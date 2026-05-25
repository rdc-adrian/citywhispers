# Project Feature Tracker

## Sprint A — Complete

> Fix all broken functionality before building anything new.

- [x] Fix `patchUserPreferences` signature mismatch — corrected to `(preferences, token)`
- [x] Fix collected screen missing `cityName` — added city include in `user/index.ts`
- [x] Fix preferences API only persisting `notifications` + `language` — added `prefsJson` JSONB column, all fields now persist
- [x] Add `GET /user/preferences` endpoint for hydration on app launch
- [x] Add `GET /user/preferences` call in `settings.tsx` via `useQuery`
- [x] Fix `UserPreferences` type in `packages/types/src/index.ts` — corrected field names
- [x] Add tab navigation to `app/(app)/_layout.tsx` — Settings was unreachable
- [x] Resolve `packages/types` rebuild not propagating to mobile TS server
- [x] Add settings persistence validation + error handling
- [x] Verify preferences round-trip end to end (toggle → DB → reload)

---

## Sprint A.5 — Complete

> Dev environment & infrastructure — get the app running end to end on a real device.

- [x] Scope Clerk plugin to authenticated routes only — global registration caused JWKS hang on every public request
- [x] Fix Supabase SSL (`rejectUnauthorized: false` in PrismaPg) — connections were failing silently
- [x] Fix `DATABASE_URL` / `DIRECT_URL` to use pooler hostname — direct hostname unresolvable in dev
- [x] Remove auth token from `useNearbyPois` — `/pois/nearby` is a public route; sending a token triggered Clerk JWKS on the server
- [x] Add `keepPreviousData` and coordinate rounding (4 dp) to `useNearbyPois` — prevents spinner on every GPS tick
- [x] Fix whisper route response shape to match `WhisperResponse` type (`id`, `poiId`, `timeSlot`, `personaSlug`, `createdAt`)
- [x] Fix `UserWhisperEvent.create` removing non-existent `poiId` field — discovery writes were silently failing
- [x] Add Windows Firewall inbound rule for port 3001 (LAN dev mode)
- [x] Add `ngrok-free.app` to CORS allowed origins
- [x] Add tap-to-retry on map POI error banner
- [x] Document dev environment setup, tunnel vs LAN workflow, and gotchas in `CLAUDE.md`
- [x] Delete old backup files (`*-old.ts/tsx`) and remove debug `console.log` calls

---

## Sprint D — Complete

> Persistent Discovery Memory System — make the app remember the user emotionally.

- [x] Schema: add `completedAt DateTime?` + `@@unique([userId, whisperId])` to `UserWhisperEvent`, run migration
- [x] Discovery write path: upsert `UserWhisperEvent` on authenticated `GET /whisper/poi/:poiId`
- [x] Complete endpoint: add `PATCH /whisper/:whisperId/complete` + update `GET /user/discovered` response to include `completedAt`
- [x] Shared types: add `DiscoveredWhisper` + `CompleteWhisperBody` to `packages/types`, rebuild
- [x] Zustand + API layer: add `completeWhisper` to `api.ts` + discovery state slices to `useWhisperStore`
- [x] Hydration on launch: wire `GET /user/discovered` → `hydrateDiscovered` on app open
- [x] Completion event: fire `completeWhisper` + `markCompleted` when audio finishes
- [x] Revisit guard + marker dimming: `isRevisit` flag in `handlePoiPress` + opacity on `PoiMarker`

---

## Phase 1: Foundation & Core Infrastructure

- [x] Setup Expo React Native mobile app
- [x] Setup Fastify backend API
- [x] Setup Supabase PostgreSQL database
- [x] Configure Clerk authentication
- [x] Implement geolocation + geohash proximity system
- [x] Setup monorepo architecture (Turborepo)
- [x] Seed initial Singapore / Seoul / Jeju POIs
- [x] Build backend API routes for POIs, whispers, users, cities
- [x] Build admin CRUD routes for cities, POIs, facts, whispers, personas

---

## Phase 2: Onboarding & Discovery

- [x] Build lightweight onboarding flow
- [x] Request location permissions
- [x] Route onboarding to map experience
- [x] Implement nearby POI fetching
- [x] Render map markers dynamically
- [x] Display nearby distance indicators
- [x] Add atmospheric map dimming when Whisper Card opens
- [ ] Refine marker visual hierarchy by POI importance
- [ ] Implement discovered-state marker styling

---

## Phase 3: Whisper Card Experience

- [x] Build Whisper Card bottom sheet
- [x] Implement animated card entry sequence
- [x] Add staggered title + whisper reveal animation
- [x] Implement drag-to-dismiss interaction
- [x] Build audio playback controls
- [x] Add waveform visualiser
- [x] Implement dynamic progress bar expansion during playback
- [x] Add nearby whisper suggestions
- [x] Add graceful fallback when no audio exists
- [x] Whisper Card Phase 3 — atmospheric transitions (map dim, cinematic entry)
- [ ] Whisper Card Phase 4 — typography + spacing polish
- [ ] Tune nighttime readability and cinematic pacing
- [ ] Install and configure Cormorant Garamond typography
- [ ] Refine waveform emotional animation behavior
- [ ] Add audio completion cool down transition state

---

## Phase 4: User Preferences & Settings

- [x] Build Settings screen UI
- [x] Fix preferences save API mismatch
- [x] Add tab navigation so Settings is reachable
- [x] Add `prefsJson` JSONB column to `user_preferences` table
- [x] Persist autoplay, radiusMeters, showVisited, darkMode via prefsJson
- [x] Add preference hydration on app launch via GET /user/preferences
- [x] Resolve `packages/types` rebuild not propagating to mobile TS server
- [x] Add settings persistence validation + error handling
- [x] Verify full round-trip: toggle → PATCH → DB → reload → GET → correct state

---

## Phase 5: Discovery Persistence & Journal

- [x] Build Collected screen UI
- [x] Fetch whisper history from API
- [x] Fix missing city name in collected entries
- [x] Add `@@unique([userId, whisperId])` constraint to `UserWhisperEvent`
- [x] Add `completedAt` field to `UserWhisperEvent`
- [x] Write discovery record on whisper fetch (upsert on `GET /whisper/poi/:poiId`)
- [x] Add `PATCH /whisper/:whisperId/complete` endpoint
- [x] Update `GET /user/discovered` to return `completedAt`
- [x] Add `DiscoveredWhisper` type to shared types package
- [x] Add discovery state to Zustand (`discoveredPoiIds`, `completedWhisperIds`)
- [x] Hydrate discovery state on app launch
- [x] Fire completion event when audio finishes
- [x] Add revisit guard in `handlePoiPress`
- [x] Add discovered marker visual states (opacity dimming only)
- [ ] Build Journal emotional layout redesign
- [ ] Add replay from Journal
- [ ] Add city grouping in Journal
- [ ] Add timestamps and contextual metadata
- [ ] Add atmospheric empty states
- [ ] Add emotional memory details (weather/time/night context)

---

## Phase 6: Whisper Content Operations

- [x] Build personas schema + admin routes
- [x] Build generated whispers schema
- [x] Build POI facts schema
- [ ] Build AI whisper generation service
- [ ] Build whisper generation pipeline
- [ ] Build whisper regeneration workflow
- [ ] Add moderation / QA pipeline
- [ ] Add whisper approval workflow
- [ ] Add draft / approved / needs-review states
- [ ] Build internal whisper preview tooling
- [ ] Add whisper quality scoring system

---

## Phase 7: Audio & TTS Pipeline

- [ ] Build TTS/audio generation service
- [ ] Generate and store narration audio files
- [ ] Implement audio caching strategy
- [ ] Add audio preloading for nearby whispers
- [ ] Add graceful streaming/loading fallback states
- [ ] Tune narration pacing and normalization
- [ ] Select final narrator voice for MVP

---

## Phase 8: Content Expansion (Singapore MVP)

- [ ] Curate Singapore MVP whisper set (in progress)
- [x] Seed Marina Bay Sands
- [x] Seed Gardens by the Bay
- [x] Seed Chinatown Heritage Centre
- [x] Seed Maxwell Food Centre
- [x] Seed Raffles Hotel
- [x] Seed Ann Siang Hill
- [x] Seed Amoy Street Alley
- [x] Seed Hougang Central Hawker Centre (test POI near lat 1.362 for local dev)
- [x] Seed Serangoon Gardens Estate (test POI near lat 1.359 for local dev)
- [ ] Expand Singapore to 15–20 curated MVP POIs
- [ ] Add more hidden gems + micro moments
- [ ] Refine factual sourcing for whisper generation

---

## Phase 9: Future / Deferred Features

- [ ] Trails system
- [ ] Offline mode
- [ ] Monetization / city packs
- [ ] Additional cities expansion
- [ ] User-generated whispers
- [ ] Social/community systems
- [ ] Achievements/gamification
- [ ] Whisper sharing system

---

## Sprint G.0 — Complete

> Audio reality check & cleanup — validate the full audio pipeline before Sprint G proper begins.

- [x] G.0-1: Remove `fetchAudioUrl` from `api.ts` — orphaned, no route exists, no references
- [x] G.0-2: Delete `AudioPlayer.tsx` — superceded by inline controls in `WhisperCard`; seek/position logic already in `useAudio.ts`
- [x] G.0-3: Fix silent error state in `WhisperCard` — `playbackState === 'error'` dims play button (opacity 0.4), disables tap, shows "audio unavailable" label; null-audio fallback zone unchanged
- [x] G.0-4: Fix Reanimated 4 worklet crash — `WaveformBar.animate()` and `BreathRing.breathe()` called directly from UI-thread worklet callbacks; wrapped with `runOnJS`. Also fixed `BreathRing` outer callback missing `finished` guard (runaway animation on pause/close). Same fix applied to `animateClose`
- [x] G.0-5: Create `whisper-audio` Supabase Storage bucket (public) and upload test MP3
- [x] G.0-6: Validate end-to-end completion chain — audio plays on device, progress bar animates, `completedAt` written to `user_whisper_events` after 85% threshold, `PATCH /whisper/:id/complete` confirmed in API logs, no crashes

**Findings:**
- `completedAt` write path confirmed working ✅
- Reanimated 4 (`~4.1.1`) compiles `withTiming`/`withSpring` callbacks as UI-thread worklets — any JS function called from them requires `runOnJS`. The deprecation hints on `runOnJS` are type-level only; runtime is stable. Proper R4 replacement TBD.
- Audio zone (waveform + breath ring) had never been exercised before this sprint — `audioUrl` was always null

---

## Sprint B — In Progress

> Atmospheric Transitions — make the WhisperCard opening feel like an environmental shift. Pure mobile animation, no backend work.

- [x] B-1: Create `MapOverlay.tsx` — fullscreen Reanimated overlay, `pointerEvents="none"`, `Easing.linear` 320ms fade in/out
- [x] B-2/B-3: Update `WhisperCard.tsx` — remove internal overlay, soften spring to `damping:18 / stiffness:120`, coordinated entry with MapOverlay
- [x] B-3 (cleanup): Remove dead `s.overlay` style from WhisperCard StyleSheet
- [x] B-4: Thread `isRevisit` — `_isRevisit` alias in destructure (typed, unused, Sprint-E TODO comment added in `animateOpen`)
- [x] B-2: Update `map.tsx` — `MapOverlay` imported and placed between top bar and `WhisperCard` in z-order
- [ ] B-5: Performance validation on physical device (10+ open/close cycles, GPS running, Perf Monitor, headphones)

---

## Sprint Reference

| Sprint  | Focus                                                             | Status         |
| ------- | ----------------------------------------------------------------- | -------------- |
| **A**   | Fix broken functionality                                          | ✅ Complete    |
| **A.5** | Dev environment & infrastructure — real device end-to-end         | ✅ Complete    |
| **B**   | Whisper Card Phase 3 — atmospheric map dim, cinematic transitions | 🔄 In Progress |
| **C**   | Whisper Card Phase 4 — Cormorant, typography, readability         | ⏳ Pending     |
| **D**   | Persistent discovery state                                        | ✅ Complete    |
| **E**   | Journal / Collected emotional redesign                            | ⏳ Pending     |
| **F**   | AI whisper generation pipeline                                    | ⏳ Pending     |
| **G.0** | Audio reality check — cleanup, error state, E2E validation        | ✅ Complete    |
| **G**   | TTS / audio generation system                                     | ⏳ Pending     |
