// Compares a participant's function result against the expected value from
// coding_config. Deliberately conservative: only the specific relaxations
// the question config asks for (unordered_result, float_tolerance) are
// applied. Everything else must match exactly after JSON-shape normalisation.

export interface CompareOptions {
  unordered_result?: boolean;
  float_tolerance?: number | null;
}

export function normalizedEqual(actual: unknown, expected: unknown, opts: CompareOptions): boolean {
  if (opts.float_tolerance != null && typeof actual === "number" && typeof expected === "number") {
    return Math.abs(actual - expected) <= opts.float_tolerance;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (actual.length !== expected.length) return false;
    if (opts.unordered_result) {
      // Only apply unordered comparison at the top level, and only when
      // the question config explicitly asked for it (never silently, to
      // avoid making a genuinely-wrong-order answer pass by accident).
      const a = actual.map((v) => canonicalize(v, opts));
      const e = expected.map((v) => canonicalize(v, opts));
      a.sort();
      e.sort();
      return JSON.stringify(a) === JSON.stringify(e);
    }
    for (let i = 0; i < expected.length; i++) {
      if (!normalizedEqual(actual[i], expected[i], { float_tolerance: opts.float_tolerance })) return false;
    }
    return true;
  }

  if (typeof expected === "number" && typeof actual === "number") {
    return expected === actual;
  }

  if (typeof expected === "string" && typeof actual === "string") {
    // Trailing whitespace/newline differences are harmless; the content itself must match exactly.
    return expected.replace(/\s+$/g, "") === actual.replace(/\s+$/g, "");
  }

  return JSON.stringify(actual) === JSON.stringify(expected);
}

function canonicalize(v: unknown, opts: CompareOptions): string {
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => canonicalize(x, opts)).sort());
  return JSON.stringify(v);
}
