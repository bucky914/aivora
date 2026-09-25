-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 003: complete coding_config for
-- every existing DSA/coding question
--
-- Run AFTER 001_code_execution.sql, 002_code_execution_seed.sql, and the
-- existing seed.sql (it UPDATEs rows seed.sql already inserted, matched
-- by title — no ids are hardcoded, so this is safe to run against any
-- database that has the standard seed.sql question bank, in any order,
-- with any actual row ids).
--
-- WHY EVERY QUESTION, NOT JUST TWO:
-- Each attempt draws 2 easy + 2 medium + 1 hard CODING question at random
-- from ALL active coding questions (see create_attempt() in schema.sql).
-- The seed bank has 8 coding questions (3 easy, 3 medium, 2 hard), so a
-- participant's 5 assigned questions are a random subset of those 8 — if
-- even one question lacked coding_config, some participants would still
-- see the old plain-text editor. This migration fills in all 8.
--
-- Every question below gets: function_name, params, return_type,
-- 4-language starter code (python3/java/c/cpp), public_tests, hidden_tests.
-- The participant only ever implements the named function — no main(),
-- no input()/scanf()/cin, no manual I/O parsing.
--
-- A NOTE ON GROUP ANAGRAMS AND C:
-- Its natural return type is "a list of groups of strings" (string[][]),
-- which C has no built-in representation for (no generics, no nested
-- dynamic arrays as a return convention). Its C starter is intentionally
-- left as a stub that always reports "not supported in C for this
-- question" through the normal error-reporting path — this is an honest
-- signal, not a bug: every other language (Python/Java/C++) is fully
-- solvable and graded normally. This is the one place in the whole
-- question bank where all 4 languages are not equally capable, because
-- the problem itself doesn't have a natural C shape.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Two Sum (already configured by 002, re-applied here idempotently so
-- this migration is a complete, standalone source of truth for all 8)
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "twoSum",
  "return_type": "int[]",
  "unordered_result": true,
  "params": [
    {"name": "nums", "type": "int[]"},
    {"name": "target", "type": "int"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def twoSum(self, nums, target):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution\n        return new int[]{};\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution\n        return {};\n    }\n};\n",
    "c": "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}\n"
  },
  "public_tests": [
    {"input": {"nums": [2, 7, 11, 15], "target": 9}, "expected": [0, 1]},
    {"input": {"nums": [3, 2, 4], "target": 6}, "expected": [1, 2]}
  ],
  "hidden_tests": [
    {"input": {"nums": [3, 3], "target": 6}, "expected": [0, 1]},
    {"input": {"nums": [1, 2, 3, 4, 5], "target": 9}, "expected": [3, 4]},
    {"input": {"nums": [-3, 4, 3, 90], "target": 0}, "expected": [0, 2]},
    {"input": {"nums": [0, 4, 3, 0], "target": 0}, "expected": [0, 3]},
    {"input": {"nums": [-1, -2, -3, -4, -5], "target": -8}, "expected": [2, 4]},
    {"input": {"nums": [5, 75, 25], "target": 100}, "expected": [1, 2]}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Two Sum';


-- ---------------------------------------------------------------------
-- Valid Parentheses (re-applied idempotently, see note above)
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "isValid",
  "return_type": "bool",
  "unordered_result": false,
  "params": [
    {"name": "s", "type": "string"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def isValid(self, s):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public boolean isValid(String s) {\n        // Write your solution\n        return false;\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your solution\n        return false;\n    }\n};\n",
    "c": "bool isValid(char* s) {\n    return false;\n}\n"
  },
  "public_tests": [
    {"input": {"s": "()[]{}"}, "expected": true},
    {"input": {"s": "(]"}, "expected": false}
  ],
  "hidden_tests": [
    {"input": {"s": "([{}])"}, "expected": true},
    {"input": {"s": "("}, "expected": false},
    {"input": {"s": ""}, "expected": true},
    {"input": {"s": "]"}, "expected": false},
    {"input": {"s": "([)]"}, "expected": false},
    {"input": {"s": "{[]}"}, "expected": true}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Valid Parentheses';


-- ---------------------------------------------------------------------
-- Merge Two Sorted Arrays
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "mergeSorted",
  "return_type": "int[]",
  "unordered_result": false,
  "params": [
    {"name": "a", "type": "int[]"},
    {"name": "b", "type": "int[]"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def mergeSorted(self, a, b):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public int[] mergeSorted(int[] a, int[] b) {\n        // Write your solution\n        return new int[]{};\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    vector<int> mergeSorted(vector<int>& a, vector<int>& b) {\n        // Write your solution\n        return {};\n    }\n};\n",
    "c": "int* mergeSorted(int* a, int aSize, int* b, int bSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}\n"
  },
  "public_tests": [
    {"input": {"a": [1, 3, 5], "b": [2, 4, 6]}, "expected": [1, 2, 3, 4, 5, 6]},
    {"input": {"a": [], "b": [7, 9]}, "expected": [7, 9]}
  ],
  "hidden_tests": [
    {"input": {"a": [7, 9], "b": []}, "expected": [7, 9]},
    {"input": {"a": [], "b": []}, "expected": []},
    {"input": {"a": [1, 1, 1], "b": [1, 1]}, "expected": [1, 1, 1, 1, 1]},
    {"input": {"a": [-5, -1, 0], "b": [-3, -2, 4]}, "expected": [-5, -3, -2, -1, 0, 4]},
    {"input": {"a": [2, 2, 2], "b": [1, 3]}, "expected": [1, 2, 2, 2, 3]},
    {"input": {"a": [100], "b": [1, 2, 3]}, "expected": [1, 2, 3, 100]}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Merge Two Sorted Arrays';


-- ---------------------------------------------------------------------
-- Longest Substring Without Repeating Characters
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "lengthOfLongestSubstring",
  "return_type": "int",
  "unordered_result": false,
  "params": [
    {"name": "s", "type": "string"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def lengthOfLongestSubstring(self, s):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your solution\n        return 0;\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your solution\n        return 0;\n    }\n};\n",
    "c": "int lengthOfLongestSubstring(char* s) {\n    return 0;\n}\n"
  },
  "public_tests": [
    {"input": {"s": "abcabcbb"}, "expected": 3},
    {"input": {"s": "bbbbb"}, "expected": 1}
  ],
  "hidden_tests": [
    {"input": {"s": "pwwkew"}, "expected": 3},
    {"input": {"s": ""}, "expected": 0},
    {"input": {"s": " "}, "expected": 1},
    {"input": {"s": "dvdf"}, "expected": 3},
    {"input": {"s": "abba"}, "expected": 2},
    {"input": {"s": "tmmzuxt"}, "expected": 5}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Longest Substring Without Repeating Characters';


-- ---------------------------------------------------------------------
-- Product of Array Except Self
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "productExceptSelf",
  "return_type": "int[]",
  "unordered_result": false,
  "params": [
    {"name": "nums", "type": "int[]"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def productExceptSelf(self, nums):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        // Write your solution\n        return new int[]{};\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        // Write your solution\n        return {};\n    }\n};\n",
    "c": "int* productExceptSelf(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}\n"
  },
  "public_tests": [
    {"input": {"nums": [1, 2, 3, 4]}, "expected": [24, 12, 8, 6]},
    {"input": {"nums": [-1, 1, 0, -3, 3]}, "expected": [0, 0, 9, 0, 0]}
  ],
  "hidden_tests": [
    {"input": {"nums": [2, 3]}, "expected": [3, 2]},
    {"input": {"nums": [0, 0]}, "expected": [0, 0]},
    {"input": {"nums": [1, 1, 1, 1]}, "expected": [1, 1, 1, 1]},
    {"input": {"nums": [-1, -1, -1]}, "expected": [1, 1, 1]},
    {"input": {"nums": [5, 6, 7, 8, 9]}, "expected": [3024, 2520, 2160, 1890, 1680]},
    {"input": {"nums": [1, 0]}, "expected": [0, 1]}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Product of Array Except Self';


-- ---------------------------------------------------------------------
-- Group Anagrams
-- Python/Java/C++ return the natural "list of groups" shape (string[][]).
-- C has no natural nested-array return convention, so its starter always
-- reports "not supported in C for this question" — see the note at the
-- top of this file. The other three languages are fully solvable and
-- graded normally; unordered_result makes both group order AND each
-- group's internal word order irrelevant (canonicalized recursively).
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "groupAnagrams",
  "return_type": "string[][]",
  "unordered_result": true,
  "params": [
    {"name": "words", "type": "string[]"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def groupAnagrams(self, words):\n        # Write your solution\n        pass\n",
    "java": "import java.util.*;\n\nclass Solution {\n    public List<List<String>> groupAnagrams(String[] words) {\n        // Write your solution\n        return new ArrayList<>();\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string>& words) {\n        // Write your solution\n        return {};\n    }\n};\n",
    "c": "/* Group Anagrams has no natural return shape in plain C (no generics,\n * no built-in nested dynamic arrays). Please solve this one in Python,\n * Java, or C++ - those are fully supported and graded normally. */\nint groupAnagrams_not_supported_in_c(void) {\n    return 0;\n}\n"
  },
  "public_tests": [
    {"input": {"words": ["eat", "tea", "tan", "ate", "nat", "bat"]}, "expected": [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]]},
    {"input": {"words": [""]}, "expected": [[""]]}
  ],
  "hidden_tests": [
    {"input": {"words": ["a"]}, "expected": [["a"]]},
    {"input": {"words": ["abc", "bca", "cab", "xyz"]}, "expected": [["abc", "bca", "cab"], ["xyz"]]},
    {"input": {"words": ["ab", "ba", "abc"]}, "expected": [["ab", "ba"], ["abc"]]},
    {"input": {"words": []}, "expected": []},
    {"input": {"words": ["aa", "aa", "aa"]}, "expected": [["aa", "aa", "aa"]]},
    {"input": {"words": ["listen", "silent", "hello"]}, "expected": [["listen", "silent"], ["hello"]]}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Group Anagrams';


-- ---------------------------------------------------------------------
-- Trapping Rain Water
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "trap",
  "return_type": "int",
  "unordered_result": false,
  "params": [
    {"name": "height", "type": "int[]"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def trap(self, height):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public int trap(int[] height) {\n        // Write your solution\n        return 0;\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    int trap(vector<int>& height) {\n        // Write your solution\n        return 0;\n    }\n};\n",
    "c": "int trap(int* height, int heightSize) {\n    return 0;\n}\n"
  },
  "public_tests": [
    {"input": {"height": [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]}, "expected": 6},
    {"input": {"height": [4, 2, 0, 3, 2, 5]}, "expected": 9}
  ],
  "hidden_tests": [
    {"input": {"height": []}, "expected": 0},
    {"input": {"height": [1]}, "expected": 0},
    {"input": {"height": [5, 4, 3, 2, 1]}, "expected": 0},
    {"input": {"height": [1, 2, 3, 4, 5]}, "expected": 0},
    {"input": {"height": [3, 0, 3]}, "expected": 3},
    {"input": {"height": [0, 0, 0, 0]}, "expected": 0}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Trapping Rain Water';


-- ---------------------------------------------------------------------
-- Minimum Window Substring
-- ---------------------------------------------------------------------
update public.questions
set coding_config = $cfg${
  "function_name": "minWindow",
  "return_type": "string",
  "unordered_result": false,
  "params": [
    {"name": "s", "type": "string"},
    {"name": "t", "type": "string"}
  ],
  "starter_code": {
    "python3": "class Solution:\n    def minWindow(self, s, t):\n        # Write your solution\n        pass\n",
    "java": "class Solution {\n    public String minWindow(String s, String t) {\n        // Write your solution\n        return \"\";\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    string minWindow(string s, string t) {\n        // Write your solution\n        return \"\";\n    }\n};\n",
    "c": "char* minWindow(char* s, char* t) {\n    return \"\";\n}\n"
  },
  "public_tests": [
    {"input": {"s": "ADOBECODEBANC", "t": "ABC"}, "expected": "BANC"},
    {"input": {"s": "a", "t": "aa"}, "expected": ""}
  ],
  "hidden_tests": [
    {"input": {"s": "a", "t": "a"}, "expected": "a"},
    {"input": {"s": "a", "t": "b"}, "expected": ""},
    {"input": {"s": "ab", "t": "b"}, "expected": "b"},
    {"input": {"s": "aa", "t": "aa"}, "expected": "aa"},
    {"input": {"s": "cabwefgewcwaefgcf", "t": "cae"}, "expected": "cwae"},
    {"input": {"s": "", "t": "a"}, "expected": ""}
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 262144
}$cfg$::jsonb
where category = 'coding' and title = 'Minimum Window Substring';


-- ---------------------------------------------------------------------
-- Sanity check: warn (in the SQL editor / migration log) if any active
-- coding question still has no coding_config, so a broken run of this
-- migration against a differently-worded question bank is caught
-- immediately instead of silently leaving some questions on the old
-- plain-text editor.
-- ---------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(title, ', ') into v_missing
    from public.questions
   where category = 'coding' and is_active and coding_config is null;
  if v_missing is not null then
    raise warning 'Coding questions still missing coding_config after migration 003: %. '
      'These questions will keep the plain-text editor until an admin adds coding_config '
      '(via Admin > Questions, or another UPDATE like the ones in this migration).', v_missing;
  end if;
end $$;
