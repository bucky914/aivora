-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 001: LeetCode-style code execution
--
-- Run this AFTER schema.sql (and seed.sql, if you already loaded it).
-- It is additive: no existing table, column, row, or function is dropped.
-- Safe to run once on a fresh DB that already has schema.sql applied.
--
-- What this adds
--   * questions.coding_config jsonb   – function signature, per-language
--     starter code, public tests, and hidden tests for CODING questions.
--     SQL questions leave this column null and are completely unaffected.
--   * public.code_submissions          – one row per Run/Submit call,
--     for auditing and duplicate-scoring protection. Judge0 does the
--     actual execution; this table never stores participant secrets.
--   * public.get_public_tests()        – lets an Edge Function fetch the
--     function signature + PUBLIC tests only (hidden tests never leave
--     the database in this call).
--   * public.get_judge_context()       – full signature + PUBLIC + HIDDEN
--     tests, callable by service_role only, used by submit-code.
--   * public.record_code_result()      – server-trusted scoring. This is
--     the ONLY function allowed to set is_solved for a coding question
--     from now on; submit_answer() (existing) still handles SQL answers
--     and the autosave/"Mark as Solved" text path exactly as before.
--   * public.autosave_code()           – per-language code autosave,
--     separate from submissions.answer so partial code never scores.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------

alter table public.questions
  add column if not exists coding_config jsonb;

-- Shape (only meaningful when category = 'coding'):
-- {
--   "function_name": "twoSum",
--   "params": [{"name":"nums","type":"int[]"}, {"name":"target","type":"int"}],
--   "return_type": "int[]",
--   "unordered_result": false,
--   "float_tolerance": null,
--   "starter_code": {"python3": "...", "java": "...", "c": "...", "cpp": "..."},
--   "public_tests": [{"input": {"nums":[2,7,11,15],"target":9}, "expected": [0,1]}, ...],
--   "hidden_tests":  [{"input": {...}, "expected": [...]}, ...],
--   "time_limit_ms": 2000,
--   "memory_limit_kb": 262144
-- }
alter table public.questions
  add constraint questions_coding_config_shape check (
    coding_config is null
    or (
      category = 'coding'
      and coding_config ? 'function_name'
      and coding_config ? 'params'
      and coding_config ? 'starter_code'
      and coding_config ? 'public_tests'
    )
  );

-- Per-language autosaved code, kept apart from submissions.answer so
-- typing never affects score. One row per (attempt, question).
create table if not exists public.code_drafts (
  attempt_id   uuid not null references public.attempts (id) on delete cascade,
  question_id  uuid not null,
  -- { "python3": "...", "java": "...", "c": "...", "cpp": "..." }
  code_by_lang jsonb not null default '{}'::jsonb,
  last_lang    text check (last_lang in ('python3', 'java', 'c', 'cpp')),
  updated_at   timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id)
    references public.attempt_questions (attempt_id, question_id) on delete cascade
);

-- One row per Run/Submit call. Never holds hidden test input/output –
-- only pass/fail counts and truncated public-facing output.
create table if not exists public.code_submissions (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.attempts (id) on delete cascade,
  question_id    uuid not null,
  kind           text not null check (kind in ('run', 'submit')),
  language       text not null check (language in ('python3', 'java', 'c', 'cpp')),
  status         text not null check (status in (
                   'pending', 'accepted', 'wrong_answer', 'compile_error',
                   'runtime_error', 'time_limit', 'memory_limit', 'internal_error'
                 )),
  passed_tests   integer not null default 0,
  total_tests    integer not null default 0,
  execution_ms   integer,
  error_message  text,          -- compiler/runtime message; safe to show (public tests only)
  code_length    integer not null,
  submitted_at   timestamptz not null default now(),
  foreign key (attempt_id, question_id)
    references public.attempt_questions (attempt_id, question_id) on delete cascade
);

create index if not exists code_submissions_attempt_idx on public.code_submissions (attempt_id, question_id, submitted_at desc);
create index if not exists code_drafts_attempt_idx on public.code_drafts (attempt_id);


-- ---------------------------------------------------------------------
-- get_public_tests  (called by execute-code, for "Run Code")
--
-- Returns the function signature, starter code and ONLY the public tests.
-- Hidden tests never appear in this function's result.
-- ---------------------------------------------------------------------
create or replace function public.get_public_tests(
  p_attempt_id  uuid,
  p_token       text,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_aq      public.attempt_questions;
  v_q       public.questions;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id and access_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_attempt.status <> 'active' or clock_timestamp() >= v_attempt.expires_at then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed');
  end if;

  select * into v_aq from public.attempt_questions
   where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
  end if;

  select * into v_q from public.questions where id = p_question_id;
  if not found or v_q.category <> 'coding' or v_q.coding_config is null then
    return jsonb_build_object('ok', false, 'error', 'not_a_coding_question');
  end if;

  return jsonb_build_object(
    'ok', true,
    'function_name', v_q.coding_config->>'function_name',
    'params', coalesce(v_q.coding_config->'params', '[]'::jsonb),
    'return_type', v_q.coding_config->>'return_type',
    'unordered_result', coalesce((v_q.coding_config->>'unordered_result')::boolean, false),
    'float_tolerance', v_q.coding_config->'float_tolerance',
    'starter_code', coalesce(v_q.coding_config->'starter_code', '{}'::jsonb),
    'public_tests', coalesce(v_q.coding_config->'public_tests', '[]'::jsonb),
    'time_limit_ms', coalesce((v_q.coding_config->>'time_limit_ms')::integer, 2000),
    'memory_limit_kb', coalesce((v_q.coding_config->>'memory_limit_kb')::integer, 262144)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- get_judge_context  (called by submit-code ONLY — service_role)
--
-- Same as above but includes hidden_tests. Never call this from
-- anything that echoes its raw result back to the browser.
-- ---------------------------------------------------------------------
create or replace function public.get_judge_context(
  p_attempt_id  uuid,
  p_token       text,
  p_question_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb;
  v_q    public.questions;
begin
  v_base := public.get_public_tests(p_attempt_id, p_token, p_question_id);
  if not (v_base->>'ok')::boolean then
    return v_base;
  end if;

  select * into v_q from public.questions where id = p_question_id;

  return v_base || jsonb_build_object(
    'hidden_tests', coalesce(v_q.coding_config->'hidden_tests', '[]'::jsonb)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- autosave_code  (called by save-code, for the editor's autosave)
--
-- Stores code per language. Switching language never erases another
-- language's saved code because each language is its own JSON key.
-- ---------------------------------------------------------------------
create or replace function public.autosave_code(
  p_attempt_id  uuid,
  p_token       text,
  p_question_id uuid,
  p_language    text,
  p_code        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_aq      public.attempt_questions;
begin
  if p_language not in ('python3', 'java', 'c', 'cpp') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if p_code is not null and char_length(p_code) > 20000 then
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
    update public.attempts set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
     where id = v_attempt.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select * into v_aq from public.attempt_questions
   where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'question_not_assigned');
  end if;

  insert into public.code_drafts (attempt_id, question_id, code_by_lang, last_lang, updated_at)
  values (p_attempt_id, p_question_id, jsonb_build_object(p_language, coalesce(p_code, '')), p_language, clock_timestamp())
  on conflict (attempt_id, question_id) do update
     set code_by_lang = public.code_drafts.code_by_lang || jsonb_build_object(p_language, coalesce(p_code, '')),
         last_lang    = p_language,
         updated_at   = clock_timestamp();

  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------
-- record_code_result  (called by submit-code, AFTER Judge0 has run
-- every test). This is the only place a coding question is marked
-- solved. The score is derived purely from the question's difficulty,
-- exactly like submit_answer() does for SQL — never from anything the
-- Edge Function or the browser claims.
-- ---------------------------------------------------------------------
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
  v_score  := case when v_solved then public.points_for(v_aq.difficulty) else 0 end;

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


-- ---------------------------------------------------------------------
-- record_run_result  (called by execute-code, for "Run Code")
-- Audit-only: never touches submissions/score. Public tests only.
-- ---------------------------------------------------------------------
create or replace function public.record_run_result(
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
begin
  select * into v_attempt from public.attempts where id = p_attempt_id and access_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_attempt.status <> 'active' or clock_timestamp() >= v_attempt.expires_at then
    return jsonb_build_object('ok', false, 'error', 'attempt_closed');
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
    (p_attempt_id, p_question_id, 'run', p_language, p_status, p_passed, p_total,
     p_execution_ms, p_error_message, p_code_length, clock_timestamp());

  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------
-- get_code_draft  (called by get-attempt indirectly / by the client on
-- question load) – returns saved per-language code for one question.
-- ---------------------------------------------------------------------
create or replace function public.get_code_drafts(
  p_attempt_id uuid,
  p_token      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id and access_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'drafts', coalesce((
      select jsonb_object_agg(question_id::text, jsonb_build_object(
               'code_by_lang', code_by_lang,
               'last_lang', last_lang
             ))
      from public.code_drafts
      where attempt_id = p_attempt_id
    ), '{}'::jsonb)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- get_attempt_state override
--
-- Re-create the EXISTING function (same name/signature, so every caller
-- keeps working unchanged) and additionally include, for coding
-- questions only, the function signature + per-language starter code +
-- this attempt's saved code drafts. Hidden AND public tests are never
-- included here — Run/Submit fetch those separately server-side.
-- ---------------------------------------------------------------------
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
             'points',          public.points_for(aq.difficulty),
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

revoke execute on function public.get_attempt_state(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.get_attempt_state(uuid, text, boolean) to service_role;


-- ---------------------------------------------------------------------
-- RLS / privileges for the new tables
-- ---------------------------------------------------------------------
alter table public.code_drafts      enable row level security;
alter table public.code_submissions enable row level security;

-- Admins can read submissions for debugging/monitoring; never write.
create policy code_submissions_admin_read on public.code_submissions
  for select to authenticated using (public.is_admin());

revoke all on public.code_drafts, public.code_submissions from public, anon, authenticated;
grant select on public.code_submissions to authenticated;

revoke execute on function public.get_public_tests(uuid, text, uuid)                                     from public, anon, authenticated;
revoke execute on function public.get_judge_context(uuid, text, uuid)                                     from public, anon, authenticated;
revoke execute on function public.autosave_code(uuid, text, uuid, text, text)                             from public, anon, authenticated;
revoke execute on function public.record_code_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) from public, anon, authenticated;
revoke execute on function public.record_run_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer)   from public, anon, authenticated;
revoke execute on function public.get_code_drafts(uuid, text)                                             from public, anon, authenticated;

grant execute on function public.get_public_tests(uuid, text, uuid)                                     to service_role;
grant execute on function public.get_judge_context(uuid, text, uuid)                                     to service_role;
grant execute on function public.autosave_code(uuid, text, uuid, text, text)                             to service_role;
grant execute on function public.record_code_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) to service_role;
grant execute on function public.record_run_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer)   to service_role;
grant execute on function public.get_code_drafts(uuid, text)                                             to service_role;

-- Admins manage coding_config through the existing questions_admin_all
-- policy (already granted select/insert/update/delete on public.questions).
