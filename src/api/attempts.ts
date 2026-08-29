import type { ProcedureState } from '../procedure/machine'
import { SUPABASE_URL, authHeaders, isConfigured } from './config'

/**
 * Posts a finished attempt to the score edge function.
 *
 * The server scores it rather than trusting a number from the browser, so a
 * training record cannot be edited into a pass. Both sides run the identical
 * scoring file, so the score shown on the card and the score stored in the row
 * cannot drift.
 */


export interface AttemptRecord {
  id: string
  score: number
}

export function studentIdFromUrl(): string {
  const value = new URLSearchParams(location.search).get('student')?.trim()
  return value && value !== '' ? value.slice(0, 64) : 'demo'
}

export async function submitAttempt(options: {
  mode: 'vr' | '2d'
  targetSeconds: number
  state: ProcedureState
}): Promise<AttemptRecord | null> {
  // Running without a backend is a normal local state, not an error.
  if (!isConfigured) return null

  const { startedAt, finishedAt } = options.state
  if (startedAt === null || finishedAt === null) return null

  const response = await fetch(`${SUPABASE_URL}/functions/v1/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      studentId: studentIdFromUrl(),
      mode: options.mode,
      targetSeconds: options.targetSeconds,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      steps: options.state.completed,
      errors: options.state.errors,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Score service returned ${response.status}. ${detail}`.trim())
  }

  return (await response.json()) as AttemptRecord
}
