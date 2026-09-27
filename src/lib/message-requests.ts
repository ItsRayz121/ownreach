/** How many messages an unaccepted request's initiator may send before being blocked. Shared between server actions and client UI, so it can't live in a `server-only` module. */
export const MESSAGE_REQUEST_CAP = 3;
