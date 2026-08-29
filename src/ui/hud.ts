/** What the student needs to see right now. Null means the procedure is over. */
export interface StepView {
  number: number
  total: number
  label: string
  hint: string
}

export interface Hud {
  update(view: StepView | null): void
}

export function trackerText(view: StepView): string {
  return `${view.number} of ${view.total}`
}
