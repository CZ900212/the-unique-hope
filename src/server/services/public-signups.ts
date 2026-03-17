import { TRPCError } from "@trpc/server";

import { getMessages, type Locale } from "~/lib/i18n";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

function normalizeSignupPhone(phone: string) {
  const compact = phone.trim().replaceAll(/\s+|\(|\)|-/g, "");
  return compact.length > 0 ? compact : phone.trim();
}

export async function enforcePublicSignupRateLimit(
  headers: Headers,
  phone: string,
  locale: Locale,
) {
  const messages = getMessages(locale);
  const clientIp = extractClientIp(headers);
  const [byPhone, byIp] = await Promise.all([
    consumeRateLimit({
      action: "signup:phone",
      limit: 2,
      subject: normalizeSignupPhone(phone),
      windowMs: 60 * 60 * 1000,
    }),
    clientIp
      ? consumeRateLimit({
          action: "signup:ip",
          limit: 5,
          subject: clientIp,
          windowMs: 60 * 60 * 1000,
        })
      : Promise.resolve(null),
  ]);

  if (!byPhone.allowed || (byIp && !byIp.allowed)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: messages.errors.signupTooManyRequests,
    });
  }
}
