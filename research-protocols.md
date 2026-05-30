## 📋 Internal Documentation Update: Spatial Research & Curation Protocols

**Target Reference File:** `packages/config/research-protocols.md` (or inline Project Source)

**Status:** Validated & Integrated into Content Engine Pipeline

---

### I. Spatial Architecture & Content Philosophy

The CityWhispers platform processes the urban landscape not as a collection of tourist coordinates or geographic data points, but as **emotional territory**. The primary operational risk of the platform is database congestion and narrative overcrowding, which collapses spatial pacing and reduces an intimate audio experience into a generic tourism guide.

#### Core Curatorial Mandates

- **The Restraint Rule:** The absence of content is a structural requirement. Walking gaps, silence, and emotional decompression zones must be intentionally preserved to maintain cinematic pacing.

- **Anti-Cannibalization:** Nearby Points of Interest (POIs) must never compete for attention, replicate thematic elements, or express identical emotions. One resonant emotional anchor is prioritized over dense layering.

- **Rejection of Tourism Logic:** Historical trivia, Wikipedia-style significance, and "Top 10" landmarks are fundamentally rejected. Sourcing prioritizes architectural obsolescence, human traces, sensory memory, and liminal urban intersections.

---

### II. Advanced Search Engine Syntactic Blueprints

To bypass commercial indexation and aggregators during live spatial research, all search operations must utilize strict, targeted syntax.

```text
# 1. Architectural Transformations & Obsolescence
site:gov.sg OR site:roots.gov.sg "redevelopment" OR "demolition" OR "conservation" "[Location Name]"

# 2. Micro-Historical & Ephemeral Traces
site:nlb.gov.sg/infopedia OR site:nas.gov.sg/archivesonline "[Location Name]" ("origin" OR "named after" OR "historical background")

# 3. Infrastructural & Transit Modifications
site:lta.gov.sg OR site:pub.gov.sg "[Location Name]" ("drainage" OR "walkway" OR "station upgrade" OR "decommissioned")

# 4. Industrial Layout & Zonal Records
site:jtc.gov.sg OR site:ura.gov.sg "flatted factory" OR "industrial estate" "[Sector Name]"

```

---

### III. Data Extraction & Schema Integrity Guardrails

When scraping or generating POI packages, data payloads must map to exact typologies and pass validation constraints.

#### 1. Spatial Validation Facts Matrix

| Fact Type | Extraction Focus | Validation Rule | <br>`sourceUrl` Matching

|  |
| ---------------- | ------------------------------------------------------- |
| **`historical`** | Dated/named milestones, land handovers, naming origins. |

| `verified: true` | Must be a **direct, plain URL** to a page containing the exact claim.

|
| **`architectural`** | Layout choices, materials, SIT/HDB patterns, decay.

| `verified: true` | Must be a **direct, plain URL** to a page containing the exact claim.

|
| **`sensory`** | Lighting types (sodium/LED), audio frequencies, vibrations, dampness.

| `verified: false` | Must be set strictly to `null`.

|
| **`social`** | Regular demographics, informal seating, labor rhythms, avoidance habits.

| `verified: false` | Must be set strictly to `null`.

|
| **`behavioral`** | Unconscious gestures, waiting patterns, spatial rituals.

| `verified: false` | Must be set strictly to `null`.

|

#### 2. Strict Technical Schema Guardrails

- **Slug Uniqueness:** Slugs (`{cityCode}-{kebab-name}`) must be checked across all existing production JSON files before compilation to prevent compilation collisions. Duplicates are rejected immediately.
- **Time-of-Day Affinity Tracking:** The client architecture enforces an automated parsing matrix based on device time. Only **five explicit string tokens** are allowed:

$$\text{`timeOfDayAffinity`} \in \{\text{'morning'}, \text{'afternoon'}, \text{'evening'}, \text{'night'}, \text{'anytime'}\}$$

_(Note: Tokens like "dusk" or "dawn" are illegal and fail compilation or map incorrectly to 'morning'.)_

- **Source URL Hygiene:** Markdown hyperlink formats (e.g., `[text](url)`) or URL loops routing through Google Search pipelines (`google.com/search?q=...`) break structural hydration. Input fields must be clean, raw strings.
- **Whitespace Sanitation:** To protect backend indexing, leading and trailing whitespaces must be trimmed via regex or manual sanitization across all string properties (`name`, `description`, `whisper.text`).
- **Numeric Constraints:** `triggerRadiusMeters` must be an unquoted integer. Street-level enclaves default to `80`; open plazas or waterfront margins scale to `120` or `150`.

---

### IV. Whisper Script Calibration Laws

Data points captured during research are forbidden from entering scripts in unmodulated formats. They must pass through the internal monologue pipeline.

- **The Banned Term Protocol:** Dates, percentages, exact dimensions in meters, decibels (dB), and exact color temperatures (K) must be stripped out.

- **The Choreography Ban:** Directional orientation markers and imperative spatial cues derived from walking guides (e.g., _"look up"_, _"turn left"_, _"notice the window"_) are strictly prohibited.

#### Translation Behavior Blueprint

> **Raw Extracted Source Data:** _"Built in 1974, stands 24 meters high with 4000K fluorescent lamps."_
>
> **Calibrated Audio Script Output:** _"The concrete has been settling here since the seventies ... holding up the low ceiling under that flat white light."_

- **Pacing Constraints:** Length must remain bounded strictly between **60 and 120 words**. Ellipses (`...`) and em-dashes (`—`) act as structural delivery tools to handle breathing breaks during Google Cloud TTS processing. Scripts must drift away mid-thought with an unresolved ending; a clean resolution violates atmospheric presence.

---

### V. Operational Checklist For Automated/Manual Verification

Before pushing any researched POI array to `prisma/seed.ts` or hitting the Admin injection endpoint, verify the following checklist:

- [ ] **Zero Duplicate Slugs:** Verified unique against all historical production JSON datasets.
- [ ] **Valid Time Token:** Explicitly limited to `morning`, `afternoon`, `evening`, `night`, or `anytime`.
- [ ] **Clean Strings:** Regex verification executed to trim all hidden leading/trailing whitespaces.
- [ ] **URL Isolation:** `sourceUrl` parameters contain no markdown markers or search redirect routes.
- [ ] **Fact Alignment:** Every `verified: true` entry maps to a factual URL that explicitly confirms the claim; `verified: false` points to clean `null` outputs.
- [ ] **Text Calibration:** Whisper script contains zero raw metrics, zero directive commands, and concludes with an unresolved emotional trailing edge.
