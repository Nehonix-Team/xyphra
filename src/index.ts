import { XyphraMeta, XyphraOptions } from "./types.js";
import { XyphraCore } from "./Xyphra.js";
import { Plugin } from "xypriss";

/**
 * Xyphra Plugin Factory
 * Official way to use Xyphra in XyPriss G3.
 */
export function xyphraPlugin(options: XyphraOptions = {}) {
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

/**
 * Xyphra Middleware Factory
 * Used for backward compatibility or direct Express integration.
 */
export function xyphraMiddleware(
  format: string | XyphraOptions = "combined",
  options: XyphraOptions = {},
) {
  const core = new XyphraCore(format, options);
  return core.middleware();
}

/**
 * Default export (Hybrid)
 */
const xyphra = xyphraMiddleware;
export default xyphra;
export { XyphraOptions, XyphraCore };
