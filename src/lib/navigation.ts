export function resolveSafeCallbackPath(
  callbackUrl: string | null | undefined,
  fallbackPath: string,
  currentOrigin = getCurrentOrigin(),
) {
  const trimmed = callbackUrl?.trim();
  if (!trimmed) {
    return fallbackPath;
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return fallbackPath;
    }

    try {
      const url = new URL(trimmed, currentOrigin);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return fallbackPath;
    }
  }

  try {
    const url = new URL(trimmed);
    if (url.origin !== currentOrigin) {
      return fallbackPath;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fallbackPath;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallbackPath;
  }
}

function getCurrentOrigin() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}
