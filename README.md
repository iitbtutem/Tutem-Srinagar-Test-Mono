# Tutem Monorepo

A production-ready monorepo powering the Tutem platform — web app, driver mobile app, user/rider mobile app, and shared Convex backend.

## Repo Structure

```
tutem/
├── apps/
│   ├── web/           # @tutem/web — Next.js 16 web app (Tailwind, Clerk, Convex)
│   ├── driver-app/    # @tutem/driver-app — Expo SDK 54, driver mobile app
│   └── user-app/      # @tutem/user-app — Expo SDK 54, rider/user mobile app
├── packages/
│   └── api/           # @tutem/api — Convex backend (single source of truth)
└── tooling/
    ├── typescript/    # @tutem/typescript-config — base, nextjs, react-native tsconfigs
    ├── eslint/        # @tutem/eslint-config — base, nextjs, react-native eslint flat configs
    └── prettier/      # @tutem/prettier-config — shared prettier settings
```

## Getting Started

### Prerequisites

- Node.js ≥ 20.9.0
- Yarn 1.x (`npm i -g yarn`)
- [Convex account](https://dashboard.convex.dev)
- [Clerk account](https://clerk.com)

### 1. Install dependencies

```bash
yarn install
```

### 2. Start the Convex backend FIRST

**This step must run before any other app.** It generates `convex/_generated/` which all apps depend on.

```bash
cd packages/api
yarn dev
```

This will prompt you to log in and create/link a deployment. Leave this running.

### 3. Copy environment variable files

In each app directory, copy the example file and fill in your credentials:

```bash
# Web app
cp apps/web/.env.local.example apps/web/.env.local

# Convex backend (API package)
cp packages/api/.env.local.example packages/api/.env.local

# Driver app
cp apps/driver-app/.env.local.example apps/driver-app/.env.local

# User/rider app
cp apps/user-app/.env.local.example apps/user-app/.env.local
```

**Values to fill in:**

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_URL` | Convex dashboard → your deployment → Deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys (web only, keep secret) |
| `CONVEX_DEPLOYMENT` | Set automatically by `convex dev` |

### 4. Run all apps

```bash
# From repo root — starts all apps concurrently via Turborepo
yarn dev
```

Or run individual apps:

```bash
cd apps/web && yarn dev        # Next.js on http://localhost:3000
cd apps/driver-app && yarn dev # Expo (scan QR with Expo Go or simulator)
cd apps/user-app && yarn dev   # Expo (scan QR with Expo Go or simulator)
```

---

## Clerk Setup (Manual Step)

> **This cannot be automated.** Complete this once before your first deployment.

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. In your Clerk dashboard, go to **JWT Templates**
3. Create a new template named **exactly** `convex` (case-sensitive)
4. Set the **Issuer** to your Convex deployment URL
5. Copy the JWT template's signing algorithm and paste it into `packages/api/convex/auth.config.ts`

---

## Convex Type Safety Chain

```
packages/api/convex/schema.ts
  → `convex dev` generates convex/_generated/api.d.ts
  → @tutem/api re-exports the typed API
  → apps import from "@tutem/api"
  → full end-to-end type inference, zero manual type sharing
```

**Never import from `convex/_generated` directly in app code.** Always import from `@tutem/api`.

---

## Next.js 16 Key Changes

| Change | Details |
|---|---|
| `proxy.ts` replaces `middleware.ts` | Export must be named `proxy` (not `middleware`). `middleware.ts` is silently ignored. |
| `next build` no longer lints | Run `yarn lint` separately. |
| Turbopack is default | No `--turbopack` flag needed. Do not add webpack config. |
| All page `params` are async | `const { id } = await params` — see [Next.js 16 docs](https://nextjs.org/docs) |
| No default fetch caching | Use `"use cache"` directive or `cache: "force-cache"` explicitly. |
| Node.js ≥ 20.9.0 required | Hard requirement. |

---

## Expo SDK 54 Key Notes

| Note | Details |
|---|---|
| New Architecture ON by default | `"newArchEnabled": true` in `app.json`. SDK 54 is the last SDK allowing opt-out — we keep it enabled. |
| `expo-router` package version | Always `~4.0.0` in `package.json`. It is called "Router v6" in Expo docs — never use `expo-router@6.x`. |
| No `react-native-worklets/plugin` in `babel.config.js` | Already included in `react-native-reanimated/plugin`. Adding both causes a duplicate plugin build error. |

---

## How to Add a New App

1. Create `apps/my-app/` with `package.json` named `@tutem/my-app`
2. Pick the right tooling preset:
   - Next.js: extend `@tutem/typescript-config/nextjs.json` and `@tutem/eslint-config/nextjs`
   - Expo: extend `@tutem/typescript-config/react-native.json` and `@tutem/eslint-config/react-native`
3. Add `@tutem/api: "*"` as a dependency to import the typed Convex API
4. Create `.env.local` from `.env.local.example`

## How to Add a New Package

1. Create `packages/my-package/` with `package.json` named `@tutem/my-package`
2. Add as a dependency in any app: `"@tutem/my-package": "*"`
3. Re-run `yarn install` from the root

---

## Commands

| Command | Description |
|---|---|
| `yarn dev` | Start all apps in parallel (persistent, no cache) |
| `yarn build` | Build all apps (respects `^build` dependency order) |
| `yarn lint` | Run ESLint across all packages |
| `yarn typecheck` | TypeScript check across all packages |
| `yarn format` | Prettier format all files |
| `yarn clean` | Clean all build outputs |

---

## Key Conventions — Why Each Rule Exists

| Rule | Why |
|---|---|
| `noUncheckedIndexedAccess` | `arr[4]` is `T \| undefined`, not `T` — catches silent out-of-bounds bugs |
| `exactOptionalPropertyTypes` | Treats absence of a key differently from `key: undefined` — precise optional semantics |
| `noImplicitOverride` | Requires `override` keyword when overriding class methods — prevents accidental shadowing |
| `allowUnreachableCode: false` | Compiler flags dead code — catches logic errors early |
| `verbatimModuleSyntax` | Prevents accidental runtime imports of type-only modules — important for tree shaking |
| `no-floating-promises` | All `Promise`-returning calls must be `await`ed or `.catch()`ed — no silent failures |
| `no-misused-promises` | Prevents passing async functions as void callbacks (e.g. in event handlers) |
| `switch-exhaustiveness-check` | Union type switches must handle every case — prevents runtime "fell through" bugs |
| `import/no-cycle` | Circular imports are silent monorepo killers — caught at lint time |
| `prefer-nullish-coalescing` | Prefers `??` over `\|\|` — `\|\|` short-circuits on `0` and `""`, `??` only on `null`/`undefined` |
