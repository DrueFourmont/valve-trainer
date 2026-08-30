# Valve Isolation Trainer

WebXR training module. Vite + TypeScript + Three.js. One codebase, two modes:
`?mode=vr` (WebXR session, controllers, teleport) and `?mode=2d` (touch/mouse,
OrbitControls). Backend is Supabase.

Owner: Drue Fourmont, DF Systems. Not a traditional software engineer. Reads
code fine, does not want to hand debug Three.js. Explain decisions in plain
language and keep summaries short.

## Style

- No em dashes anywhere. Not in prose, comments, README, or commit messages.

## Architecture

- Keep Three.js vanilla. No React, no R3F, no frameworks.
- `src/procedure/` is a pure state machine. It must not import Three. VR and 2D
  are input adapters over it. Every behavior change in the procedure gets a
  Vitest test written first.
- Every interactable is a named node: `valve_inlet`, `valve_outlet`, `bleed`,
  `tag_point`. Positions come from the model, read at load time. Never scatter
  positions through the code and never hardcode one. The primitive placeholder
  is gone; `public/models/skid.glb` is the only skid.
- No console noise in production. Errors go to an on-screen toast.
- Keep the whole thing small. No abstraction that exists for a future which is
  not in the current plan.

## Asset budget

The trainer is downloaded over wifi by a headset, so weight is a feature. These
are limits, not targets, and a change that breaks one needs a reason.

| Asset | Limit | Now |
| --- | --- | --- |
| `public/models/skid.glb` | 500 kB | 192 kB |
| HDRI environment | 2 MB, 1K only, never 2K | 1.7 MB |
| JavaScript over the wire | 250 kB | 174 kB brotli |
| Total first load | 3 MB | about 2.1 MB |
| Deployed `dist` on disk | 5 MB | 4.2 MB |

First load and deploy size are different numbers. `dist` carries about 1.2 MB of
Draco decoder that Vite emits because DRACOLoader references it, and which is
never fetched unless a model is Draco compressed. The current one is not.

The HDRI is the largest single asset by a wide margin. 2K of the same file is
6.4 MB, and every material on the skid is rough with no mirror surfaces, so the
extra resolution would buy nothing visible in the lighting. HDR and EXR are
already binary float data and gain almost nothing from compression on the wire.

## Definition of done

A phase is not done until all of these pass and the output has been shown:

- `npx tsc --noEmit`
- `npm run lint` if a lint script exists
- `npm test`
- `npm run test:e2e`

And not until Claude has opened every screenshot in `test-results/shots/` with
the Read tool and described each in one line. A screenshot that looks wrong is a
failing check even when every assertion passed, because an assertion cannot tell
the difference between a working scene and a black rectangle. Two real bugs have
already been caught this way and neither had a failing assertion.

Manual checks are only for things a script genuinely cannot judge: VR comfort,
nausea, text legibility at real focal distance, and how the controllers feel in
the hand. Those are listed separately and kept short.

Commit at the end of every phase with a short plain message. Never `git push`
without asking.

## Verification, and what Claude cannot do

Drue has no VR headset. VR is verified only by Drue in the Immersive Web
Emulator, a Chrome DevTools extension that Claude cannot drive. 2D is verified
only by Drue on desktop Chrome and on an iPad over the LAN HTTPS URL.

Claude cannot see the render. Never mark something verified that Claude could
not run itself.

Two classes of change, handled differently:

- **Provable without looking.** Typecheck, tests, build, and numeric or
  geometric assertions. Claude proceeds and commits without stopping. A memory
  leak, a wrong rotation axis, or a panel sitting inside the equipment are all
  provable this way, and a test proves them better than a person squinting at a
  screen does.
- **Needs eyes.** How something looks or feels. Claude still writes a precise
  numbered checklist, which URL, which controller, which button in the emulator
  panel, and what should happen, but batches these into one checklist at the end
  of a work block rather than one per change. Drue reports back, and that report
  is the verification.

## Decisions the student will feel

When two approaches exist, propose both in two sentences each, with the
tradeoff for VR comfort and for touch, then implement the one Drue picks. Do
not pick silently for anything the student will feel.

## Secrets and scope

Secrets (Supabase URL and anon key, Vercel token) come from Drue. He pastes
them into `.env.local`. Never echo a secret back and never commit one. `.env*`
stays in `.gitignore`.

Nothing in this project may touch any other folder on this machine. Stay inside
the repo.
