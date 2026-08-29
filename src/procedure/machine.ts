/**
 * The procedure state machine.
 *
 * House rule: this file must not import Three, must not touch the DOM, and
 * must not know whether the student is in a headset or on a tablet. VR and 2D
 * both funnel into interact(). That is what makes it testable and what keeps
 * the two modes from drifting apart.
 */

/** Every node a student is allowed to act on. Procedures are checked against this. */
export const ALLOWED_TARGETS = ['valve_inlet', 'valve_outlet', 'bleed', 'tag_point'] as const
export type Target = (typeof ALLOWED_TARGETS)[number]

export interface Step {
  id: string
  target: Target
  label: string
  hint: string
}

export interface Procedure {
  id: string
  title: string
  /** Time the attempt is expected to take. Scoring starts deducting past it. */
  targetSeconds: number
  steps: Step[]
}

export interface ErrorRecord {
  /** Epoch milliseconds, so an attempt can be replayed on a timeline later. */
  at: number
  /** What the student actually acted on. */
  target: string
  /** What the current step wanted instead. */
  expected: string
}

export interface ProcedureState {
  currentIndex: number
  completedStepIds: string[]
  errors: ErrorRecord[]
  startedAt: number | null
  finishedAt: number | null
}

/**
 * 'advanced' and 'complete' mean the action was right. 'wrong' means it was
 * recorded as an error. 'ignored' means nothing happened at all, which the
 * caller needs to know so it does not animate or play a sound: re-touching an
 * already closed valve is a no-op, not a mistake.
 */
export type InteractResult = 'advanced' | 'wrong' | 'complete' | 'ignored'

export function parseProcedure(data: unknown): Procedure {
  if (typeof data !== 'object' || data === null) throw new Error('Procedure must be an object')
  const raw = data as Record<string, unknown>

  if (typeof raw.id !== 'string') throw new Error('Procedure needs a string id')
  if (typeof raw.title !== 'string') throw new Error('Procedure needs a string title')
  if (typeof raw.targetSeconds !== 'number') throw new Error('Procedure needs a numeric targetSeconds')
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) throw new Error('Procedure needs at least one step')

  const allowed = new Set<string>(ALLOWED_TARGETS)
  const steps: Step[] = raw.steps.map((entry, index) => {
    const step = entry as Record<string, unknown>
    for (const key of ['id', 'target', 'label', 'hint']) {
      if (typeof step[key] !== 'string') throw new Error(`Step ${index} needs a string ${key}`)
    }
    if (!allowed.has(step.target as string)) {
      throw new Error(`Step ${index} targets "${String(step.target)}", which is not an interactable node`)
    }
    return step as unknown as Step
  })

  return { id: raw.id, title: raw.title, targetSeconds: raw.targetSeconds, steps }
}

export class ProcedureMachine {
  readonly procedure: Procedure
  private readonly now: () => number
  private state: ProcedureState

  constructor(procedure: Procedure, now: () => number = Date.now) {
    this.procedure = procedure
    this.now = now
    this.state = {
      currentIndex: 0,
      completedStepIds: [],
      errors: [],
      startedAt: null,
      finishedAt: null,
    }
  }

  /** Call when the scene is ready. Otherwise the clock starts on first action. */
  start(): void {
    this.state.startedAt ??= this.now()
  }

  get currentStep(): Step | null {
    return this.procedure.steps[this.state.currentIndex] ?? null
  }

  get isComplete(): boolean {
    return this.state.finishedAt !== null
  }

  get stepNumber(): number {
    return Math.min(this.state.currentIndex + 1, this.procedure.steps.length)
  }

  get totalSteps(): number {
    return this.procedure.steps.length
  }

  snapshot(): ProcedureState {
    return {
      currentIndex: this.state.currentIndex,
      completedStepIds: [...this.state.completedStepIds],
      errors: this.state.errors.map((error) => ({ ...error })),
      startedAt: this.state.startedAt,
      finishedAt: this.state.finishedAt,
    }
  }

  durationMs(): number | null {
    const { startedAt, finishedAt } = this.state
    return startedAt !== null && finishedAt !== null ? finishedAt - startedAt : null
  }

  interact(target: string): InteractResult {
    if (this.isComplete) return 'ignored'
    this.start()

    const step = this.currentStep
    if (!step) return 'ignored'

    if (target === step.target) {
      this.state.completedStepIds.push(step.id)
      this.state.currentIndex += 1

      if (this.state.currentIndex >= this.procedure.steps.length) {
        this.state.finishedAt = this.now()
        return 'complete'
      }
      return 'advanced'
    }

    // Touching something already dealt with is a no-op, not a mistake. A
    // student checking a valve they already closed should not be punished.
    if (this.isAlreadyDone(target)) return 'ignored'

    this.state.errors.push({ at: this.now(), target, expected: step.target })
    return 'wrong'
  }

  private isAlreadyDone(target: string): boolean {
    return this.procedure.steps
      .slice(0, this.state.currentIndex)
      .some((step) => step.target === target)
  }
}
