-- Let the automated suite remove its own rows.
--
-- Every e2e run completes real procedures, which post real attempts. Without a
-- way to clean up, the instructor page fills with automated runs and stops
-- being usable as a demonstration.
--
-- Deliberately narrow: this permits deleting rows belonging to the 'e2e'
-- student and nothing else. A real student's attempt still cannot be removed by
-- anyone holding the anon key, which is the property that matters.

create policy "anon can delete e2e attempts"
  on public.attempts for delete to anon
  using (student_id = 'e2e');
