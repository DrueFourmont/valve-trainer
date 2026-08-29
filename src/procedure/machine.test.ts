import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALLOWED_TARGETS, ProcedureMachine, parseProcedure } from './machine'

function loadShippedProcedure() {
  const raw = readFileSync(new URL('../../public/procedures/valve-isolation.json', import.meta.url), 'utf8')
  return parseProcedure(JSON.parse(raw))
}

/** A clock the test drives, so timing assertions are exact instead of flaky. */
function manualClock(startMs: number) {
  let t = startMs
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('the shipped procedure file', () => {
  it('parses and targets only real interactable nodes', () => {
    const procedure = loadShippedProcedure()
    expect(procedure.steps.length).toBe(4)
    for (const step of procedure.steps) {
      expect(ALLOWED_TARGETS).toContain(step.target)
    }
  })

  it('is the valve isolation order we expect', () => {
    const procedure = loadShippedProcedure()
    expect(procedure.steps.map((s) => s.target)).toEqual([
      'valve_inlet',
      'valve_outlet',
      'bleed',
      'tag_point',
    ])
  })

  it('rejects a procedure that targets a node the scene does not have', () => {
    expect(() =>
      parseProcedure({
        id: 'bad',
        title: 'Bad',
        targetSeconds: 90,
        steps: [{ id: 's1', target: 'valve_middle', label: 'x', hint: 'y' }],
      }),
    ).toThrow(/valve_middle/)
  })
})

describe('ProcedureMachine', () => {
  it('walks the happy path and reports completion on the last step', () => {
    const machine = new ProcedureMachine(loadShippedProcedure())
    expect(machine.interact('valve_inlet')).toBe('advanced')
    expect(machine.interact('valve_outlet')).toBe('advanced')
    expect(machine.interact('bleed')).toBe('advanced')
    expect(machine.interact('tag_point')).toBe('complete')

    expect(machine.isComplete).toBe(true)
    expect(machine.snapshot().errors).toEqual([])
    expect(machine.snapshot().completed.map((step) => step.id)).toEqual([
      'close-inlet',
      'close-outlet',
      'bleed-line',
      'hang-tag',
    ])
  })

  it('timestamps each completed step so an attempt can be replayed', () => {
    const clock = manualClock(1_000)
    const machine = new ProcedureMachine(loadShippedProcedure(), clock.now)

    machine.interact('valve_inlet')
    clock.advance(4_000)
    machine.interact('valve_outlet')
    clock.advance(11_000)
    machine.interact('bleed')
    clock.advance(2_500)
    machine.interact('tag_point')

    expect(machine.snapshot().completed).toEqual([
      { id: 'close-inlet', target: 'valve_inlet', at: 1_000 },
      { id: 'close-outlet', target: 'valve_outlet', at: 5_000 },
      { id: 'bleed-line', target: 'bleed', at: 16_000 },
      { id: 'hang-tag', target: 'tag_point', at: 18_500 },
    ])
  })

  it('records a wrong action without advancing', () => {
    const machine = new ProcedureMachine(loadShippedProcedure(), manualClock(1000).now)
    expect(machine.interact('bleed')).toBe('wrong')

    const state = machine.snapshot()
    expect(state.currentIndex).toBe(0)
    expect(state.errors).toEqual([{ at: 1000, target: 'bleed', expected: 'valve_inlet' }])
    expect(machine.currentStep?.target).toBe('valve_inlet')
  })

  it('treats re-touching a finished step as a no-op, not an error', () => {
    const machine = new ProcedureMachine(loadShippedProcedure())
    machine.interact('valve_inlet')

    expect(machine.interact('valve_inlet')).toBe('ignored')
    expect(machine.snapshot().errors).toEqual([])
    expect(machine.snapshot().currentIndex).toBe(1)
  })

  it('ignores everything once the procedure is complete', () => {
    const machine = new ProcedureMachine(loadShippedProcedure())
    for (const target of ['valve_inlet', 'valve_outlet', 'bleed', 'tag_point']) {
      machine.interact(target)
    }
    expect(machine.interact('bleed')).toBe('ignored')
    expect(machine.snapshot().errors).toEqual([])
  })

  it('times the attempt from first action to last', () => {
    const clock = manualClock(1_000)
    const machine = new ProcedureMachine(loadShippedProcedure(), clock.now)
    expect(machine.durationMs()).toBeNull()

    machine.interact('valve_inlet')
    clock.advance(60_000)
    machine.interact('valve_outlet')
    machine.interact('bleed')
    machine.interact('tag_point')

    expect(machine.snapshot().startedAt).toBe(1_000)
    expect(machine.snapshot().finishedAt).toBe(61_000)
    expect(machine.durationMs()).toBe(60_000)
  })

  it('does not start the clock until something happens', () => {
    const machine = new ProcedureMachine(loadShippedProcedure(), manualClock(500).now)
    expect(machine.snapshot().startedAt).toBeNull()
    machine.start()
    expect(machine.snapshot().startedAt).toBe(500)
  })
})
