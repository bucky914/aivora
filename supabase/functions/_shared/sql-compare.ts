// Compares the participant's query result (an array of row objects, from
// deno-postgres's queryObject) against the expected result from
// sql_config. Deliberately conservative: only the one relaxation the
// question config explicitly asks for (ordered_result: false) is
// applied; everything else must match exactly.

export interface SqlCompareOptions {
  orderedResult: boolean;
  floatTolerance?: number | null;
}

export interface SqlCompareResult {
  ok: boolean;
  reason?: string; // short, safe-to-show explanation when ok is false (public tests only)
}

// Normalizes one row for comparison: converts values to a canonical,
// JSON-safe form so numeric/date/null differences that don't matter
// (e.g. deno-postgres decoding a NUMERIC as a string vs a JS number, or
// a Date object vs an ISO string) don't cause a false mismatch.
function normalizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") {
    // Postgres NUMERIC/DECIMAL often round-trips as a string; comparing
    // as a canonical number representation avoids "50000" !== 50000.
    return v;
  }
  if (typeof v === "string") {
    // A string that is purely numeric (as NUMERIC/DECIMAL columns often
    // decode) is compared numerically so "50000" and "50000.00" and
    // 50000 all agree; anything else stays a string.
    if (/^-?\d+(\.\d+)?$/.test(v.trim())) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return v;
  }
  return v;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) out[key] = normalizeValue(row[key]);
  return out;
}

function rowsEqual(a: Record<string, unknown>, b: Record<string, unknown>, floatTolerance: number | null | undefined): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
  for (const key of aKeys) {
    const av = a[key];
    const bv = b[key];
    if (floatTolerance != null && typeof av === "number" && typeof bv === "number") {
      if (Math.abs(av - bv) > floatTolerance) return false;
      continue;
    }
    if (av !== bv) return false;
  }
  return true;
}

function canonicalRowKey(row: Record<string, unknown>): string {
  const keys = Object.keys(row).sort();
  return JSON.stringify(keys.map((k) => [k, row[k]]));
}

export function compareSqlResult(
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[],
  opts: SqlCompareOptions,
): SqlCompareResult {
  const normActual = actual.map(normalizeRow);
  const normExpected = expected.map(normalizeRow);

  if (normActual.length !== normExpected.length) {
    return { ok: false, reason: `Expected ${normExpected.length} row(s), got ${normActual.length}.` };
  }
  if (normActual.length === 0) {
    return { ok: true };
  }

  // Column set must match on every row, regardless of ordering mode —
  // this is checked against the first expected row and enforced on all.
  const expectedColumns = Object.keys(normExpected[0]).sort();
  for (const row of normActual) {
    const cols = Object.keys(row).sort();
    if (cols.length !== expectedColumns.length || cols.some((c, i) => c !== expectedColumns[i])) {
      return { ok: false, reason: `Column names don't match. Expected: ${expectedColumns.join(", ")}. Got: ${cols.join(", ")}.` };
    }
  }

  if (opts.orderedResult) {
    for (let i = 0; i < normExpected.length; i++) {
      if (!rowsEqual(normActual[i], normExpected[i], opts.floatTolerance)) {
        return { ok: false, reason: `Row ${i + 1} doesn't match.` };
      }
    }
    return { ok: true };
  }

  // Unordered comparison: match rows as a multiset, not by position.
  // Exact-value equality only (no float tolerance) is used for the
  // canonical key so this stays a strict multiset match rather than a
  // loose one that could let a wrong answer slip through; float
  // tolerance is still honoured for the ordered path above, where it
  // matters most (typically a single aggregate row).
  const expectedCounts = new Map<string, number>();
  for (const row of normExpected) {
    const key = canonicalRowKey(row);
    expectedCounts.set(key, (expectedCounts.get(key) || 0) + 1);
  }
  const actualCounts = new Map<string, number>();
  for (const row of normActual) {
    const key = canonicalRowKey(row);
    actualCounts.set(key, (actualCounts.get(key) || 0) + 1);
  }
  if (expectedCounts.size !== actualCounts.size) {
    return { ok: false, reason: "Result rows don't match the expected set." };
  }
  for (const [key, count] of expectedCounts) {
    if (actualCounts.get(key) !== count) {
      return { ok: false, reason: "Result rows don't match the expected set." };
    }
  }
  return { ok: true };
}
