# OwnReach

**Own your reach. Keep your community.**

A creator-first social network — profiles, follows, a feed, and channels/DMs
later — built so creators aren't entirely dependent on a platform they don't
own. This repo is **Phase 1: Foundation + core social loop**. See
[What's built / what's next](#whats-built--whats-next) below for scope.

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

Wallet sign-in (SIWE) needs no server credentials — it only needs a browser
wallet extension (MetaMask, etc.) on the visitor's side.

None of these are billed unless you exceed each service's free tier. See
`FREE_TIER_LIMITS` notes inline where relevant; nothing here silently
provisions a paid service.

## What's built / what's next

**This phase:** Google / Telegram / Wallet auth with account linking,
profiles (with avatar/cover upload), follow/unfollow, a home feed (For
You / Following) with cursor pagination, text+image posts with a
bold/italic/link toolbar, likes, comments, bookmarks, hashtag/mention
linking, search (users + posts), settings (profile + connected accounts),
PWA manifest, dark/light themes, empty/error/loading/404 states, SEO
(robots.txt, sitemap.xml, OpenGraph).

**Deliberately not built yet** (see the product spec for the full roadmap):
channels, groups, DMs, notifications, push notifications, creator
analytics/audience export, admin dashboard, moderation tooling, rate
limiting (Upstash Redis), realtime (Ably), video. The "Messages" nav item
is present but routes to a stub — it's there so the navigation shape won't
need to change later.

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
- `proxy.ts` does an optimistic (cookie-presence-only) redirect for
  `/home` and `/settings/*`; every actual data read/write re-verifies the
  session server-side (`verifySession()`) — the proxy check is a UX
  shortcut, not the security boundary.
