-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 004: fix Judge0 request limits
--
-- Run AFTER 001/002/003. Purely corrective — no schema changes, no data
-- deleted, only two things updated:
--
--   1. Every existing question's coding_config->>'memory_limit_kb' is
--      brought down from 262144 to 256000, which matches Judge0 CE's
--      documented memory-limit ceiling. 262144 KB (256 MiB, i.e. 2^18)
--      was never itself a problem for the memory_limit field alone --
--      the real bug was in the Edge Function (see below) -- but 256000
--      is what Judge0 CE actually enforces as a ceiling, so this keeps
--      the stored config truthful to what will actually be requested.
--
--   2. get_public_tests()'s fallback default (used only when a
--      question's coding_config omits memory_limit_kb entirely) is
--      updated from 262144 to 256000 to match. This function is
--      re-created with the EXACT same signature and behaviour as in
--      001_code_execution.sql otherwise, so every caller keeps working
--      unchanged; only the one literal default value changes.
--
-- THE ACTUAL BUG this migration accompanies was in
-- supabase/functions/_shared/judge0.ts: stack_limit was sent as a copy
-- of the FULL memory_limit (e.g. 262144 KB) instead of its own,
-- independently-capped value, exceeding Judge0 CE's documented
-- stack-limit ceiling of 128000 KB and causing Judge0 to reject the
-- request outright (surfacing to participants as a generic 500). That
-- part of the fix lives entirely in judge0.ts (clampSubmissionLimits),
-- which now clamps memory_limit to <= 256000 and stack_limit to
-- <= 128000 (and never more than memory_limit) on every request,
-- regardless of what a question's coding_config asks for. This
-- migration just brings the STORED config values in line with that same
-- ceiling so they describe what Judge0 will actually honour.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Update every existing coding question's stored memory_limit_kb.
--    Matched by category + the same JSONB key already in use — no
--    hardcoded ids, no question titles needed, so this covers every
--    coding question in the bank (including any an admin may have added
--    since migration 003) rather than re-listing all 8 by name.
-- ---------------------------------------------------------------------
update public.questions
set coding_config = jsonb_set(coding_config, '{memory_limit_kb}', '256000'::jsonb)
where category = 'coding'
  and coding_config is not null
  and (coding_config->>'memory_limit_kb')::numeric = 262144;


-- ---------------------------------------------------------------------
-- 2. get_public_tests() override — identical to the version in
--    001_code_execution.sql except the memory_limit_kb fallback default
--    (262144 -> 256000). Every caller (get_judge_context, execute-code,
--    submit-code) keeps working unchanged since the function's name,
--    parameters and return shape are untouched.
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
    -- 256000 KB matches Judge0 CE's documented memory ceiling (was 262144).
    'memory_limit_kb', coalesce((v_q.coding_config->>'memory_limit_kb')::integer, 256000)
  );
end;
$$;

revoke execute on function public.get_public_tests(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.get_public_tests(uuid, text, uuid) to service_role;


-- ---------------------------------------------------------------------
-- Sanity check: warn if any active coding question still stores a
-- memory_limit_kb above the Judge0 ceiling after this migration, so a
-- differently-shaped question bank (e.g. one an admin edited directly)
-- doesn't silently keep the bug.
-- ---------------------------------------------------------------------
do $$
declare
  v_over text;
begin
  select string_agg(title, ', ') into v_over
    from public.questions
   where category = 'coding'
     and is_active
     and coding_config is not null
     and (coding_config->>'memory_limit_kb')::numeric > 256000;
  if v_over is not null then
    raise warning 'Coding questions still storing memory_limit_kb above Judge0''s 256000 KB ceiling after migration 004: %. '
      'Judge0 will clamp the actual request regardless (see judge0.ts), but the stored config no longer matches '
      'what will really be requested — consider updating these via Admin > Questions.', v_over;
  end if;
end $$;
