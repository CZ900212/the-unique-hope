export function getDisplayErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  if ("data" in error) {
    const data = (error as { data?: { zodError?: unknown } }).data;
    if (
      data &&
      typeof data === "object" &&
      "zodError" in data &&
      data.zodError
    ) {
      return fallback;
    }
  }

  if (
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return fallback;
}
