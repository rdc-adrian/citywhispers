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
      whisper/        # WhisperCard
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
- **Supabase SSL:** PrismaPg requires `ssl: { rejectUnauthorized: false }` (in `apps/api/src/lib/prisma.ts`) or DB connections fail silently. Direct hostname (`db.xxx.supabase.co`) doesn't resolve — always use the pooler URL (`aws-1-xxx.pooler.supabase.com:5432`) for both `DATABASE_URL` and `DIRECT_URL`.
- **Supabase migrations:** Must use session mode pooler (port 5432 on pooler host) or direct URL. Transaction mode (port 6543) blocks migrations. Add `DIRECT_URL` to `.env` and `directUrl` to `schema.prisma` datasource.
- **Clerk plugin scope:** `@clerk/fastify` `clerkPlugin` must be registered only inside the authenticated route scope (see `apps/api/src/index.ts`). If registered globally, it fetches JWKS on every request — including public routes — and the first request hangs for 10+ seconds. Public routes (`/pois`, `/cities`) must stay outside the Clerk scope.
- **TanStack Query cached errors:** If the API was unreachable and the app shows an error banner, the error is cached. Hard-reload the app (`r` in Metro terminal) to clear it. The error banner in `map.tsx` also has a Tap-to-retry handler that calls `refetchPois()`.
- **`EXPO_PUBLIC_*` env vars are baked at bundle time:** Changing `apps/mobile/.env` has no effect until you restart Expo with `--clear`. The app logs `[api] BASE_URL = ...` on startup to confirm the active URL.
- **`packages/types` must be rebuilt** after any changes: `cd packages/types && npm run build`. The mobile app and API both consume `dist/index.d.ts` — editing `src/index.ts` alone is not enough.
- **`UserPreference.prefsJson`** — stores `autoplay`, `radiusMeters`, `showVisited`, `darkMode` as JSONB. Column exists in DB. Prisma schema has it. Access via `(record as any).prefsJson` due to type path issue.

---

## Development Environment

### Running the stack

Always start the API first, then Expo:

```bash
# Terminal 1 — API (from apps/api)
npm run dev          # Fastify on port 3001, watches src/ with tsx

# Terminal 2 — Mobile (from apps/mobile, NOT repo root)
npx expo start --clear --tunnel
```

**Always run `npx expo start` from `apps/mobile`**, not the repo root. The `.env` and `app.json` are scoped to that directory.

### API URL — two modes

`EXPO_PUBLIC_API_URL` in `apps/mobile/.env` is **baked into the JS bundle at compile time**. Any change requires `--clear` to take effect.

| Mode                 | When to use                                                 | `.env` value                            | Extra step                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render (default)** | API hosted remotely — works for all devices, no local setup | `https://citywhispers-api.onrender.com` | None — this is the default in `.env`                                                                                                                                                              |
| **LAN**              | Local API dev (testing API changes)                         | `http://10.168.0.49:3001`               | Add Windows Firewall inbound rule for TCP port 3001 (run once as admin): `New-NetFirewallRule -DisplayName "CityWhispers API Dev" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow` |

**Tunnel mode is the reliable default.** If ngrok is already running on port 3001 (`EADDRINUSE` when starting `npm run dev`), the API server is already up — don't start a second one.

**Free ngrok allows only 1 tunnel.** If the API is already tunnelled, Expo `--tunnel` will fail with "remote gone away". Use VPN or AVD mode instead.

### Checking the active API URL

The app logs the resolved URL on startup:

```
LOG  [api] BASE_URL = http://...
```

If this shows the old Render URL or wrong IP, stop Expo, update `.env`, and restart with `--clear`.

### Firewall (LAN mode only)

If using a direct IP and the device times out, port 3001 is likely blocked. Add the rule above once, then it persists across reboots.

---

## Coding Commands

```bash
# Mobile (from apps/mobile)
npx expo start --clear --tunnel   # Tunnel mode (requires free ngrok slot)
npm run start:avd                 # Android Virtual Device — API via 10.0.2.2, Metro on localhost
npm run start:iphone              # iPhone over OpenVPN — API via 100.96.1.18, Metro on LAN
npx expo start --clear            # LAN mode (same Wi-Fi, firewall rule required)
npx expo run:android              # Build & run Android
npx expo run:ios                  # Build & run iOS

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

## Sprint History & Validated Behaviours

### Sprint B — Atmospheric Transitions ✅

- `MapOverlay.tsx` + coordinated `WhisperCard` entry implemented and stable on device.
- `isRevisit` flag threaded to `animateOpen` — diverge revisit animation here in Sprint E.

### Sprint G.0 — Audio Reality Check ✅

- **Audio completion write path validated on-device.** `completedAt` is written correctly to `user_whisper_events` after the 85% playback threshold. `PATCH /whisper/:id/complete` confirmed in API logs with no errors.
- **Reanimated 4 `runOnJS` fix is stable.** Reanimated 4 compiles `withTiming`/`withSpring` completion callbacks as UI-thread worklets. Any plain JS function called from them must be wrapped with `runOnJS` — applies to `WaveformBar.animate()`, `BreathRing.breathe()`, and `animateClose`. The type-level deprecation warnings are cosmetic; runtime behaviour is stable. Revisit when a supported R4 replacement API emerges.

---

## Product Direction

These are standing PM decisions that frame what the product is. They are not sprint notes — they persist across sessions and should inform all implementation and content choices.

### The Whisper Card is emotional pacing infrastructure

The WhisperCard is not a UI component that displays audio content. It is the primary emotional delivery mechanism of the app — the moment where the city speaks to the user. Every design decision (animation timing, typography weight, waveform behaviour, progress bar reveal) should be evaluated against whether it creates or destroys a sense of being spoken to. Polish is not the goal; presence is.

### The Journal is a memory cabinet, not a history screen

The Collected / Journal screen should feel like opening a drawer of found objects, not reviewing a log. The framing is: these are things that happened to you in a city, now kept. Timestamps, atmospheric context (time of day, weather), and emotional weight matter more than completeness or recency ordering. An engineer picking up Sprint E should read this before the task list.

### Singapore content — emotional palette brief

Singapore MVP content should not be landmark coverage. The emotional palette is: humidity and memory, the persistence of old things inside new cities, the texture of daily life in a place that moves fast. Whispers should feel overheard, not narrated. POI selection should favour layered, ambiguous places over clean tourist sites. Factual sourcing should serve atmosphere, not accuracy for its own sake.

### Narrator voice identity

**Provider:** ElevenLabs
**Primary voice (MVP):** Declan Sage — Eleven Multilingual v2 or v3
**Secondary / experimental:** Arabella — used selectively for softer emotional ambiguity, poetic intimacy, or reflective waterfront/interior-space atmosphere. Not the default MVP narrator.

**Production settings (Declan Sage baseline)**

| Parameter | Value |
|---|---|
| Stability | 39% |
| Similarity / Clarity | 78% |
| Style exaggeration | Minimal |
| Pacing | Slightly slower than conversational |

- Punctuation shaping: heavy ellipsis (`...`), em-dashes (`—`), sentence fragmentation allowed.
- Preserve breath, pause, and slight vocal instability — do not smooth these out.
- Avoid over-enunciation and commercial/podcast cadence.

**Voice rationale**

CityWhispers is not guided tourism or narrated storytelling. The narrator should feel like memory surfacing through a place. Declan Sage was chosen for his restrained gravel texture, low-register delivery, and silence handling — he preserves emotional residue without introducing documentary or meditation-app energy. The slight vocal friction makes the city feel physically lived-in rather than theatrically mysterious.

This aligns directly with the Singapore palette: humidity, lingering heat, layered redevelopment, quiet loneliness, the persistence of old emotional textures inside rapidly changing urban environments. Narration should feel overheard late at night through damp air — intimate, unhurried, slightly incomplete.

**Implementation principle:** Audio delivery should never sound finished. Sentence endings soften rather than resolve cleanly. The listener should feel like the city continues thinking after playback stops.

---

## Research Team — POI Submission Format

> This section is for researchers sourcing new points of interest. Submit one JSON object per POI. Engineers seed it directly via the admin API or `prisma/seed.ts`. Read the tonal brief before writing whisper text.

### Submission template

```json
{
  "poi": {
    "name": "<Place Name>",
    "slug": "<countryISO2>-<kebab-place-name>",
    "citySlug": "<city-slug>",
    "description": "<One sentence for admin use only — never shown in app>",
    "lat": "<latitude>",
    "lng": "<longitude>",
    "triggerRadiusMeters": "<80 | 120–150 for open plazas>",
    "category": "<neighbourhood | landmark | market | religious | park | street | building | waterfront>",
    "imageUrl": "<url or empty string>",
    "atmosphere": {
      "emotionalTone": "<dominant register e.g. Obsolescence | Isolation | Exhaustion | Decline | Transition>",
      "ambientProfile": "<1–2 sentences: sensory/atmospheric summary used for AI prompt context>",
      "timeOfDayAffinity": "<morning | afternoon | evening | night | anytime>",
      "movementContext": "<standing | slow walk | passing through | seated>",
      "intensityLevel": "<1–5 — 1 subtle, 5 overwhelming>",
      "environmentalTexture": "<physical texture e.g. wet concrete, rusted iron, dense canopy>",
      "sourceAttribution": "<researcher name or institution, or null>",
      "reviewStatus": "draft",
      "contentOwner": "<team member name>"
    }
  },
  "facts": [
    {
      "factType": "<historical | sensory | social | architectural>",
      "content": "<Fact. Max 2 sentences. Serve atmosphere, not encyclopaedic coverage.>",
      "verified": "<true | false>",
      "sourceUrl": "<https://... or null>"
    }
  ],
  "whisper": {
    "text": "<60–120 words. First person, present tense. Written to be heard, not read. See tonal brief below.>",
    "audioScript": "<same as text, or leave empty>",
    "voice": "Declan Sage | Arabella",
    "durationSeconds": "<word count ÷ 2.5>",
    "audioFileName": "<countryISO2>-<kebab-place-name>-v1.mp3"
  }
}
```

### Field notes

**`poi`**

- `slug` — `{cityCode}-{kebab-name}`, e.g. `sg-kampong-glam`. Must be unique.
- `description` — admin-facing only, never shown in the app. One sentence max.
- `triggerRadiusMeters` — default 80m for street-level POIs; 120–150m for open plazas or large spaces.
- `category` — one of: `neighbourhood`, `landmark`, `market`, `religious`, `park`, `street`, `building`, `waterfront`.
- `imageUrl` — leave empty string if no image yet; do not omit the field.

**`facts`** — include 2–4 facts per POI. Use multiple `factType` values:

- `historical` — a specific dated or named event, person, or transformation. Avoid generic "it was built in…" framing.
- `sensory` — what you smell, hear, or feel standing there. No need for sourcing; mark `verified: false`.
- `social` — who uses it, how, and when. Daily rhythms, regulars, recurring rituals.
- `architectural` — material, scale, juxtaposition, decay, or incongruity worth noting.
- `sourceUrl` — required for `verified: true`. Use `null` for sensory/social facts.

**`whisper`**

- `text` — see tonal brief below. 60–120 words is a firm range; shorter is often better.
- `durationSeconds` — estimate at roughly 2.5 words/second for slow narration. A 90-word whisper ≈ 36–40s.
- `audioFileName` — `{slug}-v1.mp3`. Leave as placeholder if audio not yet generated.

### Whisper tonal brief

The whisper is the city speaking to a single person standing in that place. It is not a tour guide. It is not a history lesson. It is something you might overhear — a voice that knows the place the way a longtime resident does, not the way a plaque does.

**Voice:** First person, present tense. The narrator is the place itself, or someone who has always been here. Not "this building was once…" — instead: "the smell hasn't changed."

**Tone:** Humid, unhurried, slightly melancholy. The emotional register of old photographs. Not sad — just aware that things persist and disappear at the same time.

**What to avoid:**

- Dates, statistics, or facts stated as facts. If a fact is in the whisper, it should feel incidental — noticed, not reported.
- Instructions or second-person address ("you are standing…", "look up and you'll see…").
- Clean endings. A whisper should feel like it continues after the audio stops.

**What to aim for:**

- A detail so specific it feels impossible to have made up.
- A tension between what a place used to be and what it is now, held lightly.
- The texture of daily life — who comes here at 6am, what the light does, what gets left behind.

**Singapore palette:** Humidity and memory. The persistence of old things inside new cities. Favour layered, ambiguous places over clean landmarks. The whisper should feel overheard in passing, not delivered.

---

## Thread Management

- Warn at **~80% context** with: `⚠️ This thread is getting long. I recommend starting a fresh one soon.`
- Stop and flag before hitting the limit.
- On request, generate a **📋 Project Handoff Summary** covering: Overview, Goal, Component Status, Decisions, Blockers, Next Steps.
