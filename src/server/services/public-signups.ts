import { TRPCError } from "@trpc/server";

import { normalizeUsername } from "~/lib/domain";
import { getMessages, type Locale } from "~/lib/i18n";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

function normalizeSignupPhone(phone: string) {
  const compact = phone.trim().replaceAll(/\s+|\(|\)|-/g, "");
  return compact.length > 0 ? compact : phone.trim();
}

async function enforceSignupRateLimit(input: {
  action: string;
  headers: Headers;
  limit: number;
  locale: Locale;
  subject: string;
}) {
  const messages = getMessages(input.locale);
  const clientIp = extractClientIp(input.headers);
  const [bySubject, byIp] = await Promise.all([
    consumeRateLimit({
      action: input.action,
      limit: input.limit,
      subject: input.subject,
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

  if (!bySubject.allowed || (byIp && !byIp.allowed)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: messages.errors.signupTooManyRequests,
    });
  }
}

export async function enforcePublicSignupRateLimit(
  headers: Headers,
  phone: string,
  locale: Locale,
) {
  await enforceSignupRateLimit({
    action: "signup:phone",
    headers,
    limit: 2,
    locale,
    subject: normalizeSignupPhone(phone),
  });
}

export async function enforceTeacherSignupRateLimit(
  headers: Headers,
  username: string,
  locale: Locale,
) {
  await enforceSignupRateLimit({
    action: "signup:username",
    headers,
    limit: 2,
    locale,
    subject: normalizeUsername(username),
  });
}
