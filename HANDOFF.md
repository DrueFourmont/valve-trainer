# Handoff

State of the Valve Isolation Trainer as of the end of Phase 6.

## Current state

Working end to end, locally, against a live Supabase project. Not deployed.

- Both modes run from one codebase, sharing one `interact()` function and one
  procedure state machine
- The authored `skid.glb` is the only skid; the primitive placeholder was
  deleted rather than kept in sync
- Attempts post to a Supabase edge function which scores them and writes the
  row; the instructor page reads them back with an expandable step timeline
- 45 tests, typecheck clean, both pages build
- CI runs typecheck, tests, and build on every push

## Verified by whom

**Verified by Drue in a browser.** Everything visual. Scene rendering in both
modes, orbit damping and floor clamp, controller models and rays, hover
highlight on both hands at once, press to preview and lift to commit on iPad,
quarter turn animations, steam vent, buzzer and click, teleport arc and work
area ring, snap turn at 30 degrees, wrist panel legibility, the world space
score panel, the 2D bottom bar in portrait and landscape, and the instructor
page including timeline expansion.

**Verified by test.** The procedure state machine including wrong order, repeat
touch, and timing. The scoring rule. Hover source independence. Tween chaining.
Mesh facing. The shipped procedure JSON. The shipped GLB's node names, scale,
uniqueness, and rotation axes. Supabase URL normalisation. Student id parsing.

**Verified by direct inspection of the live project.** Table existence, RLS
insert and select behaviour, absence of delete permission, the deployed edge
function returning a correct score, and the recorded rows matching what the
score cards showed.

**Not verified by anyone.** Behaviour on a real Quest headset. Real world
performance numbers. Anything after a Vercel deploy.

## Known gaps

1. **No real headset test.** Comfort details are the risk: teleport distance,
   wrist panel angle, and text size at arm's length.
2. **RLS is open by design.** Anyone with the anon key can read every attempt.
   Documented in the README and in the migration itself.
3. **Timestamps come from the client clock.** A student could in principle
   change their system time to shorten a duration. The server computes the score
   but trusts the timestamps it is given.
4. **Bundle is about 660 kB before compression**, nearly all Three.js. There is
   no obvious split, since the app is the 3D scene.
5. **The Draco decoder ships about 1.2 MB of assets that are never fetched**,
   because the current model is not Draco compressed. They cost deploy size, not
   page weight. Dropping `DRACOLoader` would remove them at the cost of breaking
   a future compressed export.
6. **Lighthouse performance was measured on software rendering** with mobile
   throttling and no compression, so the 53 is not meaningful. Accessibility,
   best practices, and SEO are all 100. A real number needs a deploy.
7. **Instructor page shows the most recent 200 attempts** with no pagination,
   filtering, or per student view.
8. **One procedure exists.** The loader supports more, nothing selects between
   them.

## Next three tasks

1. **Deploy to Vercel and record the demo clips.** `vercel.json` is in place and
   deliberately has no SPA catch-all rewrite, because that is what makes a
   missing model return HTML with a 200 instead of a 404. Set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project. Then
   fill in the four TBD links at the top of the README and record desktop,
   tablet, and emulator clips.

2. **Try it on a real Quest.** The live link works in the Quest browser with no
   further work. Expect to adjust teleport distance and the wrist panel angle.
   Both are single constants: `WORK_AREA_RADIUS_M` and `TELEPORT_SPEED` in
   `src/input/locomotion.ts`, and `MOUNT_POSITION` in
   `src/scene/hud-wrist.ts`.

3. **Tighten RLS before this is shown to anyone as more than a demo.**
   Authenticate students, scope insert to the caller, and restrict select to an
   instructor role. The schema does not need to change, only the policies in
   `supabase/migrations/`.

## Where things live

| Path | What |
| --- | --- |
| `src/procedure/` | State machine and scoring. No Three.js, no DOM. |
| `src/input/` | Pointer and XR adapters, locomotion. Both call one `interact()`. |
| `src/scene/` | Model loading, effects, VR panels. |
| `src/ui/` | Toast, HUDs, score card, loading screen. |
| `src/api/` | Supabase config and attempt submission. |
| `public/models/skid.glb` | The equipment. Node names are the contract. |
| `public/procedures/` | Procedures as data. |
| `supabase/` | Migration, edge function, shared scoring rule. |
