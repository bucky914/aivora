-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 008: category-aware scoring
--
-- Participant point values are intentionally not exposed by the contest
-- question payload/UI. Scoring remains server-side in public.submissions.
--
-- Coding / DSA: easy 10, medium 20, hard 30
-- SQL:          easy 5,  medium 10, hard 15
--
-- This migration is additive with respect to question/test data:
--   * no question rows are deleted
--   * question IDs are preserved
--   * public/hidden test data is not modified
--   * historical migrations are not changed
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Replace the old difficulty-only question-points constraint.
-- ---------------------------------------------------------------------
alter table public.questions
  drop constraint if exists questions_points_match_difficulty;

alter table public.questions
  drop constraint if exists questions_points_match_category_difficulty;

-- Only SQL question points need to change from the legacy 10/20/30 values;
-- coding values stay 10/20/30. The CASE is category-aware and does not
-- perform a global 10/20/30 rewrite.
update public.questions
set points = case
  when category = 'sql' and difficulty = 'easy'   then 5
  when category = 'sql' and difficulty = 'medium' then 10
  when category = 'sql' and difficulty = 'hard'   then 15
  else points
end
where category = 'sql';

alter table public.questions
  add constraint questions_points_match_category_difficulty check (
    (category = 'coding' and difficulty = 'easy'   and points = 10) or
    (category = 'coding' and difficulty = 'medium' and points = 20) or
    (category = 'coding' and difficulty = 'hard'   and points = 30) or
    (category = 'sql'    and difficulty = 'easy'   and points = 5)  or
    (category = 'sql'    and difficulty = 'medium' and points = 10) or
    (category = 'sql'    and difficulty = 'hard'   and points = 15)
  );

-- ---------------------------------------------------------------------
-- 2) Submission score constraint.
-- ---------------------------------------------------------------------
alter table public.submissions
  drop constraint if exists submissions_score_check;

alter table public.submissions
  drop constraint if exists submissions_score_allowed;

alter table public.submissions
  add constraint submissions_score_allowed
  check (score in (0, 5, 10, 15, 20, 30));

-- ---------------------------------------------------------------------
-- 3) Replace points_for(text) with points_for(category, difficulty).
--    The old one-argument function is removed after all live callers have
--    been recreated below.
-- ---------------------------------------------------------------------
create or replace function public.points_for(
  p_category text,
  p_difficulty text
)
returns integer
language sql
immutable
as $$
  select case
    when p_category = 'coding' and p_difficulty = 'easy'   then 10
    when p_category = 'coding' and p_difficulty = 'medium' then 20
    when p_category = 'coding' and p_difficulty = 'hard'   then 30
    when p_category = 'sql'    and p_difficulty = 'easy'   then 5
    when p_category = 'sql'    and p_difficulty = 'medium' then 10
    when p_category = 'sql'    and p_difficulty = 'hard'   then 15
    else 0
  end;
$$;

-- This helper is internal-only. Participants must not be able to invoke it
-- through Supabase RPC to discover the scoring table.
revoke execute on function public.points_for(text, text) from public, anon, authenticated;
grant execute on function public.points_for(text, text) to service_role;

-- Normalize any already-recorded submission scores to the new category-aware
-- rule. This preserves is_solved, answers, timestamps, IDs, and all test data.
-- Coding values remain 10/20/30; SQL legacy 10/20/30 values become 5/10/15.
update public.submissions s
set score = case
  when s.is_solved then public.points_for(aq.category, aq.difficulty)
  else 0
end
from public.attempt_questions aq
where aq.attempt_id = s.attempt_id
  and aq.question_id = s.question_id;

-- ---------------------------------------------------------------------
-- 4) Recreate every live database function in the current project that
--    previously called points_for(difficulty).
-- ---------------------------------------------------------------------

create or replace function public.attempt_summary(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'coding_solved', count(*) filter (where aq.category = 'coding' and coalesce(s.is_solved, false)),
    'sql_solved',    count(*) filter (where aq.category = 'sql'    and coalesce(s.is_solved, false)),
    'coding_total',  count(*) filter (where aq.category = 'coding'),
    'sql_total',     count(*) filter (where aq.category = 'sql'),
    'coding_score',  coalesce(sum(s.score) filter (where aq.category = 'coding'), 0),
    'sql_score',     coalesce(sum(s.score) filter (where aq.category = 'sql'), 0),
    'coding_max',    coalesce(sum(public.points_for(aq.category, aq.difficulty)) filter (where aq.category = 'coding'), 0),
    'sql_max',       coalesce(sum(public.points_for(aq.category, aq.difficulty)) filter (where aq.category = 'sql'), 0)
  )
  from public.attempt_questions aq
  left join public.submissions s
         on s.attempt_id = aq.attempt_id and s.question_id = aq.question_id
  where aq.attempt_id = p_attempt_id;
$$;

create or replace function public.submit_answer(
  p_attempt_id  uuid,
  p_token       text,
  p_question_id uuid,
  p_answer      text default null,
  p_solved      boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_aq      public.attempt_questions;
  v_prev    public.submissions;
  v_solved  boolean;
  v_score   integer;
begin
  if p_answer is not null and char_length(p_answer) > 20000 then
    return jsonb_build_object('ok', false, 'error', 'answer_too_long');
  end if;

  select * into v_attempt
    from public.attempts
   where id = p_attempt_id and access_token = p_token
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_attempt.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed', 'status', v_attempt.status);
  end if;

  if clock_timestamp() >= v_attempt.expires_at then
    update public.attempts
       set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
     where id = v_attempt.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_aq
    from public.attempt_questions
   where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
  end if;

  select * into v_prev
    from public.submissions
   where attempt_id = p_attempt_id and question_id = p_question_id;

  v_solved := coalesce(p_solved, v_prev.is_solved, false);
  v_score  := case when v_solved then public.points_for(v_aq.category, v_aq.difficulty) else 0 end;

  insert into public.submissions (attempt_id, question_id, answer, is_solved, score, submitted_at)
  values (p_attempt_id, p_question_id, p_answer, v_solved, v_score, clock_timestamp())
  on conflict (attempt_id, question_id) do update
     set answer       = coalesce(excluded.answer, public.submissions.answer),
         is_solved    = excluded.is_solved,
         score        = excluded.score,
         submitted_at = excluded.submitted_at;

  return jsonb_build_object(
    'ok', true,
    'question_id', p_question_id,
    'is_solved', v_solved,
    'score', v_score,
    'summary', public.attempt_summary(p_attempt_id)
  );
end;
$$;

create or replace function public.record_code_result(
  p_attempt_id    uuid,
  p_token         text,
  p_question_id   uuid,
  p_language      text,
  p_status        text,
  p_passed        integer,
  p_total         integer,
  p_execution_ms  integer,
  p_error_message text,
  p_code_length   integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_aq      public.attempt_questions;
  v_prev    public.submissions;
  v_solved  boolean;
  v_score   integer;
begin
  select * into v_attempt
    from public.attempts
   where id = p_attempt_id and access_token = p_token
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_attempt.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed', 'status', v_attempt.status);
  end if;
  if clock_timestamp() >= v_attempt.expires_at then
    update public.attempts set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
     where id = v_attempt.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_aq from public.attempt_questions
   where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
  end if;

  insert into public.code_submissions
    (attempt_id, question_id, kind, language, status, passed_tests, total_tests,
     execution_ms, error_message, code_length, submitted_at)
  values
    (p_attempt_id, p_question_id, 'submit', p_language, p_status, p_passed, p_total,
     p_execution_ms, p_error_message, p_code_length, clock_timestamp());

  select * into v_prev from public.submissions
   where attempt_id = p_attempt_id and question_id = p_question_id;

  -- Only the FIRST accepted submission marks it solved / awards points.
  -- Later submissions (even more "accepted" ones) never re-score.
  v_solved := coalesce(v_prev.is_solved, false) or (p_status = 'accepted');
  v_score  := case when v_solved then public.points_for(v_aq.category, v_aq.difficulty) else 0 end;

  insert into public.submissions (attempt_id, question_id, answer, is_solved, score, submitted_at)
  values (p_attempt_id, p_question_id, null, v_solved, v_score, clock_timestamp())
  on conflict (attempt_id, question_id) do update
     set is_solved    = excluded.is_solved,
         score        = excluded.score,
         submitted_at = case when excluded.is_solved and not public.submissions.is_solved
                              then excluded.submitted_at else public.submissions.submitted_at end;

  return jsonb_build_object(
    'ok', true,
    'question_id', p_question_id,
    'status', p_status,
    'is_solved', v_solved,
    'newly_solved', p_status = 'accepted' and not coalesce(v_prev.is_solved, false),
    'score', v_score,
    'passed_tests', p_passed,
    'total_tests', p_total,
    'summary', public.attempt_summary(p_attempt_id)
  );
end;
$$;

create or replace function public.record_sql_result(
  p_attempt_id    uuid,
  p_token         text,
  p_question_id   uuid,
  p_dialect       text,
  p_status        text,
  p_passed        integer,
  p_total         integer,
  p_execution_ms  integer,
  p_error_message text,
  p_query_length  integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_aq      public.attempt_questions;
  v_prev    public.submissions;
  v_solved  boolean;
  v_score   integer;
begin
  select * into v_attempt
    from public.attempts
   where id = p_attempt_id and access_token = p_token
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_attempt.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed', 'status', v_attempt.status);
  end if;
  if clock_timestamp() >= v_attempt.expires_at then
    update public.attempts set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
     where id = v_attempt.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_aq from public.attempt_questions
   where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
  end if;

  insert into public.sql_submissions
    (attempt_id, question_id, kind, dialect, status, passed_tests, total_tests,
     execution_ms, error_message, query_length, submitted_at)
  values
    (p_attempt_id, p_question_id, 'submit', p_dialect, p_status, p_passed, p_total,
     p_execution_ms, p_error_message, p_query_length, clock_timestamp());

  select * into v_prev from public.submissions
   where attempt_id = p_attempt_id and question_id = p_question_id;

  -- Only the FIRST accepted submission marks it solved / awards points —
  -- identical rule to record_code_result.
  v_solved := coalesce(v_prev.is_solved, false) or (p_status = 'accepted');
  v_score  := case when v_solved then public.points_for(v_aq.category, v_aq.difficulty) else 0 end;

  insert into public.submissions (attempt_id, question_id, answer, is_solved, score, submitted_at)
  values (p_attempt_id, p_question_id, null, v_solved, v_score, clock_timestamp())
  on conflict (attempt_id, question_id) do update
     set is_solved    = excluded.is_solved,
         score        = excluded.score,
         submitted_at = case when excluded.is_solved and not public.submissions.is_solved
                              then excluded.submitted_at else public.submissions.submitted_at end;

  return jsonb_build_object(
    'ok', true,
    'question_id', p_question_id,
    'status', p_status,
    'is_solved', v_solved,
    'newly_solved', p_status = 'accepted' and not coalesce(v_prev.is_solved, false),
    'score', v_score,
    'passed_tests', p_passed,
    'total_tests', p_total,
    'summary', public.attempt_summary(p_attempt_id)
  );
end;
$$;

create or replace function public.get_attempt_state(
  p_attempt_id uuid,
  p_token      text,
  p_light      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt     public.attempts;
  v_participant public.participants;
  v_questions   jsonb := '[]'::jsonb;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id and access_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_attempt.status = 'active' and v_attempt.expires_at <= clock_timestamp() then
    update public.attempts
       set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
     where id = v_attempt.id and status = 'active';
    select * into v_attempt from public.attempts where id = p_attempt_id;
  end if;

  select * into v_participant from public.participants where id = v_attempt.participant_id;

  if not p_light then
    select coalesce(jsonb_agg(jsonb_build_object(
             'question_id',     q.id,
             'category',        aq.category,
             'difficulty',      aq.difficulty,
             'display_order',   aq.display_order,
             'title',           q.title,
             'description',     q.description,
             'examples',        coalesce(q.examples, '[]'::jsonb),
             'constraints',     q.constraints,
             'input_format',    q.input_format,
             'output_format',   q.output_format,
             'starter_content', q.starter_content,
             'answer',          s.answer,
             'is_solved',       coalesce(s.is_solved, false),
             'score',           coalesce(s.score, 0),
             -- Coding-only, public-safe fields (never tests):
             'coding',          case when q.category = 'coding' and q.coding_config is not null then
               jsonb_build_object(
                 'function_name', q.coding_config->>'function_name',
                 'params', coalesce(q.coding_config->'params', '[]'::jsonb),
                 'return_type', q.coding_config->>'return_type',
                 'starter_code', coalesce(q.coding_config->'starter_code', '{}'::jsonb),
                 'public_tests', coalesce(q.coding_config->'public_tests', '[]'::jsonb),
                 'time_limit_ms', coalesce((q.coding_config->>'time_limit_ms')::integer, 2000)
               )
             else null end,
             'code_draft', (
               select jsonb_build_object('code_by_lang', d.code_by_lang, 'last_lang', d.last_lang)
               from public.code_drafts d
               where d.attempt_id = aq.attempt_id and d.question_id = aq.question_id
             ),
             -- SQL-only, public-safe fields (never hidden tests/seed):
             'sql',             case when q.category = 'sql' and q.sql_config is not null then
               jsonb_build_object(
                 'supported_dialects', coalesce(q.sql_config->'supported_dialects', '["sql","postgresql"]'::jsonb),
                 'schema_sql', q.sql_config->>'schema_sql',
                 'seed_sql', q.sql_config->>'seed_sql',
                 'public_tests', coalesce(q.sql_config->'public_tests', '[]'::jsonb),
                 'ordered_result', coalesce((q.sql_config->>'ordered_result')::boolean, true),
                 'statement_timeout_ms', coalesce((q.sql_config->>'statement_timeout_ms')::integer, 2000)
               )
             else null end,
             'sql_draft', (
               select jsonb_build_object('query_by_lang', d.query_by_lang, 'last_lang', d.last_lang)
               from public.sql_drafts d
               where d.attempt_id = aq.attempt_id and d.question_id = aq.question_id
             )
           ) order by aq.category, aq.display_order), '[]'::jsonb)
      into v_questions
      from public.attempt_questions aq
      join public.questions q on q.id = aq.question_id
      left join public.submissions s
             on s.attempt_id = aq.attempt_id and s.question_id = aq.question_id
     where aq.attempt_id = v_attempt.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'server_now_ms', public.to_ms(clock_timestamp()),
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'status', v_attempt.status,
      'started_at_ms', public.to_ms(v_attempt.started_at),
      'expires_at_ms', public.to_ms(v_attempt.expires_at),
      'submitted_at_ms', public.to_ms(v_attempt.submitted_at)
    ),
    'participant', jsonb_build_object(
      'name', v_participant.name,
      'participant_no', v_participant.participant_no
    ),
    'questions', v_questions,
    'summary', public.attempt_summary(v_attempt.id)
  );
end;
$$;

-- The old difficulty-only helper must not remain once all live callers use
-- the category-aware function.
drop function if exists public.points_for(text);

commit;
