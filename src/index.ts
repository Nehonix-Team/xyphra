// ─────────────────────────────────────────────────────────────────────────────
// Xyphra – Entry Point
// ─────────────────────────────────────────────────────────────────────────────

import { XyphraMeta, XyphraOptions } from "./types.js";
import { XyphraCore } from "./Xyphra.js";
import { Plugin } from "xypriss";

// ── XyPriss G3 Plugin ─────────────────────────────────────────────────────────

/**
 * Official way to use Xyphra in XyPriss G3.
 *
 * @example
 * ```ts
 * app.use(XyphraPlugin({ format: "pretty", metrics: true }));
 * ```
 */
export function XyphraPlugin(options: XyphraOptions = {}) {
  const core = new XyphraCore(options);
  const hooks = core.getPluginHooks();
  const meta = Plugin.manifest<XyphraMeta>(__sys__);

  return Plugin.create(
    {
      name: meta.name,
      version: meta.version,
      description: meta.description,
      type: meta.pluginType,
      onRequest: hooks.onRequest,
      onResponse: hooks.onResponse,
      onServerStart(server) {
        server.app.use(core.middleware());
      },
    },
    (globalThis as any).__sys__.__root__,
  );
}

// ── Direct Middleware ───────────────────────────────────────────────

/**
 * Bare middleware factory
 *
 * @example
 * ```ts
 * app.use(xyphraMiddleware("dev"));
 * app.use(xyphraMiddleware({ format: "json", anonymizeIp: true }));
 * ```
 */
export function xyphraMiddleware(
  format: string | XyphraOptions = "combined",
  options: XyphraOptions = {},
) {
  const core = new XyphraCore(format, options);
  return core.middleware();
}

// ── Request-ID Middleware ─────────────────────────────────────────────────────

/**
 * Standalone middleware that attaches a short unique ID (`req._xyphraReqId`)
 * to every request. Call BEFORE `xyphraMiddleware` if you want IDs in logs.
 *
 * @example
 * ```ts
 * app.use(xyphraRequestId());
 * app.use(xyphraMiddleware("pretty"));
 * ```
 */
export function xyphraRequestId(options: XyphraOptions = {}) {
  return new XyphraCore(options).requestId();
}

// ── Skip Helpers ──────────────────────────────────────────────────────────────

/**
 * Pre-built skip function that silences logging for the given URL paths.
 * Useful for health-check endpoints that would pollute logs.
 *
 * @example
 * ```ts
 * xyphraMiddleware({ skip: Xyphra.skipPaths("/health", "/ping") })
 * ```
 */
export const { skipPaths } = XyphraCore;
export { paint } from "./Xyphra.js";

// ── Default Export (Hybrid) ───────────────────────────────────────────────────

const xyphra = xyphraMiddleware;
export default xyphra;
