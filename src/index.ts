// ─────────────────────────────────────────────────────────────────────────────
// Xyphra – Entry Point
// ─────────────────────────────────────────────────────────────────────────────

import { XyphraMeta, XyphraOptions } from "./types.js";
import { XyphraCore } from "./Xyphra.js";
import { Plugin, Request, Response, NextFunction } from "xypriss";

// ── XyPriss G3 Plugin ─────────────────────────────────────────────────────────

/**
 * Official way to use Xyphra in XyPriss G3.
 */
export function XyphraPlugin(options: XyphraOptions = {}) {
  const core = new XyphraCore(options);
  const coreHooks = core.getPluginHooks();
  const meta = Plugin.manifest<XyphraMeta>(__sys__);

  const plugin = Plugin.create(
    {
      name: meta.name,
      version: meta.version,
      description: meta.description || "Xyphra Logger Plugin",
      type: meta.pluginType,
      globalMiddleware: true,

      // Lifecycle Hooks Verification
      onRequest(req: Request, res: Response, next: NextFunction) {
        try {
          return coreHooks.onRequest(req, res, next);
        } catch (e: any) {
          // console.error(`[XYPHRA-HOOK] error whi ERROR: ${e.message}`);
          next();
        }
      },

      onResponse(req: Request, res: Response) {
        try {
          return coreHooks.onResponse(req, res);
        } catch (e: any) {
          // console.error(`[XYPHRA-HOOK] onResponse ERROR: ${e.message}`);
        }
      },

      onServerStart(server: any) {
        server.app.use(core.middleware());
        server.app.use(new XyphraCore(options).requestId());
      },


      onResponseTime(rt: number, req: Request, res: Response) {
        return coreHooks.onResponseTime(rt, req, res);
      },
    } as any,
    (globalThis as any).__sys__.__root__,
  );

  // Inspect the plugin to identify required permissions for package.json
  // Plugin.inspect(plugin);

  return plugin;
}

// ── Direct Middleware ───────────────────────────────────────────────

/**
 * Bare middleware factory
 */
export function XyphraMiddleware(
  format: string | XyphraOptions = "combined",
  options: XyphraOptions = {},
) {
  const core = new XyphraCore(format, options);
  return core.middleware();
}

// ── Skip Helpers ──────────────────────────────────────────────────────────────

export const { skipPaths } = XyphraCore;
export { paint } from "./Xyphra.js";

// ── Default Export (Hybrid) ───────────────────────────────────────────────────

const Xyphra = XyphraMiddleware;
export default Xyphra;
