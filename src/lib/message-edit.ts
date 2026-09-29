/** How long after sending an author can still edit a direct or group message. Broadcast-channel admins are exempt. */
export const MESSAGE_EDIT_WINDOW_MS = 30 * 60 * 1000;

export function isWithinEditWindow(createdAt: Date, now: number = Date.now()): boolean {
  return now - createdAt.getTime() <= MESSAGE_EDIT_WINDOW_MS;
}

export const EDIT_WINDOW_EXPIRED_MESSAGE = "Messages can only be edited within 30 minutes of sending.";
