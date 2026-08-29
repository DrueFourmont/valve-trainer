import './instructor.css'
import { SUPABASE_URL, authHeaders, isConfigured } from './api/config'

/**
 * Instructor view. Plain DOM against the REST endpoint, no framework and no
 * build step beyond Vite's multi page input.
 */

interface CompletedStep {
  id: string
  target: string
  at: number
}

interface ErrorRecord {
  at: number
  target: string
  expected: string
}

interface Attempt {
  id: string
  student_id: string
  mode: string
  started_at: string | null
  finished_at: string | null
  steps: CompletedStep[] | null
  errors: ErrorRecord[] | null
  score: number
  created_at: string
}

const root = document.querySelector<HTMLDivElement>('#attempts')!

function message(text: string, kind: 'info' | 'error' = 'info'): void {
  root.replaceChildren()
  const el = document.createElement('p')
  el.className = kind === 'error' ? 'notice notice-error' : 'notice'
  el.textContent = text
  root.appendChild(el)
}

function durationSeconds(attempt: Attempt): number | null {
  if (!attempt.started_at || !attempt.finished_at) return null
  const ms = Date.parse(attempt.finished_at) - Date.parse(attempt.started_at)
  return Number.isFinite(ms) ? ms / 1000 : null
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'unknown'
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function scoreClass(score: number): string {
  if (score >= 85) return 'score score-good'
  if (score >= 60) return 'score score-fair'
  return 'score score-poor'
}

/** Steps and errors on one timeline, in the order they actually happened. */
function buildTimeline(attempt: Attempt): HTMLElement {
  const start = attempt.started_at ? Date.parse(attempt.started_at) : null

  const entries = [
    ...(attempt.steps ?? []).map((step) => ({
      at: step.at,
      kind: 'step' as const,
      text: `${step.id} (${step.target})`,
    })),
    ...(attempt.errors ?? []).map((error) => ({
      at: error.at,
      kind: 'error' as const,
      text: `wrong action on ${error.target}, expected ${error.expected}`,
    })),
  ].sort((a, b) => a.at - b.at)

  const list = document.createElement('ol')
  list.className = 'timeline'

  if (entries.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'timeline-empty'
    empty.textContent = 'No step detail recorded for this attempt.'
    list.appendChild(empty)
    return list
  }

  for (const entry of entries) {
    const item = document.createElement('li')
    item.className = entry.kind === 'error' ? 'timeline-item timeline-error' : 'timeline-item'

    const stamp = document.createElement('span')
    stamp.className = 'timeline-time'
    stamp.textContent =
      start === null ? '' : `+${Math.round((entry.at - start) / 100) / 10}s`
    item.appendChild(stamp)

    const text = document.createElement('span')
    text.textContent = entry.text
    item.appendChild(text)

    list.appendChild(item)
  }

  return list
}

function renderAttempt(attempt: Attempt): HTMLElement {
  const errorCount = (attempt.errors ?? []).length

  const row = document.createElement('details')
  row.className = 'attempt'

  const summary = document.createElement('summary')
  summary.className = 'attempt-summary'

  const cells: [string, string][] = [
    ['student', attempt.student_id],
    ['mode', attempt.mode],
    ['errors', errorCount === 1 ? '1' : String(errorCount)],
    ['duration', formatDuration(durationSeconds(attempt))],
    ['when', formatWhen(attempt.created_at)],
  ]

  const score = document.createElement('span')
  score.className = scoreClass(attempt.score)
  score.textContent = String(attempt.score)
  summary.appendChild(score)

  for (const [label, value] of cells) {
    const cell = document.createElement('span')
    cell.className = `cell cell-${label}`
    cell.textContent = value
    summary.appendChild(cell)
  }

  row.appendChild(summary)
  row.appendChild(buildTimeline(attempt))
  return row
}

async function load(): Promise<void> {
  if (!isConfigured) {
    message(
      'No Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and reload.',
      'error',
    )
    return
  }

  message('Loading attempts')

  let attempts: Attempt[]
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/attempts?select=*&order=created_at.desc&limit=200`,
      { headers: authHeaders() },
    )
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text().catch(() => '')}`.trim())
    }
    attempts = (await response.json()) as Attempt[]
  } catch (error: unknown) {
    message(`Could not load attempts. ${error instanceof Error ? error.message : String(error)}`, 'error')
    return
  }

  if (attempts.length === 0) {
    message('No attempts recorded yet. Run the trainer once and reload this page.')
    return
  }

  root.replaceChildren()

  const head = document.createElement('div')
  head.className = 'attempt-head'
  for (const label of ['score', 'student', 'mode', 'errors', 'duration', 'when']) {
    const cell = document.createElement('span')
    cell.className = `cell cell-${label}`
    cell.textContent = label
    head.appendChild(cell)
  }
  root.appendChild(head)

  for (const attempt of attempts) root.appendChild(renderAttempt(attempt))
}

void load()
