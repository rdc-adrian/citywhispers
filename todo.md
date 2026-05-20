# Project Feature Tracker

## Sprint A — In Progress

> Fix all broken functionality before building anything new.

- [x] Fix `patchUserPreferences` signature mismatch — corrected to `(preferences, token)`
- [x] Fix collected screen missing `cityName` — added city include in `user/index.ts`
- [x] Fix preferences API only persisting `notifications` + `language` — added `prefsJson` JSONB column, all fields now persist
- [x] Add `GET /user/preferences` endpoint for hydration on app launch
- [x] Add `GET /user/preferences` call in `settings.tsx` via `useQuery`
- [x] Fix `UserPreferences` type in `packages/types/src/index.ts` — corrected field names
- [x] Add tab navigation to `app/(app)/_layout.tsx` — Settings was unreachable
- [x] **BLOCKER:** `packages/types` rebuild not clearing TS errors in `settings.tsx` — `radiusMeters`, `showVisited`, `notifications` still not recognised despite `src/index.ts` being correct. Needs resolution in next session.
- [ ] Add settings persistence validation + error handling
- [ ] Verify preferences round-trip end to end (toggle → DB → reload)
- [x] Remove debug endpoint and temporary request.log.info line after fix

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
- [ ] Add atmospheric map dimming when Whisper Card opens
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
- [ ] Whisper Card Phase 3 — atmospheric transitions (map dim, cinematic entry)
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
- [ ] **BLOCKER:** Resolve `packages/types` rebuild not propagating to mobile TS server
- [ ] Add settings persistence validation + error handling
- [ ] Verify full round-trip: toggle → PATCH → DB → reload → GET → correct state

---

## Phase 5: Discovery Persistence & Journal

- [x] Build Collected screen UI
- [x] Fetch whisper history from API
- [x] Fix missing city name in collected entries
- [ ] Implement persistent discovered-state tracking
- [ ] Persist playback completion state
- [ ] Add discovered marker visual states
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

## Sprint Reference

| Sprint          | Focus                                                                 |
| --------------- | --------------------------------------------------------------------- |
| **A** — current | Fix broken functionality — settings blocker remaining (types rebuild) |
| **B**           | Whisper Card Phase 3 — atmospheric map dim, cinematic transitions     |
| **C**           | Whisper Card Phase 4 — Cormorant, typography, readability             |
| **D**           | Persistent discovery state                                            |
| **E**           | Journal / Collected emotional redesign                                |
| **F**           | AI whisper generation pipeline                                        |
| **G**           | TTS / audio generation system                                         |
