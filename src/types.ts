// ─────────────────────────────────────────────────────────────────────────────
// Xyphra – Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

import { NextFunction, XyPrisRequest, XyPrisResponse } from "xypriss";

export interface XyphraMeta {
  name: string;
  version: string;
  description: string;
  pluginType: string;
}

// ── Log Formats ───────────────────────────────────────────────────────────────

export type LogFormat =
  | "json"
  | "dev"
  | "combined"
  | "short"
  | "tiny"
  | "pretty"
  | (string & {});

// ── Log Levels ────────────────────────────────────────────────────────────────

export type LogLevel =
  | "silent"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "verbose";

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  verbose: 5,
};

// ── Token Definitions ─────────────────────────────────────────────────────────

export type TokenName =
  | "method"
  | "url"
  | "status"
  | "response-time"
  | "date"
  | "http-version"
  | "remote-addr"
  | "referrer"
  | "user-agent"
  | "res[content-length]"
  | "req[header]"
  | "res[header]";

export type TokenFunction = (
  req: XyPrisRequest,
  res: XyPrisResponse,
  arg?: string,
) => string;

// ── Rotation Options ──────────────────────────────────────────────────────────

export interface RotationOptions {
  /** Max size in bytes before rotating (e.g. 10 * 1024 * 1024 for 10MB) */
  maxSize?: number;
  /** Max age in milliseconds (e.g. 24 * 60 * 60 * 1000 for 24h) */
  maxAge?: number;
  /** Number of rotated files to keep */
  maxFiles?: number;
  /** Base filename (e.g. 'logs/access.log') */
  filename?: string;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface XyphraMetrics {
  totalRequests: number;
  totalErrors: number;
  totalBytes: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  statusCodes: Record<number, number>;
  methods: Record<string, number>;
  startedAt: Date;
}

// ── Sanitize Options ──────────────────────────────────────────────────────────

export interface SanitizeOptions {
  /** Headers to fully redact */
  redactHeaders?: string[];
  /** Query params to mask (e.g. ['token', 'apikey']) */
  maskQueryParams?: string[];
  /** Anonymize IP address (GDPR) */
  anonymizeIp?: boolean;
  /** Truncate long URLs to this length */
  maxUrlLength?: number;
}

// ── Color Theme ───────────────────────────────────────────────────────────────

export interface ColorTheme {
  /** ANSI code for method color */
  method?: number;
  /** ANSI code for URL color */
  url?: number;
  /** Custom status code color overrides */
  status?: Partial<Record<"2xx" | "3xx" | "4xx" | "5xx", number>>;
  /** ANSI code for timestamp color */
  timestamp?: number;
  /** ANSI code for response time color */
  responseTime?: number;
  /** ANSI code for IP address color */
  ip?: number;
}

// ── Main Options ──────────────────────────────────────────────────────────────

export interface XyphraOptions extends SanitizeOptions {
  /** Log format preset or custom format string */
  format?: LogFormat;
  /** Output stream, defaults to process.stdout */
  stream?: NodeJS.WritableStream | { write: (str: string) => void };
  /** Skip logging for certain requests */
  skip?: (
    req: XyPrisRequest,
    res: XyPrisResponse,
  ) => boolean | Promise<boolean>;
  /** Log immediately on request instead of on response finish */
  immediate?: boolean;
  /** Minimum log level */
  level?: LogLevel;
  /** Enable internal metrics collection */
  metrics?: boolean;
  /** Custom color theme for pretty/dev formats */
  colors?: ColorTheme;
  /** Log rotation config */
  rotation?: RotationOptions;
  /** Custom token definitions */
  tokens?: Record<string, TokenFunction>;
  /** Timestamp format: 'iso' | 'utc' | 'unix' | custom fn */
  timestamp?: "iso" | "utc" | "unix" | (() => string);
  /** Buffer logs and flush every N ms (0 = no buffering) */
  bufferInterval?: number;
  /** Callback invoked after each log entry */
  onLog?: (entry: LogEntry) => void;
}

// ── Log Entry ─────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  ip: string;
  method: string;
  url: string;
  status: number | string;
  contentLength: number | string;
  responseTime: string;
  httpVersion: string;
  referrer: string;
  userAgent: string;
  [key: string]: unknown;
}

// ── Plugin Types ──────────────────────────────────────────────────────────────

export interface XyphraPluginHooks {
  onRequest: (
    req: XyPrisRequest,
    res: XyPrisResponse,
    next: NextFunction,
  ) => void;
  onResponse: (req: XyPrisRequest, res: XyPrisResponse) => void;
  onResponseTime: (
    responseTime: number,
    req: XyPrisRequest,
    res: XyPrisResponse,
  ) => void;
}

// ── Module Augmentation ───────────────────────────────────────────────────────

declare module "xypriss" {
  interface Request {
    _xyphraStartAt?: [number, number];
    _xyphraStartDate?: Date;
    _xyphraReqId?: string;
    _xyphraLogged?: boolean;
  }
}
