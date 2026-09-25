-- =====================================================================
-- Bug Busters – AIVORA 2K26 · migration 002: coding_config for seed questions
--
-- Run AFTER 001_code_execution.sql AND after seed.sql has been loaded
-- (it updates rows that seed.sql already inserted, by title).
--
-- Adds a full coding_config (signature, 4-language starter code, public
-- + hidden tests) to "Two Sum" and "Valid Parentheses" so there are at
-- least 2 fully working LeetCode-style questions out of the box. Every
-- other seeded question is untouched and keeps working as a plain-text
-- answer question until you add coding_config to it too (Admin →
-- Questions, or another UPDATE like the ones below).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Two Sum
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
    "python3": "class Solution:\n    def twoSum(self, nums, target):\n        # write your solution\n        pass\n",
    "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{};\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return {};\n    }\n};\n",
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
-- Valid Parentheses
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
    "python3": "class Solution:\n    def isValid(self, s):\n        # write your solution\n        pass\n",
    "java": "class Solution {\n    public boolean isValid(String s) {\n        return false;\n    }\n}\n",
    "cpp": "class Solution {\npublic:\n    bool isValid(string s) {\n        return false;\n    }\n};\n",
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
