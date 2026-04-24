import { Plugin, Request, Response, NextFunction, getIp } from "xypriss";
import { XyphraOptions } from "./types.js";

export class XyphraCore {
  private format: string;
  private options: XyphraOptions;
  private stream: { write: (str: string) => void };

  constructor(
    format: string | XyphraOptions = "combined",
    options: XyphraOptions = {},
  ) {
    if (typeof format === "object") {
      this.options = format;
      this.format = this.options.format || "combined";
    } else {
      this.options = options;
      this.format = format;
    }
    this.stream = this.options.stream || process.stdout;
  }

  private getIp(req: any): string {
    const ip = getIp(req);
    return ip;
  }

  private getHeaderOrRedacted(req: any, headerName: string): string {
    const val = req.headers[headerName.toLowerCase()];
    if (!val) return "-";
    if (this.options.redactHeaders?.includes(headerName.toLowerCase())) {
      return "[REDACTED]";
    }
    return Array.isArray(val) ? val.join(", ") : val;
  }

  private log(req: any, res: any) {
    if (this.options.skip && this.options.skip(req, res)) return;

    const start = req._xyphraStartAt;
    let responseTime = "-";
    if (start) {
      const diff = process.hrtime(start);
      responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);
    }

    const status = res.statusCode || "-";
    const contentLength = res.getHeader
      ? res.getHeader("content-length") || "-"
      : "-";
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = this.getIp(req);
    const date = req._xyphraStartDate
      ? req._xyphraStartDate.toUTCString()
      : new Date().toUTCString();

    if (this.format === "json") {
      this.stream.write(
        JSON.stringify({
          time: new Date().toISOString(),
          ip,
          method,
          url,
          status,
          contentLength,
          responseTime: `${responseTime}ms`,
          userAgent: this.getHeaderOrRedacted(req, "user-agent"),
        }) + "\n",
      );
      return;
    }

    let output = "";
    if (this.format === "dev") {
      const color =
        status >= 500
          ? 31
          : status >= 400
            ? 33
            : status >= 300
              ? 36
              : status >= 200
                ? 32
                : 0;
      output = `\x1b[0m${method} ${url} \x1b[${color}m${status}\x1b[0m ${responseTime}ms - ${contentLength}\x1b[0m`;
    } else {
      // Default Combined
      const ref = this.getHeaderOrRedacted(req, "referer");
      const ua = this.getHeaderOrRedacted(req, "user-agent");
      output = `${ip} - - [${date}] "${method} ${url} HTTP/${req.httpVersion}" ${status} ${contentLength} "${ref}" "${ua}"`;
    }

    this.stream.write(output + "\n");
  }

  /**
   * Middleware
   */
  public middleware() {
    return (req: any, res: any, next: NextFunction) => {
      req._xyphraStartAt = process.hrtime();
      req._xyphraStartDate = new Date();

      if (this.options.immediate) {
        this.log(req, res);
      } else {
        res.on("finish", () => this.log(req, res));
      }
      next();
    };
  }

  /**
   * XyPriss Plugin Hooks
   */
  public getPluginHooks() {
    return {
      onRequest: (req: Request, res: Response, next: NextFunction) => {
        req._xyphraStartAt = process.hrtime();
        req._xyphraStartDate = new Date();
        if (this.options.immediate) this.log(req, res);
        next();
      },
      onResponse: (req: Request, res: Response) => {
        if (!this.options.immediate) this.log(req, res);
      },
    };
  }
}
