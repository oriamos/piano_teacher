# 0002 – Local-first: all practice logic on the tablet, the server only syncs aggregates

Date: 2026-10-24 · Status: accepted

## Context

Feedback must appear within 30 ms of a key press, practice must work with no network (the
piano may be in a room without Wi-Fi), and the user group is up to ~20 friends on a free
backend tier. Raw note events are high-volume (thousands per session).

## Decision

Everything that runs during practice (matching, scoring, state machine, tempo, hotspots,
spaced repetition, session building) runs in the browser against IndexedDB (Dexie). Supabase is
used only for authentication, the shared song library, and syncing **aggregates**: attempts,
per-note statistics and segment progress. Raw note-on/off events stay on the device for 30 days
and are never uploaded. Sync happens through a queue when the network is available.

## Consequences

- No network round trip can ever delay feedback; the app is fully usable offline.
- The data model carries `user_id` from day one even though stage 1–3 are single-user, so the
  sync layer (stage 4) does not need a migration.
- Conflict handling is simple because each user only writes their own rows and the server is
  not an authority over practice decisions; last-write-wins per row is acceptable.
- Server storage stays tiny (well inside the free tier) and raw performance data never leaves
  the device, which also settles the privacy question.
- The cost is that cross-device continuity depends on the sync queue having flushed; a user
  who switches tablets mid-day may see stale progress until the first one reconnects.
