/**
 * Supabase connection details, read once from the environment.
 *
 * The dashboard shows several URLs and it is easy to copy the REST endpoint
 * rather than the project URL. A project URL never has a path, so taking the
 * origin is both forgiving and correct: it turns
 * https://project.supabase.co/rest/v1/ into https://project.supabase.co
 * instead of building a doubled path that PostgREST rejects with PGRST125.
 */
export function normalizeProjectUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? ''

export const SUPABASE_URL = rawUrl === '' ? '' : normalizeProjectUrl(rawUrl)
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const isConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''

export function authHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }
}
