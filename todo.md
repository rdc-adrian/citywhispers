# CityWhispers — Post-MVP TODO

## Security

- [ ] **Rotate `ANTHROPIC_API_KEY`** — key was exposed in a Claude Code conversation session (2026-05-29). Rotate at [console.anthropic.com](https://console.anthropic.com) -> API Keys. Update the new key in Render environment and local `.env`.
- [ ] **Rotate `SUPABASE_SERVICE_ROLE_KEY`** — exposed in the same session. Rotate in Supabase dashboard -> Project Settings -> API. Update in Render environment and local `.env`.
- [ ] **Audit `.env` for any other secrets** surfaced in chat history before open-sourcing or sharing the codebase.

## Narrator

- [ ] **Wire Charon for nighttime whispers** — `charon` narrator profile is registered in `NARRATOR_PROFILES` but not yet connected to any content path. Persona-based narrator selection (Charon for `timeSlot: night`) to be implemented in a future sprint.
