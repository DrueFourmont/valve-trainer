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
  `tag_point`. Positions come from the model, or from the single `LAYOUT` const
  while the placeholder skid is still in use. Never scatter positions through
  the code.
- No console noise in production. Errors go to an on-screen toast.
- Keep the whole thing small. No abstraction that exists for a future which is
  not in the current plan.

## Definition of done

A phase is not done until all of these pass and the output has been shown:

- `npx tsc --noEmit`
- `npm run lint` if a lint script exists
- `npm test`

Commit at the end of every phase with a short plain message. Never `git push`
without asking.

## Verification, and what Claude cannot do

Drue has no VR headset. VR is verified only by Drue in the Immersive Web
Emulator, a Chrome DevTools extension that Claude cannot drive. 2D is verified
only by Drue on desktop Chrome and on an iPad over the LAN HTTPS URL.

Claude cannot see the render. So every VR or 2D change ends with a precise
numbered checklist: which URL, which controller, which button in the emulator
panel, and what should happen. Drue reports back. That report is the
verification. Never mark something verified that Claude could not run itself.

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
