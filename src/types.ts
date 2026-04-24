export interface XyphraMeta {
  name: string;
  version: string;
  description: string;
  pluginType: string;
}


export interface XyphraOptions {
  /** Log format: 'json' | 'dev' | 'combined' | 'short' | 'tiny' | string */
  format?: "json" | "dev" | "combined" | "short" | "tiny" | string;
  /** Output stream defaults to process.stdout */
  stream?: { write: (str: string) => void };
  /** Function to determine if logging should be skipped */
  skip?: (req: any, res: any) => boolean;
  /** Log request immediately instead of on response finish */
  immediate?: boolean;
  /** Array of headers to redact (e.g., ['authorization', 'cookie']) */
  redactHeaders?: string[];
  /** Anonymize IP (GDPR) */
  anonymizeIp?: boolean;
}

declare module "xypriss" {
  interface Request {
    _xyphraStartAt?: [number, number];
    _xyphraStartDate?: Date;
  }
}