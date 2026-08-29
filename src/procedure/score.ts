/**
 * Scoring. Pure, no imports, so the Edge Function in phase 5 can run the exact
 * same rule the client shows and the two can never disagree.
 *
 * Start at 100, lose 15 per wrong action, lose 1 for every full 10 seconds
 * over the procedure's target time. Never below 0.
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
