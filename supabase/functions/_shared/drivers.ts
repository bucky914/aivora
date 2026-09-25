// Driver/wrapper generation for the LeetCode-style execution model.
//
// The participant writes ONLY the function body (inside class Solution for
// python3/java/cpp, or a bare function for c). This module wraps that code
// with a small, auto-generated program that:
//   1. reads the test inputs (embedded directly in the generated source —
//      no stdin parsing, so the participant never sees or writes I/O code),
//   2. calls the participant's function once per test case,
//   3. prints one JSON line per test: {"ok":true,"result":...} or
//      {"ok":false,"error":"..."} — so a single participant crash on test #3
//      does not lose the results of tests #1, #2, #4, ...
//
// Supported param/return types (matches what coding_config.params /
// return_type may declare): "int", "long", "int[]", "int[][]", "string",
// "string[]", "string[][]", "bool", "float", "float[]".
//
// SECURITY: this module only ever receives PUBLIC or HIDDEN test inputs
// that the caller already fetched from the database with the right
// visibility. It never decides visibility itself — see execute-code and
// submit-code for that boundary.

export interface Param {
  name: string;
  type: string;
}

export interface CodingConfig {
  function_name: string;
  params: Param[];
  return_type: string;
}

export interface TestCase {
  input: Record<string, unknown>;
  expected: unknown;
}

const SUPPORTED_TYPES = new Set([
  "int", "long", "int[]", "int[][]",
  "float", "float[]",
  "string", "string[]", "string[][]",
  "bool", "bool[]",
]);

export function validateCodingConfig(cfg: CodingConfig): string | null {
  if (!cfg.function_name || typeof cfg.function_name !== "string") return "missing function_name";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cfg.function_name)) return "invalid function_name";
  if (!Array.isArray(cfg.params) || cfg.params.length === 0) return "missing params";
  for (const p of cfg.params) {
    if (!p.name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.name)) return `invalid param name: ${p.name}`;
    if (!SUPPORTED_TYPES.has(p.type)) return `unsupported param type: ${p.type}`;
  }
  if (!cfg.return_type || !SUPPORTED_TYPES.has(cfg.return_type) && cfg.return_type !== "void") {
    return `unsupported return_type: ${cfg.return_type}`;
  }
  return null;
}

// ---------------------------------------------------------------------
// Python 3
// ---------------------------------------------------------------------
function pythonDriver(cfg: CodingConfig, participantCode: string, tests: TestCase[]): string {
  const testsJson = JSON.stringify(tests.map((t) => t.input));
  const argNames = cfg.params.map((p) => p.name);
  return `
import json, sys, traceback

${participantCode}

__tests = json.loads(${pyStrLit(testsJson)})
__sol = Solution()

for __t in __tests:
    try:
        __result = __sol.${cfg.function_name}(${argNames.map((n) => `__t[${JSON.stringify(n)}]`).join(", ")})
        print(json.dumps({"ok": True, "result": __result}))
    except Exception as __e:
        print(json.dumps({"ok": False, "error": "".join(traceback.format_exception_only(type(__e), __e)).strip()}))
    sys.stdout.flush()
`.trim() + "\n";
}

function pyStrLit(s: string): string {
  // Triple-quoted, with any accidental triple-quote in input neutralised.
  return '"""' + s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"') + '"""';
}

// ---------------------------------------------------------------------
// Java
// ---------------------------------------------------------------------
function javaType(t: string): string {
  switch (t) {
    case "int": return "int";
    case "long": return "long";
    case "int[]": return "int[]";
    case "int[][]": return "int[][]";
    case "float": return "double";
    case "float[]": return "double[]";
    case "string": return "String";
    case "string[]": return "String[]";
    case "string[][]": return "List<List<String>>";
    case "bool": return "boolean";
    case "bool[]": return "boolean[]";
    default: return "Object";
  }
}

// Minimal JSON writer for Java results (no external deps allowed in Judge0's plain javac).
const JAVA_JSON_HELPERS = `
final class __Json {
    static String esc(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"': b.append("\\\\\\""); break;
                case '\\\\': b.append("\\\\\\\\"); break;
                case '\\n': b.append("\\\\n"); break;
                case '\\r': b.append("\\\\r"); break;
                case '\\t': b.append("\\\\t"); break;
                default:
                    if (c < 0x20) b.append(String.format("\\\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.toString();
    }
    static String val(Object o) {
        if (o == null) return "null";
        if (o instanceof String) return "\\"" + esc((String) o) + "\\"";
        if (o instanceof Boolean) return o.toString();
        if (o instanceof Integer || o instanceof Long) return o.toString();
        if (o instanceof Double || o instanceof Float) return o.toString();
        if (o instanceof int[]) {
            int[] a = (int[]) o;
            StringBuilder b = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); }
            return b.append("]").toString();
        }
        if (o instanceof double[]) {
            double[] a = (double[]) o;
            StringBuilder b = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); }
            return b.append("]").toString();
        }
        if (o instanceof boolean[]) {
            boolean[] a = (boolean[]) o;
            StringBuilder b = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(a[i]); }
            return b.append("]").toString();
        }
        if (o instanceof String[]) {
            String[] a = (String[]) o;
            StringBuilder b = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(val(a[i])); }
            return b.append("]").toString();
        }
        if (o instanceof int[][]) {
            int[][] a = (int[][]) o;
            StringBuilder b = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(val(a[i])); }
            return b.append("]").toString();
        }
        if (o instanceof String[][]) {
            String[][] a = (String[][]) o;
            StringBuilder b = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) { if (i > 0) b.append(","); b.append(val(a[i])); }
            return b.append("]").toString();
        }
        if (o instanceof java.util.List) {
            StringBuilder b = new StringBuilder("[");
            java.util.List<?> l = (java.util.List<?>) o;
            for (int i = 0; i < l.size(); i++) { if (i > 0) b.append(","); b.append(val(l.get(i))); }
            return b.append("]").toString();
        }
        return "\\"" + esc(String.valueOf(o)) + "\\"";
    }
}
`.trim();

// Extremely small hand-rolled JSON tokenizer, just enough for our own
// flat/nested-array test-input shape (objects of primitives/arrays only).
const JAVA_JSON_PARSER = `
final class __JsonVal {
    Object v;
    __JsonVal(Object v) { this.v = v; }
}
final class __JsonParser {
    String s; int i = 0;
    __JsonParser(String s) { this.s = s; }
    void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    Object parse() { ws(); Object v = parseVal(); ws(); return v; }
    Object parseVal() {
        ws();
        char c = s.charAt(i);
        if (c == '{') return parseObj();
        if (c == '[') return parseArr();
        if (c == '"') return parseStr();
        if (c == 't') { i += 4; return Boolean.TRUE; }
        if (c == 'f') { i += 5; return Boolean.FALSE; }
        if (c == 'n') { i += 4; return null; }
        return parseNum();
    }
    java.util.Map<String,Object> parseObj() {
        java.util.LinkedHashMap<String,Object> m = new java.util.LinkedHashMap<>();
        i++; ws();
        if (s.charAt(i) == '}') { i++; return m; }
        while (true) {
            ws(); String k = parseStr(); ws(); i++; /* : */
            Object v = parseVal(); m.put(k, v); ws();
            if (s.charAt(i) == ',') { i++; continue; }
            i++; break;
        }
        return m;
    }
    java.util.List<Object> parseArr() {
        java.util.ArrayList<Object> l = new java.util.ArrayList<>();
        i++; ws();
        if (s.charAt(i) == ']') { i++; return l; }
        while (true) {
            l.add(parseVal()); ws();
            if (s.charAt(i) == ',') { i++; ws(); continue; }
            i++; break;
        }
        return l;
    }
    String parseStr() {
        i++; StringBuilder b = new StringBuilder();
        while (s.charAt(i) != '"') {
            char c = s.charAt(i);
            if (c == '\\\\') {
                i++; char e = s.charAt(i);
                switch (e) {
                    case 'n': b.append('\\n'); break;
                    case 't': b.append('\\t'); break;
                    case 'r': b.append('\\r'); break;
                    case '"': b.append('"'); break;
                    case '\\\\': b.append('\\\\'); break;
                    case 'u':
                        b.append((char) Integer.parseInt(s.substring(i + 1, i + 5), 16));
                        i += 4;
                        break;
                    default: b.append(e);
                }
                i++;
            } else { b.append(c); i++; }
        }
        i++;
        return b.toString();
    }
    Object parseNum() {
        int start = i;
        while (i < s.length() && (Character.isDigit(s.charAt(i)) || s.charAt(i) == '-' || s.charAt(i) == '+' || s.charAt(i) == '.' || s.charAt(i) == 'e' || s.charAt(i) == 'E')) i++;
        String tok = s.substring(start, i);
        if (tok.contains(".") || tok.contains("e") || tok.contains("E")) return Double.parseDouble(tok);
        try { return Integer.parseInt(tok); } catch (Exception e) { return Long.parseLong(tok); }
    }
}
`.trim();

function javaConvertArg(varExpr: string, type: string): string {
  switch (type) {
    case "int": return `((Number) ${varExpr}).intValue()`;
    case "long": return `((Number) ${varExpr}).longValue()`;
    case "float": return `((Number) ${varExpr}).doubleValue()`;
    case "bool": return `((Boolean) ${varExpr})`;
    case "string": return `((String) ${varExpr})`;
    case "int[]": return `__toIntArray((java.util.List<?>) ${varExpr})`;
    case "int[][]": return `__toIntMatrix((java.util.List<?>) ${varExpr})`;
    case "float[]": return `__toDoubleArray((java.util.List<?>) ${varExpr})`;
    case "bool[]": return `__toBoolArray((java.util.List<?>) ${varExpr})`;
    case "string[]": return `__toStringArray((java.util.List<?>) ${varExpr})`;
    default: return varExpr;
  }
}

const JAVA_ARRAY_HELPERS = `
static int[] __toIntArray(java.util.List<?> l) {
    int[] a = new int[l.size()];
    for (int i = 0; i < l.size(); i++) a[i] = ((Number) l.get(i)).intValue();
    return a;
}
static int[][] __toIntMatrix(java.util.List<?> l) {
    int[][] a = new int[l.size()][];
    for (int i = 0; i < l.size(); i++) a[i] = __toIntArray((java.util.List<?>) l.get(i));
    return a;
}
static double[] __toDoubleArray(java.util.List<?> l) {
    double[] a = new double[l.size()];
    for (int i = 0; i < l.size(); i++) a[i] = ((Number) l.get(i)).doubleValue();
    return a;
}
static boolean[] __toBoolArray(java.util.List<?> l) {
    boolean[] a = new boolean[l.size()];
    for (int i = 0; i < l.size(); i++) a[i] = (Boolean) l.get(i);
    return a;
}
static String[] __toStringArray(java.util.List<?> l) {
    String[] a = new String[l.size()];
    for (int i = 0; i < l.size(); i++) a[i] = (String) l.get(i);
    return a;
}
`.trim();

function javaDriver(cfg: CodingConfig, participantCode: string, tests: TestCase[]): string {
  const testsJson = JSON.stringify(tests.map((t) => t.input));
  const callArgs = cfg.params
    .map((p) => javaConvertArg(`__t.get(${JSON.stringify(p.name)})`, p.type))
    .join(", ");

  return `
import java.util.*;

${participantCode}

${JAVA_JSON_PARSER}
${JAVA_JSON_HELPERS}

public class Main {
    ${JAVA_ARRAY_HELPERS}

    public static void main(String[] args) throws Exception {
        String testsJson = ${javaStrLit(testsJson)};
        Object parsed = new __JsonParser(testsJson).parse();
        java.util.List<?> tests = (java.util.List<?>) parsed;
        Solution __sol = new Solution();
        StringBuilder out = new StringBuilder();
        for (Object o : tests) {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> __t = (java.util.Map<String, Object>) o;
            try {
                Object __result = __sol.${cfg.function_name}(${callArgs});
                System.out.println("{\\"ok\\":true,\\"result\\":" + __Json.val(__result) + "}");
            } catch (Throwable __e) {
                String msg = __e.getClass().getSimpleName() + (__e.getMessage() != null ? ": " + __e.getMessage() : "");
                System.out.println("{\\"ok\\":false,\\"error\\":\\"" + __Json.esc(msg) + "\\"}");
            }
            System.out.flush();
        }
    }
}
`.trim() + "\n";
}

function javaStrLit(s: string): string {
  // Java has no raw/triple-quote-embedded literal here reliably across javac
  // versions used by Judge0, so escape it as a normal (long) string literal.
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
  return `"${escaped}"`;
}

// ---------------------------------------------------------------------
// C++
// ---------------------------------------------------------------------
function cppType(t: string): string {
  switch (t) {
    case "int": return "int";
    case "long": return "long long";
    case "float": return "double";
    case "bool": return "bool";
    case "string": return "string";
    case "int[]": return "vector<int>";
    case "int[][]": return "vector<vector<int>>";
    case "float[]": return "vector<double>";
    case "bool[]": return "vector<bool>";
    case "string[]": return "vector<string>";
    case "string[][]": return "vector<vector<string>>";
    default: return "auto";
  }
}

// A tiny header-only JSON reader/writer scoped to our test-input shape
// (objects of ints/floats/bools/strings/arrays/nested arrays) and to
// writing back int/int[]/int[][]/float/float[]/bool/bool[]/string/string[]
// results. No external dependency — Judge0's g++ has no internet access.
const CPP_JSON_LIB = `
namespace ccjson {
struct Value {
    enum Type { NUL, BOOL, NUM, STR, ARR, OBJ } type = NUL;
    bool b = false; double n = 0; std::string s;
    std::vector<Value> arr;
    std::vector<std::pair<std::string, Value>> obj;
    const Value& at(const std::string& key) const {
        for (auto& kv : obj) if (kv.first == key) return kv.second;
        static Value nullVal;
        return nullVal;
    }
};

struct Parser {
    const std::string& s; size_t i = 0;
    Parser(const std::string& s_) : s(s_) {}
    void ws() { while (i < s.size() && isspace((unsigned char)s[i])) i++; }
    Value parse() { ws(); Value v = parseVal(); return v; }
    Value parseVal() {
        ws();
        char c = s[i];
        if (c == '{') return parseObj();
        if (c == '[') return parseArr();
        if (c == '"') return parseStr();
        if (c == 't') { i += 4; Value v; v.type = Value::BOOL; v.b = true; return v; }
        if (c == 'f') { i += 5; Value v; v.type = Value::BOOL; v.b = false; return v; }
        if (c == 'n') { i += 4; Value v; v.type = Value::NUL; return v; }
        return parseNum();
    }
    Value parseObj() {
        Value v; v.type = Value::OBJ; i++; ws();
        if (s[i] == '}') { i++; return v; }
        while (true) {
            ws(); Value k = parseStr(); ws(); i++;
            Value val = parseVal();
            v.obj.push_back({k.s, val});
            ws();
            if (s[i] == ',') { i++; continue; }
            i++; break;
        }
        return v;
    }
    Value parseArr() {
        Value v; v.type = Value::ARR; i++; ws();
        if (s[i] == ']') { i++; return v; }
        while (true) {
            v.arr.push_back(parseVal()); ws();
            if (s[i] == ',') { i++; ws(); continue; }
            i++; break;
        }
        return v;
    }
    Value parseStr() {
        Value v; v.type = Value::STR; i++;
        std::string out;
        while (s[i] != '"') {
            char c = s[i];
            if (c == '\\\\') {
                i++; char e = s[i];
                switch (e) {
                    case 'n': out += '\\n'; break;
                    case 't': out += '\\t'; break;
                    case 'r': out += '\\r'; break;
                    case '"': out += '"'; break;
                    case '\\\\': out += '\\\\'; break;
                    case 'u': {
                        int cp = std::stoi(s.substr(i + 1, 4), nullptr, 16);
                        out += (char) cp;
                        i += 4;
                        break;
                    }
                    default: out += e;
                }
                i++;
            } else { out += c; i++; }
        }
        i++;
        v.s = out;
        return v;
    }
    Value parseNum() {
        size_t start = i;
        bool isFloat = false;
        while (i < s.size() && (isdigit((unsigned char)s[i]) || s[i] == '-' || s[i] == '+' || s[i] == '.' || s[i] == 'e' || s[i] == 'E')) {
            if (s[i] == '.' || s[i] == 'e' || s[i] == 'E') isFloat = true;
            i++;
        }
        Value v; v.type = Value::NUM; v.n = std::stod(s.substr(start, i - start));
        return v;
    }
};

inline std::string esc(const std::string& s) {
    std::string out;
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\\\\""; break;
            case '\\\\': out += "\\\\\\\\"; break;
            case '\\n': out += "\\\\n"; break;
            case '\\r': out += "\\\\r"; break;
            case '\\t': out += "\\\\t"; break;
            default: out += c;
        }
    }
    return out;
}

inline std::string dump(int v) { return std::to_string(v); }
inline std::string dump(long long v) { return std::to_string(v); }
inline std::string dump(double v) {
    std::ostringstream oss; oss << v; return oss.str();
}
inline std::string dump(bool v) { return v ? "true" : "false"; }
inline std::string dump(const std::string& v) { return "\\"" + esc(v) + "\\""; }
template <typename T>
inline std::string dump(const std::vector<T>& v) {
    std::string out = "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) out += ","; out += dump(v[i]); }
    return out + "]";
}
} // namespace ccjson
`.trim();

function cppFromJsonExpr(valueExpr: string, type: string): string {
  switch (type) {
    case "int": return `(int)${valueExpr}.n`;
    case "long": return `(long long)${valueExpr}.n`;
    case "float": return `${valueExpr}.n`;
    case "bool": return `${valueExpr}.b`;
    case "string": return `${valueExpr}.s`;
    case "int[]": return `__toIntVec(${valueExpr})`;
    case "int[][]": return `__toIntMatrix(${valueExpr})`;
    case "float[]": return `__toDoubleVec(${valueExpr})`;
    case "bool[]": return `__toBoolVec(${valueExpr})`;
    case "string[]": return `__toStringVec(${valueExpr})`;
    default: return valueExpr;
  }
}

const CPP_ARRAY_HELPERS = `
vector<int> __toIntVec(const ccjson::Value& v) {
    vector<int> out;
    for (auto& e : v.arr) out.push_back((int) e.n);
    return out;
}
vector<vector<int>> __toIntMatrix(const ccjson::Value& v) {
    vector<vector<int>> out;
    for (auto& e : v.arr) out.push_back(__toIntVec(e));
    return out;
}
vector<double> __toDoubleVec(const ccjson::Value& v) {
    vector<double> out;
    for (auto& e : v.arr) out.push_back(e.n);
    return out;
}
vector<bool> __toBoolVec(const ccjson::Value& v) {
    vector<bool> out;
    for (auto& e : v.arr) out.push_back(e.b);
    return out;
}
vector<string> __toStringVec(const ccjson::Value& v) {
    vector<string> out;
    for (auto& e : v.arr) out.push_back(e.s);
    return out;
}
`.trim();

function cppDriver(cfg: CodingConfig, participantCode: string, tests: TestCase[]): string {
  const testsJson = JSON.stringify(tests.map((t) => t.input));
  // Materialize each argument as a NAMED local variable before the call.
  // LeetCode-style C++ signatures commonly take containers by non-const
  // reference (e.g. vector<int>& nums), which cannot bind to an rvalue —
  // so we must pass named lvalues, not inline expressions.
  const argDecls = cfg.params
    .map((p) => `            ${cppType(p.type)} __arg_${p.name} = ${cppFromJsonExpr(`__t.at(${JSON.stringify(p.name)})`, p.type)};`)
    .join("\n");
  const callArgs = cfg.params.map((p) => `__arg_${p.name}`).join(", ");

  return `
#include <bits/stdc++.h>
using namespace std;

${CPP_JSON_LIB}

${participantCode}

${CPP_ARRAY_HELPERS}

int main() {
    string testsJson = ${cppStrLit(testsJson)};
    ccjson::Parser parser(testsJson);
    ccjson::Value tests = parser.parse();
    Solution __sol;
    for (auto& __t : tests.arr) {
        try {
${argDecls}
            auto __result = __sol.${cfg.function_name}(${callArgs});
            cout << "{\\"ok\\":true,\\"result\\":" << ccjson::dump(__result) << "}" << endl;
        } catch (const std::exception& __e) {
            cout << "{\\"ok\\":false,\\"error\\":\\"" << ccjson::esc(__e.what()) << "\\"}" << endl;
        } catch (...) {
            cout << "{\\"ok\\":false,\\"error\\":\\"unknown exception\\"}" << endl;
        }
        cout.flush();
    }
    return 0;
}
`.trim() + "\n";
}

function cppStrLit(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
  return `"${escaped}"`;
}

// ---------------------------------------------------------------------
// C
// ---------------------------------------------------------------------
// C has no classes and no generics, so the participant writes a bare
// function (as coding_config.starter_code.c shows). We only support the
// signature shapes that are realistic for a contest: int, int[], bool,
// string (char*), float, and one "extra output size" pointer parameter
// pattern (LeetCode's own C convention) is NOT auto-detected — for C we
// keep the return contract simple: functions return a single JSON-safe
// value (int / bool / string / int[] via a struct the driver defines).
// This covers Two Sum/Valid Parentheses-shaped problems; more exotic C
// signatures should be entered by the admin with a custom starter that
// still matches coding_config.params/return_type.
const C_SUPPORTED_PARAM_TYPES = new Set(["int", "long", "float", "bool", "string", "int[]"]);
const C_SUPPORTED_RETURN_TYPES = new Set(["int", "long", "float", "bool", "string", "int[]"]);

function cDriver(cfg: CodingConfig, participantCode: string, tests: TestCase[]): string {
  const testsJson = JSON.stringify(tests.map((t) => t.input));

  // C deliberately supports a smaller type surface than Python/Java/C++.
  // Emit one clean diagnostic per test for unsupported shapes instead of
  // generating declarations that cannot compile.
  const badParam = cfg.params.find((p) => !C_SUPPORTED_PARAM_TYPES.has(p.type));
  const badReturn = !C_SUPPORTED_RETURN_TYPES.has(cfg.return_type);
  if (badParam || badReturn) {
    const reason = badParam
      ? `unsupported parameter type for C: ${badParam!.type}`
      : `unsupported return_type for C: ${cfg.return_type}`;
    const count = tests.length;
    const escaped = JSON.stringify(reason);
    return `#include <stdio.h>\n\n${participantCode}\n\nint main(void){\n  for(int i=0;i<${count};i++){ printf("{\\"ok\\":false,\\"error\\":%s}\\n", ${escaped}); }\n  return 0;\n}\n`;
  }

  const paramDecls = cfg.params.map((p) => cDeclFor(p)).join("\n");
  const callArgs = cfg.params.map((p) => cCallArg(p)).join(", ");
  const extraOut = cfg.return_type === "int[]"; // LeetCode-C convention: int* fn(..., int* returnSize)

  return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

${C_JSON_LIB}

${participantCode}

int main() {
    const char* testsJson = ${cStrLit(testsJson)};
    CJsonValue tests = cjson_parse(testsJson);
    for (int __i = 0; __i < tests.arr_len; __i++) {
        CJsonValue __t = tests.arr[__i];
${paramDecls}
        ${extraOut ? "int __returnSize = 0;" : ""}
        ${cCallAndPrint(cfg, callArgs, extraOut)}
${cFreeDecls(cfg)}
        fflush(stdout);
    }
    return 0;
}
`.trim() + "\n";
}

function cDeclFor(p: Param): string {
  const key = JSON.stringify(p.name);
  switch (p.type) {
    case "int":
      return `        int ${p.name} = (int)cjson_get(&__t, ${key}).num;`;
    case "float":
      return `        double ${p.name} = cjson_get(&__t, ${key}).num;`;
    case "bool":
      return `        bool ${p.name} = cjson_get(&__t, ${key}).boolean;`;
    case "string":
      return `        char* ${p.name} = cjson_get(&__t, ${key}).str;`;
    case "int[]": {
      return (
        `        CJsonValue __${p.name}_v = cjson_get(&__t, ${key});\n` +
        `        int ${p.name}Size = __${p.name}_v.arr_len;\n` +
        `        int* ${p.name} = cjson_to_int_array(&__${p.name}_v);`
      );
    }
    default:
      return `        /* unsupported param type for C: ${p.type} */`;
  }
}

function cCallArg(p: Param): string {
  if (p.type === "int[]") return `${p.name}, ${p.name}Size`;
  return p.name;
}

function cFreeDecls(cfg: CodingConfig): string {
  return cfg.params
    .filter((p) => p.type === "int[]")
    .map((p) => `        free(${p.name});`)
    .join("\n");
}

function cCallAndPrint(cfg: CodingConfig, callArgs: string, extraOut: boolean): string {
  const fn = cfg.function_name;
  const args = extraOut ? `${callArgs}${callArgs ? ", " : ""}&__returnSize` : callArgs;
  switch (cfg.return_type) {
    case "int":
      return `int __result = ${fn}(${args});\n        printf("{\\"ok\\":true,\\"result\\":%d}\\n", __result);`;
    case "long":
      return `long long __result = ${fn}(${args});\n        printf("{\\"ok\\":true,\\"result\\":%lld}\\n", __result);`;
    case "bool":
      return `bool __result = ${fn}(${args});\n        printf("{\\"ok\\":true,\\"result\\":%s}\\n", __result ? "true" : "false");`;
    case "string":
      return `char* __result = ${fn}(${args});\n        printf("{\\"ok\\":true,\\"result\\":\\"%s\\"}\\n", __result ? __result : "");`;
    case "int[]":
      return (
        `int* __result = ${fn}(${args});\n` +
        `        printf("{\\"ok\\":true,\\"result\\":[");\n` +
        `        for (int __k = 0; __k < __returnSize; __k++) { if (__k) printf(","); printf("%d", __result[__k]); }\n` +
        `        printf("]}\\n");\n` +
        `        if (__result) free(__result);`
      );
    default:
      // Any question whose return_type has no C representation (e.g.
      // "string[][]" for Group Anagrams — C has no nested dynamic-array
      // return convention) lands here. This intentionally short-circuits
      // BEFORE the participant's function is ever called, so an
      // unsupported-in-C question always reports a clean, honest
      // "unsupported return_type for C" error instead of miscompiling or
      // crashing — see the note in migrations/003_complete_coding_config.sql.
      return `printf("{\\"ok\\":false,\\"error\\":\\"unsupported return_type for C\\"}\\n");`;
  }
}

function cStrLit(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
  return `"${escaped}"`;
}

// Small hand-rolled JSON subset reader for C: objects of int/float/bool/
// string/int-array values only (matches our test-input shape).
const C_JSON_LIB = `
typedef struct CJsonValue {
    int is_str, is_arr, is_obj, boolean;
    double num;
    char* str;
    struct CJsonValue* arr;
    int arr_len;
    char** keys;
    struct CJsonValue* obj_vals;
    int obj_len;
} CJsonValue;

static const char* __cjson_p;

static void __cjson_ws() { while (*__cjson_p == ' ' || *__cjson_p == '\\t' || *__cjson_p == '\\n' || *__cjson_p == '\\r') __cjson_p++; }

static char* __cjson_parse_string() {
    __cjson_p++; /* opening quote */
    char buf[65536]; int n = 0;
    while (*__cjson_p != '"') {
        if (*__cjson_p == '\\\\') {
            __cjson_p++;
            switch (*__cjson_p) {
                case 'n': buf[n++] = '\\n'; break;
                case 't': buf[n++] = '\\t'; break;
                case 'r': buf[n++] = '\\r'; break;
                case '"': buf[n++] = '"'; break;
                case '\\\\': buf[n++] = '\\\\'; break;
                default: buf[n++] = *__cjson_p;
            }
            __cjson_p++;
        } else {
            buf[n++] = *__cjson_p++;
        }
    }
    __cjson_p++; /* closing quote */
    buf[n] = 0;
    char* out = (char*) malloc(n + 1);
    memcpy(out, buf, n + 1);
    return out;
}

static CJsonValue __cjson_parse_value();

static CJsonValue __cjson_parse_array() {
    CJsonValue v; memset(&v, 0, sizeof(v)); v.is_arr = 1;
    CJsonValue items[4096]; int n = 0;
    __cjson_p++; __cjson_ws();
    if (*__cjson_p == ']') { __cjson_p++; v.arr_len = 0; return v; }
    while (1) {
        items[n++] = __cjson_parse_value();
        __cjson_ws();
        if (*__cjson_p == ',') { __cjson_p++; __cjson_ws(); continue; }
        __cjson_p++; break;
    }
    v.arr = (CJsonValue*) malloc(sizeof(CJsonValue) * n);
    memcpy(v.arr, items, sizeof(CJsonValue) * n);
    v.arr_len = n;
    return v;
}

static CJsonValue __cjson_parse_object() {
    CJsonValue v; memset(&v, 0, sizeof(v)); v.is_obj = 1;
    char* keys[64]; CJsonValue vals[64]; int n = 0;
    __cjson_p++; __cjson_ws();
    if (*__cjson_p == '}') { __cjson_p++; v.obj_len = 0; return v; }
    while (1) {
        __cjson_ws();
        keys[n] = __cjson_parse_string();
        __cjson_ws(); __cjson_p++; /* colon */
        vals[n] = __cjson_parse_value();
        n++;
        __cjson_ws();
        if (*__cjson_p == ',') { __cjson_p++; continue; }
        __cjson_p++; break;
    }
    v.keys = (char**) malloc(sizeof(char*) * n);
    v.obj_vals = (CJsonValue*) malloc(sizeof(CJsonValue) * n);
    memcpy(v.keys, keys, sizeof(char*) * n);
    memcpy(v.obj_vals, vals, sizeof(CJsonValue) * n);
    v.obj_len = n;
    return v;
}

static CJsonValue __cjson_parse_value() {
    __cjson_ws();
    CJsonValue v; memset(&v, 0, sizeof(v));
    if (*__cjson_p == '{') return __cjson_parse_object();
    if (*__cjson_p == '[') return __cjson_parse_array();
    if (*__cjson_p == '"') { v.is_str = 1; v.str = __cjson_parse_string(); return v; }
    if (*__cjson_p == 't') { __cjson_p += 4; v.boolean = 1; return v; }
    if (*__cjson_p == 'f') { __cjson_p += 5; v.boolean = 0; return v; }
    if (*__cjson_p == 'n') { __cjson_p += 4; return v; }
    char* end;
    v.num = strtod(__cjson_p, &end);
    __cjson_p = end;
    return v;
}

static CJsonValue cjson_parse(const char* s) {
    __cjson_p = s;
    return __cjson_parse_value();
}

static CJsonValue cjson_get(CJsonValue* obj, const char* key) {
    for (int i = 0; i < obj->obj_len; i++) {
        if (strcmp(obj->keys[i], key) == 0) return obj->obj_vals[i];
    }
    CJsonValue v; memset(&v, 0, sizeof(v));
    return v;
}

static int* cjson_to_int_array(CJsonValue* v) {
    int* out = (int*) malloc(sizeof(int) * (v->arr_len > 0 ? v->arr_len : 1));
    for (int i = 0; i < v->arr_len; i++) out[i] = (int) v->arr[i].num;
    return out;
}
`.trim();

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------
export function buildDriverSource(
  language: "python3" | "java" | "cpp" | "c",
  cfg: CodingConfig,
  participantCode: string,
  tests: TestCase[],
): string {
  switch (language) {
    case "python3": return pythonDriver(cfg, participantCode, tests);
    case "java": return javaDriver(cfg, participantCode, tests);
    case "cpp": return cppDriver(cfg, participantCode, tests);
    case "c": return cDriver(cfg, participantCode, tests);
  }
}
