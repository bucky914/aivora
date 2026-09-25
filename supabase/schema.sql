-- =====================================================================
-- Bug Busters – AIVORA 2K26 · database schema
--
-- Run this whole file once in the Supabase SQL Editor.
-- Then run migrations 001–007. seed.sql is intentionally empty; migration 007 loads the production question bank.
--
-- Security model
--   * Participants never touch the tables directly. Their browser calls
--     Edge Functions, which use the service_role key to call the
--     SECURITY DEFINER functions defined below.
--   * Every participant attempt has a secret access_token. It is the only
--     thing that lets a browser read or change that attempt.
--   * Admins sign in with Supabase Auth. RLS only lets users listed in
--     public.admins read results and manage questions.
--   * Coding/SQL execution is configured by migrations 001–007. Judge
--     fixtures and hidden tests live inside question JSON, not in public
--     application tables.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.participants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  participant_no text not null unique check (char_length(btrim(participant_no)) between 1 and 30),
  created_at     timestamptz not null default now()
);

create table public.attempts (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  -- Secret that proves a browser owns this attempt (64 hex characters).
  access_token   text not null
                 default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  started_at     timestamptz not null,
  expires_at     timestamptz not null,
  submitted_at   timestamptz,
  status         text not null default 'active'
                 check (status in ('active', 'completed', 'expired')),
  created_at     timestamptz not null default now(),
  -- One attempt per participant: re-entering the same details resumes it.
  constraint attempts_one_per_participant unique (participant_id),
  constraint attempts_expiry_after_start check (expires_at > started_at)
);

create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in ('coding', 'sql')),
  difficulty      text not null check (difficulty in ('easy', 'medium', 'hard')),
  title           text not null,
  description     text not null,
  -- [{"input": "...", "output": "...", "explanation": "..."}]
  examples        jsonb not null default '[]'::jsonb,
  constraints     text,
  input_format    text,
  output_format   text,
  starter_content text,
  points          integer not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint questions_points_match_category_difficulty check (
    (category = 'coding' and difficulty = 'easy'   and points = 10) or
    (category = 'coding' and difficulty = 'medium' and points = 20) or
    (category = 'coding' and difficulty = 'hard'   and points = 30) or
    (category = 'sql'    and difficulty = 'easy'   and points = 5)  or
    (category = 'sql'    and difficulty = 'medium' and points = 10) or
    (category = 'sql'    and difficulty = 'hard'   and points = 15)
  )
);

create table public.attempt_questions (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.attempts (id) on delete cascade,
  -- RESTRICT: a question that was given to someone cannot be deleted
  -- (disable it instead). This keeps every past attempt intact.
  question_id   uuid not null references public.questions (id) on delete restrict,
  category      text not null,
  difficulty    text not null,
  display_order integer not null,
  created_at    timestamptz not null default now(),
  unique (attempt_id, question_id),
  unique (attempt_id, category, display_order)
);

create table public.submissions (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.attempts (id) on delete cascade,
  question_id  uuid not null,
  answer       text check (answer is null or char_length(answer) <= 20000),
  is_solved    boolean not null default false,
  score        integer not null default 0 check (score in (0, 5, 10, 15, 20, 30)),
  submitted_at timestamptz not null default now(),
  -- One row per question per attempt: no duplicate scoring.
  unique (attempt_id, question_id),
  -- A participant can only submit for a question that was assigned to them.
  foreign key (attempt_id, question_id)
    references public.attempt_questions (attempt_id, question_id) on delete cascade
);

-- People allowed to use admin.html. Add yourself after creating the auth user.
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index questions_pick_idx on public.questions (category, difficulty) where is_active;
create index attempt_questions_attempt_idx on public.attempt_questions (attempt_id);
create index submissions_attempt_idx on public.submissions (attempt_id);


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Score depends on BOTH category and difficulty.
create or replace function public.points_for(p_category text, p_difficulty text)
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

create or replace function public.to_ms(p_ts timestamptz)
returns bigint
language sql
immutable
as $$
  select floor(extract(epoch from p_ts) * 1000)::bigint;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Solved counts and scores for one attempt.
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


-- ---------------------------------------------------------------------
-- create_attempt  (called by the start-attempt Edge Function)
--
-- One transaction: find/create the participant, create the attempt with a
-- 45-minute server-side expiry, pick the random questions and save them.
-- If the participant already has an attempt, it is returned instead
-- (resume) – the clock and the questions never restart.
-- ---------------------------------------------------------------------
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

  -- Same number must come with the same name (case-insensitive).
  if lower(v_participant.name) <> lower(v_name) then
    return jsonb_build_object('ok', false, 'error', 'name_mismatch');
  end if;

  select * into v_attempt from public.attempts where participant_id = v_participant.id;

  if not found then
    -- Make sure the question bank can fill 2 easy + 2 medium + 1 hard per category.
    -- Raising rolls back everything, including a brand-new participant row.
    for v_need in
      select * from (values
        ('coding', 'easy', 2), ('coding', 'medium', 2), ('coding', 'hard', 1),
        ('sql',    'easy', 2), ('sql',    'medium', 2), ('sql',    'hard', 1)
      ) as t (category, difficulty, need)
    loop
      select count(*) into v_have
        from public.questions q
       where q.is_active and q.category = v_need.category and q.difficulty = v_need.difficulty;
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

      -- Random pick per category and difficulty, saved once for the whole attempt.
      insert into public.attempt_questions (attempt_id, question_id, category, difficulty, display_order)
      select v_attempt.id, w.id, w.category, w.difficulty,
             (row_number() over (
                partition by w.category
                order by case w.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end, random()
             ))::integer
        from (
          select q.id, q.category, q.difficulty,
                 row_number() over (partition by q.category, q.difficulty order by random()) as rn
            from public.questions q
           where q.is_active
        ) w
       where (w.difficulty in ('easy', 'medium') and w.rn <= 2)
          or (w.difficulty = 'hard' and w.rn <= 1);
    else
      -- Two requests raced; the other one created it. Use that attempt.
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


-- ---------------------------------------------------------------------
-- get_attempt_state  (called by the get-attempt Edge Function)
--
-- Returns the attempt, the participant, ONLY the questions assigned to this
-- attempt (with saved answers) and a score summary. Also reports the server
-- clock so the browser timer never depends on the participant's own clock.
-- If the deadline has passed, the attempt is marked expired here.
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
             'answer',          s.answer,
             'is_solved',       coalesce(s.is_solved, false),
             'score',           coalesce(s.score, 0)
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
-- submit_answer  (called by the submit-answer Edge Function)
--
-- The attempt row is locked, then the server clock is checked against
-- expires_at. The score comes only from the difficulty assigned to the
-- question, and the unique (attempt_id, question_id) row makes repeated
-- clicks harmless: the same question can never be scored twice.
--   p_answer NULL  -> keep the saved answer
--   p_solved NULL  -> keep the current solved state
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- finish_attempt  (called by the finish-attempt Edge Function)
-- The participant chose to finish early. After this nothing can change.
-- ---------------------------------------------------------------------
create or replace function public.finish_attempt(p_attempt_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.attempts;
begin
  select * into v_attempt
    from public.attempts
   where id = p_attempt_id and access_token = p_token
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_attempt.status = 'active' then
    if clock_timestamp() >= v_attempt.expires_at then
      update public.attempts
         set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
       where id = v_attempt.id;
    else
      update public.attempts
         set status = 'completed', submitted_at = clock_timestamp()
       where id = v_attempt.id;
    end if;
    select * into v_attempt from public.attempts where id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_attempt.status,
    'summary', public.attempt_summary(v_attempt.id)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- Admin: mark abandoned attempts (tab closed, time ran out) as expired.
-- ---------------------------------------------------------------------
create or replace function public.admin_expire_stale()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.attempts
     set status = 'expired', submitted_at = coalesce(submitted_at, expires_at)
   where status = 'active' and expires_at <= clock_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------------
-- Admin results view (one row per attempt).
-- security_invoker = the caller's RLS applies, so only admins see rows.
-- An "active" attempt past its deadline is reported as expired.
-- ---------------------------------------------------------------------
create or replace view public.admin_results
with (security_invoker = true) as
select
  a.id as attempt_id,
  p.name,
  p.participant_no,
  a.started_at,
  a.expires_at,
  case when a.status = 'active' and a.expires_at <= now() then 'expired' else a.status end as status,
  coalesce(a.submitted_at, case when a.expires_at <= now() then a.expires_at end) as ended_at,
  count(*) filter (where aq.category = 'coding' and coalesce(s.is_solved, false))::integer as coding_solved,
  count(*) filter (where aq.category = 'sql'    and coalesce(s.is_solved, false))::integer as sql_solved,
  count(*) filter (where coalesce(s.is_solved, false))::integer                             as total_solved,
  coalesce(sum(s.score) filter (where aq.category = 'coding'), 0)::integer                  as coding_score,
  coalesce(sum(s.score) filter (where aq.category = 'sql'), 0)::integer                     as sql_score,
  coalesce(sum(s.score), 0)::integer                                                        as total_score
from public.attempts a
join public.participants p on p.id = a.participant_id
left join public.attempt_questions aq on aq.attempt_id = a.id
left join public.submissions s
       on s.attempt_id = aq.attempt_id and s.question_id = aq.question_id
group by a.id, p.id;


-- ---------------------------------------------------------------------
-- Row Level Security
-- Only admins can read participant data. Participants get NO direct table
-- access at all (no policy = no rows); they go through Edge Functions.
-- ---------------------------------------------------------------------
alter table public.participants       enable row level security;
alter table public.attempts           enable row level security;
alter table public.questions          enable row level security;
alter table public.attempt_questions  enable row level security;
alter table public.submissions        enable row level security;
alter table public.admins             enable row level security;

create policy admins_read_self on public.admins
  for select to authenticated using (user_id = auth.uid());

create policy participants_admin_read on public.participants
  for select to authenticated using (public.is_admin());

create policy attempts_admin_read on public.attempts
  for select to authenticated using (public.is_admin());

-- Lets an admin reset a participant (they can then start again).
create policy attempts_admin_delete on public.attempts
  for delete to authenticated using (public.is_admin());

create policy attempt_questions_admin_read on public.attempt_questions
  for select to authenticated using (public.is_admin());

create policy submissions_admin_read on public.submissions
  for select to authenticated using (public.is_admin());

create policy questions_admin_all on public.questions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- Privileges (defense in depth on top of RLS)
-- ---------------------------------------------------------------------
revoke all on public.participants, public.attempts, public.questions,
              public.attempt_questions, public.submissions, public.admins,
              public.admin_results
  from public, anon, authenticated;

grant select on public.participants, public.attempts, public.attempt_questions,
                public.submissions, public.admins, public.admin_results
  to authenticated;
grant delete on public.attempts to authenticated;
grant select, insert, update, delete on public.questions to authenticated;

-- points_for is an internal scoring helper, not a participant RPC.
revoke execute on function public.points_for(text, text) from public, anon, authenticated;
grant execute on function public.points_for(text, text) to service_role;

-- Functions: only the service role (Edge Functions) may call the
-- participant functions. Admin helpers are for signed-in users.
revoke execute on function public.attempt_summary(uuid)                         from public, anon, authenticated;
revoke execute on function public.create_attempt(text, text, integer)           from public, anon, authenticated;
revoke execute on function public.get_attempt_state(uuid, text, boolean)        from public, anon, authenticated;
revoke execute on function public.submit_answer(uuid, text, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.finish_attempt(uuid, text)                    from public, anon, authenticated;
revoke execute on function public.is_admin()                                    from public, anon;
revoke execute on function public.admin_expire_stale()                          from public, anon;

grant execute on function public.attempt_summary(uuid)                          to service_role;
grant execute on function public.create_attempt(text, text, integer)            to service_role;
grant execute on function public.get_attempt_state(uuid, text, boolean)         to service_role;
grant execute on function public.submit_answer(uuid, text, uuid, text, boolean) to service_role;
grant execute on function public.finish_attempt(uuid, text)                     to service_role;
grant execute on function public.is_admin()                                     to authenticated;
grant execute on function public.admin_expire_stale()                           to authenticated;
