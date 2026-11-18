/**
 * Password reset ("Forgot password"). Pure helpers, tested in __tests__/recovery.test.ts.
 *
 * The reset email links to the web app's /reset-password screen, on phones too: the link opens
 * in the browser, the person picks a new password there, then signs in with it anywhere.
 */

/** The live web app. Supabase only redirects to allowed URLs; anything else falls back to it. */
export const LIVE_SITE = 'https://life-plan-os.vercel.app';
export const RESET_PATH = '/reset-password';
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Where the reset link should land. On the web, the site the person is using (so a local or
 * preview build gets the link back); on phones, the live site.
 */
export function resetRedirectTo(webOrigin?: string | null): string {
  const origin = webOrigin && /^https?:\/\/[^/]+$/.test(webOrigin) ? webOrigin : LIVE_SITE;
  return `${origin}${RESET_PATH}`;
}

/** What's wrong with a new password, or null if it's fine. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return 'The two passwords don’t match.';
  return null;
}
