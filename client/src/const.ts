export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getDevLoginUrl = (role: "user" | "admin" = "user") =>
  `/api/dev-login?role=${role}`;

export const getAuthRedirectUrl = () => getDevLoginUrl("user");
