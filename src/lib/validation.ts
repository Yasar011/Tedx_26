export const NIFT_EMAIL_DOMAIN = "@nift.ac.in";

export function isNiftEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(NIFT_EMAIL_DOMAIN);
}
