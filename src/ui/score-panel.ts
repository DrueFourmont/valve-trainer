export interface AttemptSummary {
  title: string
  score: number
  durationSeconds: number
  errorCount: number
}

export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}

export function summaryLines(summary: AttemptSummary): string[] {
  return [
    `Score ${summary.score}`,
    `Time ${formatDuration(summary.durationSeconds)}`,
    summary.errorCount === 1 ? '1 wrong action' : `${summary.errorCount} wrong actions`,
  ]
}

/** The 2D score card. VR gets a world space panel instead, see scene/world-panel. */
export function showScorePanel(summary: AttemptSummary): void {
  const existing = document.querySelector('.score-panel')
  if (existing) existing.remove()

  const panel = document.createElement('div')
  panel.className = 'score-panel'

  const heading = document.createElement('h1')
  heading.textContent = summary.title
  panel.appendChild(heading)

  const score = document.createElement('div')
  score.className = 'score-value'
  score.textContent = String(summary.score)
  panel.appendChild(score)

  const detail = document.createElement('div')
  detail.className = 'score-detail'
  detail.textContent = summaryLines(summary).slice(1).join('   ')
  panel.appendChild(detail)

  const again = document.createElement('button')
  again.type = 'button'
  again.className = 'score-again'
  again.textContent = 'Run it again'
  again.addEventListener('click', () => location.reload())
  panel.appendChild(again)

  document.body.appendChild(panel)
}
