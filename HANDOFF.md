# Handoff

State of the Valve Isolation Trainer as of the end of Phase 6.

## Current state

Deployed and working end to end at https://valve-trainer.vercel.app against a
live Supabase project.

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

**Verified against the live deployment.** Both pages serve, the model serves as
`model/gltf-binary`, a missing model returns a real 404 rather than HTML with a
200, Brotli takes the bundle from 664 kB to 174 kB, and cache headers apply.
Lighthouse on production scores 83 performance, 100 accessibility, 100 best
practices, 100 SEO.

**Not verified by anyone.** Behaviour on a real Quest headset.

## Deploying, and one trap worth knowing

`VITE_` variables are compiled into the bundle at build time, not read at
runtime. Two consequences:

1. `vercel redeploy` reuses the previous build output, so it will never pick up
   changed environment variables. Use `vercel --prod`, which rebuilds.
2. The Vercel CLI intercepts any `VITE_` variable that looks like a credential
   and asks how to store it. **Its default option silently renames the variable,
   stripping the `VITE_` prefix and storing it as a Secret**, which hides it from
   the browser build and is exactly wrong for a client side app. Choose the
   second option, "Expose to anyone visiting your site". Because it is an
   interactive prompt, piping or redirecting the value into `vercel env add`
   makes this worse: stdin hits EOF at the prompt and the CLI takes the
   renaming default without telling you.

Both variables must end up listed as type `Config`, not `Secret`:

```
npx vercel env ls
  VITE_SUPABASE_URL         Config   Production
  VITE_SUPABASE_ANON_KEY    Config   Production
```

Exposing the anon key is correct. It is what every Supabase browser client
ships, and it is protected by row level security rather than by secrecy.

To confirm a deployment actually baked them in, without printing anything
sensitive, look at the compiled config chunk. `isConfigured` folds to a literal
`!0` when the values are present and `!1` when they are not.

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
6. **Lighthouse performance on production is 83.** What holds it back is 610 ms
   of total blocking time and 8.6 s of main thread work, which is Three.js
   parsing plus scene setup. Part of that is the audit running on software
   rendering; a device with a real GPU will do better. Accessibility, best
   practices, and SEO are all 100.
7. **Instructor page shows the most recent 200 attempts** with no pagination,
   filtering, or per student view.
8. **One procedure exists.** The loader supports more, nothing selects between
   them.

## Next three tasks

1. **Record the demo clips** on desktop, tablet, and the Immersive Web Emulator,
   then fill in the demo video link at the top of the README. The deploy itself
   is done.

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
