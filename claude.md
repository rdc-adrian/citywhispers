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

### Sprint G — TTS & Audio Pipeline ✅

- **Voice provider changed to Google Cloud TTS.** ElevenLabs removed. Active voice: `en-GB-Chirp3-HD-Aoede`. `en-SG` locale does not exist in GCP — all voices are `en-GB`. PM confirmed narrator roster on 2026-05-27 (see Narrator Architecture section).
- **Narrator profile system implemented.** `services/media/tts.ts` — three registered profiles (Aoede, Charon, Neural2-B) with per-narrator configs. `generateNarrationAudio(text, whisperId, narratorId?)` — defaults to Aoede.
- **SSML builder** (`services/media/ssml.ts`) — 1.8s leading arrival pause, sentence-length-aware inter-sentence pauses (2.2s after short sentences → 1.2s after long), ellipsis-aware, phoneme-hooked.
- **Phoneme override system** (`services/media/phonemes.ts`) — 27 Singapore place names registered. `applyPhonemeOverrides` runs before sentence splitting in `buildSsml`.
- **Narrator preview endpoint** — `POST /admin/whispers/preview-narration`. Returns base64 MP3 + SSML used. Does not write to DB. For content team QA iteration.
- **22 SSML/phoneme tests green.** Suites: structural requirements, multi-sentence pacing, ellipsis handling, edge cases, phoneme overrides.
- **Audio storage** — `city/{citySlug}/whispers/{whisperId}.mp3` in Supabase `whisper-audio` bucket. citySlug derived from `City.countryCode + City.name`.
- **WhisperCard loading states** (G-7) and **audio preloading** (G-8) implemented.
- **E2E validated on-device (2026-05-29).** Approve → GenerationJob completes → audioUrl populated → Aoede narration plays on device → silences feel intentional → 85% completion write path regression-free.

---

## Product Direction

These are standing PM decisions that frame what the product is. They are not sprint notes — they persist across sessions and should inform all implementation and content choices.

### The Whisper Card is emotional pacing infrastructure

The WhisperCard is not a UI component that displays audio content. It is the primary emotional delivery mechanism of the app — the moment where the city speaks to the user. Every design decision (animation timing, typography weight, waveform behaviour, progress bar reveal) should be evaluated against whether it creates or destroys a sense of being spoken to. Polish is not the goal; presence is.

### The Journal is a memory cabinet, not a history screen

The Collected / Journal screen should feel like opening a drawer of found objects, not reviewing a log. The framing is: these are things that happened to you in a city, now kept. Timestamps, atmospheric context (time of day, weather), and emotional weight matter more than completeness or recency ordering. An engineer picking up Sprint E should read this before the task list.

### Singapore content — emotional palette brief

Singapore MVP content should not be landmark coverage. The emotional palette is: humidity and memory, the persistence of old things inside new cities, the texture of daily life in a place that moves fast. Whispers should feel overheard, not narrated. POI selection should favour layered, ambiguous places over clean tourist sites. Factual sourcing should serve atmosphere, not accuracy for its own sake.

### Narrator Architecture

> **Provider:** Google Cloud Text-to-Speech (Chirp3-HD tier)
> **Note:** GCP has no `en-SG` locale. All voices are `en-GB`. British English is the production accent for MVP — the SSML layer and per-narrator config suppress broadcaster/documentary cadence ("colonial tour-guide syndrome").

#### Narrator roster (PM confirmed 2026-05-27)

| Role | `narratorId` | Voice | Gender | Tier |
|---|---|---|---|---|
| **Primary MVP** | `aoede` | `en-GB-Chirp3-HD-Aoede` | Female | Chirp3-HD |
| Nighttime / industrial | `charon` | `en-GB-Chirp3-HD-Charon` | Male | Chirp3-HD |
| Stable fallback | `neural2_b` | `en-GB-Neural2-B` | Male | Neural2 |

Charon is not yet wired to any content path — infrastructure preparation only. Persona-based selection (Charon for nighttime whispers) to be wired in a future sprint.

#### Per-narrator audio config

| Setting | `aoede` | `charon` | `neural2_b` |
|---|---|---|---|
| `speakingRate` | `0.90` | `0.88` | `0.88` |
| `pitch` | `-1.5` | `-2.0` | `-2.0` |
| `volumeGainDb` | `-0.5` | `-1.0` | `-1.5` |

To swap the active narrator: change `DEFAULT_NARRATOR` in [apps/api/src/services/media/tts.ts](apps/api/src/services/media/tts.ts). All profiles are registered in `NARRATOR_PROFILES` — no other code changes needed.

#### Auth

GCP service account credentials via env vars. Required IAM role: `Cloud Text-to-Speech API User`.

```
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_CLIENT_EMAIL
GOOGLE_CLOUD_PRIVATE_KEY   # Literal \n sequences — normalised on load in tts.ts
```

#### SSML pacing — [apps/api/src/services/media/ssml.ts](apps/api/src/services/media/ssml.ts)

The silence windows are not padding — they're where ambient city sound lives. Do not optimise them away without PM sign-off.

- **Leading break:** `1.8s` — voice arrives, doesn't start
- **Inter-sentence pauses:** sentence-length-aware — `2.2s` after ≤5 words, `2.0s` after ≤8 words, `1.6s` after ≤12 words, `1.2s` after longer. Short sentences sit in silence longer; the rhythm feels uneven and human.
- **Ellipses (`...`):** `<break time="1.2s"/>...` — break inserted, ellipsis preserved for natural TTS softening. Ellipsis is NOT a sentence boundary.
- **Trailing break:** `2.0s` — no abrupt cutoffs, ever
- **Em-dashes (`—`):** untouched — TTS handles them naturally

If narration sounds upbeat, explanatory, or performative — tune SSML pauses first, phoneme overrides second. Never look at the voice config first.

#### Phoneme overrides — [apps/api/src/services/media/phonemes.ts](apps/api/src/services/media/phonemes.ts)

British Chirp3-HD mispronounces Singaporean place names. `applyPhonemeOverrides(text)` wraps known names in `<phoneme alphabet="ipa">` tags before sentence splitting. 27 names registered (Kallang, Tiong Bahru, Tanjong Pagar, etc.). Add new entries to `PHONEME_OVERRIDES` as content expands — do not inline phoneme tags in whisper text.

#### Audio storage

Supabase `whisper-audio` bucket. Path: `city/{citySlug}/whispers/{whisperId}.mp3`. Files are immutable after generation — regeneration overwrites at the same path. `citySlug` is derived at runtime from `City.countryCode + City.name` (e.g. `sg-singapore`).

#### Narrator preview endpoint

`POST /admin/whispers/preview-narration` — lets the content team test SSML variants and phoneme fixes without touching the DB. Returns `{ audioBase64, mimeType, narratorId, voiceName, ssml }`. Accepts `{ text, narratorId?, ssmlOverride? }`.

#### Implementation principle

Audio delivery should never sound finished. Sentence endings soften rather than resolve cleanly. The listener should feel like the city continues thinking after playback stops.

---

> **Original ElevenLabs direction (archived):** Declan Sage — Eleven Multilingual v2/v3. Stability 39%, similarity 78%, style minimal. Arabella as secondary voice. Superseded before production use — do not re-introduce.

---

## POI Search & Emotional Density Rules

> These rules govern how new POIs are discovered, selected, and approved for CityWhispers. A POI is not valuable because it is famous, historically important, or visually impressive. A POI is valuable if it can hold emotional residue.

The goal is not coverage of Singapore. The goal is emotional cartography.

### Core Selection Principle

A POI must contain at least one of the following:

* visible tension between old and new
* recurring human rhythms
* signs of persistence or disappearance
* strong sensory identity
* emotional ambiguity
* infrastructural intimacy
* unnoticed daily ritual
* physical texture that carries memory

If a location feels explainable in a tourist brochure, it is usually the wrong POI.

If a location feels like something overheard while walking alone, it is usually closer.

---

### Preferred POI Categories

Researchers should prioritize:

* void decks
* aging coffee shops
* wet markets
* overhead bridges
* underpasses
* older malls
* bus interchanges
* industrial edges
* stairwells
* back lanes
* waterfront fringes
* hawker overflow spaces
* HDB transition corridors
* sheltered walkways
* MRT perimeter spaces
* forgotten civic infrastructure
* partially obsolete commercial zones
* liminal green spaces
* places active at unusual hours

These spaces usually contain stronger emotional layering than polished landmarks.

---

### Avoid These POIs

Avoid locations that are primarily:

* tourist photo destinations
* visually iconic but emotionally empty
* luxury retail environments
* generic modern developments
* spectacle-driven attractions
* highly commercialized installations
* spaces designed mainly for consumption
* places with no lingering human rhythm

A famous place may still qualify — but only if the emotional texture is stronger than the landmark identity.

---

### Emotional Density Rules

CityWhispers should feel sparse, discovered, and breathable.

The map must never feel crowded with whispers.

POIs are not distributed by geographic fairness. They are distributed by emotional necessity.

#### Core Principle

Two POIs may be geographically close if they produce clearly different emotional experiences.

Two POIs must not coexist if they produce the same emotional register, even when physically separate.

Emotional collision matters more than physical distance.

---

### Minimum Spacing Rules

These are soft-authoritative rules, not hard blockers.

| Environment Type         | Recommended Minimum Distance |
| ------------------------ | ---------------------------- |
| Dense HDB / urban fabric | 120–180m                     |
| Commercial districts     | 180–250m                     |
| Open parks / waterfronts | 250–400m                     |
| Major landmark zones     | 300m+                        |

Researchers may intentionally violate spacing rules only if the emotional identities are clearly distinct.

Example:

* a wet market loading bay at 5am
* an overhead bridge above the same market at midnight

These may coexist despite proximity because the emotional experience differs completely.

---

### Emotional Collision Rules

A new POI should be rejected or merged if it overlaps heavily with nearby POIs in:

* emotional tone
* sensory texture
* social rhythm
* narrative tension
* environmental atmosphere
* movement pattern
* time-of-day identity

Examples of emotional collision:

* two nostalgic coffee shops on the same street
* three similar aging HDB void decks within one block cluster
* multiple "lonely industrial" spaces in the same warehouse zone
* several waterfront melancholy whispers competing within earshot

The issue is not duplication of geography.
The issue is duplication of feeling.

---

### Emotional Contrast Encouraged

Strong local contrast is desirable.

Good emotional adjacency:

* crowded hawker centre ↔ silent overhead bridge
* humid market ↔ over-airconditioned dead mall
* bright daytime corridor ↔ empty nighttime interchange
* ritual-heavy temple edge ↔ nearby construction noise

The city should feel emotionally layered rather than tonally repetitive.

---

### Density Escalation Rules

If a district already contains multiple approved POIs:

Researchers must justify:

* why this location deserves presence
* what emotional territory is still uncovered
* why an existing nearby POI cannot absorb this perspective

Once an area begins feeling "fully mapped," researchers should move elsewhere.

CityWhispers benefits from absence.

Unmapped silence is part of the product.

---

### Research Evaluation Questions

Before submitting a POI, researchers should ask:

* What emotional residue exists here?
* What persists here despite change?
* What happens here repeatedly?
* What texture or rhythm would disappear if this place vanished?
* Does this feel emotionally different from nearby POIs?
* Would removing this POI reduce the emotional map of the city?

If the answer is weak, the POI should not be submitted.

---

### Final Principle

The goal is not to document Singapore.

The goal is to make users feel like the city remembers things.

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
    "voice": "en-SG-Neural2-A",
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

### AI Generation — Approved Submission Constraints

> These rules govern Claude-assisted POI batch generation. They are stricter than the researcher template above and override it where they conflict. When generating POI JSON, follow these exactly.

**Output format**

- Output **only** the raw JSON array. No markdown code fences, no introductory text, no conversational filler. The array is ready to paste directly into the seed script or admin API.

**Field type constraints**

| Field | Rule |
|---|---|
| `triggerRadiusMeters` | Strict number — `80` for street-level, `120`–`150` for open plazas/waterfronts. Never a string. |
| `imageUrl` | Always empty string `""`. Never a placeholder URL. |
| `atmosphere.intensityLevel` | Strict integer 1–5. |
| `atmosphere.sourceAttribution` | Always `"CityWhispers Research Unit"`. |
| `atmosphere.reviewStatus` | Always `"draft"`. |
| `atmosphere.contentOwner` | The researcher or team member who authored this POI's content. |
| `whisper.durationSeconds` | Strict number: word count ÷ 2.5. Round to one decimal place. |
| `whisper.audioScript` | Exact duplicate of `text`, preserving all ellipsis (`...`) and em-dash (`—`) pacing. |

**Facts rules**

- `historical` facts: `verified: true` required; `sourceUrl` must be a real URL.
- `sensory`, `social`, `architectural` facts: `verified: false`, `sourceUrl: null`.
- 2–4 facts per POI; use a mix of `factType` values.

**Whisper rules**

- 60–120 words. First person, present tense.
- Atmosphere and sensory observation only — no mood-labelling ("melancholy", "eerie"), no technical units, no navigation choreography ("turn left", "look up").
- Must drift away mid-thought with an unresolved ending. Never a clean resolution.
- Ellipsis (`...`) and em-dashes (`—`) are the primary pacing tools.

---

## Thread Management

- Warn at **~80% context** with: `⚠️ This thread is getting long. I recommend starting a fresh one soon.`
- Stop and flag before hitting the limit.
- On request, generate a **📋 Project Handoff Summary** covering: Overview, Goal, Component Status, Decisions, Blockers, Next Steps.
