import { loginBanner } from "@/lib/settings";

/**
 * The notice an admin can post above the sign-in form.
 *
 * Rendered on every page someone can reach without an account, not just
 * /login — a person following a stale link to the reset page is exactly the
 * person a "we're moving to a new address on Friday" notice is written for.
 *
 * The message is rendered as text, never as markup: it is stored by an admin
 * but displayed to everyone including people who never sign in, and there is
 * no version of this feature that needs to accept HTML.
 */
export default function LoginBanner() {
  const banner = loginBanner();
  if (!banner.on || !banner.message.trim()) return null;

  return <div className={`login-banner login-banner-${banner.tone}`}>{banner.message}</div>;
}
