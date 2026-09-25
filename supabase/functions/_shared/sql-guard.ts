// Statement-level guard, run BEFORE ever opening a database connection.
// This is defense in depth and fast, clear rejection — NOT the real
// security boundary. Participant safety actually rests on the sql_judge
// Postgres role's privileges (see 005_sql_execution.sql): zero grants
// on any real table, no CREATEDB/CREATEROLE/SUPERUSER, no filesystem or
// external-program access, and a statement_timeout — all verified
// directly against a live Postgres instance. Even if this file had a
// bug, none of those hold true guarantees change.
//
// DIALECT: the "sql" and "postgresql" language options both run on the
// same PostgreSQL engine. "sql" is currently an ALIAS for "postgresql" —
// there is no separate standards-only execution mode or syntax
// validator. This is a deliberate simplification, not an oversight:
// building and maintaining an accurate "portable SQL" validator (one
// that correctly distinguishes ANSI-standard syntax from every
// PostgreSQL-specific extension without false-rejecting legitimate
// standard SQL) is a substantial project of its own. Until that exists,
// "sql" behaves identically to "postgresql" in every way — same engine,
// same accepted syntax, same results — and the UI/README say so
// explicitly rather than implying a portability guarantee that isn't
// actually enforced.

export type GuardVerdict =
  | { blocked: false }
  | { blocked: true; reason: string };

// Statements that are either actively dangerous or make no sense for a
// single SELECT-oriented judge query. Matched after stripping
// comments/string literals, so a keyword inside a string or comment
// never triggers a false positive, and one can't be hidden from the
// check by putting it inside a string or comment either.
// COPY ... FROM/TO a quoted argument is always a filesystem path in
// Postgres syntax (STDIN/STDOUT are the only non-file forms, and those
// are never quoted) — checked against the RAW query, before string
// stripping, since stripping removes exactly the quoted path argument
// this needs to see.
const COPY_FILE_RE = /\bCOPY\s.+\b(?:FROM|TO)\s+['"]/i;

const BLOCKED_STATEMENT_RE = new RegExp(
  "(" + [
    "DROP\\s+DATABASE",
    "DROP\\s+ROLE",
    "DROP\\s+USER",
    "ALTER\\s+SYSTEM",
    "CREATE\\s+EXTENSION",
    "DROP\\s+EXTENSION",
    "CREATE\\s+ROLE",
    "CREATE\\s+USER",
    "ALTER\\s+ROLE",
    "ALTER\\s+USER",
    "GRANT\\s",
    "REVOKE\\s",
    "COPY\\s.+\\bPROGRAM\\b",
    "CREATE\\s+DATABASE",
    "pg_read_file",
    "pg_ls_dir",
    "pg_read_binary_file",
    "dblink",
    "LISTEN\\s",
    "NOTIFY\\s",
    "SET\\s+SESSION\\s+AUTHORIZATION",
    "RESET\\s+ROLE",
  ].join("|") + ")\\b",
  "i",
);

function stripCommentsAndStrings(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === "--") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    const c = sql[i];
    if (c === "'" || c === '"') {
      out += c;
      i++;
      while (i < sql.length && sql[i] !== c) i++;
      if (i < sql.length) { out += c; i++; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function guardStatement(query: string): GuardVerdict {
  // Checked against the RAW query first — this pattern needs to see the
  // quoted path argument that string-stripping would otherwise remove.
  if (COPY_FILE_RE.test(query)) {
    return { blocked: true, reason: "This statement is not allowed here: COPY to/from a file." };
  }

  const cleaned = stripCommentsAndStrings(query);
  const match = cleaned.match(BLOCKED_STATEMENT_RE);
  if (match) {
    return { blocked: true, reason: `This statement is not allowed here: ${match[1].replace(/\s+/g, " ").trim()}.` };
  }
  return { blocked: false };
}
