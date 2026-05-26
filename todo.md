# CityWhispers — Project Tracker

## ✅ Foundation (Phases 1–4)

| Phase | Area                                                                                                                                                                 | Status      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **1** | Core infrastructure — Expo + Fastify + Supabase + Clerk + Turborepo monorepo, geohash proximity, admin CRUD                                                          | ✅ Complete |
| **2** | Onboarding & discovery — location permissions, nearby POI fetch, map markers, distance indicators, atmospheric map dim                                               | ✅ Complete |
| **3** | Whisper Card — bottom sheet, animated entry, drag-to-dismiss, audio controls, waveform, progress bar, nearby suggestions, no-audio fallback, atmospheric transitions | ✅ Complete |
| **4** | Settings & preferences — Settings screen, `prefsJson` persistence, hydration on launch, full round-trip verified                                                     | ✅ Complete |

---

## 🔄 Active Phases (5–9)

| Phase | Area                                                                                      | Status      | Next sprint |
| ----- | ----------------------------------------------------------------------------------------- | ----------- | ----------- |
| **5** | Discovery & Journal — persistence + collected screen done; journal redesign pending       | 🔄 Partial  | Sprint E    |
| **6** | Whisper Content — schemas + admin routes done; AI generation pipeline pending             | 🔄 Partial  | Sprint F    |
| **7** | Audio & TTS — E2E playback + completion chain validated; full generation pipeline pending | 🔄 Partial  | Sprint G    |
| **8** | Singapore Content — 9 POIs seeded; expand to 15–20 curated POIs + whisper copy pending    | 🔄 Partial  | Backlog     |
| **9** | Future Features — trails, offline, monetization, social, gamification                     | ⏳ Deferred | Backlog     |

---

## Sprint History

| Sprint  | Focus                       | Highlights                                                                                       |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| **A**   | Bug fixes                   | Preferences API, `cityName` fix, tab nav, types rebuild                                          |
| **A.5** | Dev environment             | Clerk JWKS scope, Supabase SSL, pooler URL, CORS, firewall, env docs                             |
| **D**   | Persistent discovery memory | `completedAt` schema, write path, completion API, Zustand hydration, marker dimming              |
| **B**   | Atmospheric transitions     | `MapOverlay`, coordinated WhisperCard entry, `isRevisit` threaded, device performance validated  |
| **G.0** | Audio reality check         | Dead code cleanup, error state UI, Reanimated 4 worklet crash fix, E2E completion chain verified |

> **G.0 note:** Reanimated 4 compiles `withTiming`/`withSpring` callbacks as UI-thread worklets — JS functions called from them require `runOnJS`. Deprecation warnings are type-level only; runtime is stable.

---

## ✅ Sprint B: Atmospheric Transitions — Complete

- [x] `MapOverlay.tsx` — fullscreen Reanimated overlay, `pointerEvents="none"`, 320ms fade
- [x] `WhisperCard.tsx` — soften spring (`damping:18 / stiffness:120`), coordinated entry with MapOverlay
- [x] `map.tsx` — MapOverlay placed between top bar and WhisperCard in z-order
- [x] Thread `isRevisit` — `_isRevisit` alias typed, Sprint-E TODO noted in `animateOpen`
- [x] Performance validation on device — open/close cycles stable, no frame drops with GPS running

---

## 🔄 Active — Sprint C: Whisper Card Polish

> The Whisper Card is emotional pacing infrastructure, not a UI component. Every decision here — font weight, animation timing, waveform behaviour — should be evaluated against whether it creates or reinforces the sense of being spoken to by a place. "Done" means it feels present, not that it looks polished.

### C-1 — Install and configure Cormorant Garamond ✅

- [x] Install `@expo-google-fonts/cormorant-garamond` (or load via expo-font with local assets)
- [x] Load variants: Regular (400), Italic (400i), Light (300), SemiBold (600) — no others
- [x] Gate rendering behind `useFonts` / `SplashScreen.preventAutoHideAsync()` — no font flash on first render
- [x] Create `apps/mobile/lib/typography.ts` (or `constants/typography.ts`) exporting named presets: `whisperTitle`, `whisperBody`, `whisperMeta`
- [x] Verify: `useFonts` returns `true` before card is shown; no Cormorant font family strings hardcoded outside this file

### C-2 — Typography and spacing polish pass ✅

- [x] Apply `whisperTitle` and `whisperBody` presets from C-1 to WhisperCard whisper text and POI name
- [x] POI name: lighter weight, `letterSpacing ~1.5`, muted gold or secondary colour — frames, does not compete
- [x] Whisper body: Regular or Light Cormorant, `lineHeight` 1.6–1.8×, **left-aligned** (not centred)
- [x] Increase vertical breathing room between POI name, whisper body, and audio controls
- [x] Typography and spacing only — no layout structure or animation changes
- [x] Verify on-device: text reads in one breath without eye strain; POI name is visually subordinate

### C-3 — Nighttime readability and cinematic pacing

- [x] Whisper body text: reduce from pure `#e8e4dc` to `rgba(232, 228, 220, 0.88)` — ambient, not broadcast
- [x] Card background: `#15140f` warm tint applied
- [x] Entry animation: spring slowed ~15% — `stiffness: 120 → 102`
- [x] No new animation types; existing timing values only; no regressions
- [x] On-device review in dim/dark conditions — pending low-light test session

### C-4 — Waveform emotional behaviour refinement

- [x] Slow bar animation cycle: target 600–800ms per cycle (faster reads nervous, slower reads present)
- [x] Reduce height variance range — tighter range feels intimate, not energetic
- [x] Add phase offset / stagger between bars — soft wave motion, not simultaneous movement
- [x] Apply `Easing.inOut(Easing.sine)` to bar animations
- [x] Paused state: bars minimal or static — visually quiet
- [x] Playing state: slow pulse that suggests presence, not technical visualisation
- [x] `runOnJS` wrapper in `WaveformBar.animate()` must remain intact (Reanimated 4 — Sprint G.0 constraint)
- [x] Verify on-device: motion reads organic; no Reanimated crashes

### C-5 — Audio completion cooldown transition state

- [x] Fade waveform out over ~400ms when completion threshold (85%) is reached
- [x] Replace waveform area with a single thin gold horizontal line (low opacity) or empty space — no text, icons, or replay prompt
- [x] Audio controls (play/pause) remain visible but styled to secondary/muted
- [x] Waveform and replacement element occupy identical height — no layout reflow on transition
- [x] Wire to existing completion event from `useAudio` — do not duplicate the 85% threshold logic
- [x] Replaying from completed state restores normal playing appearance (waveform + active controls) without card reload
- [x] Verify on-device: transition is smooth, no layout jump, replay round-trip works

### Sprint C — Completion gate

> Sprint C is **not done** until a collective on-device review answers: _"This feels like a place speaking to me — not an audio player."_ If the answer is "it feels like an audio player," identify which element breaks the illusion and address it before marking complete. On-device sign-off must be noted in the PR description.

---

## ✅ Voice Taste-Testing — Direction Locked

> The emotional voice direction for CityWhispers is now established. Declan Sage selected as primary narrator for MVP due to restrained gravel texture, silence handling, and emotional residue. Arabella retained as secondary experimental voice for selected whispers requiring softer poetic intimacy.

- [x] Identify 3–5 candidate voices (ElevenLabs / OpenAI TTS / other)
- [x] Generate comparative sample narrations
- [x] PM review and voice direction selection
- [x] Document chosen voice + rationale as Sprint G handoff

### Selected MVP Direction

- Primary narrator: Declan Sage
- Secondary experimental narrator: Arabella

### Remaining Validation (non-blocking)

- [ ] Real-world headphone walking validation
- [ ] Nighttime environmental listening pass
- [ ] Long-session fatigue testing

---

## 🔄 Sprint E: Journal Redesign

> The Journal is a memory cabinet, not a history screen. It should feel like opening a drawer of found objects from places you've been — not reviewing a log. Timestamps, time-of-day atmosphere, and emotional weight matter more than recency or completeness. Read this before the task list.

### E-1 — Emotional layout redesign + City grouping ✅

- [x] Replace all placeholder colors with design tokens (`#0f0e0c` bg, `#e8e4dc` primary text, `#c8a96e` gold)
- [x] Apply Cormorant Garamond throughout — `whisperTitle` for POI name, `whisperBody` italic for excerpt, `whisperMeta` for labels
- [x] `SectionList` grouped by city — gold uppercase city header + hairline gold rule
- [x] Flat entry rows (no bordered cards) — `hairlineWidth` separator between entries, feels like notes in a drawer
- [x] Ambient time-of-day label derived from `discoveredAt` hour ("morning light", "after dark", etc.)
- [x] Relative date labels ("yesterday", "3 days ago", "last week")
- [x] Subtle gold completion dot (5px) when `completedAt` is set
- [x] Atmospheric state screens — loading: "listening for memories…", empty: "nothing here yet / Step outside. The city has been waiting.", error: "the drawer won't open"
- [x] `stickySectionHeadersEnabled={false}` — city headers scroll naturally, not pinned

### E-2 — Replay from Journal ✅

- [x] Move `WhisperCard` + `MapOverlay` from `map.tsx` to `(app)/_layout.tsx` — now overlays all tabs
- [x] `nearbyPressHandler` added to store — map screen registers callback on mount, clears on unmount
- [x] `WhisperCard` props removed (`onNearbyPress`, `isRevisit`) — reads both from store directly
- [x] `toActiveWhisper()` mapper in `collected.tsx` — builds `ActiveWhisper` from `DiscoveredWhisper`;
      missing fields (`category`, `personaSlug`) default to `''`; `timeSlot` derived from `discoveredAt`
- [x] `WhisperEntry` accepts `onPress` callback; `CollectedScreen` wires `openWhisper(toActiveWhisper(w))`
- [x] `audioUrl: null` handled by existing WhisperCard "no audio yet" fallback — no changes needed
- [x] `isRevisit: true` always set in `toActiveWhisper` — everything in Journal is a second listen

### E-3 — Atmospheric metadata depth

- [ ] Show `timeSlot` from DB if available (currently derived from `discoveredAt` — verify server stores it)
- [ ] Consider: faint POI category label above POI name (e.g. "WATERFRONT", "MARKET") — `whisperMeta` muted
- [ ] Consider: group ordering — most recently discovered city first vs. most whispers first
- [ ] On-device review: does the screen feel like opening a drawer or browsing a list?

---

## ⏳ Sprint F: AI Whisper Generation

> Build the pipeline that generates whisper text from POI facts.

- [ ] AI whisper generation service
- [ ] Generation pipeline (facts → prompt → whisper)
- [ ] Regeneration workflow
- [ ] Moderation / QA pipeline
- [ ] Approval workflow — draft / approved / needs-review states
- [ ] Internal whisper preview tooling
- [ ] Whisper quality scoring

---

## ⏳ Sprint G: TTS & Audio Pipeline

> Generate, store, and stream narration audio for every whisper.

- [ ] TTS / audio generation service
- [ ] Generate and store narration audio files → `whisper-audio` bucket (✅ created)
- [ ] Audio caching strategy
- [ ] Preloading for nearby whispers
- [ ] Graceful streaming / loading fallback states
- [ ] Narrator voice selection for MVP
- [ ] Pacing and normalization tuning

---

## 📋 Backlog

### Map & Markers

- [ ] Marker visual hierarchy by POI importance
- [ ] Richer discovered-state marker styling (beyond opacity dimming)

### Singapore MVP Content

> Emotional palette: humidity and memory, the persistence of old things inside new cities, the texture of daily life in a place that moves fast. Whispers should feel overheard, not narrated. Favour layered, ambiguous places over clean tourist sites. Factual sourcing should serve atmosphere, not accuracy for its own sake.

- [ ] Curate whisper copy for all 9 seeded POIs against emotional palette
- [ ] Expand to 15–20 POIs — prioritise layered, lived-in places over landmarks
- [ ] Write POI facts that serve atmospheric generation, not encyclopaedic coverage
- [ ] Review all generated whispers against emotional palette before approval

### Future / Deferred

- [ ] Trails system
- [ ] Offline mode
- [ ] Monetization / city packs
- [ ] Additional cities expansion
- [ ] User-generated whispers
- [ ] Social / community systems
- [ ] Achievements / gamification
- [ ] Whisper sharing
