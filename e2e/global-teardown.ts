import { readFileSync } from 'node:fs'

/**
 * Removes the rows this suite created.
 *
 * Every run completes real procedures, which post real attempts, so without
 * this the instructor page fills with automated runs and stops being usable as
 * a demonstration. Forty six of them accumulated before anyone noticed.
 *
 * Depends on a delete policy scoped to the e2e student. Without that policy the
 * request succeeds and removes nothing, which is correct row level security
 * behaviour and is why this reports what it actually deleted rather than
 * assuming.
 */
export default async function teardown(): Promise<void> {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    try {
      for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
        const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
        if (match?.[1] === 'VITE_SUPABASE_URL') url ??= match[2]
        if (match?.[1] === 'VITE_SUPABASE_ANON_KEY') key ??= match[2]
      }
    } catch {
      return
    }
  }

  if (!url || !key) return
  const origin = new URL(url).origin

  const response = await fetch(`${origin}/rest/v1/attempts?student_id=eq.e2e`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
  })

  if (!response.ok) {
    console.log(`e2e cleanup: ${response.status}, rows left in place`)
    return
  }

  const deleted = (await response.json()) as unknown[]
  console.log(
    deleted.length > 0
      ? `e2e cleanup: removed ${deleted.length} automated attempts`
      : 'e2e cleanup: nothing removed, the delete policy is probably missing',
  )
}
