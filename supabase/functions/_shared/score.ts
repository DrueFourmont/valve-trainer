/**
 * Scoring. Pure, no imports, no platform APIs, so the exact same file runs in
 * the browser and inside the Deno edge function. It lives here rather than in
 * src because Deno bundles what sits under supabase/functions, and having one
 * implementation matters more than where it sits: a client and a server that
 * disagree about a score is the worst possible bug in a training record.
 *
 * Start at 100, lose 15 per wrong action, lose 1 for every full 10 seconds over
 * the procedure's target time. Never below 0.
 */

export const WRONG_ACTION_PENALTY = 15
export const SECONDS_PER_TIME_PENALTY = 10

export interface ScoreInput {
  errorCount: number
  durationSeconds: number
  targetSeconds: number
}

export function scoreAttempt({ errorCount, durationSeconds, targetSeconds }: ScoreInput): number {
  const errorPenalty = errorCount * WRONG_ACTION_PENALTY
  const secondsOver = Math.max(0, durationSeconds - targetSeconds)
  const timePenalty = Math.floor(secondsOver / SECONDS_PER_TIME_PENALTY)
  return Math.max(0, 100 - errorPenalty - timePenalty)
}
