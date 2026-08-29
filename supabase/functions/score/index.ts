// Deno edge function. Not part of the Vite build and not typechecked by tsc,
// which is why it lives outside src.
//
// Takes a finished attempt, scores it with the same file the browser uses,
// writes the row, and returns the score. Scoring happens here rather than being
// trusted from the client so a training record cannot be edited into a pass.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { scoreAttempt } from '../_shared/score.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface AttemptPayload {
  studentId?: unknown
  mode?: unknown
  startedAt?: unknown
  finishedAt?: unknown
  steps?: unknown
  errors?: unknown
  targetSeconds?: unknown
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405)

  let payload: AttemptPayload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Body must be JSON' }, 400)
  }

  const mode = payload.mode === 'vr' || payload.mode === '2d' ? payload.mode : null
  if (!mode) return json({ error: 'mode must be "vr" or "2d"' }, 400)

  const steps = Array.isArray(payload.steps) ? payload.steps : []
  const errors = Array.isArray(payload.errors) ? payload.errors : []

  const startedAt = typeof payload.startedAt === 'string' ? payload.startedAt : null
  const finishedAt = typeof payload.finishedAt === 'string' ? payload.finishedAt : null
  if (!startedAt || !finishedAt) return json({ error: 'startedAt and finishedAt are required' }, 400)

  const elapsedMs = Date.parse(finishedAt) - Date.parse(startedAt)
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return json({ error: 'finishedAt must be a valid time at or after startedAt' }, 400)
  }

  const targetSeconds =
    typeof payload.targetSeconds === 'number' && payload.targetSeconds > 0
      ? payload.targetSeconds
      : 90

  const score = scoreAttempt({
    errorCount: errors.length,
    durationSeconds: elapsedMs / 1000,
    targetSeconds,
  })

  const studentId =
    typeof payload.studentId === 'string' && payload.studentId.trim() !== ''
      ? payload.studentId.trim().slice(0, 64)
      : 'demo'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )

  const { data, error } = await supabase
    .from('attempts')
    .insert({
      student_id: studentId,
      mode,
      started_at: startedAt,
      finished_at: finishedAt,
      steps,
      errors,
      score,
    })
    .select('id')
    .single()

  if (error) return json({ error: error.message }, 500)

  return json({ id: data.id, score })
})
