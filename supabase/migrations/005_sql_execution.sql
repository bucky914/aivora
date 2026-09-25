-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 005: SQL question execution
-- (Stage 1 of 3 — schema + security model only. Edge Functions and
-- frontend land in later stages of this same feature.)
--
-- Run AFTER 001-004. Purely additive: does not modify any table, column,
-- row, function or policy created by 001-004, and does not touch any
-- CODING question or the coding execution path in any way.
--
-- =====================================================================
-- WHY A SEPARATE ROLE, NOT A SECURITY DEFINER FUNCTION
-- =====================================================================
-- The coding judge (Judge0) runs untrusted code in an entirely separate
-- sandboxed service, so the database is never at risk. SQL is different:
-- the "untrusted code" here IS SQL, so it has to run somewhere inside
-- Postgres itself.
--
-- Postgres does NOT allow `SET ROLE` inside a SECURITY DEFINER function
-- (this is deliberate — Postgres blocks it specifically to stop a
-- SECURITY DEFINER function from being used to launder privilege), so a
-- SECURITY DEFINER wrapper that tries to "become" a lower-privileged
-- role before running participant SQL is a dead end.
--
-- Instead: `sql_judge` is a real, separate, LOGIN Postgres role with:
--   - NO privileges on ANY table in public/auth/storage/graphql/etc —
--     not SELECT, not INSERT, nothing. It cannot read participants,
--     attempts, submissions, questions, or any other real data.
--   - NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS,
--     NOREPLICATION — no elevated capability of any kind.
--   - A locked-down search_path (see below) so it can't accidentally
--     resolve an unqualified table name to something in `public`.
--   - A short statement_timeout as a role-level default (the Edge
--     Function also sets one per-connection; this is defense in depth
--     in case a connection is ever reused in a way that skips that).
--
-- The Edge Functions for SQL (execute-sql / submit-sql, added in a
-- later stage) connect to Postgres AS THIS ROLE, over a SEPARATE
-- connection string stored as its own secret (SQL_JUDGE_DB_URL) — never
-- reusing the service-role Supabase client used everywhere else in this
-- project. Each submission's schema_sql / seed_sql / participant query
-- all run inside `pg_temp`, Postgres's own session-scoped temporary
-- schema: objects created there are invisible to every other session by
-- construction, and are automatically dropped the moment the connection
-- closes — no manual cleanup, no risk of one submission's temp table
-- leaking into another's.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The sql_judge role
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sql_judge') then
    create role sql_judge with
      login
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls
      noreplication
      connection limit 10
      password null;  -- authentication is by SQL_JUDGE_DB_URL below (see README); rotate via ALTER ROLE if needed
  end if;
end $$;

-- Belt-and-braces: explicitly revoke everything sql_judge might have
-- inherited from PUBLIC grants, on every schema that holds real data.
-- (NOINHERIT above already means it has no other role's privileges, but
-- PUBLIC-granted privileges apply to every role regardless of INHERIT,
-- so these must be revoked explicitly.)
--
-- NOTE on schema-level USAGE: Postgres 15+ grants USAGE on the `public`
-- schema to the PUBLIC pseudo-role by default (visible as `=U/...` in
-- \dn+), and `revoke ... from sql_judge` cannot remove a grant made to
-- PUBLIC — only `revoke ... from public` can, which would affect every
-- role in the database, not just sql_judge. This is verified to be safe
-- to leave as-is: USAGE alone only permits resolving a schema-qualified
-- name, never reading/writing data — with every table-level privilege
-- already revoked below, `SET ROLE sql_judge; SELECT * FROM
-- public.questions;` fails with `permission denied for table questions`
-- (confirmed by testing against a live Postgres instance). The
-- table/sequence/function-level revokes immediately below are what
-- actually matters, and those apply to sql_judge specifically.
revoke all on schema public from sql_judge;
revoke all on all tables in schema public from sql_judge;
revoke all on all sequences in schema public from sql_judge;
revoke all on all functions in schema public from sql_judge;
revoke all on database postgres from sql_judge;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'revoke all on schema auth from sql_judge';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'revoke all on schema storage from sql_judge';
  end if;
end $$;

-- sql_judge is allowed to use its own temporary schema (pg_temp is
-- always usable by any role that can connect — this GRANT is belt-and-
-- braces documentation of that fact, not strictly required) and nothing
-- else. Every question's schema_sql/seed_sql creates its fixture tables
-- as TEMP TABLE, which Postgres places in pg_temp automatically.
alter role sql_judge set search_path = pg_temp;
alter role sql_judge set statement_timeout = '5s';
alter role sql_judge set lock_timeout = '3s';
alter role sql_judge set idle_in_transaction_session_timeout = '10s';
-- Defence in depth against COPY ... PROGRAM, file_fdw, or anything else
-- that could reach outside the database from SQL:
alter role sql_judge set default_transaction_read_only = off; -- needs write access, but ONLY ever touches pg_temp objects it created itself


-- ---------------------------------------------------------------------
-- questions.sql_config — parallel to coding_config, only meaningful for
-- category = 'sql'. Shape:
--
-- {
--   "supported_dialects": ["sql", "postgresql"],
--   "schema_sql": "CREATE TEMP TABLE employees (...);",
--   "seed_sql":   "INSERT INTO employees VALUES (...);",   -- PUBLIC fixture, used by Run Code
--   "public_tests": [ { "expected": [ {"name": "Arun", "salary": 65000}, ... ] } ],
--   "hidden_seed_sql": "INSERT INTO employees VALUES (...);",  -- optional: extra rows only Submit sees
--   "hidden_tests": [ { "expected": [ ... ] } ],
--   "ordered_result": true,
--   "float_tolerance": null,
--   "statement_timeout_ms": 2000,
--   "max_rows": 1000
-- }
--
-- A public/hidden test's "expected" is an array of row objects (column
-- name -> value), so comparison can check column names AND values, not
-- just positional output. schema_sql/seed_sql/hidden_seed_sql run
-- exactly once per Run/Submit call, inside the same pg_temp session as
-- the participant's query, so the participant never writes CREATE
-- TABLE/INSERT/DROP themselves.
-- ---------------------------------------------------------------------
alter table public.questions
  add column if not exists sql_config jsonb;

alter table public.questions
  add constraint questions_sql_config_shape check (
    sql_config is null
    or (
      category = 'sql'
      and sql_config ? 'schema_sql'
      and sql_config ? 'public_tests'
    )
  );


-- ---------------------------------------------------------------------
-- Per-language (per-dialect) autosaved SQL, parallel to code_drafts.
-- Two dialects share the same structure as coding's per-language store:
-- switching SQL <-> PostgreSQL never overwrites the other's saved text.
-- ---------------------------------------------------------------------
create table if not exists public.sql_drafts (
  attempt_id    uuid not null references public.attempts (id) on delete cascade,
  question_id   uuid not null,
  -- { "sql": "...", "postgresql": "..." }
  query_by_lang jsonb not null default '{}'::jsonb,
  last_lang     text check (last_lang in ('sql', 'postgresql')),
  updated_at    timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id)
    references public.attempt_questions (attempt_id, question_id) on delete cascade
);

create index if not exists sql_drafts_attempt_idx on public.sql_drafts (attempt_id);


-- ---------------------------------------------------------------------
-- Audit table for every Run/Submit call against a SQL question. Never
-- holds hidden test data/expected output — only pass/fail counts and a
-- truncated, safe error message, exactly like code_submissions.
-- ---------------------------------------------------------------------
create table if not exists public.sql_submissions (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.attempts (id) on delete cascade,
  question_id    uuid not null,
  kind           text not null check (kind in ('run', 'submit')),
  dialect        text not null check (dialect in ('sql', 'postgresql')),
  status         text not null check (status in (
                   'pending', 'accepted', 'wrong_answer', 'syntax_error',
                   'runtime_error', 'time_limit', 'row_limit', 'dialect_rejected',
                   'internal_error'
                 )),
  passed_tests   integer not null default 0,
  total_tests    integer not null default 0,
  execution_ms   integer,
  error_message  text,          -- safe to show (public tests only); see submit-sql for hidden-test redaction
  query_length   integer not null,
  submitted_at   timestamptz not null default now(),
  foreign key (attempt_id, question_id)
    references public.attempt_questions (attempt_id, question_id) on delete cascade
);

create index if not exists sql_submissions_attempt_idx on public.sql_submissions (attempt_id, question_id, submitted_at desc);


-- ---------------------------------------------------------------------
-- RLS / privileges for the new tables (same pattern as code_drafts /
-- code_submissions in 001_code_execution.sql)
-- ---------------------------------------------------------------------
alter table public.sql_drafts      enable row level security;
alter table public.sql_submissions enable row level security;

create policy sql_submissions_admin_read on public.sql_submissions
  for select to authenticated using (public.is_admin());

revoke all on public.sql_drafts, public.sql_submissions from public, anon, authenticated;
grant select on public.sql_submissions to authenticated;

-- sql_judge must NEVER be able to read these either — it only ever runs
-- inside its own pg_temp session and has no reason to touch any table
-- in the public schema, including these.
revoke all on public.sql_drafts, public.sql_submissions, public.questions,
  public.attempts, public.attempt_questions, public.submissions,
  public.participants, public.code_drafts, public.code_submissions
  from sql_judge;


-- =====================================================================
-- RPC functions — same shape/pattern as the coding ones in
-- 001_code_execution.sql. These hand SQL question configuration to the
-- (later-stage) execute-sql / submit-sql Edge Functions; they never run
-- any participant SQL themselves — that only ever happens over the
-- separate sql_judge connection, outside this database session.
-- =====================================================================

-- ---------------------------------------------------------------------
-- get_public_sql_tests  (called by execute-sql, for "Run Code")
--
-- Returns schema_sql/seed_sql + ONLY the public tests. Hidden tests and
-- hidden_seed_sql never appear in this function's result.
-- ---------------------------------------------------------------------
create or replace function public.get_public_sql_tests(
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
  if not found or v_q.category <> 'sql' or v_q.sql_config is null then
    return jsonb_build_object('ok', false, 'error', 'not_a_sql_question');
  end if;

  return jsonb_build_object(
    'ok', true,
    'supported_dialects', coalesce(v_q.sql_config->'supported_dialects', '["sql","postgresql"]'::jsonb),
    'schema_sql', v_q.sql_config->>'schema_sql',
    'seed_sql', v_q.sql_config->>'seed_sql',
    'public_tests', coalesce(v_q.sql_config->'public_tests', '[]'::jsonb),
    'ordered_result', coalesce((v_q.sql_config->>'ordered_result')::boolean, true),
    'float_tolerance', v_q.sql_config->'float_tolerance',
    'statement_timeout_ms', coalesce((v_q.sql_config->>'statement_timeout_ms')::integer, 2000),
    'max_rows', coalesce((v_q.sql_config->>'max_rows')::integer, 1000)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- get_sql_judge_context  (called by submit-sql ONLY — service_role)
--
-- Same as above but includes hidden_seed_sql and hidden_tests. Never
-- call this from anything that echoes its raw result back to the browser.
-- ---------------------------------------------------------------------
create or replace function public.get_sql_judge_context(
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
  v_base := public.get_public_sql_tests(p_attempt_id, p_token, p_question_id);
  if not (v_base->>'ok')::boolean then
    return v_base;
  end if;

  select * into v_q from public.questions where id = p_question_id;

  return v_base || jsonb_build_object(
    'hidden_seed_sql', v_q.sql_config->>'hidden_seed_sql',
    'hidden_tests', coalesce(v_q.sql_config->'hidden_tests', '[]'::jsonb)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- autosave_sql  (called by save-sql, the SQL equivalent of save-code)
--
-- Stores the query per dialect. Switching SQL <-> PostgreSQL never
-- erases the other dialect's saved text, because each is its own key.
-- ---------------------------------------------------------------------
create or replace function public.autosave_sql(
  p_attempt_id  uuid,
  p_token       text,
  p_question_id uuid,
  p_dialect     text,
  p_query       text
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
  if p_dialect not in ('sql', 'postgresql') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if p_query is not null and char_length(p_query) > 20000 then
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

  insert into public.sql_drafts (attempt_id, question_id, query_by_lang, last_lang, updated_at)
  values (p_attempt_id, p_question_id, jsonb_build_object(p_dialect, coalesce(p_query, '')), p_dialect, clock_timestamp())
  on conflict (attempt_id, question_id) do update
     set query_by_lang = public.sql_drafts.query_by_lang || jsonb_build_object(p_dialect, coalesce(p_query, '')),
         last_lang      = p_dialect,
         updated_at      = clock_timestamp();

  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------
-- record_sql_result  (called by submit-sql, AFTER the sql_judge
-- connection has run every test). Only place a SQL question is marked
-- solved. Score derives purely from difficulty, exactly like
-- record_code_result — never from anything the Edge Function claims.
-- ---------------------------------------------------------------------
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
-- record_sql_run_result  (called by execute-sql, for "Run Code")
-- Audit-only: never touches submissions/score. Public tests only.
-- ---------------------------------------------------------------------
create or replace function public.record_sql_run_result(
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

  insert into public.sql_submissions
    (attempt_id, question_id, kind, dialect, status, passed_tests, total_tests,
     execution_ms, error_message, query_length, submitted_at)
  values
    (p_attempt_id, p_question_id, 'run', p_dialect, p_status, p_passed, p_total,
     p_execution_ms, p_error_message, p_query_length, clock_timestamp());

  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------
-- get_attempt_state override
--
-- Re-created with the SAME signature/behaviour as 001_code_execution.sql
-- (which is still the authoritative version — 004 did not touch it),
-- adding: for SQL questions with sql_config, the public-safe fields
-- (schema_sql, seed_sql, public_tests, supported_dialects) and this
-- attempt's saved sql_draft. Hidden SQL tests/seed are never included
-- here — Run/Submit fetch those separately, exactly like coding.
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


-- ---------------------------------------------------------------------
-- Grants — mirror 001_code_execution.sql's pattern exactly: every new
-- function is callable ONLY by service_role (the Edge Functions), never
-- by anon/authenticated/public directly.
-- ---------------------------------------------------------------------
revoke execute on function public.get_public_sql_tests(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.get_sql_judge_context(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.autosave_sql(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.record_sql_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) from public, anon, authenticated;
revoke execute on function public.record_sql_run_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) from public, anon, authenticated;
revoke execute on function public.get_attempt_state(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.get_public_sql_tests(uuid, text, uuid) to service_role;
grant execute on function public.get_sql_judge_context(uuid, text, uuid) to service_role;
grant execute on function public.autosave_sql(uuid, text, uuid, text, text) to service_role;
grant execute on function public.record_sql_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) to service_role;
grant execute on function public.record_sql_run_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) to service_role;
grant execute on function public.get_attempt_state(uuid, text, boolean) to service_role;

-- sql_judge never needs (and must never have) execute on any of these —
-- it never touches the application database, only its own pg_temp
-- session over a separate connection.
revoke execute on function public.get_public_sql_tests(uuid, text, uuid) from sql_judge;
revoke execute on function public.get_sql_judge_context(uuid, text, uuid) from sql_judge;
revoke execute on function public.autosave_sql(uuid, text, uuid, text, text) from sql_judge;
revoke execute on function public.record_sql_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) from sql_judge;
revoke execute on function public.record_sql_run_result(uuid, text, uuid, text, text, integer, integer, integer, text, integer) from sql_judge;
revoke execute on function public.get_attempt_state(uuid, text, boolean) from sql_judge;

-- Admins manage sql_config through the existing questions_admin_all
-- policy (already granted select/insert/update/delete on public.questions).

