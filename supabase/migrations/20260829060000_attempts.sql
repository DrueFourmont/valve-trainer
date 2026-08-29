-- Attempts recorded by the valve isolation trainer.

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null default 'demo',
  mode text not null,
  started_at timestamptz,
  finished_at timestamptz,
  steps jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  score int not null,
  created_at timestamptz not null default now()
);

create index if not exists attempts_created_at_idx
  on public.attempts (created_at desc);

alter table public.attempts enable row level security;

-- KNOWN SIMPLIFICATION, also written up in the README.
--
-- Anyone holding the anon key can insert an attempt and read every attempt.
-- That is fine for a portfolio demo with no real student data in it, and it is
-- not fine for a real deployment. A real one would authenticate students,
-- restrict select to an instructor role, and scope insert to the student's own
-- rows. Nothing in the schema has to change to do that, only these policies.

create policy "anon can insert attempts"
  on public.attempts for insert to anon with check (true);

create policy "anon can read attempts"
  on public.attempts for select to anon using (true);
