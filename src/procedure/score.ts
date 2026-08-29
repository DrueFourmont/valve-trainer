/**
 * The scoring rule lives under supabase/functions/_shared so the edge function
 * can bundle the identical file. Re-exported here so the rest of the app can
 * keep importing it from the procedure module where it belongs conceptually.
 */
export {
  SECONDS_PER_TIME_PENALTY,
  WRONG_ACTION_PENALTY,
  scoreAttempt,
  type ScoreInput,
} from '../../supabase/functions/_shared/score.ts'
