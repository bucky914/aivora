# Bug Busters – AIVORA 2K26

A timed coding-only contest site. Participants type their **name and participant number**, click **START NOW**, and get **45 minutes** to work through **10 coding / DSA questions** (5 easy and 5 medium). No accounts, no passwords.

It is a plain static site (HTML, CSS, vanilla JavaScript) with a Supabase backend. There is no build step and no framework.

> **SQL questions are really executed and checked.** Participants write PostgreSQL in the Monaco editor and use **Run Code** for public tests or **Submit** for public + hidden tests. The server runs each query against isolated temporary fixtures through the `sql_judge` database role; only a passing server-side comparison can mark the question solved.
>
> **Coding (DSA) questions are really executed**, via [Judge0](https://judge0.com), in a LeetCode-style function-only editor (Monaco). Participants implement just the required function — never `main()`, `input()`, `scanf()`, or `cin` — and the server auto-generates the driver code, runs it against public + hidden test cases, and only a server-side judgement can mark the question solved. See **"Coding execution (Judge0)"** and **"SQL question execution"** below.

## How it works

| Rule | How it is enforced |
| --- | --- |
| 45-minute timer survives refresh | The deadline (`expires_at`) is stored in the database when the attempt is created. The page only counts down to it. |
| Same questions after refresh | The 10 questions are picked once, at start, and stored in `attempt_questions`. |
| 2 easy + 2 medium + 1 hard per category | Chosen at random by the database function `create_attempt`. If the bank is too small, the attempt is refused and nothing is half-created. |
| Points: Coding easy/medium = 10/20 | Calculated inside the database from category + difficulty. Numeric question-point values are not exposed in the participant question payload or UI. |
| No double scoring | One row per attempt + question. Marking solved twice changes nothing; a coding question's first **Accepted** submission is the only one that awards points (`record_code_result`). |
| No answers after time is up | `record_code_result`/`autosave_code` check the database clock and reject late writes — and `get_public_tests`/`get_judge_context` refuse to hand out test cases for an expired attempt, so Judge0 is never even called. |
| Same person resumes, not restarts | Same participant number + same name returns the existing attempt. A different name on the same number is refused. |
| Participants can't read other people's data | Row Level Security gives participants **no** direct table access. They only talk to the contest Edge Functions. |

## Project layout

```
bug-busters/
├── index.html              Home page (name + participant number)
├── contest.html            The contest
├── admin.html               Admin dashboard
├── css/                    style.css (shared + home), contest.css, admin.css
├── js/
│   ├── supabase.js         ← put your Supabase URL + anon key here
│   ├── timer.js            Server-anchored countdown
│   ├── code-editor.js      Coding Monaco wrapper: per-language buffers, Ctrl+Enter/Ctrl+S
│   ├── sql-editor.js       SQL Monaco wrapper: per-dialect (SQL/PostgreSQL) buffers
│   ├── home.js  contest.js  admin.js
├── assets/                 logo.svg, favicon.svg
└── supabase/
    ├── schema.sql          Tables, security rules, database functions
    ├── seed.sql            compatibility seed (question bank is migration-driven)
    ├── migrations/
    │   ├── 001_code_execution.sql        coding_config, code_drafts, code_submissions, judge RPCs
    │   ├── 002_code_execution_seed.sql   fills in coding_config for Two Sum + Valid Parentheses
    │   ├── 003_complete_coding_config.sql  coding_config for all 8 seeded coding questions
    │   ├── 004_fix_judge0_limits.sql     clamps memory/stack/time limits to Judge0 CE's ceilings
    │   ├── 005_sql_execution.sql         sql_judge role, sql_config, sql_drafts/sql_submissions, judge RPCs
    │   ├── 006_sql_seed_config.sql       fills in sql_config for the original sample questions
    │   ├── 007_replace_question_bank.sql  production bank: 25 coding + 20 SQL questions
│   └── 008_category_aware_scoring.sql category-aware scoring + participant point redaction
    ├── config.toml         Turns off JWT checks for all 10 functions
    └── functions/
        ├── start-attempt, get-attempt, submit-answer, finish-attempt   (existing)
        ├── save-code        per-language code autosave
        ├── execute-code     "Run Code" (coding) — public tests only
        ├── submit-code      "Submit" (coding) — public + hidden tests, scores the attempt
        ├── save-sql         per-dialect SQL query autosave
        ├── execute-sql      "Run Code" (SQL) — public tests only
        ├── submit-sql       "Submit" (SQL) — public + hidden tests, scores the attempt
        └── _shared/
            ├── util.ts      (existing) CORS, JSON helpers, credential checks
            ├── judge0.ts    Judge0 HTTP client (reads secrets, never hardcodes them)
            ├── drivers.ts   auto-generates the Python/Java/C/C++ driver around participant code
            ├── compare.ts   normalized coding-result comparison (unordered arrays, float tolerance)
            ├── judge.ts     orchestrates one coding Run/Submit call end-to-end
            ├── sql-judge.ts     connects to Postgres AS the sql_judge role, runs schema/seed/query
            ├── sql-compare.ts   normalized SQL-result comparison (ordered/unordered rows)
            └── sql-guard.ts     dangerous-statement blocklist (defense in depth, not the real boundary)
```

## Coding execution (Judge0)

Coding questions that have a `coding_config` (see `supabase/migrations/002_code_execution_seed.sql`
for example configurations) get the full LeetCode-style workspace:
Monaco editor, a language dropdown (Python 3 / Java / C / C++), **Run Code** (public tests) and
**Submit** (public + hidden tests, scores the question). Coding questions with no `coding_config`
keep the original plain-text "Mark as Solved" flow untouched, and SQL questions are completely
unaffected either way.

### How a submission is judged

1. The participant's function-only code (no `main`, no `input()`) is wrapped by
   `_shared/drivers.ts` into a complete, runnable program **per language**: the test inputs are
   embedded directly in the generated source, the participant's function is called once per test,
   and the program prints one `{"ok":true,"result":...}` or `{"ok":false,"error":"..."}` line per
   test — so one participant crash never loses the other tests' results.
2. That single program is sent to Judge0 **once** (one compile + one run covers every test case).
3. `_shared/compare.ts` compares each printed result against the expected value from
   `coding_config` (exact match by default; a question can opt into unordered-array comparison or
   a float tolerance).
4. `execute-code` only ever fetches **public** tests (`get_public_tests`); `submit-code` fetches
   public **and hidden** tests via `get_judge_context`, which is grantable to `service_role` only.
   A hidden-test failure is reported to the browser as `"Hidden test case failed."` — no input, no
   expected value, no actual output.
5. Only `submit-code` can change score/solved state, and only through `record_code_result`, which
   re-derives the score from the question's category + difficulty and only awards it on the **first**
   `accepted` submission — resubmitting an already-solved question changes nothing.

### Judge0 credentials — Edge Function secrets only

Judge0 credentials are **never** referenced anywhere in `js/*.js` or any HTML file. They are read
only inside the Edge Functions, from environment secrets.

By default this project talks to the **official public Judge0 CE instance at
`https://ce.judge0.com`**, which needs no API key and no RapidAPI account — you can deploy
`execute-code`/`submit-code` with **no Judge0 secrets set at all** and it works out of the box.
Execution uses the standard asynchronous Judge0 flow (`POST /submissions` → poll
`GET /submissions/{token}` until a terminal status), not `wait=true`, since the public instance is
shared and a submission may sit in a queue.

| Secret | Required | Meaning |
| --- | --- | --- |
| `JUDGE0_API_URL` | no (default `https://ce.judge0.com`) | Base URL of your Judge0 instance. Set this only if you want to use RapidAPI or a self-hosted instance instead of the public CE instance. No trailing slash needed. |
| `JUDGE0_API_KEY` | no — only if using RapidAPI or an authenticated self-hosted instance | Sent as `X-RapidAPI-Key`. Leave unset for `ce.judge0.com`. |
| `JUDGE0_API_HOST` | no — only if using RapidAPI | Sent as `X-RapidAPI-Host`, e.g. `judge0-ce.p.rapidapi.com`. Leave unset for `ce.judge0.com`. |
| `JUDGE0_AUTH_TOKEN` | no — only if self-hosted with `AUTHN_HEADER` enabled | Sent as `X-Auth-Token`. Leave unset for `ce.judge0.com` or an unauthenticated self-hosted instance. |
| `JUDGE0_LANG_PYTHON3` | no (default `71`) | Judge0 language id for Python 3.8.1. Override only if your instance numbers languages differently. |
| `JUDGE0_LANG_JAVA` | no (default `62`) | Judge0 language id for Java (OpenJDK 13.0.1). |
| `JUDGE0_LANG_CPP` | no (default `54`) | Judge0 language id for C++ (GCC 9.2.0). |
| `JUDGE0_LANG_C` | no (default `50`) | Judge0 language id for C (GCC 9.2.0). |

**Where to add them** — Supabase dashboard → **Edge Functions → Secrets** (or via the CLI, see
Deployment below). They apply to every Edge Function in the project, which is fine here: only
`execute-code` and `submit-code` actually read them.

The public `ce.judge0.com` instance is shared and rate-limited; if you outgrow it (e.g. a large
live contest), switch to RapidAPI or a self-hosted instance by setting `JUDGE0_API_URL` (and
`JUDGE0_API_KEY`/`JUDGE0_API_HOST` for RapidAPI) — no code changes needed, only secrets.

**Request limits are always clamped to Judge0 CE's documented ceilings** before every submission —
`memory_limit` to 256000 KB, `stack_limit` to 128000 KB (and never more than `memory_limit`),
`cpu_time_limit` to 15s, `wall_time_limit` to 20s — regardless of what a question's `coding_config`
asks for. This is enforced in `_shared/judge0.ts` (`clampSubmissionLimits`), not just in the stored
question data, so it holds even for a misconfigured or future question.

### Production question bank

Migration `007_replace_question_bank.sql` deactivates the original sample rows and adds the exact contest bank requested:

- **Coding / DSA:** LeetCode IDs `4000, 680, 119, 263, 3813, 3866, 3452, 345, 392, 1768` (Easy), `328, 11, 299, 3021, 38, 2095, 6, 73, 49, 56` (Medium), and `37, 363, 51, 765, 1872` (Hard).
- **SQL:** the 20-question SQL challenge from `code_crusade_sql_test.html` is loaded as executable PostgreSQL fixtures with public and hidden tests.
- The SQL-injection PDF is a separate scenario/query-analysis exercise rather than an executable SELECT-answer bank, so it is not mixed into the current SQL code editor.

The new coding descriptions are concise paraphrases, while the SQL descriptions preserve the supplied challenge structure and fixtures. Q20 uses separate session/purchase aggregates so a multi-row join cannot double-count player activity.

## Deployment commands

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# 1. Database: run schema.sql + seed.sql first if you haven't already, then:
supabase db push --file supabase/migrations/001_code_execution.sql
supabase db push --file supabase/migrations/002_code_execution_seed.sql
supabase db push --file supabase/migrations/003_complete_coding_config.sql
supabase db push --file supabase/migrations/004_fix_judge0_limits.sql
supabase db push --file supabase/migrations/005_sql_execution.sql
supabase db push --file supabase/migrations/006_sql_seed_config.sql
supabase db push --file supabase/migrations/007_replace_question_bank.sql
supabase db push --file supabase/migrations/008_category_aware_scoring.sql
supabase db push --file supabase/migrations/009_bug_busters_coding_only.sql
#   (or paste the files into the Supabase SQL Editor and run them in order,
#    001 through 008, all AFTER schema.sql/seed.sql)

# 2. Judge0 (coding): NOTHING TO SET for the default ce.judge0.com instance.
#    Only set these if you're using RapidAPI or a self-hosted instance instead:
# supabase secrets set JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
# supabase secrets set JUDGE0_API_KEY=your-rapidapi-key
# supabase secrets set JUDGE0_API_HOST=judge0-ce.p.rapidapi.com

# 3. sql_judge role password (once, in the SQL Editor, after migration 005):
#    ALTER ROLE sql_judge WITH PASSWORD 'choose-a-strong-password-here';

# 4. SQL judge secret (REQUIRED — see "SQL question execution" above):
supabase secrets set SQL_JUDGE_DB_URL="postgres://sql_judge:choose-a-strong-password-here@YOUR-DB-HOST:5432/postgres"

# 5. Deploy every Edge Function (the 4 existing ones are unchanged but
#    harmless to redeploy; the other 6 are required)
supabase functions deploy start-attempt
supabase functions deploy get-attempt
supabase functions deploy submit-answer
supabase functions deploy finish-attempt
supabase functions deploy save-code
supabase functions deploy execute-code
supabase functions deploy submit-code
supabase functions deploy save-sql
supabase functions deploy execute-sql
supabase functions deploy submit-sql
```

### Testing locally / before an event

1. Apply migrations 001–007, deploy the Edge Functions, and set the required Supabase/Judge0/SQL-judge secrets.
2. Start a contest attempt and open any of the new **LeetCode #...** questions on the CODING (DSA) tab.
3. **Correct solution** — write a working solution in each of Python 3 / Java / C / C++, click
   **Run Code**: both public tests should show ✓ Passed. Click **Submit**: should show *Accepted*,
   the question badge should flip to "Marked solved", and the score/solved counters should update.
4. **Wrong solution** — submit something that returns the wrong indices: expect *Wrong Answer*
   with the failing public test's input/expected/actual shown, `is_solved` stays `false`.
5. **Compile error** — introduce a syntax error (e.g. a missing `}` in Java or a Python
   `def` with a stray colon typo): expect *Compilation Error* with the compiler's message, and
   no test cards.
6. **Runtime error** — throw/raise inside the function (or in C, dereference a null pointer):
   expect *Runtime Error*, `perTest` for that request is empty (a whole-process crash loses all
   test results for that run — that's inherent to a process crash, not a quirk of `submit-code`).
7. **Timeout** — submit an intentional infinite loop: expect *Time Limit Exceeded* within the
   question's `time_limit_ms` (default 2000 ms) plus Judge0's own wall-time buffer.
8. **Hidden test failure** — write a solution that passes both public tests but fails on an edge
   case only present in `hidden_tests` (e.g. duplicate values for Two Sum): Submit should show
   partial `passed_tests`/`total_tests` and a hidden test card with **no** input/expected/actual,
   just "Hidden test failed."
9. **Duplicate submission** — after an Accepted submission, submit again (even a different,
   also-correct solution): `newly_solved` should be `false` this time and the score must not
   increase — check the `code_submissions` table (via the SQL editor) to see every attempt logged,
   and `submissions.score` to see it never moved after the first Accepted row.
10. **Contest expiration** — let the 45-minute timer run out (or manually set an attempt's
    `expires_at` to the past in the SQL editor for a quick test), then try Run/Submit: expect an
    `expired`/`attempt_closed` error, the editor should lock exactly like the text-answer path
    does, and no Judge0 call should be made (check your Judge0 dashboard/logs — nothing new should
    appear).

### Testing SQL questions

1. SQL questions are not part of the AIVORA 2K26 / Bug Busters contest configuration. The final migration `009_bug_busters_coding_only.sql` deactivates SQL questions for new attempts.
2. Start a contest attempt, go to the **SQL** tab. Every question should show Monaco with a
   **PostgreSQL / SQL** dropdown, not the old textarea.
3. **Correct query** — e.g. for "High Earners":
   `SELECT name, salary FROM employees WHERE salary > 50000 ORDER BY salary DESC, name;`
   Click **Run Code**: the public test should show ✓ Passed. Click **Submit**: expect *Accepted*,
   the solved badge/score should update.
4. **Wrong query** — e.g. drop the `WHERE` clause: expect *Wrong Answer* with the row-count or
   value mismatch shown for the public test.
5. **Syntax error** — e.g. `SELCT name FROM employees`: expect *Syntax Error* with Postgres's own
   message.
6. **Runtime error** — e.g. `SELECT 1/0`: expect *Runtime Error*.
7. **Timeout** — e.g. `SELECT pg_sleep(10)`: expect *Time Limit Exceeded* well under 10 seconds
   (the question's `statement_timeout_ms`, default 2000ms).
8. **Too many rows** — e.g. `SELECT * FROM generate_series(1, 100000) AS n` against a question
   with a low `max_rows`: expect *Too Many Rows*.
9. **Hidden test failure** — write a query that passes the public test but fails on an edge case
   only present in `hidden_seed_sql`/`hidden_tests`: Submit should show partial `passed_tests` and
   a hidden test card with **no** expected/actual rows shown, just "Hidden test failed."
10. **Duplicate submission** — after an Accepted submission, submit again: `newly_solved` should be
    `false` and the score should not increase — check the `sql_submissions` table to see every
    attempt logged.
11. **Refresh / autosave** — type a query, wait ~2s, refresh: the query should be restored.
12. **Switching SQL ↔ PostgreSQL** — type something in one, switch dialects, switch back: the text
    should be exactly as you left it in each.
13. **Contest expiry** — same as the coding case above: Run/Submit should be rejected and the
    editor should lock, with no query executed against `sql_judge`.
14. **Verify hidden data never reaches the browser** — open DevTools → Network while using Run
    Code and Submit on a question with hidden tests: the `execute-sql` response should contain
    only public-test detail; the `submit-sql` response should show `hidden: true` entries with no
    `expected`/`actual` fields for any hidden test index.


## SQL question execution

SQL questions get the same LeetCode-style workspace as coding questions: Monaco editor, a
language dropdown (**PostgreSQL** / **SQL**), **Run Code** (public tests) and **Submit** (public +
hidden tests, scores the question). Every one of the 8 seeded SQL questions has a `sql_config`
(migration `006`), so all of them show the editor rather than the old plain-text answer box.

### Dialect: "SQL" vs "PostgreSQL"

Both language options run on the **same** underlying PostgreSQL engine — **"SQL" is currently an
alias for "PostgreSQL"**, not a separate portable-subset validator. This is a deliberate,
documented simplification: building an accurate standards-only SQL validator (one that reliably
tells ANSI-standard syntax apart from every PostgreSQL extension without false-rejecting
legitimate standard SQL) is a substantial project of its own, and a wrong validator is worse than
no validator — it would either falsely block valid queries or falsely allow non-portable ones. So
for now: whichever dialect you pick, the query runs on PostgreSQL, unmodified. This is stated
plainly here (and can be surfaced in the UI) rather than implying a portability guarantee that
isn't actually enforced.

### How a SQL submission is judged

1. The participant writes **only** the `SELECT` query — never `CREATE TABLE`, `INSERT`, `DROP`, or
   any database connection code. The question's `schema_sql` and `seed_sql` (public) or
   `hidden_seed_sql` (hidden-test-only, Submit only) build the fixture automatically before the
   participant's query runs.
2. The query — and the fixture SQL before it — executes on a **separate PostgreSQL connection**,
   authenticated as a dedicated, locked-down role called `sql_judge` (created by migration `005`).
   This is never the same connection or role used for anything else in the app.
3. Everything happens inside PostgreSQL's own `pg_temp` schema: session-scoped, automatically
   invisible to every other session, and automatically dropped when that session ends. Between
   runs, `DISCARD ALL` is run before the connection is returned to the pool, so pooled connection
   reuse can never leak one submission's temp tables into another's.
4. `_shared/sql-compare.ts` compares the result (as rows of column → value) against the expected
   rows from `sql_config` — exact match by default, with `ordered_result` controlling whether row
   order matters and an optional `float_tolerance` for aggregate values.
5. `execute-sql` only ever fetches **public** tests (`get_public_sql_tests`); `submit-sql` fetches
   public **and** hidden tests via `get_sql_judge_context`, which is grantable to `service_role`
   only. A hidden-test failure is reported as `"Hidden test case failed."` — no expected rows, no
   actual rows.
6. Only `submit-sql` can change score/solved state, through `record_sql_result`, which re-derives
   the score from the question's difficulty and only awards it on the **first** `accepted`
   submission.

### Why `sql_judge` is safe — the real security boundary

Participant SQL never has a path to real application data, **enforced by PostgreSQL itself**, not
just application logic:

- `sql_judge` has **zero** grants on any table in `public`, `auth`, or `storage` — verified
  directly (`SELECT * FROM public.attempts` as `sql_judge` returns `permission denied`), including
  against tables created *after* the role was set up.
- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` — no elevated capability of any kind.
  `DROP DATABASE`, `CREATE EXTENSION`, `ALTER SYSTEM`, `CREATE ROLE` all fail with a permission
  error.
- No filesystem or external-program access: `COPY ... TO/FROM` a file and `COPY ... TO PROGRAM`
  both require role memberships `sql_judge` doesn't have.
- A `statement_timeout` is enforced at both the role level and per-connection — a genuine
  `pg_sleep(30)` is killed, not left to run.
- `_shared/sql-guard.ts` additionally blocklists a short list of dangerous statements
  (`DROP DATABASE`, `ALTER SYSTEM`, `COPY ... PROGRAM`, `GRANT`/`REVOKE`, etc.) **before** ever
  opening a database connection — this is defense in depth and a faster, clearer rejection, not
  the thing safety actually depends on.

See the header comments in `supabase/migrations/005_sql_execution.sql` and
`supabase/functions/_shared/sql-judge.ts` for the full reasoning, including why a
`SECURITY DEFINER` wrapper function (the pattern the coding judge doesn't need) can't be used here
— Postgres blocks `SET ROLE` inside `SECURITY DEFINER` functions specifically to prevent exactly
that kind of privilege laundering.

### `SQL_JUDGE_DB_URL` — Edge Function secret

`execute-sql` and `submit-sql` connect to Postgres directly (via `deno-postgres`, the same
approach Supabase's own docs recommend for Edge Functions that need a raw Postgres connection),
**not** through the `service_role` Supabase client used everywhere else in this project.

| Secret | Required | Meaning |
| --- | --- | --- |
| `SQL_JUDGE_DB_URL` | **yes** | A full Postgres connection string authenticating as the `sql_judge` role, e.g. `postgres://sql_judge:PASSWORD@YOUR-DB-HOST:5432/postgres`. Use the same host/port your `SUPABASE_DB_URL` already points at — only the role and password differ. |

**Setting the role's password** (once, in the Supabase SQL Editor, after running migration `005`):

```sql
ALTER ROLE sql_judge WITH PASSWORD 'choose-a-strong-password-here';
```

Then set the secret with that same password:

```bash
supabase secrets set SQL_JUDGE_DB_URL="postgres://sql_judge:choose-a-strong-password-here@YOUR-DB-HOST:5432/postgres"
```

Find `YOUR-DB-HOST` in your Supabase project's Database settings (Connection string), or reuse the
host from `SUPABASE_DB_URL` if you have it.




You need a free [Supabase](https://supabase.com) project, the [Supabase CLI](https://supabase.com/docs/guides/cli), and any static host (Vercel, Netlify, GitHub Pages).

### 1. Create the database

1. In your Supabase project open **SQL Editor**.
2. Paste and run **`supabase/schema.sql`**.
3. Paste and run **`supabase/seed.sql`** (sample questions – replace them with your own later).

Run `schema.sql` **once**. Running it a second time stops with `relation "participants" already exists`. If you need to start over on a project that has no real data yet, run this first and then run `schema.sql` and `seed.sql` again:

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
```

(This deletes everything in the `public` schema, including all participants and results. Never run it during a live event.)

### 2. Create your admin account

1. Supabase dashboard → **Authentication → Users → Add user**. Enter an email and password (tick *Auto Confirm User*).
2. Copy that user's **UID**.
3. In the SQL Editor run:

   ```sql
   insert into public.admins (user_id) values ('PASTE-THE-UID-HERE');
   ```

Signing in is not enough on its own: only accounts listed in `public.admins` can see results or edit questions. To add another organiser, repeat both steps.

### 3. Deploy the four Edge Functions

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy start-attempt
supabase functions deploy get-attempt
supabase functions deploy submit-answer
supabase functions deploy finish-attempt
```

`supabase/config.toml` already sets `verify_jwt = false` for all four (participants have no login). If your CLI version ignores that file, add `--no-verify-jwt` to each deploy command.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the functions automatically. Do not copy the service-role key anywhere else.

**Recommended:** once your site has a URL, restrict which sites may call the functions:

```bash
supabase secrets set ALLOWED_ORIGIN=https://your-site.vercel.app
```

(Use your real site address, with no trailing slash. Without this, any website can call the functions.)

### 4. Connect the website

Open **`js/supabase.js`** and replace the two placeholders (Supabase dashboard → **Project Settings → API**):

```js
var SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

The **anon / publishable** key is safe to put in a public website. **Never** put the `service_role` key here.

### 5. Run it locally

Any static server works. Opening the files by double-click is not enough because the pages call the network.

```bash
cd bug-busters
python3 -m http.server 8000
# open http://localhost:8000
```

### 6. Deploy the site

The project root is the site: no build command, no output folder.

- **Vercel:** import the repo, Framework Preset **Other**, leave build settings empty.
- **Netlify:** drag the folder onto the dashboard, or connect the repo with an empty build command.
- **GitHub Pages:** publish the repo root.

Then set `ALLOWED_ORIGIN` (step 3) to the new address.

## Running the event

**Before**
- Open `admin.html`, sign in, and check the **Questions** tab. A green banner means the bank is ready. A red one means some category has too few enabled questions, and new participants **cannot start** until you fix it.
- Do a full practice run with a test name and number, then delete that attempt with **Reset** on the Results tab.

**During**
- **Results** refreshes on its own every 15 seconds, or use **Refresh**. Search by name or number, filter by status, click a column heading to sort. **Export CSV** downloads the current view.
- **Reset** deletes a participant's attempt so they can start again with a fresh timer and new questions. It cannot be undone.

**Notes**
- You can add, edit, or disable questions mid-event. It only affects people who start **after** the change; anyone already started keeps their 10 questions.
- A question already given to someone cannot be deleted (the database refuses). **Disable** it instead.
- An attempt whose time ran out is marked *expired* automatically, even if the participant closed the tab.
- Points always follow difficulty. Changing a question's difficulty in the form changes its points to match.

## Question format

Each question has: category (`coding` or `sql`), difficulty, title, description, optional input/output format, examples, constraints, and optional starter text for the editor.

- In descriptions, a blank line starts a new paragraph, `` `backticks` `` make inline code, and a block wrapped in three backticks is shown as a code block (useful for SQL table definitions).
- **Examples** is a JSON list, for example:

  ```json
  [
    { "input": "nums = [2, 7, 11, 15], target = 9", "output": "[0, 1]", "explanation": "2 + 7 = 9" }
  ]
  ```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "The site is not connected to Supabase yet" | `js/supabase.js` still has the placeholders. |
| START NOW says the questions are not ready | Fewer enabled questions than needed in some category/difficulty. Check the Questions tab. |
| Every call fails with a CORS error in the browser console | `ALLOWED_ORIGIN` is set to a different address than the one you are visiting (check `https` and the exact host). |
| Calls return 401 | The functions were deployed with JWT checks on. Redeploy with `verify_jwt = false` / `--no-verify-jwt`. |
| Admin sign-in works but says "not an admin" | The user's UID is missing from `public.admins` (step 2). |
| Admin dashboard is empty but no error | Same cause: signed in, but not listed in `public.admins`. |
| Participant lost their tab and browser data | Have them enter the same name and number on the home page. If the browser still has the session they resume; if the number is already used they will be refused, and an admin can use **Reset** if a fresh start is appropriate. |

## Security notes

- Participants have no direct database access at all. Only the four Edge Functions (using the service-role key on the server) can read or write attempt data, and each request must carry the attempt's secret 64-character token.
- Admins can read everything and manage questions, but the database gives them **no** right to edit scores, submissions, or deadlines. The only destructive action is deleting an attempt (Reset).
- All text from participants and questions is shown with `textContent`, never as raw HTML.
- Error messages shown to participants are generic; internal details are logged on the server only.
#   a i v o r a  
 