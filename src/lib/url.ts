export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeRedirectUrl(url: string): boolean {
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith("/") && !trimmedUrl.startsWith("//")) {
    return trimmedUrl !== "/";
  }

  return isSafeHttpUrl(trimmedUrl);
}
