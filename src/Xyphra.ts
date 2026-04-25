// ─────────────────────────────────────────────────────────────────────────────
// Xyphra – Core Logger
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction, getIp } from "xypriss";
import {
  XyphraOptions,
  XyphraPluginHooks,
  XyphraMetrics,
  LogEntry,
  LogLevel,
  LOG_LEVEL_PRIORITY,
  ColorTheme,
  TokenFunction,
} from "./types.js";

// ── ANSI Helpers ──────────────────────────────────────────────────────────────

const A = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  fg: (code: number) => `\x1b[${code}m`,
  bg: (code: number) => `\x1b[${code + 10}m`,
} as const;

/** Wrap text in an ANSI color + reset */
export function paint(text: string, ...codes: number[]): string {
  return codes.map((c) => `\x1b[${c}m`).join("") + text + A.reset;
}

function bold(text: string): string {
  return `\x1b[1m${text}${A.reset}`;
}

function dim(text: string): string {
  return `\x1b[2m${text}${A.reset}`;
}

// ── Method Colors ─────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, number[]> = {
  GET: [32], // green
  POST: [34], // blue
  PUT: [33], // yellow
  PATCH: [35], // magenta
  DELETE: [31], // red
  HEAD: [36], // cyan
  OPTIONS: [37], // white
};

// ── Default Color Theme ───────────────────────────────────────────────────────

const DEFAULT_THEME: Required<ColorTheme> = {
  method: 32,
  url: 37,
  timestamp: 90, // bright black = gray
  responseTime: 36,
  ip: 33,
  status: {
    "2xx": 32,
    "3xx": 36,
    "4xx": 33,
    "5xx": 31,
  },
};

// ── HTTP Method Badge ─────────────────────────────────────────────────────────

const METHOD_BADGE_WIDTH = 7;

function methodBadge(method: string): string {
  const colors = METHOD_COLORS[method] ?? [37];
  const padded = method.padEnd(METHOD_BADGE_WIDTH);
  return paint(bold(padded), ...colors);
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function statusBadge(
  status: number | string,
  theme: Required<ColorTheme>,
): string {
  const s = Number(status);
  let symbol = "●";
  let colorCode: number;
  let label = String(status);

  if (s >= 500) {
    colorCode = theme.status["5xx"] ?? 31;
    symbol = "✖";
  } else if (s >= 400) {
    colorCode = theme.status["4xx"] ?? 33;
    symbol = "⚠";
  } else if (s >= 300) {
    colorCode = theme.status["3xx"] ?? 36;
    symbol = "↪";
  } else if (s >= 200) {
    colorCode = theme.status["2xx"] ?? 32;
    symbol = "✔";
  } else {
    colorCode = 90;
    symbol = "?";
  }

  return paint(`${symbol} ${label}`, colorCode);
}

// ── Response Time Badge ───────────────────────────────────────────────────────

function timeBadge(ms: string): string {
  const v = parseFloat(ms);
  let color = 32; // green = fast
  if (v > 1000)
    color = 31; // red = slow
  else if (v > 300)
    color = 33; // yellow = medium
  else if (v > 100) color = 36; // cyan = ok

  const label = isNaN(v) ? "-" : `${ms}ms`;
  return paint(label.padStart(10), color);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function nowString(fmt: XyphraOptions["timestamp"] = "iso"): string {
  if (typeof fmt === "function") return fmt();
  if (fmt === "unix") return String(Date.now());
  if (fmt === "utc") return new Date().toUTCString();
  return new Date().toISOString();
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function anonymizeIp(ip: string): string {
  if (ip.includes(":")) {
    // IPv6 – zero out last 3 groups
    const parts = ip.split(":");
    return [...parts.slice(0, 5), "0", "0", "0"].join(":");
  }
  // IPv4 – zero out last octet
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  return ip;
}

function maskQueryParams(url: string, params: string[]): string {
  try {
    const idx = url.indexOf("?");
    if (idx === -1) return url;
    const base = url.slice(0, idx);
    const qs = new URLSearchParams(url.slice(idx + 1));
    for (const key of params) {
      if (qs.has(key)) qs.set(key, "***");
    }
    return `${base}?${qs.toString()}`;
  } catch {
    return url;
  }
}

// ── UUID (tiny, no dep) ───────────────────────────────────────────────────────

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// XyphraCore
// ─────────────────────────────────────────────────────────────────────────────

export class XyphraCore {
  private format: string;
  private options: XyphraOptions;
  private stream: { write: (str: string) => void };
  private theme: Required<ColorTheme>;
  private level: LogLevel;
  private customTokens: Record<string, TokenFunction>;

  // Metrics
  private _metrics: XyphraMetrics | null = null;
  private _rtSum = 0;
  private _rtCount = 0;
  private _windowStart = Date.now();
  private _windowRequests = 0;

  // Buffering
  private _buffer: string[] = [];
  private _bufferTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    format: string | XyphraOptions = "combined",
    options: XyphraOptions = {},
  ) {
    if (typeof format === "object") {
      this.options = format;
      this.format = this.options.format ?? "combined";
    } else {
      this.options = options;
      this.format = format;
    }

    this.stream = this.options.stream ?? process.stdout;
    this.level = this.options.level ?? "info";
    this.customTokens = this.options.tokens ?? {};
    this.theme = this._buildTheme(this.options.colors);

    if (this.options.metrics) {
      this._metrics = {
        totalRequests: 0,
        totalErrors: 0,
        totalBytes: 0,
        averageResponseTime: 0,
        requestsPerSecond: 0,
        statusCodes: {},
        methods: {},
        startedAt: new Date(),
      };
    }

    if (this.options.bufferInterval && this.options.bufferInterval > 0) {
      this._bufferTimer = setInterval(
        () => this._flush(),
        this.options.bufferInterval,
      );
      if (
        this._bufferTimer &&
        typeof (this._bufferTimer as any).unref === "function"
      ) {
        (this._bufferTimer as any).unref();
      }
    }
  }

  // ── Theme ──────────────────────────────────────────────────────────────────

  private _buildTheme(custom?: ColorTheme): Required<ColorTheme> {
    return {
      method: custom?.method ?? DEFAULT_THEME.method,
      url: custom?.url ?? DEFAULT_THEME.url,
      timestamp: custom?.timestamp ?? DEFAULT_THEME.timestamp,
      responseTime: custom?.responseTime ?? DEFAULT_THEME.responseTime,
      ip: custom?.ip ?? DEFAULT_THEME.ip,
      status: {
        "2xx": custom?.status?.["2xx"] ?? DEFAULT_THEME.status["2xx"]!,
        "3xx": custom?.status?.["3xx"] ?? DEFAULT_THEME.status["3xx"]!,
        "4xx": custom?.status?.["4xx"] ?? DEFAULT_THEME.status["4xx"]!,
        "5xx": custom?.status?.["5xx"] ?? DEFAULT_THEME.status["5xx"]!,
      },
    };
  }

  // ── IP ─────────────────────────────────────────────────────────────────────

  private _resolveIp(req: any): string {
    let ip: string = getIp(req) ?? req.socket?.remoteAddress ?? "unknown";
    if (this.options.anonymizeIp) ip = anonymizeIp(ip);
    return ip;
  }

  // ── Headers ────────────────────────────────────────────────────────────────

  private _header(req: any, name: string): string {
    const key = name.toLowerCase();
    const val = req.headers?.[key];
    if (!val) return "-";
    if (this.options.redactHeaders?.includes(key)) return "[REDACTED]";
    return Array.isArray(val) ? val.join(", ") : String(val);
  }


  // ── URL Sanitize ───────────────────────────────────────────────────────────

  private _sanitizeUrl(req: any): string {
    let url: string = req.originalUrl ?? req.url ?? "/";
    if (this.options.maskQueryParams?.length) {
      url = maskQueryParams(url, this.options.maskQueryParams);
    }
    if (this.options.maxUrlLength) {
      url = truncate(url, this.options.maxUrlLength);
    }
    return url;
  }

  // ── Response Time ──────────────────────────────────────────────────────────

  private _responseTime(req: any): string {
    const start = req._xyphraStartAt;
    if (!start) return "-";
    const diff = process.hrtime(start);
    return (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);
  }

  // ── Metrics Update ─────────────────────────────────────────────────────────

  private _updateMetrics(
    method: string,
    status: number | string,
    bytes: number | string,
    rt: string,
  ): void {
    if (!this._metrics) return;
    const m = this._metrics;
    const s = Number(status);
    const b = Number(bytes) || 0;
    const t = parseFloat(rt) || 0;

    m.totalRequests++;
    m.totalBytes += b;
    m.statusCodes[s] = (m.statusCodes[s] ?? 0) + 1;
    m.methods[method] = (m.methods[method] ?? 0) + 1;
    if (s >= 400) m.totalErrors++;

    this._rtSum += t;
    this._rtCount++;
    m.averageResponseTime = this._rtSum / this._rtCount;

    this._windowRequests++;
    const elapsed = (Date.now() - this._windowStart) / 1000;
    if (elapsed >= 1) {
      m.requestsPerSecond = this._windowRequests / elapsed;
      this._windowStart = Date.now();
      this._windowRequests = 0;
    }
  }

  // ── Build Entry ────────────────────────────────────────────────────────────

  private _buildEntry(req: Request, res: Response): LogEntry {
    const rt = this._responseTime(req);
    const status: number | string = res.statusCode ?? "-";
    const cl = res.getHeader?.("content-length") ?? "-";

    return {
      timestamp: nowString(this.options.timestamp),
      level:
        Number(status) >= 500
          ? "error"
          : Number(status) >= 400
            ? "warn"
            : "info",
      ip: this._resolveIp(req),
      method: req.method ?? "-",
      url: this._sanitizeUrl(req),
      status,
      contentLength: typeof cl === "object" && Array.isArray(cl) ? cl[0] : cl,
      responseTime: rt,
      httpVersion: req.httpVersion ?? "1.1",
      referrer: this._header(req, "referer"),
      userAgent: this._header(req, "user-agent"),
      requestId: req._xyphraReqId,
    };
  }


  // ── Format: pretty ────────────────────────────────────────────────────────

  private _formatPretty(e: LogEntry): string {
    const ts = paint(e.timestamp, this.theme.timestamp);
    const meth = methodBadge(e.method);
    const url = paint(e.url, this.theme.url);
    const stat = statusBadge(e.status, this.theme);
    const rt = timeBadge(e.responseTime);
    const ip = dim(paint(e.ip, this.theme.ip));
    const id = e.requestId ? dim(` #${e.requestId}`) : "";

    return (
      `${dim("┃")} ${ts} ${dim("│")} ${meth} ${url}\n` +
      `${dim("┃")}            ${dim("│")} ${stat} ${rt} ${ip}${id}`
    );
  }

  // ── Format: dev ───────────────────────────────────────────────────────────

  private _formatDev(e: LogEntry): string {
    const meth = methodBadge(e.method);
    const url = paint(e.url, this.theme.url);
    const stat = statusBadge(e.status, this.theme);
    const rt = timeBadge(e.responseTime);
    const cl = dim(`${e.contentLength}b`);
    return `  ${meth} ${url} ${stat} ${rt} ${cl}`;
  }

  // ── Format: short ─────────────────────────────────────────────────────────

  private _formatShort(e: LogEntry): string {
    const stat = statusBadge(e.status, this.theme);
    const rt = timeBadge(e.responseTime);
    return `${paint(e.method, this.theme.method)} ${e.url} ${stat} ${rt}`;
  }

  // ── Format: tiny ──────────────────────────────────────────────────────────

  private _formatTiny(e: LogEntry): string {
    return `${paint(e.method, this.theme.method)} ${e.url} ${statusBadge(e.status, this.theme)} - ${timeBadge(e.responseTime)}`;
  }

  // ── Format: combined ─────────────────────────────────────────────────────

  private _formatCombined(e: LogEntry): string {
    const ts = paint(e.timestamp, this.theme.timestamp);
    return (
      `${paint(e.ip, this.theme.ip)} - - [${ts}] ` +
      `"${bold(e.method)} ${e.url} HTTP/${e.httpVersion}" ` +
      `${statusBadge(e.status, this.theme)} ${e.contentLength} ` +
      `"${dim(e.referrer)}" "${dim(e.userAgent)}"`
    );
  }

  // ── Format: json ─────────────────────────────────────────────────────────

  private _formatJson(e: LogEntry): string {
    return JSON.stringify(e);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private _render(e: LogEntry): string {
    switch (this.format) {
      case "pretty":
        return this._formatPretty(e);
      case "dev":
        return this._formatDev(e);
      case "short":
        return this._formatShort(e);
      case "tiny":
        return this._formatTiny(e);
      case "json":
        return this._formatJson(e);
      case "combined":
      default:
        return this._formatCombined(e);
    }
  }

  // ── Log ───────────────────────────────────────────────────────────────────

  private async _log(req: Request, res: Response): Promise<void> {
    // skip check
    if (this.options.skip) {
      const shouldSkip = await this.options.skip(req, res);
      if (shouldSkip) return;
    }

    const entry = this._buildEntry(req, res);

    // level filter
    if (
      LOG_LEVEL_PRIORITY[entry.level as LogLevel] <
      LOG_LEVEL_PRIORITY[this.level]
    )
      return;

    // update metrics
    this._updateMetrics(
      entry.method,
      entry.status,
      entry.contentLength,
      entry.responseTime,
    );

    const line = this._render(entry) + "\n";

    if (this._bufferTimer) {
      this._buffer.push(line);
    } else {
      this.stream.write(line);
    }

    this.options.onLog?.(entry);
  }

  // ── Flush Buffer ──────────────────────────────────────────────────────────

  private _flush(): void {
    if (!this._buffer.length) return;
    this.stream.write(this._buffer.join(""));
    this._buffer = [];
  }

  // ── Public: Metrics ───────────────────────────────────────────────────────

  /** Returns a snapshot of current metrics (null if metrics not enabled) */
  public getMetrics(): Readonly<XyphraMetrics> | null {
    if (!this._metrics) return null;
    return { ...this._metrics };
  }

  /** Reset all metrics counters */
  public resetMetrics(): void {
    if (!this._metrics) return;
    this._metrics = {
      totalRequests: 0,
      totalErrors: 0,
      totalBytes: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0,
      statusCodes: {},
      methods: {},
      startedAt: new Date(),
    };
    this._rtSum = 0;
    this._rtCount = 0;
  }

  /** Print a pretty metrics summary to the stream */
  public printMetricsSummary(): void {
    const m = this._metrics;
    if (!m) return;

    const sep = paint("─".repeat(42), 90);
    const head = bold(paint("  Xyphra Metrics", 36));
    const up = dim(
      `Uptime: ${Math.round((Date.now() - m.startedAt.getTime()) / 1000)}s`,
    );

    const lines = [
      "",
      `${sep}`,
      `${head}  ${up}`,
      `${sep}`,
      `  ${paint("Requests", 37)}   ${bold(String(m.totalRequests))}`,
      `  ${paint("Errors", 31)}   ${bold(String(m.totalErrors))}`,
      `  ${paint("Avg RT", 36)}   ${bold(m.averageResponseTime.toFixed(2))}ms`,
      `  ${paint("RPS", 33)}   ${bold(m.requestsPerSecond.toFixed(2))}`,
      `  ${paint("Bytes", 32)}   ${bold((m.totalBytes / 1024).toFixed(1))}KB`,
      `${sep}`,
      `  ${paint("Methods:", 37)}   ${Object.entries(m.methods)
        .map(([k, v]) => `${methodBadge(k)}${paint("×" + v, 90)}`)
        .join("  ")}`,
      `${sep}`,
      "",
    ];

    this.stream.write(lines.join("\n"));
  }

  // ── Public: Token Registration ────────────────────────────────────────────

  /** Register a custom token */
  public token(name: string, fn: TokenFunction): this {
    this.customTokens[name] = fn;
    return this;
  }

  // ── Public: Request ID Middleware ─────────────────────────────────────────

  /** Express middleware that attaches a short request ID to every request */
  public requestId() {
    return (req: any, _res: any, next: () => void) => {
      req._xyphraReqId = shortId();
      next();
    };
  }

  // ── Public: Health Check Skipper ──────────────────────────────────────────

  /** Returns a skip function that silences logs for given paths */
  public static skipPaths(...paths: string[]): XyphraOptions["skip"] {
    const set = new Set(paths);
    return (req: any) => set.has(req.url) || set.has(req.originalUrl);
  }

  // ── Public: Middleware ────────────────────────────────────────────────────

  public middleware() {
    return (req: Request, res: Response, next: () => void) => {
      req._xyphraStartAt = process.hrtime();
      req._xyphraStartDate = new Date();
      if (!req._xyphraReqId) req._xyphraReqId = shortId();

      if (this.options.immediate) {
        this._log(req, res).catch(() => {});
      } else {
        res.on("finish", () => this._log(req, res).catch(() => {}));
      }
      next();
    };
  }

  // ── Public: Plugin Hooks ──────────────────────────────────────────────────

  public getPluginHooks(): XyphraPluginHooks {
    return {
      onRequest: (req: Request, res: Response, next: NextFunction) => {
        req._xyphraStartAt = process.hrtime();
        req._xyphraStartDate = new Date();
        if (!req._xyphraReqId) req._xyphraReqId = shortId();
        if (this.options.immediate) this._log(req, res).catch(() => {});
        next();
      },
      onResponse: (req: Request, res: Response) => {
        if (!this.options.immediate) this._log(req, res).catch(() => {});
      },
    };
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /** Flush buffer and stop timers (call on server shutdown) */
  public destroy(): void {
    if (this._bufferTimer) {
      clearInterval(this._bufferTimer);
      this._bufferTimer = null;
    }
    this._flush();
  }
}
