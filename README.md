# OwnReach

**Own your reach. Keep your community.**

A creator-first social network — profiles, follows, a feed, DMs, and channels
later — built so creators aren't entirely dependent on a platform they don't
own. This repo spans **Phase 1 (foundation + core social loop)** and
**Phase 2 (formatting UX, DMs, notifications, realtime, analytics,
moderation)**. See [What's built / what's next](#whats-built--whats-next)
below for scope. Images only for now — no video.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript (strict)
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives) + Lucide icons
- **Drizzle ORM** + **Neon Postgres** (`neon-serverless` driver — the `neon-http`
  driver doesn't support `db.transaction()`, which account linking and post
  creation both rely on)
- **Auth**: hand-rolled, database-backed sessions (not NextAuth/Auth.js — see
  below) with three sign-in methods: Google OAuth, Telegram Login, and
  Sign-In with Ethereum (SIWE / EIP-4361) for wallets
- **Cloudinary** for image uploads (signed, direct-from-browser)
- PWA manifest + dynamically generated icons (`next/og`), mobile-first layout
  with a bottom tab bar on mobile and a sidebar on desktop

### Why not NextAuth/Auth.js?

Two of the three providers (Telegram, wallet/SIWE) need custom verification
logic no matter what, so the usual benefit of a provider-abstraction library
is smaller here. Given Next.js 16 is very new, we went with the
database-session pattern from Next's own [authentication
guide](https://nextjs.org/docs/app/guides/authentication) instead of betting
on a beta package's compatibility. The `sessions` / `auth_accounts` tables
are exactly what that guide describes.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum
npm run db:push              # applies the Drizzle schema to your database
npm run dev
```

Open http://localhost:3000. The landing page, login screen, explore, and
error/empty states all work with zero configuration. **Nothing will actually
authenticate** until you fill in the relevant env vars (see below) — that's
expected, not a bug.

### Environment variables

See `.env.example` for the full list with comments. Summary:

| Var | Required for | Where to get it |
|---|---|---|
| `DATABASE_URL` | Everything (the app won't boot without it) | [Neon console](https://console.neon.tech) → Connection Details |
| `AUTH_SECRET` | Nothing yet (reserved) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" | Google Cloud Console → APIs & Services → Credentials. Redirect URI: `{APP_URL}/api/auth/google/callback` |
| `TELEGRAM_BOT_TOKEN` / `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Telegram login | [@BotFather](https://t.me/BotFather), then `/setdomain` to your app's domain |
| `NEXT_PUBLIC_APP_URL` | OAuth redirects, SIWE domain check | Your app's public URL, no trailing slash |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Avatar/cover/post image uploads | [Cloudinary console](https://console.cloudinary.com), free tier |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting writes and login attempts | [Upstash console](https://console.upstash.com), free tier — without these, requests simply aren't throttled |
| `ABLY_API_KEY` | Live delivery for DMs and notifications | [Ably dashboard](https://ably.com/accounts), free tier — without this, messages/notifications still work via refetch, just not instantly |

Wallet sign-in (SIWE) needs no server credentials — it only needs a browser
wallet extension (MetaMask, etc.) on the visitor's side.

None of these are billed unless you exceed each service's free tier. See
`FREE_TIER_LIMITS` notes inline where relevant; nothing here silently
provisions a paid service.

## What's built / what's next

**Phase 1 — foundation + core social loop:** Google / Telegram / Wallet auth
with account linking, profiles (with avatar/cover upload), follow/unfollow, a
home feed (For You / Following) with cursor pagination, text+image posts,
likes, comments, bookmarks, hashtag/mention linking, search (users + posts),
settings (profile + connected accounts), PWA manifest, dark/light themes,
empty/error/loading/404 states, SEO (robots.txt, sitemap.xml, OpenGraph).

**Phase 2 — formatting UX + the deferred roadmap:**
- Rich text: bold/italic/underline/strikethrough/code/links, a
  Telegram/Medium-style floating selection toolbar, and a "magic pencil"
  that offers to restore formatting lost from a paste (Unicode "fancy text"
  or HTML clipboard content from another platform).
- Rate limiting on writes and login attempts (Upstash Redis).
- In-app notifications (follow/like/comment/mention) with a live unread badge.
- 1:1 direct messages, with realtime delivery.
- Realtime (Ably) for DMs and notifications — optional; both work via normal
  refetch without it, just not instantly.
- Creator analytics (follower growth, top posts, engagement totals) and a
  followers CSV export, under Settings → Analytics.
- Admin dashboard (`/admin`, gated on the `admin` role) with a
  user-reporting flow, an open-reports queue, and user suspend/reinstate.

**Deliberately not built yet:** channels, groups, video. Multi-participant
conversations aren't modeled yet (DMs are 1:1 only) — the schema anticipates
groups later but doesn't implement them.

## Database

```bash
npm run db:push     # push schema changes to your database (dev)
npm run db:studio   # browse data in Drizzle Studio
```

Schema lives in `src/db/schema/*.ts`. `drizzle-kit push` is fine for this
phase; switch to migration files (`drizzle-kit generate` + a migrate step)
before this has real production data you can't blow away.

## Security notes

- Wallet auth only ever requests a **message signature** (SIWE) — never a
  private key or seed phrase.
- Telegram auth only verifies the Login Widget's HMAC signature — it does
  **not** grant access to the user's Telegram contacts or chats.
- Passwords are never requested for any provider.
- Session tokens are stored as SHA-256 hashes in the database; the raw
  token only ever lives in an `httpOnly`, `Secure` (in production),
  `SameSite=Lax` cookie.
- `proxy.ts` does an optimistic (cookie-presence-only) redirect for its
  protected route prefixes (`/home`, `/settings`, `/bookmarks`,
  `/notifications`, `/messages`, `/admin`); every actual data read/write
  re-verifies the session server-side (`verifySession()`) — the proxy check
  is a UX shortcut, not the security boundary. `/admin` additionally checks
  `role === "admin"` in its layout, since the proxy never looks at role.
