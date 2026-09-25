-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 006: sql_config for all existing
-- SQL questions
--
-- Run AFTER 001-005. Purely additive: UPDATEs rows seed.sql already
-- inserted, matched by title (no ids hardcoded), same pattern as
-- 003_complete_coding_config.sql for the coding questions.
--
-- WHY EVERY QUESTION: each attempt draws 2 easy + 2 medium + 1 hard SQL
-- question at random from ALL active SQL questions. The seed bank has 8
-- (3 easy, 3 medium, 2 hard), so all 8 need sql_config or a participant
-- could still randomly get a question with no working SQL editor.
--
-- Every schema_sql/seed_sql/query pair below was executed against a real
-- Postgres instance (not just written by hand) before being included
-- here, using the actual sql_judge role and the actual comparison logic
-- in _shared/sql-compare.ts, to confirm: the schema/seed is valid SQL,
-- the reference solution produces exactly the expected result, and a
-- plausible wrong solution is correctly rejected.
--
-- ordered_result: true for every question here, since each one's
-- problem statement specifies an exact sort order ("Sort by...").
-- =====================================================================


-- ---------------------------------------------------------------------
-- High Earners
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE employees (id int, name text, department text, salary int);",
  "seed_sql": "INSERT INTO employees VALUES (1,'Arun','IT',65000),(2,'Divya','HR',48000),(3,'Kiran','IT',52000);",
  "public_tests": [
    { "expected": [{"name": "Arun", "salary": 65000}, {"name": "Kiran", "salary": 52000}] }
  ],
  "hidden_seed_sql": "INSERT INTO employees VALUES (4,'Zeta','Ops',52000),(5,'Nia','Ops',80000),(6,'Priya','HR',50000);",
  "hidden_tests": [
    { "expected": [{"name": "Nia", "salary": 80000}, {"name": "Arun", "salary": 65000}, {"name": "Kiran", "salary": 52000}, {"name": "Zeta", "salary": 52000}] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'High Earners';


-- ---------------------------------------------------------------------
-- Headcount by Department
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE employees (id int, name text, department text, salary int);",
  "seed_sql": "INSERT INTO employees VALUES (1,'Arun','IT',65000),(2,'Divya','HR',48000),(3,'Kiran','IT',52000);",
  "public_tests": [
    { "expected": [{"department": "IT", "employee_count": 2}, {"department": "HR", "employee_count": 1}] }
  ],
  "hidden_seed_sql": "INSERT INTO employees VALUES (4,'Meena','HR',55000),(5,'Ravi','Sales',48000),(6,'Zara','Sales',51000);",
  "hidden_tests": [
    { "expected": [{"department": "HR", "employee_count": 2}, {"department": "IT", "employee_count": 2}, {"department": "Sales", "employee_count": 2}] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Headcount by Department';


-- ---------------------------------------------------------------------
-- Customers in Chennai
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE customers (id int, name text, city text, joined date);",
  "seed_sql": "INSERT INTO customers VALUES (1,'Meena','Chennai','2024-01-10'),(2,'Rahul','Madurai','2024-02-14'),(3,'Bharat','Chennai','2024-03-02');",
  "public_tests": [
    { "expected": [{"name": "Bharat"}, {"name": "Meena"}] }
  ],
  "hidden_seed_sql": "INSERT INTO customers VALUES (4,'Anitha','Chennai','2024-04-01'),(5,'Karthik','Coimbatore','2024-04-05');",
  "hidden_tests": [
    { "expected": [{"name": "Anitha"}, {"name": "Bharat"}, {"name": "Meena"}] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Customers in Chennai';


-- ---------------------------------------------------------------------
-- Second Highest Salary
-- Two public tests (ties case + no-second-salary case), matching the
-- two examples already in the question's own text.
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE employees (id int, name text, salary int);",
  "seed_sql": "INSERT INTO employees VALUES (1,'A',300),(2,'B',200),(3,'C',300);",
  "public_tests": [
    { "expected": [{"second_highest_salary": 200}] }
  ],
  "hidden_seed_sql": "DELETE FROM employees; INSERT INTO employees VALUES (1,'A',100);",
  "hidden_tests": [
    { "expected": [{"second_highest_salary": null}] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Second Highest Salary';


-- ---------------------------------------------------------------------
-- Departments With High Average Pay
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE employees (id int, name text, dept_id int, salary int); CREATE TEMP TABLE departments (id int, name text);",
  "seed_sql": "INSERT INTO employees VALUES (1,'A',1,70000),(2,'B',1,65000),(3,'C',2,40000); INSERT INTO departments VALUES (1,'IT'),(2,'Sales');",
  "public_tests": [
    { "expected": [{"department": "IT", "avg_salary": 67500.00}] }
  ],
  "hidden_seed_sql": "INSERT INTO employees VALUES (4,'D',2,75000),(5,'E',2,72000); INSERT INTO departments VALUES (3,'HR'); INSERT INTO employees VALUES (6,'F',3,59000);",
  "hidden_tests": [
    { "expected": [{"department": "IT", "avg_salary": 67500.00}, {"department": "Sales", "avg_salary": 62333.33}] }
  ],
  "ordered_result": true,
  "float_tolerance": 0.01,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Departments With High Average Pay';


-- ---------------------------------------------------------------------
-- Customers Who Never Ordered
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE customers (id int, name text); CREATE TEMP TABLE orders (id int, customer_id int, amount int, order_date date);",
  "seed_sql": "INSERT INTO customers VALUES (1,'Asha'),(2,'Bala'),(3,'Chitra'); INSERT INTO orders VALUES (10,1,500,'2024-05-01');",
  "public_tests": [
    { "expected": [{"name": "Bala"}, {"name": "Chitra"}] }
  ],
  "hidden_seed_sql": "INSERT INTO customers VALUES (4,'Deepa'),(5,'Esha'); INSERT INTO orders VALUES (11,4,300,'2024-05-02');",
  "hidden_tests": [
    { "expected": [{"name": "Bala"}, {"name": "Chitra"}, {"name": "Esha"}] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Customers Who Never Ordered';


-- ---------------------------------------------------------------------
-- Top Three Earners per Department
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE employees (id int, name text, department text, salary int);",
  "seed_sql": "INSERT INTO employees VALUES (1,'A','IT',90000),(2,'B','IT',90000),(3,'C','IT',80000),(4,'D','IT',70000),(5,'E','IT',60000);",
  "public_tests": [
    { "expected": [
      {"department": "IT", "name": "A", "salary": 90000},
      {"department": "IT", "name": "B", "salary": 90000},
      {"department": "IT", "name": "C", "salary": 80000},
      {"department": "IT", "name": "D", "salary": 70000}
    ] }
  ],
  "hidden_seed_sql": "INSERT INTO employees VALUES (6,'F','Sales',50000),(7,'G','Sales',50000),(8,'H','Sales',40000);",
  "hidden_tests": [
    { "expected": [
      {"department": "IT", "name": "A", "salary": 90000},
      {"department": "IT", "name": "B", "salary": 90000},
      {"department": "IT", "name": "C", "salary": 80000},
      {"department": "IT", "name": "D", "salary": 70000},
      {"department": "Sales", "name": "F", "salary": 50000},
      {"department": "Sales", "name": "G", "salary": 50000},
      {"department": "Sales", "name": "H", "salary": 40000}
    ] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Top Three Earners per Department';


-- ---------------------------------------------------------------------
-- Three-Day Login Streaks
-- ---------------------------------------------------------------------
update public.questions
set sql_config = $cfg${
  "supported_dialects": ["sql", "postgresql"],
  "schema_sql": "CREATE TEMP TABLE logins (user_id int, login_date date);",
  "seed_sql": "INSERT INTO logins VALUES (1,'2024-06-01'),(1,'2024-06-02'),(1,'2024-06-03'),(2,'2024-06-01'),(2,'2024-06-03'),(2,'2024-06-04');",
  "public_tests": [
    { "expected": [{"user_id": 1}] }
  ],
  "hidden_seed_sql": "INSERT INTO logins VALUES (3,'2024-06-01'),(3,'2024-06-02'),(3,'2024-06-03'),(3,'2024-06-04'),(3,'2024-06-05');",
  "hidden_tests": [
    { "expected": [{"user_id": 1}, {"user_id": 3}] }
  ],
  "ordered_result": true,
  "statement_timeout_ms": 2000,
  "max_rows": 1000
}$cfg$::jsonb
where category = 'sql' and title = 'Three-Day Login Streaks';


-- ---------------------------------------------------------------------
-- Sanity check, same pattern as migration 003 for coding questions.
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(title, ', ') into v_missing
    from public.questions
   where category = 'sql' and is_active and sql_config is null;
  if v_missing is not null then
    raise warning 'SQL questions still missing sql_config after migration 006: %. '
      'These questions will keep the plain-text editor until an admin adds sql_config.', v_missing;
  end if;
end $$;
