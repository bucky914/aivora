-- Bug Busters 008 validation
-- Run AFTER supabase/migrations/008_category_aware_scoring.sql

-- 1. Question points by category/difficulty
select category, difficulty, points
from public.questions
order by category, difficulty;

-- 2. Expected point mapping for every combination
select *
from (values
  ('coding','easy',10),
  ('coding','medium',20),
  ('coding','hard',30),
  ('sql','easy',5),
  ('sql','medium',10),
  ('sql','hard',15)
) as expected(category, difficulty, expected_points)
order by category, difficulty;

select
  expected.category,
  expected.difficulty,
  expected.expected_points,
  count(q.id) as question_count,
  min(q.points) as min_points,
  max(q.points) as max_points,
  case when count(q.id) > 0 and min(q.points) = expected.expected_points
            and max(q.points) = expected.expected_points
       then 'OK' else 'CHECK' end as status
from (values
  ('coding','easy',10),
  ('coding','medium',20),
  ('coding','hard',30),
  ('sql','easy',5),
  ('sql','medium',10),
  ('sql','hard',15)
) as expected(category, difficulty, expected_points)
left join public.questions q
  on q.category = expected.category
 and q.difficulty = expected.difficulty
group by expected.category, expected.difficulty, expected.expected_points
order by expected.category, expected.difficulty;

-- 3. Score function
select
  public.points_for('coding','easy')   as coding_easy,
  public.points_for('coding','medium') as coding_medium,
  public.points_for('coding','hard')   as coding_hard,
  public.points_for('sql','easy')      as sql_easy,
  public.points_for('sql','medium')    as sql_medium,
  public.points_for('sql','hard')      as sql_hard;

-- 4. No submission score outside the allowed set
select *
from public.submissions
where score not in (0, 5, 10, 15, 20, 30);

-- 5. Existing submission scores agree with category + difficulty
select
  s.id,
  s.attempt_id,
  s.question_id,
  aq.category,
  aq.difficulty,
  s.is_solved,
  s.score,
  case when s.is_solved
       then public.points_for(aq.category, aq.difficulty)
       else 0
  end as expected_score
from public.submissions s
join public.attempt_questions aq
  on aq.attempt_id = s.attempt_id
 and aq.question_id = s.question_id
where s.score <> case when s.is_solved
                      then public.points_for(aq.category, aq.difficulty)
                      else 0
                 end;

-- 6. Confirm no current database function still calls the old
--    difficulty-only points_for signature.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ~* 'public[.]points_for[[:space:]]*[(][[:space:]]*(aq|v_aq)[.]difficulty';

-- 7. Confirm the old one-argument helper is gone and the new helper exists.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'points_for'
order by pg_get_function_identity_arguments(p.oid);

-- 8. Confirm the category-aware question constraint exists.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.questions'::regclass
  and conname = 'questions_points_match_category_difficulty';

-- 9. Confirm the submission-score constraint exists.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.submissions'::regclass
  and conname = 'submissions_score_allowed';

-- 10. Admin totals (same source used by the admin dashboard)
select
  participant_no,
  coding_score,
  sql_score,
  total_score
from public.admin_results
order by total_score desc, ended_at nulls last;
