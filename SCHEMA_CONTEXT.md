# CityWhispers — Full Schema & System Context

## What is CityWhispers?

A mobile-first app that plays AI-generated immersive audio stories ("whispers")
when a user physically arrives at a real-world location via GPS.

When a user walks near a Point of Interest (POI), the app:

1. Detects proximity via GPS + geohash
2. Checks entitlement (is this city unlocked?)
3. Checks cache (does a whisper exist for this geohash + persona + time slot?)
4. If cache miss → calls AI to generate a new whisper
5. Plays the whisper as audio (TTS)

---

## Tech Stack

- Mobile: React Native + Expo (TypeScript)
- Backend: Fastify + Node.js (TypeScript)
- Database: PostgreSQL (Supabase) via Prisma ORM
- AI: Google Gemini (primary) + Anthropic Claude (quality tier)
- Cache: Redis (hot) + Postgres (cold)
- Audio: Cloudflare R2 + CDN

---

## Full Database Schema

### TABLE: cities

Root anchor for all content.

| Column       | Type      | Notes                             |
| ------------ | --------- | --------------------------------- |
| id           | UUID PK   |                                   |
| name         | TEXT      | e.g. 'Singapore'                  |
| country_code | TEXT      | ISO 3166-1 e.g. 'SG'              |
| timezone     | TEXT      | IANA e.g. 'Asia/Singapore'        |
| status       | TEXT      | 'draft' / 'active' / 'deprecated' |
| created_at   | TIMESTAMP |                                   |

---

### TABLE: pois (Points of Interest)

Real-world locations that anchor whispers.

| Column           | Type      | Notes                                               |
| ---------------- | --------- | --------------------------------------------------- |
| id               | UUID PK   |                                                     |
| city_id          | UUID FK   | → cities.id                                         |
| name             | TEXT      | e.g. 'Raffles Hotel'                                |
| category         | TEXT      | 'landmark'/'food'/'park'/'cultural'/'street'        |
| tags             | TEXT[]    | e.g. ['romantic','hidden','night','instagrammable'] |
| geohash6         | TEXT      | Precision-6 geohash for cache keying (~1.2km²)      |
| address          | TEXT      |                                                     |
| latitude         | FLOAT     |                                                     |
| longitude        | FLOAT     |                                                     |
| active           | BOOLEAN   |                                                     |
| importance_score | INT       | 0–100. Higher = trigger priority in dense areas     |
| trigger_radius   | INT       | Meters. How close user must be to trigger (def: 80) |
| cooldown_minutes | INT       | Minutes before same POI re-triggers (def: 60)       |
| created_at       | TIMESTAMP |                                                     |

Current Singapore POIs:
| Name | Category | importance | radius | Tags |
|-------------------------|-----------|------------|--------|-------------------------------------------|
| Raffles Hotel | landmark | 95 | 100m | historic, iconic, colonial, romantic |
| Marina Bay Sands | landmark | 98 | 150m | iconic, instagrammable, modern, nightlife |
| Chinatown Heritage Ctr | cultural | 75 | 80m | historic, cultural, hidden, local |
| Maxwell Food Centre | food | 85 | 80m | food, local, hawker, iconic, budget |
| Gardens by the Bay | park | 92 | 200m | iconic, instagrammable, night, romantic |
| Ann Siang Hill | cultural | 88 | 80m | historic, hidden, night, romantic |
| Everton Park | street | 82 | 80m | local, food, hidden, artsy |
| Tiong Bahru Estate | landmark | 90 | 120m | architecture, historic, local |

---

### TABLE: poi_facts

Verified curated facts injected into AI prompts as ground truth.
The LLM uses these facts — it never invents its own.

| Column     | Type      | Notes                                                   |
| ---------- | --------- | ------------------------------------------------------- |
| id         | UUID PK   |                                                         |
| poi_id     | UUID FK   | → pois.id                                               |
| fact_type  | TEXT      | 'historical'/'cultural'/'food'/'architectural'          |
| body       | TEXT      | The fact. Max ~300 chars. Injected verbatim into prompt |
| source_url | TEXT      | Optional                                                |
| verified   | BOOLEAN   | Only verified=true facts are injected into prompts      |
| created_at | TIMESTAMP |                                                         |

---

### TABLE: personas

AI storytelling characters. tone_prompt is injected into every LLM call.

| Column      | Type      | Notes                                           |
| ----------- | --------- | ----------------------------------------------- |
| id          | UUID PK   |                                                 |
| slug        | TEXT      | 'historian'/'night_wanderer'/'foodie'/'default' |
| name        | TEXT      | Display name e.g. 'The Historian'               |
| tone_prompt | TEXT      | Injected into every prompt. Max 200 chars       |
| active      | BOOLEAN   |                                                 |
| created_at  | TIMESTAMP |                                                 |

Current personas:
| Slug | Name | Tone |
|----------------|------------------|---------------------------------------------------|
| historian | The Historian | Passionate, authoritative, brings history to life |
| night_wanderer | Night Wanderer | Mysterious, poetic, reveals city secrets at night |
| foodie | The Foodie | Warm, enthusiastic, connects places to food |
| default | City Whisperer | Friendly, curious, finds magic in everyday places |

---

### TABLE: generated_whispers

Core output entity. Every AI-generated or curated whisper story.

| Column        | Type      | Notes                                                  |
| ------------- | --------- | ------------------------------------------------------ |
| id            | UUID PK   |                                                        |
| poi_id        | UUID FK   | → pois.id                                              |
| city_id       | UUID FK   | → cities.id                                            |
| persona_id    | UUID FK   | → personas.id                                          |
| geohash6      | TEXT      | Location cache key                                     |
| time_slot     | TEXT      | 'morning'/'afternoon'/'evening'/'night'                |
| whisper_text  | TEXT      | The story. Max 120 words                               |
| audio_url     | TEXT      | CDN URL to TTS audio. Null until async job completes   |
| model_used    | TEXT      | 'gemini-1.5-flash'/'claude-haiku-4-5'/'seed'/'curated' |
| prompt_hash   | TEXT      | SHA-256 of full prompt — dedup guard                   |
| token_count   | INT       | LLM tokens used — cost tracking                        |
| quality_score | FLOAT     | 0.0–1.0. Set by post-processor after generation        |
| is_featured   | BOOLEAN   | Editorial flag for Top Whispers                        |
| source        | TEXT      | 'ai'/'curated'/'community'                             |
| is_stale      | BOOLEAN   | true = needs regeneration                              |
| expires_at    | TIMESTAMP |                                                        |
| created_at    | TIMESTAMP |                                                        |

Cache key strategy: geohash6 + persona_id + time_slot
→ Same location = up to 16 unique whispers (4 personas × 4 time slots)

---

### TABLE: trails

Ordered multi-stop narrative journeys through a city.

| Column            | Type      | Notes                     |
| ----------------- | --------- | ------------------------- |
| id                | UUID PK   |                           |
| city_id           | UUID FK   | → cities.id               |
| persona_id        | UUID FK   | → personas.id             |
| title             | TEXT      | e.g. 'Colonial Singapore' |
| description       | TEXT      |                           |
| estimated_minutes | INT       | Walking time estimate     |
| created_at        | TIMESTAMP |                           |

---

### TABLE: trail_stops

Ordered join table — defines stops within a trail.

| Column          | Type    | Notes                            |
| --------------- | ------- | -------------------------------- |
| id              | UUID PK |                                  |
| trail_id        | UUID FK | → trails.id                      |
| whisper_id      | UUID FK | → generated_whispers.id          |
| stop_order      | INT     | 1-based position                 |
| transition_text | TEXT    | Walking instruction to next stop |

---

### TABLE: users

| Column     | Type      | Notes                       |
| ---------- | --------- | --------------------------- |
| id         | UUID PK   |                             |
| clerk_id   | TEXT      | Clerk auth user ID          |
| email      | TEXT      |                             |
| plan       | TEXT      | 'free'/'explorer'/'premium' |
| created_at | TIMESTAMP |                             |

---

### TABLE: user_preferences

One row per user. Drives personalisation.

| Column               | Type      | Notes                                   |
| -------------------- | --------- | --------------------------------------- |
| id                   | UUID PK   |                                         |
| user_id              | UUID FK   | → users.id                              |
| persona_id           | UUID FK   | Preferred persona (null = city default) |
| language_code        | TEXT      | Default 'en'                            |
| preferred_categories | TEXT[]    | e.g. ['food', 'landmark']               |
| preferred_tags       | TEXT[]    | e.g. ['hidden', 'romantic', 'night']    |
| notifications_on     | BOOLEAN   |                                         |
| updated_at           | TIMESTAMP |                                         |

---

### TABLE: city_packs

Monetization — unlocks city content for users.

| Column      | Type      | Notes                       |
| ----------- | --------- | --------------------------- |
| id          | UUID PK   |                             |
| city_id     | UUID FK   | → cities.id                 |
| name        | TEXT      |                             |
| description | TEXT      |                             |
| price_usd   | DECIMAL   |                             |
| tier        | TEXT      | 'base'/'experience'/'voice' |
| is_active   | BOOLEAN   |                             |
| created_at  | TIMESTAMP |                             |

---

### TABLE: purchases

Immutable payment records.

| Column       | Type      | Notes                                  |
| ------------ | --------- | -------------------------------------- |
| id           | UUID PK   |                                        |
| user_id      | UUID FK   | → users.id                             |
| city_pack_id | UUID FK   | → city_packs.id                        |
| status       | TEXT      | 'pending'/'completed'/'refunded'       |
| payment_ref  | TEXT      | Stripe / Apple / Google transaction ID |
| platform     | TEXT      | 'web'/'ios'/'android'                  |
| purchased_at | TIMESTAMP |                                        |

---

### TABLE: generation_jobs

Async job tracking for AI generation and TTS.

| Column        | Type      | Notes                                                  |
| ------------- | --------- | ------------------------------------------------------ |
| id            | UUID PK   |                                                        |
| whisper_id    | UUID FK   | → generated_whispers.id                                |
| job_type      | TEXT      | 'ai_generate'/'tts_encode'/'tts_upload'                |
| status        | TEXT      | 'pending'/'processing'/'completed'/'failed'/'retrying' |
| queue_name    | TEXT      | Matches BullMQ queue name                              |
| attempt_count | INT       |                                                        |
| error_message | TEXT      |                                                        |
| scheduled_at  | TIMESTAMP |                                                        |
| completed_at  | TIMESTAMP |                                                        |

---

## Key Relationships

```
cities
  └── pois → poi_facts
  └── pois → generated_whispers → trail_stops
  └── trails → trail_stops → generated_whispers
  └── city_packs → purchases

personas → generated_whispers
personas → trails
personas → user_preferences

users → user_preferences
users → purchases
users → user_whisper_events → generated_whispers
```

---

## AI Generation Rules

- whisper_text must be max 120 words
- persona.tone_prompt is always injected into the LLM system prompt
- Only poi_facts where verified=true are used as source material
- time_slot is derived from user's local time at trigger moment
- source='curated' = human written, source='ai' = LLM generated
- Cache key = geohash6 + persona_id + time_slot
- quality_score is set by post-processor (0.0 = poor, 1.0 = excellent)
- is_featured is set manually by editors for Top Whispers curation

---

## Current Seed Data (Singapore)

- 4 personas: historian, night_wanderer, foodie, default
- 8 POIs with verified facts, tags, importance scores
- 13 POI facts clean, no duplicates
- 3 curated whispers (Raffles/evening, Maxwell/afternoon, Gardens/night)
- 1 trail: "Colonial Singapore" (2 stops, 45 min)
- 1 city pack: "Singapore Explorer" ($4.99)
