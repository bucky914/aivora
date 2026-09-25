-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 009: coding-only contest bank
--
-- Final contest configuration:
--   * 10 active coding / DSA questions total
--   * 5 easy + 5 medium
--   * no active SQL questions
--   * each new attempt receives all 10 coding questions in random order
--
-- This migration intentionally DISABLES every other question instead of
-- deleting rows, because past attempt_questions may reference them.
-- =====================================================================

begin;

-- Keep old rows for history, but prevent them from being selected for new
-- AIVORA 2K26 / Bug Busters attempts.
update public.questions
set is_active = false;

-- Activate exactly five easy + five medium coding questions from the
-- previously supplied DSA bank.
update public.questions
set is_active = true,
    title = regexp_replace(title, '^LeetCode #[0-9]+ — ', ''),
    description = regexp_replace(description, '^LeetCode #[0-9]+\. ', '')
where category = 'coding'
  and difficulty = 'easy'
  and regexp_replace(title, '^LeetCode #[0-9]+ — ', '') in (
    'Largest Integer With Given Digit Sum',
    'Valid Palindrome II',
    'Pascal''s Triangle II',
    'Ugly Number',
    'Vowel-Consonant Score'
  );

update public.questions
set is_active = true,
    title = regexp_replace(title, '^LeetCode #[0-9]+ — ', ''),
    description = regexp_replace(description, '^LeetCode #[0-9]+\. ', '')
where category = 'coding'
  and difficulty = 'medium'
  and regexp_replace(title, '^LeetCode #[0-9]+ — ', '') in (
    'Odd Even Linked List',
    'Container With Most Water',
    'Bulls and Cows',
    'Alice and Bob Playing Flower Game',
    'Count and Say'
  );

-- Fail the migration instead of silently publishing the wrong bank.
do $$
declare
  v_easy integer;
  v_medium integer;
  v_sql integer;
begin
  select count(*) into v_easy
    from public.questions
   where is_active and category = 'coding' and difficulty = 'easy';

  select count(*) into v_medium
    from public.questions
   where is_active and category = 'coding' and difficulty = 'medium';

  select count(*) into v_sql
    from public.questions
   where is_active and category = 'sql';

  if v_easy <> 5 or v_medium <> 5 or v_sql <> 0 then
    raise exception 'Bug Busters question bank validation failed: coding easy=%, coding medium=%, active SQL=% (expected 5, 5, 0)',
      v_easy, v_medium, v_sql;
  end if;
end $$;

-- Replace the assignment logic so every new attempt receives 5 easy + 5
-- medium coding questions and no SQL questions.
create or replace function public.create_attempt(
  p_name             text,
  p_participant_no   text,
  p_duration_minutes integer default 45
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name        text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_no          text := upper(btrim(coalesce(p_participant_no, '')));
  v_participant public.participants;
  v_attempt     public.attempts;
  v_need        record;
  v_have        integer;
  v_now         timestamptz := now();
  v_resumed     boolean := true;
begin
  if char_length(v_name) not between 1 and 80 or char_length(v_no) not between 1 and 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  insert into public.participants (name, participant_no)
  values (v_name, v_no)
  on conflict (participant_no) do nothing;

  select * into v_participant from public.participants where participant_no = v_no;

  if lower(v_participant.name) <> lower(v_name) then
    return jsonb_build_object('ok', false, 'error', 'name_mismatch');
  end if;

  select * into v_attempt from public.attempts where participant_id = v_participant.id;

  if not found then
    -- The final contest bank must contain exactly 5 easy + 5 medium coding
    -- questions. No hard or SQL question is assigned.
    for v_need in
      select * from (values
        ('coding', 'easy', 5),
        ('coding', 'medium', 5)
      ) as t (category, difficulty, need)
    loop
      select count(*) into v_have
        from public.questions q
       where q.is_active
         and q.category = v_need.category
         and q.difficulty = v_need.difficulty;

      if v_have < v_need.need then
        raise exception 'not_enough_questions: % / % needs % active questions but only % found',
          v_need.category, v_need.difficulty, v_need.need, v_have;
      end if;
    end loop;

    insert into public.attempts (participant_id, started_at, expires_at, status)
    values (v_participant.id, v_now, v_now + make_interval(mins => p_duration_minutes), 'active')
    on conflict (participant_id) do nothing
    returning * into v_attempt;

    if found then
      v_resumed := false;

      -- All ten active coding questions are assigned once and then kept
      -- fixed for the participant's attempt.
      insert into public.attempt_questions (attempt_id, question_id, category, difficulty, display_order)
      select v_attempt.id,
             w.id,
             w.category,
             w.difficulty,
             row_number() over (
               order by case w.difficulty when 'easy' then 1 else 2 end, random()
             )::integer
        from public.questions w
       where w.is_active
         and w.category = 'coding'
         and w.difficulty in ('easy', 'medium');
    else
      -- Two requests raced; the other one created the attempt. Use that attempt.
      select * into v_attempt from public.attempts where participant_id = v_participant.id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'resumed', v_resumed,
    'attempt_id', v_attempt.id,
    'access_token', v_attempt.access_token,
    'status', v_attempt.status
  );
end;
$$;

commit;
