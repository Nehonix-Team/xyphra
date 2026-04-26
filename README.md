# Xyphra

**Xyphra** is the official, native replacement for `morgan` in the XyPriss G3 ecosystem. Designed for ultra-high performance and Zero-Trust security, it offers features that standard JS loggers lack, such as native JSON support, automatic security redaction, and GDPR-compliant IP anonymization.

## Features

- **Blazing Fast**: Native TypeScript implementation with zero overhead.
- **Security-First**: Redact sensitive headers (Authorized, Cookies, etc.) automatically.
- **GDPR Compliant**: One-click IP anonymization.
- **Hybrid Architecture**: Use it as a XyPriss Plugin (Lifecycle integrated) or as a standard middleware.

## Security & Required Permissions (XHS G3)

Xyphra operates under a strict Zero-Trust model. To ensure full visibility and accurate telemetry, you **must** grant the following permissions in your `xypriss.config.jsonc`:

- `XHS.PERM.SECURITY.SENSITIVE_DATA`: **Critical.** Grants access to request headers (`User-Agent`, `Referer`). Note: Standard headers like `Host` and `Content-Type` are visible by default through selective masking, but full identification requires this permission.
- `XHS.PERM.HTTP.GLOBAL_MIDDLEWARE`: Required to hook into the global request/response stream via `server.app.use()`.
- `XHS.HOOK.HTTP.ON_RESPONSE`: Required for lifecycle-integrated logging (triggered at the end of every response).
- **Strictly Typed**: Full TypeScript support with detailed request timing.

## Developer Identity (G3 Security)

> [!IMPORTANT]
> **Developer ID:** `ed25519:a58b17a3e46302dd3ae5538bc9b8b991c57f4c5fe2e7d8ac41803de818d947f4`
> This plugin is cryptographically signed. Always verify the signature during installation.

## Installation

```bash
xfpm install xyphra
```

## Quick Start

### 1. Register as a Plugin (Recommended)

In your `xypriss.config.jsonc`, grant the necessary permissions:

```jsonc
{
  "$internal": {
    "xyphra": {
      "permissions": {
        "allowedHooks": [
          "XHS.HOOK.HTTP.REQUEST",
          "XHS.HOOK.HTTP.RESPONSE",
          "XHS.PERM.SECURITY.SENSITIVE_DATA",
        ],
        "policy": "allow",
      },
    },
  },
}
```

Then in your server code:

```typescript
import { xyphraPlugin } from "xyphra";

server.register(
  xyphraPlugin({
    format: "json",
    anonymizeIp: true,
    redactHeaders: ["authorization", "cookie"],
  }),
);
```

### 2. Use as Middleware (Compat Mode)

```typescript
import { xyphraMiddleware } from "xyphra";

server.use(xyphraMiddleware("dev"));
```

## Configuration

| Option          | Type       | Description                                     |
| :-------------- | :--------- | :---------------------------------------------- |
| `format`        | `string`   | 'json', 'dev', 'combined', 'short', 'tiny'      |
| `stream`        | `Stream`   | Output target (default: `stdout`)               |
| `anonymizeIp`   | `boolean`  | Mask the last octet of IP addresses             |
| `redactHeaders` | `string[]` | List of headers to mask as `[REDACTED]`         |
| `immediate`     | `boolean`  | Log on request start instead of response finish |

## License

MIT © Nehonix-Team
