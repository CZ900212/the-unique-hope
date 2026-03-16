import { type Role } from "~/lib/domain";

export function getLoginRateLimitPolicy(role: Role) {
  if (role === "admin") {
    return {
      identifierLimit: 3,
      ipLimit: 5,
    };
  }

  return {
    identifierLimit: 5,
    ipLimit: 10,
  };
}
