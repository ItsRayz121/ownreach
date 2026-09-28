import "server-only";

const MESSAGE_MEDIA_FOLDER_PREFIX = "ownreach/messages/";

/**
 * mediaUrl/mediaPublicId arrive from the client, and cloudinary.uploader.destroy()
 * deletes by public_id account-wide with no ownership check of its own — so
 * without this, a caller could attach someone else's asset's public_id to
 * their own message (e.g. a victim's avatar) and later trigger its
 * destruction via deleteMessageMedia or the retention cron. The upload/sign
 * route (src/app/api/upload/sign/route.ts) scopes every signed upload to
 * `ownreach/messages/${userId}/...`, so requiring both fields to reference
 * that same per-user prefix confines a sender's media claims to assets
 * Cloudinary actually let them upload — worst case they can only prematurely
 * destroy their own asset, never anyone else's.
 *
 * Checked against the URL's `pathname` (query/hash stripped) rather than the
 * raw string, so a public_id can't be smuggled into an ignored query param
 * to pass the check while the path itself points elsewhere. Also requires
 * the path's cloud segment to be *our* Cloudinary cloud_name — `res.cloudinary.com`
 * is shared, path-routed multi-tenant hosting, so the hostname alone (the
 * only thing the mediaUrl zod schema checks) doesn't prove the asset is even
 * in our account, let alone this user's folder.
 */
export function assertOwnMessageMedia(userId: string, mediaUrl: string, mediaPublicId: string): void {
  const expectedPrefix = `${MESSAGE_MEDIA_FOLDER_PREFIX}${userId}/`;
  if (!mediaPublicId.startsWith(expectedPrefix)) {
    throw new Error("Invalid media reference.");
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let pathname: string;
  try {
    pathname = new URL(mediaUrl).pathname;
  } catch {
    throw new Error("Invalid media reference.");
  }
  if (!cloudName || !pathname.startsWith(`/${cloudName}/`) || !pathname.includes(`/${mediaPublicId}.`)) {
    throw new Error("Invalid media reference.");
  }
}
