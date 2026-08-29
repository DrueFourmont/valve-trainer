# Valve Isolation Trainer

A WebXR training module for industrial valve isolation. One codebase runs as an
immersive VR session on a Quest headset and as a touch experience on a tablet or
desktop. Attempts are scored server side and land on a plain instructor page.

The procedure is the real one: close the inlet, close the outlet, bleed the
trapped section, hang the lockout tag. Doing it out of order is not blocked. It
is recorded, scored, and shown back to the instructor on a timeline, because
knowing that a student tried to bleed a line before isolating it is the whole
point of a training record.

## Links

- Live trainer: https://valve-trainer.vercel.app
- Tablet: https://valve-trainer.vercel.app/?mode=2d
- Instructor view: https://valve-trainer.vercel.app/instructor
- Demo video: TBD

Useful URL parameters:

| Parameter | Effect |
| --- | --- |
| `?mode=vr` | Offers an immersive session. Falls back to 2D if the browser has no headset. |
| `?mode=2d` | Mouse and touch. This is the default. |
| `?student=NAME` | Attributes the attempt to a student. Defaults to `demo`. |

## Testing note

I do not own a VR headset. This was developed and verified in the Immersive Web
Emulator in Chrome, and on an iPad over a LAN HTTPS URL. Every VR behaviour in
here has been driven through emulated controllers: teleport arc, snap turn,
controller rays, wrist panel, trigger selection, and the world space score
panel. None of it has been through a real Quest.

The live link runs on any Quest browser, so it can be tried on hardware
directly. If something is wrong on a real device, the likely candidates are
comfort details that an emulator cannot show: teleport arc distance, the wrist
panel angle, and text size at arm's length.

Everything in this repository that is claimed as verified was either checked by
a human in a browser or is covered by a test. Nothing is claimed as verified
because it looked plausible.

## How it works

**The procedure is a pure state machine.** `src/procedure/machine.ts` has no
Three.js and no DOM. It holds an ordered list of steps, a current position,
completed steps with timestamps, and errors with timestamps and the target that
was expected instead. VR and 2D are input adapters that both call one
`interact(target)` function, which is why the two modes cannot drift apart.

**The procedure is data, not code.** `public/procedures/valve-isolation.json`
defines the steps. A second procedure is a second JSON file. A test loads that
file and asserts every target it names is a real interactable node.

**Everything interactable is a named node in the GLB.** `valve_inlet`,
`valve_outlet`, `bleed`, `tag_point`. Nothing positional is hardcoded. The vent
position, the work area centre, and the teleport obstacle bounds are all read
from the model at load time, so re-exporting the skid moves them automatically.
A test reads `skid.glb` directly and checks the four names exist, are unique,
are unscaled, and that the handles turn about a vertical axis. Those faults look
fine in Blender, export silently, and would otherwise only show up as a
handwheel tumbling sideways in a headset.

**Scoring happens on the server.** The `score` edge function computes the score
and writes the row. The client never sends a score, so a training record cannot
be edited into a pass. Both sides import the identical scoring file, so the
number on the card and the number in the database cannot disagree.

Score starts at 100, loses 15 for each wrong action, and loses 1 for every full
10 seconds over the procedure's 90 second target. Floor of 0.

## Known simplification

Row level security is deliberately permissive. Anyone holding the anon key can
insert an attempt and read every attempt. That is acceptable for a portfolio
demo containing no real student data, and it is not acceptable for a real
deployment. A production version would authenticate students, restrict reads to
an instructor role, and scope inserts to the student's own rows. Only the
policies change, not the schema.

There is deliberately no delete policy, so a student cannot erase a bad attempt.

## How Claude Code was used

Claude Code wrote the plumbing under rules committed to this repository in
`CLAUDE.md`: vanilla Three.js, no framework, procedure logic isolated from
rendering, positions read from the model, no console output in production, and
typecheck plus tests passing before any phase was called done.

Every visual and VR behaviour was reviewed by a human, because Claude cannot see
a render or drive the Immersive Web Emulator. That division found real bugs that
tests alone would not have: exiting VR left the camera at the origin, the
teleport faded to black and never faded back, both controllers fought over one
hover slot, the teleport arc passed straight through the skid, and the wrist
panel faced away from the reader. Each of those was found by a human looking at
the screen and then fixed with a regression test where a test was possible.

Work proceeded in phases, each ending with a human checkpoint. Claims were
checked against evidence rather than accepted: several times the state of the
database or a file on disk contradicted what was believed to have been done, and
the evidence won.

## Running locally

Requires Node 22 and a Supabase project.

```
npm install
cp .env.example .env.local     # then fill in your Supabase URL and anon key
npm run dev
```

The dev server runs over HTTPS, because WebXR requires a secure context. The
first run mints a local certificate and needs your password once:

```
CAROOT=~/.vite-plugin-mkcert ~/.vite-plugin-mkcert/mkcert -install
```

Then open `https://localhost:5173/?mode=2d`, or the printed LAN address on a
tablet on the same network.

For the backend, apply `supabase/migrations/` to your project and deploy the
function:

```
supabase functions deploy score --project-ref YOUR_PROJECT_REF
```

### Checks

```
npx tsc --noEmit
npm test
npm run build
```

All three also run in CI on every push.
