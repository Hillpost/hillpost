/**
 * Turns a `redirect_url` query param into a path inside this app, so a user who
 * signs in from a deep link lands back on it (with its query string) instead of
 * the dashboard. Anything off-site or pointing back at the auth pages is dropped.
 */
export function internalRedirect(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let target: URL;
  try {
    target = new URL(value, "http://app.local");
  } catch {
    return undefined;
  }
  if (/^\/sign-(in|up)/.test(target.pathname)) return undefined;
  return target.pathname + target.search;
}
