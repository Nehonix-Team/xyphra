# Xyphra

**Xyphra** is the official, native replacement for `morgan` in the XyPriss G3 ecosystem. Designed for ultra-high performance and Zero-Trust security, it offers features that standard JS loggers lack, such as native JSON support, automatic security redaction, and GDPR-compliant IP anonymization.

## Features

- **Blazing Fast**: Native TypeScript implementation with zero overhead.
- **Security-First**: Redact sensitive headers (Authorized, Cookies, etc.) automatically.
- **GDPR Compliant**: One-click IP anonymization.
- **Hybrid Architecture**: Use it as a XyPriss Plugin (Lifecycle integrated) or as a standard middleware.
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
          "PLG.HTTP.ON_REQUEST",
          "PLG.HTTP.ON_RESPONSE",
          "PLG.SECURITY.ACCESS_SENSITIVE_DATA",
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
