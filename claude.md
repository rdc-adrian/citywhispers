# Project: CityWhispers Architecture & Style Guide

## Tech Stack

- **Framework:** React Native (Expo SDK) with Expo Router (file-based routing)
- **Backend:** Fastify + Prisma ORM (PostgreSQL) — monorepo under `apps/api`
- **State Management:** Zustand (`useWhisperStore`) + TanStack Query (server state)
- **Auth:** Clerk (`@clerk/clerk-expo`)
- **UI/Styling:** Inline StyleSheet (React Native) — dark theme, gold (`#c8a96e`) accent
- **Animation:** `react-native-reanimated` + `PanResponder`
- **Location:** `expo-location`
- **Audio:** Custom `useAudio` hook (expo-av under the hood)
- **Monorepo:** Turborepo — `apps/mobile`, `apps/api`, `packages/types`, `packages/config`

---

## Folder Structure

```
apps/
  mobile/
    app/
      (app)/          # Authenticated screens: map, collected, settings
      (auth)/         # Unauthenticated screens: onboarding
    components/
      map/            # NearbyBadge, PoiMarker
      ui/             # Toggle (reusable primitives)
      whisper/        # WhisperCard, AudioPlayer
    hooks/            # useAudio, useLocation, useNearbyPois, useWhisper
    lib/              # api.ts, queryClient.ts, time.ts
    store/            # useWhisperStore (Zustand)
  api/
    src/
      routes/
        admin/        # cities, pois, poiFacts, whispers, personas
        city/         # public city routes
        pois/         # nearby POI lookup
        whisper/      # whisper fetch + trigger
        user/         # discovered whispers, preferences
      middleware/     # adminAuth, errorHandler
      services/       # ai, city, media, user, whisper
      lib/            # prisma.ts, redis.ts, errors.ts
    prisma/
      schema.prisma   # Source of truth for all models
packages/
  types/              # Shared TypeScript types (@citywhispers/types)
  config/             # Shared config
```

---

## Architecture Rules

- Use a strictly modular folder structure (components, hooks, screens, services).
- Keep components small and under **150 lines** where possible.
- Prioritise clean, self-documenting code over excessive comments.
- **API layer:** All fetch calls live in `apps/mobile/lib/api.ts` — screens/hooks never call `fetch` directly.
- **Server state:** TanStack Query (`useQuery` / `useMutation`) for all remote data. Default `staleTime: 2 min`, `gcTime: 10 min`.
- **Client state:** Zustand (`useWhisperStore`) for UI-only state (active whisper, audio open flag, discovered set).
- **Auth tokens:** Always retrieved via `const token = await getToken()` from `useAuth()` inside query functions — never stored in module scope.
- **Admin routes** are protected by `x-admin-key` middleware (`adminAuth`). Never expose admin endpoints publicly.
- **Geohash** (`ngeohash`) is auto-calculated server-side from lat/lng — never sent raw by the client.
- **Soft deletes:** POIs use `active: false`; Cities use `status: 'deprecated'`; Whispers use `isStale: true`.

---

## Key Models (Prisma)

| Model                 | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `City`                | Top-level geographic unit                                       |
| `Poi`                 | Points of interest with geohash + trigger radius                |
| `PoiFact`             | Curated facts attached to a POI (factType, verified)            |
| `Persona`             | Narrator voice/tone for whisper generation                      |
| `GeneratedWhisper`    | AI or curated whisper text + audio URL                          |
| `UserWhisperEvent`    | Records when a user encounters a whisper                        |
| `UserPreference`      | Per-user settings (language, notifications, persona, prefsJson) |
| `Trail` / `TrailStop` | Ordered sequence of whispers forming a walk                     |
| `GenerationJob`       | Queue tracking for AI generation jobs                           |

---

## Design Tokens (Mobile)

```ts
// Background
'#0f0e0c' // root background
'#141414' // sheet surface
'#171613' // card / row background
'#1f1d19' // elevated surface

// Text
'#e8e4dc' // primary
'#a09890' // secondary
'#5c5650' // muted / sublabel
'#2a2722' // very muted / version text

// Accent
'#c8a96e' // gold — primary brand accent
'#c06060' // destructive / error

// Borders
'rgba(255,255,255,0.05)' // subtle separator
'rgba(255,255,255,0.1)' // visible border
```

---

## API Conventions

- All routes return `{ data: ... }` wrappers.
- Admin routes are prefixed `/admin/*` and require `x-admin-key` header.
- Public routes: `/cities`, `/pois/nearby`, `/whisper/poi/:poiId`, `/user/discovered`, `/user/preferences`.
- Whisper fetch supports `?time_slot=morning|afternoon|evening|night` (auto-detected from device time via `getCurrentTimeSlot()`).
- `UserPreferences` on mobile includes: `autoplay`, `radiusMeters`, `showVisited`, `darkMode`, `language`, `notifications` — patched via `PATCH /user/preferences`.
- `GET /user/preferences` — returns full preferences for hydration on app launch.

---

## Known Issues / Gotchas

- **Prisma v7 + monorepo:** Generated client outputs to root `node_modules/.prisma/client`, not `apps/api/node_modules/.prisma/client`. Type resolution can break in VS Code — use `as any` casts for new JSON fields as workaround.
- **Supabase migrations:** Must use session mode pooler (port 5432 on pooler host) or direct URL. Transaction mode (port 6543) blocks migrations. Add `DIRECT_URL` to `.env` and `directUrl` to `schema.prisma` datasource.
- **`packages/types` must be rebuilt** after any changes: `cd packages/types && npm run build`. The mobile app and API both consume `dist/index.d.ts` — editing `src/index.ts` alone is not enough.
- **`UserPreference.prefsJson`** — stores `autoplay`, `radiusMeters`, `showVisited`, `darkMode` as JSONB. Column exists in DB. Prisma schema has it. Access via `(record as any).prefsJson` due to type path issue.

---

## Coding Commands

```bash
# Mobile (from apps/mobile or repo root)
npx expo start              # Start Expo dev server
npx expo run:android        # Build & run Android
npx expo run:ios            # Build & run iOS

# API (from apps/api)
npm run dev                 # Start Fastify dev server (port 3001)
npx prisma studio           # Open Prisma Studio
npx prisma migrate dev      # Run migrations
npx tsx prisma/seed.ts      # Seed database

# Types package (from packages/types) — MUST run after any type changes
npm run build               # Rebuild shared types

# Monorepo root
npm run build               # Build all packages
npm run lint                # Lint all workspaces
```

---

## Thread Management

- Warn at **~80% context** with: `⚠️ This thread is getting long. I recommend starting a fresh one soon.`
- Stop and flag before hitting the limit.
- On request, generate a **📋 Project Handoff Summary** covering: Overview, Goal, Component Status, Decisions, Blockers, Next Steps.
