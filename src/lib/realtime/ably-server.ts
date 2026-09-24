import "server-only";
import Ably from "ably";

// Not required — see README's env var table. When ABLY_API_KEY is unset,
// getAblyRest() returns null and publishToChannel() no-ops, same
// "optional until configured" contract as Upstash/Cloudinary/Google/Telegram.
let restClient: Ably.Rest | null | undefined;

export function getAblyRest(): Ably.Rest | null {
  if (restClient !== undefined) return restClient;
  const apiKey = process.env.ABLY_API_KEY;
  restClient = apiKey ? new Ably.Rest({ key: apiKey }) : null;
  return restClient;
}

/**
 * Best-effort realtime fan-out for an already-committed write. Never throws —
 * realtime is an enhancement layer on top of the DB as the source of truth
 * (clients that miss an event still see it on next fetch/navigation), so a
 * publish failure must never surface as a user-facing error.
 */
export async function publishToChannel(channel: string, eventName: string, data: unknown): Promise<void> {
  const client = getAblyRest();
  if (!client) return;
  try {
    await client.channels.get(channel).publish(eventName, data);
  } catch {
    // Swallow — see doc comment above.
  }
}
