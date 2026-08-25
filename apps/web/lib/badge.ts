/**
 * The numeric badge on the PWA icon.
 *
 * Every write that changes how many unread items the inbox holds ends by
 * calling this with the count the server just returned — which is why each
 * route responds with `unread`. Kept in one place so the badge cannot drift
 * apart from what the tabs show.
 *
 * `setAppBadge` only exists in the installed app; in a browser tab the guard
 * makes this a no-op.
 */
export function setBadge(count: number): void {
  if (!("setAppBadge" in navigator)) return;
  if (count > 0) void navigator.setAppBadge(count);
  else void navigator.clearAppBadge();
}
