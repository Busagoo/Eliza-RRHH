import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Universal environment variable accessor that works across:
 * 1. Standard Node.js / Next.js local dev (`process.env`)
 * 2. Cloudflare Workers via OpenNext (`getCloudflareContext().env`)
 * 3. Cloudflare Workers `process.env` with `nodejs_compat_populate_process_env`
 */
export function getEnv(key: string): string | undefined {
  // 1. Check process.env first
  const val = process.env[key];
  if (val !== undefined && val !== "") {
    return val;
  }

  // 2. Fallback to Cloudflare Worker runtime bindings / secrets
  try {
    const ctx = getCloudflareContext();
    if (ctx?.env) {
      const bindingVal = (ctx.env as Record<string, any>)[key];
      if (typeof bindingVal === "string" && bindingVal.length > 0) {
        return bindingVal;
      }
    }
  } catch {
    // Outside request context or not running on Cloudflare
  }

  return undefined;
}
