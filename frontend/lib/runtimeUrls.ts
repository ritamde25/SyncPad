function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveApiOrigin(): string {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    return trimTrailingSlash(window.location.origin);
  }

  return "http://localhost:8080";
}

export function toApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiOrigin()}${normalizedPath}`;
}

export function resolveWebSocketUrl(): string {
  const apiOrigin = resolveApiOrigin();
  const parsedOrigin = new URL(apiOrigin);
  const wsProtocol = parsedOrigin.protocol === "https:" ? "wss:" : "ws:";

  return `${wsProtocol}//${parsedOrigin.host}`;
}