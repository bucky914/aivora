-- =====================================================================
-- Bug Busters – AIVORA 2K26 · production question bank replacement
-- Replaces the original 16 sample questions with:
--   Coding / DSA: 10 easy + 10 medium + 5 hard (25 total)
--   SQL:          8 easy +  8 medium + 4 hard (20 total)
-- Attempts still select 2 easy + 2 medium + 1 hard per category.
-- SQL fixtures are PostgreSQL-safe. Coding statements are original paraphrases
-- of the supplied LeetCode IDs, not copied problem statements.
-- =====================================================================

begin;

update public.questions
set is_active = false
where title in (
    'Two Sum',
    'Valid Parentheses',
    'Merge Two Sorted Arrays',
    'Longest Substring Without Repeating Characters',
    'Product of Array Except Self',
    'Group Anagrams',
    'Trapping Rain Water',
    'Minimum Window Substring',
    'High Earners',
    'Headcount by Department',
    'Customers in Chennai',
    'Second Highest Salary',
    'Departments With High Average Pay',
    'Customers Who Never Ordered',
    'Top Three Earners per Department',
    'Three-Day Login Streaks'
);

-- ---------------------------------------------------------------------
-- CODING / DSA · 25 LeetCode-based questions
-- ---------------------------------------------------------------------

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #4000 — Largest Integer With Given Digit Sum',$d4000$LeetCode 4000. Build the largest integer that has at most n digits and whose digits add up to s. Return -1 when no such integer exists.$d4000$,$e4000$[{"input":"{\"n\":2,\"s\":9}","output":"90"},{"input":"{\"n\":3,\"s\":10}","output":"910"}]$e4000$::jsonb,$x4000$1 <= n <= 5; 0 <= s <= 100. Return 0 when s = 0; otherwise do not use leading zeroes.$x4000$,NULL,NULL,NULL,10,true,$c4000${"function_name":"largestInteger","params":[{"name":"n","type":"int"},{"name":"s","type":"int"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def largestInteger(self, n, s):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int largestInteger(int n, int s) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint largestInteger(int n, int s) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int largestInteger(int n, int s) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"n":2,"s":9},"expected":90},{"input":{"n":3,"s":10},"expected":910}],"hidden_tests":[{"input":{"n":5,"s":45},"expected":99999},{"input":{"n":5,"s":0},"expected":0},{"input":{"n":2,"s":1},"expected":10},{"input":{"n":2,"s":20},"expected":-1}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c4000$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #680 — Valid Palindrome II',$d680$LeetCode 680. Decide whether a string can become a palindrome after deleting at most one character.$d680$,$e680$[{"input":"s=\"abca\"","output":"true"},{"input":"s=\"abc\"","output":"false"}]$e680$::jsonb,$x680$1 <= s.length <= 100000. Characters are lowercase English letters.$x680$,NULL,NULL,NULL,10,true,$c680${"function_name":"validPalindrome","params":[{"name":"s","type":"string"}],"return_type":"bool","starter_code":{"python3":"class Solution:\n    def validPalindrome(self, s):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return False\n","java":"class Solution {\n    public boolean validPalindrome(String s) {\n        // Write your solution here.\n        return false;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nbool validPalindrome(char* s) {\n    /* Write your solution here. */\n    return false;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool validPalindrome(string s) {\n        // Write your solution here.\n        return false;\n    }\n};\n"},"public_tests":[{"input":{"s":"abca"},"expected":true},{"input":{"s":"abc"},"expected":false}],"hidden_tests":[{"input":{"s":"deeee"},"expected":true},{"input":{"s":"abcda"},"expected":false},{"input":{"s":"a"},"expected":true}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c680$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #119 — Pascal''s Triangle II',$d119$LeetCode 119. Return the row of Pascal's triangle at zero-based index rowIndex, keeping the values in order.$d119$,$e119$[{"input":"{\"rowIndex\":3}","output":"[1,3,3,1]"},{"input":"{\"rowIndex\":4}","output":"[1,4,6,4,1]"}]$e119$::jsonb,$x119$0 <= rowIndex <= 33.$x119$,NULL,NULL,NULL,10,true,$c119${"function_name":"getRow","params":[{"name":"rowIndex","type":"int"}],"return_type":"int[]","starter_code":{"python3":"class Solution:\n    def getRow(self, rowIndex):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public int[] getRow(int rowIndex) {\n        // Write your solution here.\n        return new int[0];\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint* getRow(int rowIndex, int* returnSize) {\n    /* Write your solution here. */\n    *returnSize=0; return NULL;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> getRow(int rowIndex) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"rowIndex":3},"expected":[1,3,3,1]},{"input":{"rowIndex":0},"expected":[1]}],"hidden_tests":[{"input":{"rowIndex":4},"expected":[1,4,6,4,1]},{"input":{"rowIndex":5},"expected":[1,5,10,10,5,1]}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c119$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #263 — Ugly Number',$d263$LeetCode 263. Return true exactly when n is a positive integer whose prime factors are limited to 2, 3, and 5.$d263$,$e263$[{"input":"{\"n\":6}","output":"true"},{"input":"{\"n\":14}","output":"false"}]$e263$::jsonb,$x263$n may be any 32-bit signed integer.$x263$,NULL,NULL,NULL,10,true,$c263${"function_name":"isUgly","params":[{"name":"n","type":"int"}],"return_type":"bool","starter_code":{"python3":"class Solution:\n    def isUgly(self, n):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return False\n","java":"class Solution {\n    public boolean isUgly(int n) {\n        // Write your solution here.\n        return false;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nbool isUgly(int n) {\n    /* Write your solution here. */\n    return false;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool isUgly(int n) {\n        // Write your solution here.\n        return false;\n    }\n};\n"},"public_tests":[{"input":{"n":6},"expected":true},{"input":{"n":14},"expected":false}],"hidden_tests":[{"input":{"n":1},"expected":true},{"input":{"n":0},"expected":false},{"input":{"n":-25},"expected":false}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c263$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #3813 — Vowel-Consonant Score',$d3813$LeetCode 3813. Count vowels v and consonants c in the string. Return floor(v / c) when c > 0; return 0 when there are no consonants. Spaces and digits are ignored.$d3813$,$e3813$[{"input":"s=\"cooear\"","output":"2"},{"input":"s=\"axeyizou\"","output":"1"}]$e3813$::jsonb,$x3813$1 <= s.length <= 100. Only lowercase letters, spaces, and digits appear. Vowels are a, e, i, o, u.$x3813$,NULL,NULL,NULL,10,true,$c3813${"function_name":"vowelConsonantScore","params":[{"name":"s","type":"string"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def vowelConsonantScore(self, s):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int vowelConsonantScore(String s) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint vowelConsonantScore(char* s) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int vowelConsonantScore(string s) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"s":"cooear"},"expected":2},{"input":{"s":"axeyizou"},"expected":1}],"hidden_tests":[{"input":{"s":"a1b2c3"},"expected":0},{"input":{"s":"aeioub"},"expected":5},{"input":{"s":"bcdfg"},"expected":0}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c3813$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #3866 — First Unique Even Element',$d3866$LeetCode 3866. Return the first even value that occurs exactly once in nums. Return -1 if no even value is unique.$d3866$,$e3866$[{"input":"{\"nums\":[3,4,2,5,4,6]}","output":"2"},{"input":"{\"nums\":[4,4,2,2]}","output":"-1"}]$e3866$::jsonb,$x3866$1 <= nums.length <= 100. Values are positive integers from 1 to 100.$x3866$,NULL,NULL,NULL,10,true,$c3866${"function_name":"firstUniqueEvenElement","params":[{"name":"nums","type":"int[]"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def firstUniqueEvenElement(self, nums):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int firstUniqueEvenElement(int[] nums) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint firstUniqueEvenElement(int* nums, int numsSize) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int firstUniqueEvenElement(vector<int> nums) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"nums":[3,4,2,5,4,6]},"expected":2},{"input":{"nums":[4,4,2,2]},"expected":-1}],"hidden_tests":[{"input":{"nums":[5,2,3,2,4]},"expected":4},{"input":{"nums":[7,1,9]},"expected":-1}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c3866$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #3452 — Sum of Good Numbers',$d3452$LeetCode 3452. An element nums[i] is good when it is strictly greater than nums[i-k] and nums[i+k], whenever those indices exist. If neither index exists, it is still good. Return the sum of all good elements.$d3452$,$e3452$[{"input":"{\"nums\":[1,3,2,1,5,4],\"k\":2}","output":"12"},{"input":"{\"nums\":[2,1],\"k\":1}","output":"2"}]$e3452$::jsonb,$x3452$2 <= nums.length <= 100; 1 <= nums[i] <= 1000; 1 <= k <= floor(nums.length / 2).$x3452$,NULL,NULL,NULL,10,true,$c3452${"function_name":"sumOfGoodNumbers","params":[{"name":"nums","type":"int[]"},{"name":"k","type":"int"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def sumOfGoodNumbers(self, nums, k):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int sumOfGoodNumbers(int[] nums, int k) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint sumOfGoodNumbers(int* nums, int numsSize, int k) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int sumOfGoodNumbers(vector<int> nums, int k) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"nums":[1,3,2,1,5,4],"k":2},"expected":12},{"input":{"nums":[2,1],"k":1},"expected":2}],"hidden_tests":[{"input":{"nums":[5,4,3,2,1],"k":2},"expected":9},{"input":{"nums":[10,10,10],"k":1},"expected":0}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c3452$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #345 — Reverse Vowels of a String',$d345$LeetCode 345. Reverse only the vowels in a string, leaving every consonant and every non-vowel character in its original position.$d345$,$e345$[{"input":"s=\"IceCreAm\"","output":"AceCreIm"},{"input":"s=\"leetcode\"","output":"leotcede"}]$e345$::jsonb,$x345$1 <= s.length <= 300000. Vowels are A, E, I, O, U in either case.$x345$,NULL,NULL,NULL,10,true,$c345${"function_name":"reverseVowels","params":[{"name":"s","type":"string"}],"return_type":"string","starter_code":{"python3":"class Solution:\n    def reverseVowels(self, s):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return \"\"\n","java":"class Solution {\n    public String reverseVowels(String s) {\n        // Write your solution here.\n        return \"\";\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nchar* reverseVowels(char* s) {\n    /* Write your solution here. */\n    return \"\";\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    string reverseVowels(string s) {\n        // Write your solution here.\n        return \"\";\n    }\n};\n"},"public_tests":[{"input":{"s":"IceCreAm"},"expected":"AceCreIm"},{"input":{"s":"leetcode"},"expected":"leotcede"}],"hidden_tests":[{"input":{"s":"Aa"},"expected":"aA"},{"input":{"s":"hello"},"expected":"holle"},{"input":{"s":"xyz"},"expected":"xyz"}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c345$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #392 — Is Subsequence',$d392$LeetCode 392. Determine whether s can be obtained from t by deleting zero or more characters without changing the order of the remaining characters.$d392$,$e392$[{"input":"{\"s\":\"abc\",\"t\":\"ahbgdc\"}","output":"true"},{"input":"{\"s\":\"axc\",\"t\":\"ahbgdc\"}","output":"false"}]$e392$::jsonb,$x392$0 <= s.length <= 100; 0 <= t.length <= 100000.$x392$,NULL,NULL,NULL,10,true,$c392${"function_name":"isSubsequence","params":[{"name":"s","type":"string"},{"name":"t","type":"string"}],"return_type":"bool","starter_code":{"python3":"class Solution:\n    def isSubsequence(self, s, t):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return False\n","java":"class Solution {\n    public boolean isSubsequence(String s, String t) {\n        // Write your solution here.\n        return false;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nbool isSubsequence(char* s, char* t) {\n    /* Write your solution here. */\n    return false;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool isSubsequence(string s, string t) {\n        // Write your solution here.\n        return false;\n    }\n};\n"},"public_tests":[{"input":{"s":"abc","t":"ahbgdc"},"expected":true},{"input":{"s":"axc","t":"ahbgdc"},"expected":false}],"hidden_tests":[{"input":{"s":"","t":"abc"},"expected":true},{"input":{"s":"aaaa","t":"aa"},"expected":false}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c392$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','easy','LeetCode #1768 — Merge Strings Alternately',$d1768$LeetCode 1768. Interleave two strings by taking one character from each in turn; when one ends, append the rest of the other string.$d1768$,$e1768$[{"input":"{\"word1\":\"abc\",\"word2\":\"pqr\"}","output":"apbqcr"},{"input":"{\"word1\":\"ab\",\"word2\":\"pqrs\"}","output":"apbqrs"}]$e1768$::jsonb,$x1768$1 <= word1.length, word2.length <= 100.$x1768$,NULL,NULL,NULL,10,true,$c1768${"function_name":"mergeAlternately","params":[{"name":"word1","type":"string"},{"name":"word2","type":"string"}],"return_type":"string","starter_code":{"python3":"class Solution:\n    def mergeAlternately(self, word1, word2):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return \"\"\n","java":"class Solution {\n    public String mergeAlternately(String word1, String word2) {\n        // Write your solution here.\n        return \"\";\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nchar* mergeAlternately(char* word1, char* word2) {\n    /* Write your solution here. */\n    return \"\";\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    string mergeAlternately(string word1, string word2) {\n        // Write your solution here.\n        return \"\";\n    }\n};\n"},"public_tests":[{"input":{"word1":"abc","word2":"pqr"},"expected":"apbqcr"},{"input":{"word1":"ab","word2":"pqrs"},"expected":"apbqrs"}],"hidden_tests":[{"input":{"word1":"abcd","word2":"pq"},"expected":"apbqcd"},{"input":{"word1":"a","word2":"xyz"},"expected":"axyz"}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c1768$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #328 — Odd Even Linked List',$d328$LeetCode 328. Rearrange a linked list so nodes in odd positions come first, followed by nodes in even positions. For this contest harness, the linked list is represented by an array of node values; return the reordered values.$d328$,$e328$[{"input":"{\"head\":[1,2,3,4,5]}","output":"[1,3,5,2,4]"},{"input":"{\"head\":[2,1,3,5,6,4,7]}","output":"[2,3,6,7,1,5,4]"}]$e328$::jsonb,$x328$0 <= number of nodes <= 100000.$x328$,NULL,NULL,NULL,20,true,$c328${"function_name":"oddEvenList","params":[{"name":"head","type":"int[]"}],"return_type":"int[]","starter_code":{"python3":"class Solution:\n    def oddEvenList(self, head):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public int[] oddEvenList(int[] head) {\n        // Write your solution here.\n        return new int[0];\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint* oddEvenList(int* head, int headSize, int* returnSize) {\n    /* Write your solution here. */\n    *returnSize=0; return NULL;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> oddEvenList(vector<int> head) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"head":[1,2,3,4,5]},"expected":[1,3,5,2,4]},{"input":{"head":[2,1,3,5,6,4,7]},"expected":[2,3,6,7,1,5,4]}],"hidden_tests":[{"input":{"head":[]},"expected":[]},{"input":{"head":[1,2,3]},"expected":[1,3,2]}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c328$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #11 — Container With Most Water',$d11$LeetCode 11. Choose two vertical lines and maximize the area of water they can contain, using the distance between them and the shorter line.$d11$,$e11$[{"input":"{\"height\":[1,8,6,2,5,4,8,3,7]}","output":"49"},{"input":"{\"height\":[1,1]}","output":"1"}]$e11$::jsonb,$x11$2 <= height.length <= 100000; 0 <= height[i] <= 100000.$x11$,NULL,NULL,NULL,20,true,$c11${"function_name":"maxArea","params":[{"name":"height","type":"int[]"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def maxArea(self, height):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int maxArea(int[] height) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint maxArea(int* height, int heightSize) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxArea(vector<int> height) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"height":[1,8,6,2,5,4,8,3,7]},"expected":49},{"input":{"height":[1,1]},"expected":1}],"hidden_tests":[{"input":{"height":[4,3,2,1,4]},"expected":16},{"input":{"height":[1,2,1]},"expected":2}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c11$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #299 — Bulls and Cows',$d299$LeetCode 299. Compare two equal-length digit strings. A bull is a matching digit in the same position; a cow is a matching digit in a different position. Return the counts as xAyB.$d299$,$e299$[{"input":"{\"secret\":\"1807\",\"guess\":\"7810\"}","output":"1A3B"},{"input":"{\"secret\":\"1123\",\"guess\":\"0111\"}","output":"1A1B"}]$e299$::jsonb,$x299$secret and guess have equal length and contain digits 0-9.$x299$,NULL,NULL,NULL,20,true,$c299${"function_name":"getHint","params":[{"name":"secret","type":"string"},{"name":"guess","type":"string"}],"return_type":"string","starter_code":{"python3":"class Solution:\n    def getHint(self, secret, guess):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return \"\"\n","java":"class Solution {\n    public String getHint(String secret, String guess) {\n        // Write your solution here.\n        return \"\";\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nchar* getHint(char* secret, char* guess) {\n    /* Write your solution here. */\n    return \"\";\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    string getHint(string secret, string guess) {\n        // Write your solution here.\n        return \"\";\n    }\n};\n"},"public_tests":[{"input":{"secret":"1807","guess":"7810"},"expected":"1A3B"},{"input":{"secret":"1123","guess":"0111"},"expected":"1A1B"}],"hidden_tests":[{"input":{"secret":"1","guess":"0"},"expected":"0A0B"},{"input":{"secret":"1122","guess":"1222"},"expected":"3A0B"}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c299$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #3021 — Alice and Bob Playing Flower Game',$d3021$LeetCode 3021. Count the pairs (x,y) with 1 <= x <= n and 1 <= y <= m for which x + y is odd. Return the count.$d3021$,$e3021$[{"input":"{\"n\":3,\"m\":2}","output":"3"},{"input":"{\"n\":4,\"m\":4}","output":"8"}]$e3021$::jsonb,$x3021$1 <= n,m <= 100000.$x3021$,NULL,NULL,NULL,20,true,$c3021${"function_name":"flowerGame","params":[{"name":"n","type":"int"},{"name":"m","type":"int"}],"return_type":"long","starter_code":{"python3":"class Solution:\n    def flowerGame(self, n, m):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public long flowerGame(int n, int m) {\n        // Write your solution here.\n        return 0L;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nlong long flowerGame(int n, int m) {\n    /* Write your solution here. */\n    return 0LL;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    long long flowerGame(int n, int m) {\n        // Write your solution here.\n        return 0LL;\n    }\n};\n"},"public_tests":[{"input":{"n":3,"m":2},"expected":3},{"input":{"n":4,"m":4},"expected":8}],"hidden_tests":[{"input":{"n":1,"m":1},"expected":0},{"input":{"n":5,"m":1},"expected":2},{"input":{"n":100000,"m":100000},"expected":5000000000}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c3021$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #38 — Count and Say',$d38$LeetCode 38. Generate the nth term of the count-and-say sequence: read the previous digit string aloud as runs of repeated digits.$d38$,$e38$[{"input":"{\"n\":4}","output":"1211"},{"input":"{\"n\":5}","output":"111221"}]$e38$::jsonb,$x38$1 <= n <= 30.$x38$,NULL,NULL,NULL,20,true,$c38${"function_name":"countAndSay","params":[{"name":"n","type":"int"}],"return_type":"string","starter_code":{"python3":"class Solution:\n    def countAndSay(self, n):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return \"\"\n","java":"class Solution {\n    public String countAndSay(int n) {\n        // Write your solution here.\n        return \"\";\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nchar* countAndSay(int n) {\n    /* Write your solution here. */\n    return \"\";\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    string countAndSay(int n) {\n        // Write your solution here.\n        return \"\";\n    }\n};\n"},"public_tests":[{"input":{"n":4},"expected":"1211"},{"input":{"n":1},"expected":"1"}],"hidden_tests":[{"input":{"n":5},"expected":"111221"},{"input":{"n":6},"expected":"312211"}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c38$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #2095 — Delete the Middle Node of a Linked List',$d2095$LeetCode 2095. Remove the middle node of a non-empty linked list. For this contest harness, the list is represented as an array of values; return the values after deleting the middle node.$d2095$,$e2095$[{"input":"{\"head\":[1,3,4,7,1,2,6]}","output":"[1,3,4,1,2,6]"},{"input":"{\"head\":[1,2,3,4]}","output":"[1,2,4]"}]$e2095$::jsonb,$x2095$2 <= number of nodes <= 100000 for the original problem.$x2095$,NULL,NULL,NULL,20,true,$c2095${"function_name":"deleteMiddle","params":[{"name":"head","type":"int[]"}],"return_type":"int[]","starter_code":{"python3":"class Solution:\n    def deleteMiddle(self, head):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public int[] deleteMiddle(int[] head) {\n        // Write your solution here.\n        return new int[0];\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint* deleteMiddle(int* head, int headSize, int* returnSize) {\n    /* Write your solution here. */\n    *returnSize=0; return NULL;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> deleteMiddle(vector<int> head) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"head":[1,3,4,7,1,2,6]},"expected":[1,3,4,1,2,6]},{"input":{"head":[1,2,3,4]},"expected":[1,2,4]}],"hidden_tests":[{"input":{"head":[2,1]},"expected":[2]},{"input":{"head":[1,2,3,4,5]},"expected":[1,2,4,5]}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c2095$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #6 — Zigzag Conversion',$d6$LeetCode 6. Write a string in a zigzag across numRows and then read the rows left to right.$d6$,$e6$[{"input":"{\"s\":\"PAYPALISHIRING\",\"numRows\":3}","output":"PAHNAPLSIIGYIR"},{"input":"{\"s\":\"PAYPALISHIRING\",\"numRows\":4}","output":"PINALSIGYAHRPI"}]$e6$::jsonb,$x6$1 <= s.length <= 1000; 1 <= numRows <= 1000.$x6$,NULL,NULL,NULL,20,true,$c6${"function_name":"convert","params":[{"name":"s","type":"string"},{"name":"numRows","type":"int"}],"return_type":"string","starter_code":{"python3":"class Solution:\n    def convert(self, s, numRows):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return \"\"\n","java":"class Solution {\n    public String convert(String s, int numRows) {\n        // Write your solution here.\n        return \"\";\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nchar* convert(char* s, int numRows) {\n    /* Write your solution here. */\n    return \"\";\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    string convert(string s, int numRows) {\n        // Write your solution here.\n        return \"\";\n    }\n};\n"},"public_tests":[{"input":{"s":"PAYPALISHIRING","numRows":3},"expected":"PAHNAPLSIIGYIR"},{"input":{"s":"A","numRows":1},"expected":"A"}],"hidden_tests":[{"input":{"s":"PAYPALISHIRING","numRows":4},"expected":"PINALSIGYAHRPI"},{"input":{"s":"ABCD","numRows":2},"expected":"ACBD"}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c6$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #73 — Set Matrix Zeroes',$d73$LeetCode 73. Whenever a matrix cell is zero, set its entire row and column to zero. For this contest harness, return the modified matrix after performing the operation.$d73$,$e73$[{"input":"{\"matrix\":[[1,1,1],[1,0,1],[1,1,1]]}","output":"[[1,0,1],[0,0,0],[1,0,1]]"},{"input":"{\"matrix\":[[0,1,2,0],[3,4,5,2],[1,3,1,5]]}","output":"[[0,0,0,0],[0,4,5,0],[0,3,1,0]]"}]$e73$::jsonb,$x73$1 <= rows, cols <= 200.$x73$,NULL,NULL,NULL,20,true,$c73${"function_name":"setZeroes","params":[{"name":"matrix","type":"int[][]"}],"return_type":"int[][]","starter_code":{"python3":"class Solution:\n    def setZeroes(self, matrix):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public int[][] setZeroes(int[][] matrix) {\n        // Write your solution here.\n        return new int[0][0];\n    }\n}\n","c":"/* C contest note: this problem uses a parameter or return type that the current C harness does not support.\n   Solve it in Python 3, Java, or C++. */\n#include <stdbool.h>\n\nint setZeroes_unsupported(void) { return 0; }\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<int>> setZeroes(vector<vector<int>> matrix) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"matrix":[[1,1,1],[1,0,1],[1,1,1]]},"expected":[[1,0,1],[0,0,0],[1,0,1]]}],"hidden_tests":[{"input":{"matrix":[[1,2],[3,4]]},"expected":[[1,2],[3,4]]},{"input":{"matrix":[[1,0,3],[4,5,6]]},"expected":[[0,0,0],[4,0,6]]}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c73$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #49 — Group Anagrams',$d49$LeetCode 49. Group together words that contain the same letters with the same multiplicities. The groups and the word order inside a group may be returned in any order.$d49$,$e49$[{"input":"{\"words\":[\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]}","output":"[[\"eat\",\"tea\",\"ate\"],[\"tan\",\"nat\"],[\"bat\"]]"}]$e49$::jsonb,$x49$1 <= words.length <= 10000; words contain lowercase English letters.$x49$,NULL,NULL,NULL,20,true,$c49${"function_name":"groupAnagrams","params":[{"name":"words","type":"string[]"}],"return_type":"string[][]","starter_code":{"python3":"class Solution:\n    def groupAnagrams(self, words):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public java.util.List<java.util.List<String>> groupAnagrams(String[] words) {\n        // Write your solution here.\n        return new java.util.ArrayList<>();\n    }\n}\n","c":"/* C contest note: this problem uses a parameter or return type that the current C harness does not support.\n   Solve it in Python 3, Java, or C++. */\n#include <stdbool.h>\n\nint groupAnagrams_unsupported(void) { return 0; }\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string> words) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"words":["eat","tea","tan","ate","nat","bat"]},"expected":[["eat","tea","ate"],["tan","nat"],["bat"]]}],"hidden_tests":[{"input":{"words":["abc","bca","cab","foo","oof"]},"expected":[["abc","bca","cab"],["foo","oof"]]},{"input":{"words":[""]},"expected":[[""]]}],"unordered_result":true,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c49$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','medium','LeetCode #56 — Merge Intervals',$d56$LeetCode 56. Merge every pair of overlapping intervals until no two intervals overlap. Return the resulting intervals sorted by start value.$d56$,$e56$[{"input":"{\"intervals\":[[1,3],[2,6],[8,10],[15,18]]}","output":"[[1,6],[8,10],[15,18]]"},{"input":"{\"intervals\":[[1,4],[4,5]]}","output":"[[1,5]]"}]$e56$::jsonb,$x56$1 <= intervals.length <= 10000.$x56$,NULL,NULL,NULL,20,true,$c56${"function_name":"merge","params":[{"name":"intervals","type":"int[][]"}],"return_type":"int[][]","starter_code":{"python3":"class Solution:\n    def merge(self, intervals):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public int[][] merge(int[][] intervals) {\n        // Write your solution here.\n        return new int[0][0];\n    }\n}\n","c":"/* C contest note: this problem uses a parameter or return type that the current C harness does not support.\n   Solve it in Python 3, Java, or C++. */\n#include <stdbool.h>\n\nint merge_unsupported(void) { return 0; }\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<int>> merge(vector<vector<int>> intervals) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"intervals":[[1,3],[2,6],[8,10],[15,18]]},"expected":[[1,6],[8,10],[15,18]]},{"input":{"intervals":[[1,4],[4,5]]},"expected":[[1,5]]}],"hidden_tests":[{"input":{"intervals":[[1,4],[0,4]]},"expected":[[0,4]]},{"input":{"intervals":[[1,2],[3,4]]},"expected":[[1,2],[3,4]]}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c56$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','hard','LeetCode #37 — Sudoku Solver',$d37$LeetCode 37. Fill every empty cell of a 9x9 Sudoku grid with digits 1-9 so each row, column, and 3x3 box contains each digit exactly once. In this contest harness, return the completed board.$d37$,$e37$[{"input":"{\"board\":\"9x9 grid with 0 for empty cells\"}","output":"the completed 9x9 grid"}]$e37$::jsonb,$x37$The board is 9x9; 0 means empty. The input has a valid completion.$x37$,NULL,NULL,NULL,30,true,$c37${"function_name":"solveSudoku","params":[{"name":"board","type":"int[][]"}],"return_type":"int[][]","starter_code":{"python3":"class Solution:\n    def solveSudoku(self, board):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public int[][] solveSudoku(int[][] board) {\n        // Write your solution here.\n        return new int[0][0];\n    }\n}\n","c":"/* C contest note: this problem uses a parameter or return type that the current C harness does not support.\n   Solve it in Python 3, Java, or C++. */\n#include <stdbool.h>\n\nint solveSudoku_unsupported(void) { return 0; }\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<int>> solveSudoku(vector<vector<int>> board) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"board":[[0,0,4,6,0,8,9,1,2],[0,7,2,0,9,5,3,4,0],[1,9,0,3,4,0,5,0,7],[8,0,9,7,6,1,0,2,3],[0,2,6,8,0,3,7,9,0],[7,1,0,9,2,0,8,5,6],[9,0,1,5,0,7,2,0,4],[0,8,7,0,1,9,6,3,0],[3,4,0,2,8,0,0,7,9]]},"expected":[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]]}],"hidden_tests":[{"input":{"board":[[0,0,4,6,0,8,9,1,2],[0,7,2,0,9,5,3,4,0],[1,9,0,3,4,0,5,0,7],[8,0,9,7,6,1,0,2,3],[0,2,6,8,0,3,7,9,0],[7,1,0,9,2,0,8,5,6],[9,0,1,5,0,7,2,0,4],[0,8,7,0,1,9,6,3,0],[3,4,0,2,8,0,0,7,9]]},"expected":[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]]}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c37$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','hard','LeetCode #363 — Max Sum of Rectangle No Larger Than K',$d363$LeetCode 363. Find the maximum sum among all non-empty axis-aligned rectangular submatrices whose sum is at most k.$d363$,$e363$[{"input":"{\"matrix\":[[1,0,1],[0,-2,3]],\"k\":2}","output":"2"},{"input":"{\"matrix\":[[2,2,-1]],\"k\":3}","output":"3"}]$e363$::jsonb,$x363$1 <= rows, cols <= 100. Matrix values are signed integers; a valid rectangle always exists.$x363$,NULL,NULL,NULL,30,true,$c363${"function_name":"maxSumSubmatrix","params":[{"name":"matrix","type":"int[][]"},{"name":"k","type":"int"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def maxSumSubmatrix(self, matrix, k):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int maxSumSubmatrix(int[][] matrix, int k) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"/* C contest note: this problem uses a parameter or return type that the current C harness does not support.\n   Solve it in Python 3, Java, or C++. */\n#include <stdbool.h>\n\nint maxSumSubmatrix_unsupported(void) { return 0; }\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int maxSumSubmatrix(vector<vector<int>> matrix, int k) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"matrix":[[1,0,1],[0,-2,3]],"k":2},"expected":2},{"input":{"matrix":[[2,2,-1]],"k":3},"expected":3}],"hidden_tests":[{"input":{"matrix":[[5,-4,3],[-2,1,2]],"k":3},"expected":3},{"input":{"matrix":[[-5,4],[-2,-1]],"k":-1},"expected":-1}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c363$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','hard','LeetCode #51 — N-Queens',$d51$LeetCode 51. Place n queens on an n x n board so no two queens share a row, column, or diagonal. Return every valid board using Q for a queen and . for an empty cell. Solution order is arbitrary.$d51$,$e51$[{"input":"{\"n\":4}","output":"2 valid boards"},{"input":"{\"n\":1}","output":"[\"Q\"]"}]$e51$::jsonb,$x51$1 <= n <= 9.$x51$,NULL,NULL,NULL,30,true,$c51${"function_name":"solveNQueens","params":[{"name":"n","type":"int"}],"return_type":"string[][]","starter_code":{"python3":"class Solution:\n    def solveNQueens(self, n):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return []\n","java":"class Solution {\n    public java.util.List<java.util.List<String>> solveNQueens(int n) {\n        // Write your solution here.\n        return new java.util.ArrayList<>();\n    }\n}\n","c":"/* C contest note: this problem uses a parameter or return type that the current C harness does not support.\n   Solve it in Python 3, Java, or C++. */\n#include <stdbool.h>\n\nint solveNQueens_unsupported(void) { return 0; }\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<string>> solveNQueens(int n) {\n        // Write your solution here.\n        return {};\n    }\n};\n"},"public_tests":[{"input":{"n":4},"expected":[[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]},{"input":{"n":1},"expected":[["Q"]]}],"hidden_tests":[{"input":{"n":2},"expected":[]},{"input":{"n":3},"expected":[]}],"unordered_result":true,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c51$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','hard','LeetCode #765 — Couples Holding Hands',$d765$LeetCode 765. People sit in a row, and each couple is represented by consecutive labels (0,1), (2,3), and so on. Return the minimum number of swaps needed so every couple sits together.$d765$,$e765$[{"input":"{\"row\":[0,2,1,3]}","output":"1"},{"input":"{\"row\":[3,2,0,1]}","output":"0"}]$e765$::jsonb,$x765$row contains every integer from 0 to row.length-1 exactly once; row.length is even.$x765$,NULL,NULL,NULL,30,true,$c765${"function_name":"minSwapsCouples","params":[{"name":"row","type":"int[]"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def minSwapsCouples(self, row):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int minSwapsCouples(int[] row) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint minSwapsCouples(int* row, int rowSize) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int minSwapsCouples(vector<int> row) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"row":[0,2,1,3]},"expected":1},{"input":{"row":[3,2,0,1]},"expected":0}],"hidden_tests":[{"input":{"row":[0,1,2,3]},"expected":0},{"input":{"row":[3,0,2,1]},"expected":1}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c765$::jsonb,NULL);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('coding','hard','LeetCode #1872 — Stone Game VIII',$d1872$LeetCode 1872. Alice and Bob repeatedly merge the chosen prefix of stones and place its sum at the front. Compute the maximum score difference Alice can force under optimal play.$d1872$,$e1872$[{"input":"{\"stones\":[-1,2,-3,4,-5]}","output":"5"},{"input":"{\"stones\":[7,-6,5,10,5,-2,-6]}","output":"13"}]$e1872$::jsonb,$x1872$2 <= stones.length <= 100000; values are signed integers.$x1872$,NULL,NULL,NULL,30,true,$c1872${"function_name":"stoneGameVIII","params":[{"name":"stones","type":"int[]"}],"return_type":"int","starter_code":{"python3":"class Solution:\n    def stoneGameVIII(self, stones):\n        # Write your solution here.\n        # Return the value required by the problem.\n        return 0\n","java":"class Solution {\n    public int stoneGameVIII(int[] stones) {\n        // Write your solution here.\n        return 0;\n    }\n}\n","c":"#include <stdbool.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\n\nint stoneGameVIII(int* stones, int stonesSize) {\n    /* Write your solution here. */\n    return 0;\n}\n","cpp":"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    int stoneGameVIII(vector<int> stones) {\n        // Write your solution here.\n        return 0;\n    }\n};\n"},"public_tests":[{"input":{"stones":[-1,2,-3,4,-5]},"expected":5},{"input":{"stones":[7,-6,5,10,5,-2,-6]},"expected":13}],"hidden_tests":[{"input":{"stones":[-10,-12]},"expected":-22},{"input":{"stones":[1,2,3]},"expected":6},{"input":{"stones":[1,-2,3]},"expected":2}],"unordered_result":false,"float_tolerance":null,"memory_limit_kb":256000,"stack_limit_kb":128000,"cpu_time_limit_sec":5,"wall_time_limit_sec":10}$c1872$::jsonb,NULL);


-- ---------------------------------------------------------------------
-- SQL · 20 questions from the supplied SQL challenge page
-- ---------------------------------------------------------------------

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Active Premium Members',$sd1$A SaaS company stores its user data in a members table. Retrieve the full names and email addresses of all members who have a premium subscription status, sorted alphabetically by last name.

Schema:
```text
members
member_id | first_name | last_name | email | status
--- | --- | --- | --- | ---
1 | Alice | Nguyen | alice@mail.com | premium
2 | Bob | Smith | bob@mail.com | free
3 | Carol | Adams | carol@mail.com | premium
4 | Dan | Lee | dan@mail.com | free
5 | Eva | Brown | eva@mail.com | premium
```

Task:
Write a query that returns full_name (first + last name concatenated with a space) and email for all premium members, ordered by last_name ASC .

Constraints:
Constraints Use CONCAT() or the || operator for name concatenation. Return only members with status = 'premium'.$sd1$,$se1$[{"input":"Use the sample data shown in the statement.","output":"[{\"full_name\":\"Carol Adams\",\"email\":\"carol@mail.com\"},{\"full_name\":\"Eva Brown\",\"email\":\"eva@mail.com\"},{\"full_name\":\"Alice Nguyen\",\"email\":\"alice@mail.com\"}]"}]$se1$::jsonb,$sx1$Constraints Use CONCAT() or the || operator for name concatenation. Return only members with status = 'premium'.$sx1$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc1${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE members (member_id int, first_name text, last_name text, email text, status text);","seed_sql":"INSERT INTO members VALUES (1,'Alice','Nguyen','alice@mail.com','premium'),(2,'Bob','Smith','bob@mail.com','free'),(3,'Carol','Adams','carol@mail.com','premium'),(4,'Dan','Lee','dan@mail.com','free'),(5,'Eva','Brown','eva@mail.com','premium');","public_tests":[{"expected":[{"full_name":"Carol Adams","email":"carol@mail.com"},{"full_name":"Eva Brown","email":"eva@mail.com"},{"full_name":"Alice Nguyen","email":"alice@mail.com"}]}],"hidden_seed_sql":"INSERT INTO members VALUES (6,'Zoe','Aaron','zoe@mail.com','premium'),(7,'Fred','Smith','fred@mail.com','premium');","hidden_tests":[{"expected":[{"full_name":"Zoe Aaron","email":"zoe@mail.com"},{"full_name":"Carol Adams","email":"carol@mail.com"},{"full_name":"Eva Brown","email":"eva@mail.com"},{"full_name":"Alice Nguyen","email":"alice@mail.com"},{"full_name":"Fred Smith","email":"fred@mail.com"}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000}$sc1$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Product Catalogue Snapshot',$sd2$An e-commerce platform stores its product inventory. Find the top 5 most expensive unique product categories (by their maximum listed price in that category), showing the category name and that maximum price, ordered from most expensive to least.

Schema:
```text
products
product_id | product_name | category | price
--- | --- | --- | ---
1 | Laptop Pro | Electronics | 1200.00
2 | Wireless Mouse | Electronics | 45.00
3 | Sofa Deluxe | Furniture | 850.00
4 | Running Shoes | Footwear | 130.00
5 | Winter Jacket | Clothing | 220.00
6 | Coffee Maker | Appliances | 95.00
7 | Bookshelf | Furniture | 310.00
8 | Smartwatch | Electronics | 399.00
```

Task:
Write a query returning category and max_price (the MAX price in that category) for the top 5 categories by maximum price, ordered descending.$sd2$,$se2$[{"input":"Use the sample data shown in the statement.","output":"[{\"category\":\"Electronics\",\"max_price\":1200.0},{\"category\":\"Furniture\",\"max_price\":850.0},{\"category\":\"Clothing\",\"max_price\":220.0},{\"category\":\"Footwear\",\"max_price\":130.0},{\"category\":\"Appliances\",\"max_price\":95.0}]"}]$se2$::jsonb,$sx2$$sx2$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc2${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE products (product_id int, product_name text, category text, price numeric);","seed_sql":"INSERT INTO products VALUES (1,'Laptop Pro','Electronics',1200.0),(2,'Wireless Mouse','Electronics',45.0),(3,'Sofa Deluxe','Furniture',850.0),(4,'Running Shoes','Footwear',130.0),(5,'Winter Jacket','Clothing',220.0),(6,'Coffee Maker','Appliances',95.0),(7,'Bookshelf','Furniture',310.0),(8,'Smartwatch','Electronics',399.0);","public_tests":[{"expected":[{"category":"Electronics","max_price":1200.0},{"category":"Furniture","max_price":850.0},{"category":"Clothing","max_price":220.0},{"category":"Footwear","max_price":130.0},{"category":"Appliances","max_price":95.0}]}],"hidden_seed_sql":"INSERT INTO products VALUES (9,'Server Pro','Servers',1500.00),(10,'Desk Lamp','Furniture',180.00);","hidden_tests":[{"expected":[{"category":"Servers","max_price":1500.0},{"category":"Electronics","max_price":1200.0},{"category":"Furniture","max_price":850.0},{"category":"Clothing","max_price":220.0},{"category":"Footwear","max_price":130.0}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc2$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Order Count Per Customer',$sd3$An online store wants to know how many orders each customer has placed. Return the customer ID, customer name, and their total order count, sorted by order count descending.

Schema:
```text
customers
customer_id | name
--- | ---
1 | Priya Patel
2 | James Wilson
3 | Mei Zhang

orders
order_id | customer_id | order_date | amount
--- | --- | --- | ---
101 | 1 | 2024-01-10 | 250.00
102 | 1 | 2024-02-05 | 130.00
103 | 2 | 2024-01-15 | 80.00
104 | 1 | 2024-03-01 | 95.00
105 | 3 | 2024-02-20 | 310.00
```

Task:
Write a query that returns customer_id , name , and order_count for every customer who has placed at least one order, sorted by order_count DESC .$sd3$,$se3$[{"input":"Use the sample data shown in the statement.","output":"[{\"customer_id\":1,\"name\":\"Priya Patel\",\"order_count\":3},{\"customer_id\":2,\"name\":\"James Wilson\",\"order_count\":1},{\"customer_id\":3,\"name\":\"Mei Zhang\",\"order_count\":1}]"}]$se3$::jsonb,$sx3$$sx3$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc3${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE customers (customer_id int, name text); CREATE TEMP TABLE orders (order_id int, customer_id int, order_date date, amount numeric);","seed_sql":"INSERT INTO customers VALUES (1,'Priya Patel'),(2,'James Wilson'),(3,'Mei Zhang'); INSERT INTO orders VALUES (101,1,'2024-01-10',250.0),(102,1,'2024-02-05',130.0),(103,2,'2024-01-15',80.0),(104,1,'2024-03-01',95.0),(105,3,'2024-02-20',310.0);","public_tests":[{"expected":[{"customer_id":1,"name":"Priya Patel","order_count":3},{"customer_id":2,"name":"James Wilson","order_count":1},{"customer_id":3,"name":"Mei Zhang","order_count":1}]}],"hidden_seed_sql":"INSERT INTO orders VALUES (106,2,'2024-03-20',60.00);","hidden_tests":[{"expected":[{"customer_id":1,"name":"Priya Patel","order_count":3},{"customer_id":2,"name":"James Wilson","order_count":2},{"customer_id":3,"name":"Mei Zhang","order_count":1}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000}$sc3$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Average Salary by Department',$sd4$An HR database stores employee salaries. Find the average salary per department, rounded to 2 decimal places, and display results in descending order of average salary.

Schema:
```text
employees
emp_id | name | department | salary
--- | --- | --- | ---
1 | Ravi Kumar | Engineering | 90000.00
2 | Sia Mehta | Engineering | 85000.00
3 | Tom Baker | Sales | 60000.00
4 | Uma Singh | Sales | 55000.00
5 | Vera Cruz | HR | 50000.00
6 | Will Park | HR | 52000.00
```

Task:
Return department and avg_salary (AVG of salary rounded to 2 decimal places) per department, sorted by avg_salary descending.$sd4$,$se4$[{"input":"Use the sample data shown in the statement.","output":"[{\"department\":\"Engineering\",\"avg_salary\":87500.0},{\"department\":\"Sales\",\"avg_salary\":57500.0},{\"department\":\"HR\",\"avg_salary\":51000.0}]"}]$se4$::jsonb,$sx4$$sx4$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc4${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE employees (emp_id int, name text, department text, salary numeric);","seed_sql":"INSERT INTO employees VALUES (1,'Ravi Kumar','Engineering',90000.0),(2,'Sia Mehta','Engineering',85000.0),(3,'Tom Baker','Sales',60000.0),(4,'Uma Singh','Sales',55000.0),(5,'Vera Cruz','HR',50000.0),(6,'Will Park','HR',52000.0);","public_tests":[{"expected":[{"department":"Engineering","avg_salary":87500.0},{"department":"Sales","avg_salary":57500.0},{"department":"HR","avg_salary":51000.0}]}],"hidden_seed_sql":"INSERT INTO employees VALUES (7,'Xavier Rao','Engineering',90000),(8,'Yash Shah','Sales',70000);","hidden_tests":[{"expected":[{"department":"Engineering","avg_salary":88333.33},{"department":"Sales","avg_salary":61666.67},{"department":"HR","avg_salary":51000.0}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc4$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Cities With Multiple Branches',$sd5$A bank maintains a branches table. Find all cities that have more than one branch, along with the count of branches in that city.

Schema:
```text
branches
branch_id | branch_name | city
--- | --- | ---
1 | MG Road | Bangalore
2 | Indiranagar | Bangalore
3 | Andheri | Mumbai
4 | Bandra | Mumbai
5 | Dadar | Mumbai
6 | Connaught Place | Delhi
```

Task:
Return city and branch_count for cities that have strictly more than 1 branch.$sd5$,$se5$[{"input":"Use the sample data shown in the statement.","output":"[{\"city\":\"Bangalore\",\"branch_count\":2},{\"city\":\"Mumbai\",\"branch_count\":3}]"}]$se5$::jsonb,$sx5$$sx5$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc5${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE branches (branch_id int, branch_name text, city text);","seed_sql":"INSERT INTO branches VALUES (1,'MG Road','Bangalore'),(2,'Indiranagar','Bangalore'),(3,'Andheri','Mumbai'),(4,'Bandra','Mumbai'),(5,'Dadar','Mumbai'),(6,'Connaught Place','Delhi');","public_tests":[{"expected":[{"city":"Bangalore","branch_count":2},{"city":"Mumbai","branch_count":3}]}],"hidden_seed_sql":"INSERT INTO branches VALUES (7,'Dwarka','Delhi');","hidden_tests":[{"expected":[{"city":"Bangalore","branch_count":2},{"city":"Delhi","branch_count":2},{"city":"Mumbai","branch_count":3}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000}$sc5$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Students Without Scores',$sd6$A school stores student exam results. Some students did not appear for the exam and have a NULL score. Identify all students whose score is missing (NULL) and display their name and roll number.

Schema:
```text
student_scores
roll_no | student_name | score
--- | --- | ---
1 | Aarav Shah | 88.5
2 | Bhavna Rao | NULL
3 | Chetan Das | 75.00
4 | Divya Nair | NULL
5 | Eshan Malik | 91.00
```

Task:
Return roll_no and student_name for all students whose score is NULL . Remember: = NULL does not work in SQL.$sd6$,$se6$[{"input":"Use the sample data shown in the statement.","output":"[{\"roll_no\":2,\"student_name\":\"Bhavna Rao\"},{\"roll_no\":4,\"student_name\":\"Divya Nair\"}]"}]$se6$::jsonb,$sx6$$sx6$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc6${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE student_scores (roll_no int, student_name text, score numeric);","seed_sql":"INSERT INTO student_scores VALUES (1,'Aarav Shah',88.5),(2,'Bhavna Rao',NULL),(3,'Chetan Das',75.0),(4,'Divya Nair',NULL),(5,'Eshan Malik',91.0);","public_tests":[{"expected":[{"roll_no":2,"student_name":"Bhavna Rao"},{"roll_no":4,"student_name":"Divya Nair"}]}],"hidden_seed_sql":"INSERT INTO student_scores VALUES (6,'Farah Iyer',NULL);","hidden_tests":[{"expected":[{"roll_no":2,"student_name":"Bhavna Rao"},{"roll_no":4,"student_name":"Divya Nair"},{"roll_no":6,"student_name":"Farah Iyer"}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000}$sc6$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Revenue by Month',$sd7$A retail store tracks daily sales. Calculate the total revenue for each month in the year 2024, showing the month number and total revenue, ordered chronologically.

Schema:
```text
sales
sale_id | sale_date | revenue
--- | --- | ---
1 | 2024-01-05 | 500.00
2 | 2024-01-20 | 300.00
3 | 2024-02-10 | 700.00
4 | 2024-03-15 | 450.00
5 | 2024-03-28 | 550.00
6 | 2024-02-25 | 200.00
```

Task:
Return sale_month (numeric month extracted from sale_date) and total_revenue (SUM of revenue) for each month in 2024, ordered by month ascending.$sd7$,$se7$[{"input":"Use the sample data shown in the statement.","output":"[{\"sale_month\":1,\"total_revenue\":800.0},{\"sale_month\":2,\"total_revenue\":900.0},{\"sale_month\":3,\"total_revenue\":1000.0}]"}]$se7$::jsonb,$sx7$$sx7$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc7${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE sales (sale_id int, sale_date date, revenue numeric);","seed_sql":"INSERT INTO sales VALUES (1,'2024-01-05',500.0),(2,'2024-01-20',300.0),(3,'2024-02-10',700.0),(4,'2024-03-15',450.0),(5,'2024-03-28',550.0),(6,'2024-02-25',200.0);","public_tests":[{"expected":[{"sale_month":1,"total_revenue":800.0},{"sale_month":2,"total_revenue":900.0},{"sale_month":3,"total_revenue":1000.0}]}],"hidden_seed_sql":"INSERT INTO sales VALUES (7,'2024-04-10',1000.00),(8,'2023-12-20',5000.00);","hidden_tests":[{"expected":[{"sale_month":1,"total_revenue":800.0},{"sale_month":2,"total_revenue":900.0},{"sale_month":3,"total_revenue":1000.0},{"sale_month":4,"total_revenue":1000.0}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc7$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','easy','Duplicate Email Detection',$sd8$A user registration table may have duplicate email entries due to a data import bug. Find all email addresses that appear more than once in the table, along with how many times each appears.

Schema:
```text
registrations
reg_id | username | email
--- | --- | ---
1 | alice01 | alice@mail.com
2 | alice02 | alice@mail.com
3 | bob | bob@mail.com
4 | carol | carol@mail.com
5 | carol2 | carol@mail.com
6 | carol3 | carol@mail.com
```

Task:
Return email and occurrences (count) for all emails that appear more than once. Order by occurrences descending.$sd8$,$se8$[{"input":"Use the sample data shown in the statement.","output":"[{\"email\":\"alice@mail.com\",\"occurrences\":2},{\"email\":\"carol@mail.com\",\"occurrences\":3}]"}]$se8$::jsonb,$sx8$$sx8$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 10, true, NULL, $sc8${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE registrations (reg_id int, username text, email text);","seed_sql":"INSERT INTO registrations VALUES (1,'alice01','alice@mail.com'),(2,'alice02','alice@mail.com'),(3,'bob','bob@mail.com'),(4,'carol','carol@mail.com'),(5,'carol2','carol@mail.com'),(6,'carol3','carol@mail.com');","public_tests":[{"expected":[{"email":"alice@mail.com","occurrences":2},{"email":"carol@mail.com","occurrences":3}]}],"hidden_seed_sql":"INSERT INTO registrations VALUES (7,'bob2','bob@mail.com'),(8,'bob3','bob@mail.com'),(9,'bob4','bob@mail.com');","hidden_tests":[{"expected":[{"email":"bob@mail.com","occurrences":4},{"email":"carol@mail.com","occurrences":3},{"email":"alice@mail.com","occurrences":2}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000}$sc8$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Customers With No Orders',$sd9$Using the same customers and orders tables from Q3, find all customers who have never placed any order. Return their customer_id and name.

Schema:
```text
customers
customer_id | name
--- | ---
1 | Priya Patel
2 | James Wilson
3 | Mei Zhang
4 | Omar Hassan

orders
order_id | customer_id | order_date | amount
--- | --- | --- | ---
101 | 1 | 250.00
102 | 2 | 80.00
103 | 1 | 130.00
```

Task:
Write a query to find customers who have placed zero orders . You must use a LEFT JOIN with a NULL check — do not use NOT IN or NOT EXISTS (though those are valid alternatives).$sd9$,$se9$[{"input":"Use the sample data shown in the statement.","output":"[{\"customer_id\":3,\"name\":\"Mei Zhang\"},{\"customer_id\":4,\"name\":\"Omar Hassan\"}]"}]$se9$::jsonb,$sx9$$sx9$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc9${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE customers (customer_id int, name text); CREATE TEMP TABLE orders (order_id int, customer_id int, order_date date, amount numeric);","seed_sql":"INSERT INTO customers VALUES (1,'Priya Patel'),(2,'James Wilson'),(3,'Mei Zhang'),(4,'Omar Hassan'); INSERT INTO orders VALUES (101,1,250.0),(102,2,80.0),(103,1,130.0);","public_tests":[{"expected":[{"customer_id":3,"name":"Mei Zhang"},{"customer_id":4,"name":"Omar Hassan"}]}],"hidden_seed_sql":"INSERT INTO customers VALUES (5,'Nisha Roy');","hidden_tests":[{"expected":[{"customer_id":3,"name":"Mei Zhang"},{"customer_id":4,"name":"Omar Hassan"},{"customer_id":5,"name":"Nisha Roy"}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000}$sc9$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','High Earners by Department',$sd10$Find employees who earn more than the average salary of their own department. Return their name, department, and salary.

Schema:
```text
employees
emp_id | name | department | salary
--- | --- | --- | ---
1 | Ravi Kumar | Engineering | 90000.00
2 | Sia Mehta | Engineering | 85000.00
3 | Nate Fox | Engineering | 70000.00
4 | Tom Baker | Sales | 60000.00
5 | Uma Singh | Sales | 55000.00
6 | Vera Cruz | Sales | 50000.00
```

Task:
Return name , department , and salary for employees whose salary exceeds the average salary of their own department . Use a correlated subquery.$sd10$,$se10$[{"input":"Use the sample data shown in the statement.","output":"[{\"name\":\"Ravi Kumar\",\"department\":\"Engineering\",\"salary\":90000.0},{\"name\":\"Sia Mehta\",\"department\":\"Engineering\",\"salary\":85000.0},{\"name\":\"Tom Baker\",\"department\":\"Sales\",\"salary\":60000.0}]"}]$se10$::jsonb,$sx10$$sx10$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc10${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE employees (emp_id int, name text, department text, salary numeric);","seed_sql":"INSERT INTO employees VALUES (1,'Ravi Kumar','Engineering',90000.0),(2,'Sia Mehta','Engineering',85000.0),(3,'Nate Fox','Engineering',70000.0),(4,'Tom Baker','Sales',60000.0),(5,'Uma Singh','Sales',55000.0),(6,'Vera Cruz','Sales',50000.0);","public_tests":[{"expected":[{"name":"Ravi Kumar","department":"Engineering","salary":90000.0},{"name":"Sia Mehta","department":"Engineering","salary":85000.0},{"name":"Tom Baker","department":"Sales","salary":60000.0}]}],"hidden_seed_sql":"INSERT INTO employees VALUES (7,'Nora','Engineering',95000);","hidden_tests":[{"expected":[{"name":"Nora","department":"Engineering","salary":95000},{"name":"Ravi Kumar","department":"Engineering","salary":90000},{"name":"Tom Baker","department":"Sales","salary":60000}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc10$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Course Enrolment Report',$sd11$An online learning platform has students, courses, and enrolments. List each course name, the instructor name, and the number of enrolled students. Include courses with zero enrolments.

Schema:
```text
instructors
instructor_id | instructor_name
--- | ---
1 | Dr. Aditi Sen
2 | Prof. Mike Ray

courses
course_id | course_name | instructor_id
--- | --- | ---
1 | SQL Basics | 1
2 | Advanced Python | 2
3 | Data Structures | 1

enrolments
enrolment_id | course_id | student_id
--- | --- | ---
1 | 1 | 10
2 | 1 | 11
3 | 1 | 12
4 | 2 | 10
```

Task:
Join all three tables and return course_name , instructor_name , and enrolment_count . Courses with no enrolments must show 0, not be omitted.$sd11$,$se11$[{"input":"Use the sample data shown in the statement.","output":"[{\"course_name\":\"SQL Basics\",\"instructor_name\":\"Dr. Aditi Sen\",\"enrolment_count\":3},{\"course_name\":\"Advanced Python\",\"instructor_name\":\"Prof. Mike Ray\",\"enrolment_count\":1},{\"course_name\":\"Data Structures\",\"instructor_name\":\"Dr. Aditi Sen\",\"enrolment_count\":0}]"}]$se11$::jsonb,$sx11$$sx11$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc11${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE instructors (instructor_id int, instructor_name text); CREATE TEMP TABLE courses (course_id int, course_name text, instructor_id int); CREATE TEMP TABLE enrolments (enrolment_id int, course_id int, student_id int);","seed_sql":"INSERT INTO instructors VALUES (1,'Dr. Aditi Sen'),(2,'Prof. Mike Ray'); INSERT INTO courses VALUES (1,'SQL Basics',1),(2,'Advanced Python',2),(3,'Data Structures',1); INSERT INTO enrolments VALUES (1,1,10),(2,1,11),(3,1,12),(4,2,10);","public_tests":[{"expected":[{"course_name":"SQL Basics","instructor_name":"Dr. Aditi Sen","enrolment_count":3},{"course_name":"Advanced Python","instructor_name":"Prof. Mike Ray","enrolment_count":1},{"course_name":"Data Structures","instructor_name":"Dr. Aditi Sen","enrolment_count":0}]}],"hidden_seed_sql":"INSERT INTO enrolments VALUES (5,3,13);","hidden_tests":[{"expected":[{"course_name":"SQL Basics","instructor_name":"Dr. Aditi Sen","enrolment_count":3},{"course_name":"Advanced Python","instructor_name":"Prof. Mike Ray","enrolment_count":1},{"course_name":"Data Structures","instructor_name":"Dr. Aditi Sen","enrolment_count":1}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000}$sc11$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Order Status Labelling',$sd12$An order management system stores order amounts. Classify each order as 'Small' (amount < 100), 'Medium' (100–499.99), or 'Large' (≥ 500). Return the order_id, amount, and category label.

Schema:
```text
order_items
order_id | customer_id | amount
--- | --- | ---
1 | 10 | 45.00
2 | 11 | 250.00
3 | 12 | 780.00
4 | 10 | 99.99
5 | 13 | 500.00
```

Task:
Write a query returning order_id , amount , and a computed column order_category using a CASE expression to apply the three-tier classification above.$sd12$,$se12$[{"input":"Use the sample data shown in the statement.","output":"[{\"order_id\":1,\"amount\":45.0,\"order_category\":\"Small\"},{\"order_id\":2,\"amount\":250.0,\"order_category\":\"Medium\"},{\"order_id\":3,\"amount\":780.0,\"order_category\":\"Large\"},{\"order_id\":4,\"amount\":99.99,\"order_category\":\"Small\"},{\"order_id\":5,\"amount\":500.0,\"order_category\":\"Large\"}]"}]$se12$::jsonb,$sx12$$sx12$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc12${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE order_items (order_id int, customer_id int, amount numeric);","seed_sql":"INSERT INTO order_items VALUES (1,10,45.0),(2,11,250.0),(3,12,780.0),(4,10,99.99),(5,13,500.0);","public_tests":[{"expected":[{"order_id":1,"amount":45.0,"order_category":"Small"},{"order_id":2,"amount":250.0,"order_category":"Medium"},{"order_id":3,"amount":780.0,"order_category":"Large"},{"order_id":4,"amount":99.99,"order_category":"Small"},{"order_id":5,"amount":500.0,"order_category":"Large"}]}],"hidden_seed_sql":"INSERT INTO order_items VALUES (6,14,100.00);","hidden_tests":[{"expected":[{"order_id":1,"amount":45.0,"order_category":"Small"},{"order_id":2,"amount":250.0,"order_category":"Medium"},{"order_id":3,"amount":780.0,"order_category":"Large"},{"order_id":4,"amount":99.99,"order_category":"Small"},{"order_id":5,"amount":500.0,"order_category":"Large"},{"order_id":6,"amount":100.0,"order_category":"Medium"}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc12$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Top Customer Per Region',$sd13$A company tracks regional sales by customer. Find the customer with the highest total purchase amount in each region. If there's a tie, return all tied customers.

Schema:
```text
regional_sales
sale_id | region | customer_name | purchase_amount
--- | --- | --- | ---
1 | North | Alice | 500.00
2 | North | Bob | 800.00
3 | North | Alice | 300.00
4 | South | Carol | 600.00
5 | South | Dan | 400.00
6 | South | Carol | 200.00
```

Task:
Return region , customer_name , and total_purchase for the top-spending customer in each region. Handle ties by including all tied rows.$sd13$,$se13$[{"input":"Use the sample data shown in the statement.","output":"[{\"region\":\"North\",\"customer_name\":\"Bob\",\"total_purchase\":800.0},{\"region\":\"South\",\"customer_name\":\"Carol\",\"total_purchase\":800.0}]"}]$se13$::jsonb,$sx13$$sx13$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc13${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE regional_sales (sale_id int, region text, customer_name text, purchase_amount numeric);","seed_sql":"INSERT INTO regional_sales VALUES (1,'North','Alice',500.0),(2,'North','Bob',800.0),(3,'North','Alice',300.0),(4,'South','Carol',600.0),(5,'South','Dan',400.0),(6,'South','Carol',200.0);","public_tests":[{"expected":[{"region":"North","customer_name":"Bob","total_purchase":800.0},{"region":"South","customer_name":"Carol","total_purchase":800.0}]}],"hidden_seed_sql":"INSERT INTO regional_sales VALUES (7,'North','Alice',500);","hidden_tests":[{"expected":[{"region":"North","customer_name":"Alice","total_purchase":800.0},{"region":"North","customer_name":"Bob","total_purchase":800.0},{"region":"South","customer_name":"Carol","total_purchase":800.0}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc13$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Employee Referral Chain (Self JOIN)',$sd14$A company stores each employee's manager in the same employees table (with a self-referencing foreign key). List each employee's name alongside their direct manager's name. Employees with no manager (the CEO) should appear with 'No Manager' .

Schema:
```text
employees
emp_id | name | manager_id
--- | --- | ---
1 | Sarah CEO | NULL
2 | John VP | 1
3 | Lisa Eng | 2
4 | Mark Sales | 2
5 | Amy Dev | 3
```

Task:
Write a self-join query on the employees table. Use COALESCE to display 'No Manager' for employees whose manager_id is NULL.$sd14$,$se14$[{"input":"Use the sample data shown in the statement.","output":"[{\"employee_name\":\"Sarah CEO\",\"manager_name\":\"No Manager\"},{\"employee_name\":\"John VP\",\"manager_name\":\"Sarah CEO\"},{\"employee_name\":\"Lisa Eng\",\"manager_name\":\"John VP\"},{\"employee_name\":\"Mark Sales\",\"manager_name\":\"John VP\"},{\"employee_name\":\"Amy Dev\",\"manager_name\":\"Lisa Eng\"}]"}]$se14$::jsonb,$sx14$$sx14$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc14${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE employees (emp_id int, name text, manager_id int);","seed_sql":"INSERT INTO employees VALUES (1,'Sarah CEO',NULL),(2,'John VP',1),(3,'Lisa Eng',2),(4,'Mark Sales',2),(5,'Amy Dev',3);","public_tests":[{"expected":[{"employee_name":"Sarah CEO","manager_name":"No Manager"},{"employee_name":"John VP","manager_name":"Sarah CEO"},{"employee_name":"Lisa Eng","manager_name":"John VP"},{"employee_name":"Mark Sales","manager_name":"John VP"},{"employee_name":"Amy Dev","manager_name":"Lisa Eng"}]}],"hidden_seed_sql":"INSERT INTO employees VALUES (6,'Zed Intern',5);","hidden_tests":[{"expected":[{"employee_name":"Sarah CEO","manager_name":"No Manager"},{"employee_name":"John VP","manager_name":"Sarah CEO"},{"employee_name":"Lisa Eng","manager_name":"John VP"},{"employee_name":"Mark Sales","manager_name":"John VP"},{"employee_name":"Amy Dev","manager_name":"Lisa Eng"},{"employee_name":"Zed Intern","manager_name":"Amy Dev"}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000}$sc14$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Username Format Standardisation',$sd15$A user table contains usernames entered with inconsistent casing and spaces. Produce a standardised username: convert to lowercase, trim leading/trailing spaces, and replace internal spaces with underscores. Return original and cleaned username.

Schema:
```text
raw_users
user_id | raw_username
--- | ---
1 | John Doe
2 | ALICE SMITH
3 | Bob
4 | CAROL jones
```

Task:
Return user_id , raw_username , and clean_username produced by: TRIM → LOWER → REPLACE(spaces, '_') .$sd15$,$se15$[{"input":"Use the sample data shown in the statement.","output":"[{\"user_id\":1,\"raw_username\":\"John Doe\",\"clean_username\":\"john_doe\"},{\"user_id\":2,\"raw_username\":\"ALICE SMITH\",\"clean_username\":\"alice_smith\"},{\"user_id\":3,\"raw_username\":\"Bob\",\"clean_username\":\"bob\"},{\"user_id\":4,\"raw_username\":\"CAROL jones\",\"clean_username\":\"carol_jones\"}]"}]$se15$::jsonb,$sx15$$sx15$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc15${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE raw_users (user_id int, raw_username text);","seed_sql":"INSERT INTO raw_users VALUES (1,'  John Doe  '),(2,'ALICE SMITH'),(3,' Bob '),(4,'CAROL jones');","public_tests":[{"expected":[{"user_id":1,"raw_username":"  John Doe  ","clean_username":"john_doe"},{"user_id":2,"raw_username":"ALICE SMITH","clean_username":"alice_smith"},{"user_id":3,"raw_username":" Bob ","clean_username":"bob"},{"user_id":4,"raw_username":"CAROL jones","clean_username":"carol_jones"}]}],"hidden_seed_sql":"INSERT INTO raw_users VALUES (5,'  ALICE  SMITH  ');","hidden_tests":[{"expected":[{"user_id":1,"raw_username":"  John Doe  ","clean_username":"john_doe"},{"user_id":2,"raw_username":"ALICE SMITH","clean_username":"alice_smith"},{"user_id":3,"raw_username":" Bob ","clean_username":"bob"},{"user_id":4,"raw_username":"CAROL jones","clean_username":"carol_jones"},{"user_id":5,"raw_username":"  ALICE  SMITH  ","clean_username":"alice__smith"}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000}$sc15$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','medium','Departments With High Average Salary',$sd16$List departments whose average salary exceeds the overall company average salary. Return the department name and its average salary.

Schema:
```text
employees
emp_id | name | department | salary
--- | --- | --- | ---
1 | Ravi | Engineering | 90000.00
2 | Sia | Engineering | 85000.00
3 | Tom | Sales | 60000.00
4 | Uma | Sales | 55000.00
5 | Vera | HR | 50000.00
6 | Will | HR | 52000.00
```

Task:
Use GROUP BY + HAVING with a scalar subquery inside HAVING to compare each department's average to the overall average.$sd16$,$se16$[{"input":"Use the sample data shown in the statement.","output":"[{\"department\":\"Engineering\",\"avg_salary\":87500.0}]"}]$se16$::jsonb,$sx16$$sx16$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 20, true, NULL, $sc16${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE employees (emp_id int, name text, department text, salary numeric);","seed_sql":"INSERT INTO employees VALUES (1,'Ravi','Engineering',90000.0),(2,'Sia','Engineering',85000.0),(3,'Tom','Sales',60000.0),(4,'Uma','Sales',55000.0),(5,'Vera','HR',50000.0),(6,'Will','HR',52000.0);","public_tests":[{"expected":[{"department":"Engineering","avg_salary":87500.0}]}],"hidden_seed_sql":"INSERT INTO employees VALUES (7,'Y','Sales',120000);","hidden_tests":[{"expected":[{"department":"Engineering","avg_salary":87500.0},{"department":"Sales","avg_salary":78333.33}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc16$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','hard','Top 2 Products Per Category (Dense Rank)',$sd17$A retail chain tracks product sales. Find the top 2 products by revenue within each category, using dense ranking so that tied products sharing a rank are both included. Return category, product name, revenue, and dense rank.

Schema:
```text
product_sales
sale_id | category | product_name | revenue
--- | --- | --- | ---
1 | Electronics | Laptop X | 5000.00
2 | Electronics | Tablet Z | 3000.00
3 | Electronics | Phone Y | 3000.00
4 | Electronics | Cable A | 200.00
5 | Furniture | Sofa Deluxe | 4500.00
6 | Furniture | Desk Pro | 2800.00
7 | Furniture | Chair Basic | 900.00
```

Task:
Use a CTE with DENSE_RANK() OVER (PARTITION BY category ORDER BY revenue DESC) to rank products within each category, then filter for ranks ≤ 2.

Constraints:
Constraints Must use DENSE_RANK() — not ROW_NUMBER() (which would exclude tied rows). Must use a CTE (WITH clause).$sd17$,$se17$[{"input":"Use the sample data shown in the statement.","output":"[{\"category\":\"Electronics\",\"product_name\":\"Laptop X\",\"revenue\":5000.0,\"rnk\":1},{\"category\":\"Electronics\",\"product_name\":\"Tablet Z\",\"revenue\":3000.0,\"rnk\":2},{\"category\":\"Electronics\",\"product_name\":\"Phone Y\",\"revenue\":3000.0,\"rnk\":2},{\"category\":\"Furniture\",\"product_name\":\"Sofa Deluxe\",\"revenue\":4500.0,\"rnk\":1},{\"category\":\"Furniture\",\"product_name\":\"Desk Pro\",\"revenue\":2800.0,\"rnk\":2}]"}]$se17$::jsonb,$sx17$Constraints Must use DENSE_RANK() — not ROW_NUMBER() (which would exclude tied rows). Must use a CTE (WITH clause).$sx17$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 30, true, NULL, $sc17${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE product_sales (sale_id int, category text, product_name text, revenue numeric);","seed_sql":"INSERT INTO product_sales VALUES (1,'Electronics','Laptop X',5000.0),(2,'Electronics','Tablet Z',3000.0),(3,'Electronics','Phone Y',3000.0),(4,'Electronics','Cable A',200.0),(5,'Furniture','Sofa Deluxe',4500.0),(6,'Furniture','Desk Pro',2800.0),(7,'Furniture','Chair Basic',900.0);","public_tests":[{"expected":[{"category":"Electronics","product_name":"Laptop X","revenue":5000.0,"rnk":1},{"category":"Electronics","product_name":"Tablet Z","revenue":3000.0,"rnk":2},{"category":"Electronics","product_name":"Phone Y","revenue":3000.0,"rnk":2},{"category":"Furniture","product_name":"Sofa Deluxe","revenue":4500.0,"rnk":1},{"category":"Furniture","product_name":"Desk Pro","revenue":2800.0,"rnk":2}]}],"hidden_seed_sql":"INSERT INTO product_sales VALUES (8,'Electronics','Monitor Q',3000);","hidden_tests":[{"expected":[{"category":"Electronics","product_name":"Laptop X","revenue":5000.0,"rnk":1},{"category":"Electronics","product_name":"Monitor Q","revenue":3000.0,"rnk":2},{"category":"Electronics","product_name":"Phone Y","revenue":3000.0,"rnk":2},{"category":"Electronics","product_name":"Tablet Z","revenue":3000.0,"rnk":2},{"category":"Furniture","product_name":"Sofa Deluxe","revenue":4500.0,"rnk":1},{"category":"Furniture","product_name":"Desk Pro","revenue":2800.0,"rnk":2}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc17$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','hard','Running Total of Daily Revenue',$sd18$A company's finance team needs a daily revenue report that also shows the cumulative (running) total of revenue up to and including each day, for the year 2024.

Schema:
```text
daily_revenue
rev_date | revenue
--- | ---
2024-01-01 | 1000.00
2024-01-02 | 1500.00
2024-01-03 | 800.00
2024-01-04 | 2200.00
2024-01-05 | 500.00
```

Task:
Return rev_date , revenue , and running_total using SUM() OVER (ORDER BY rev_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) .$sd18$,$se18$[{"input":"Use the sample data shown in the statement.","output":"[{\"rev_date\":\"2024-01-01\",\"revenue\":1000.0,\"running_total\":1000.0},{\"rev_date\":\"2024-01-02\",\"revenue\":1500.0,\"running_total\":2500.0},{\"rev_date\":\"2024-01-03\",\"revenue\":800.0,\"running_total\":3300.0},{\"rev_date\":\"2024-01-04\",\"revenue\":2200.0,\"running_total\":5500.0},{\"rev_date\":\"2024-01-05\",\"revenue\":500.0,\"running_total\":6000.0}]"}]$se18$::jsonb,$sx18$$sx18$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 30, true, NULL, $sc18${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE daily_revenue (rev_date date, revenue numeric);","seed_sql":"INSERT INTO daily_revenue VALUES ('2024-01-01',1000.0),('2024-01-02',1500.0),('2024-01-03',800.0),('2024-01-04',2200.0),('2024-01-05',500.0);","public_tests":[{"expected":[{"rev_date":"2024-01-01","revenue":1000.0,"running_total":1000.0},{"rev_date":"2024-01-02","revenue":1500.0,"running_total":2500.0},{"rev_date":"2024-01-03","revenue":800.0,"running_total":3300.0},{"rev_date":"2024-01-04","revenue":2200.0,"running_total":5500.0},{"rev_date":"2024-01-05","revenue":500.0,"running_total":6000.0}]}],"hidden_seed_sql":"INSERT INTO daily_revenue VALUES ('2024-01-06',700.00),('2023-12-31',9000.00);","hidden_tests":[{"expected":[{"rev_date":"2024-01-01","revenue":1000.0,"running_total":1000.0},{"rev_date":"2024-01-02","revenue":1500.0,"running_total":2500.0},{"rev_date":"2024-01-03","revenue":800.0,"running_total":3300.0},{"rev_date":"2024-01-04","revenue":2200.0,"running_total":5500.0},{"rev_date":"2024-01-05","revenue":500.0,"running_total":6000.0},{"rev_date":"2024-01-06","revenue":700.0,"running_total":6700.0}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc18$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','hard','Second Highest Salary Per Department',$sd19$For each department, find the employee with the second highest distinct salary . If a department has fewer than 2 distinct salary levels, omit that department. Return department, employee name, and their salary.

Schema:
```text
employees
emp_id | name | department | salary
--- | --- | --- | ---
1 | Ravi | Engineering | 90000.00
2 | Sia | Engineering | 85000.00
3 | Nate | Engineering | 85000.00
4 | Tom | Sales | 60000.00
5 | Uma | Sales | 55000.00
6 | Vera | HR | 50000.00
7 | Will | HR | 50000.00
```

Task:
Use two CTEs: the first uses DENSE_RANK() to rank salaries per department; the second filters to rank = 2. Return all employees at that second-distinct-salary level. HR (only one distinct salary) should be excluded.$sd19$,$se19$[{"input":"Use the sample data shown in the statement.","output":"[{\"department\":\"Engineering\",\"name\":\"Sia\",\"salary\":85000.0},{\"department\":\"Engineering\",\"name\":\"Nate\",\"salary\":85000.0},{\"department\":\"Sales\",\"name\":\"Uma\",\"salary\":55000.0}]"}]$se19$::jsonb,$sx19$$sx19$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 30, true, NULL, $sc19${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE employees (emp_id int, name text, department text, salary numeric);","seed_sql":"INSERT INTO employees VALUES (1,'Ravi','Engineering',90000.0),(2,'Sia','Engineering',85000.0),(3,'Nate','Engineering',85000.0),(4,'Tom','Sales',60000.0),(5,'Uma','Sales',55000.0),(6,'Vera','HR',50000.0),(7,'Will','HR',50000.0);","public_tests":[{"expected":[{"department":"Engineering","name":"Sia","salary":85000.0},{"department":"Engineering","name":"Nate","salary":85000.0},{"department":"Sales","name":"Uma","salary":55000.0}]}],"hidden_seed_sql":"INSERT INTO employees VALUES (8,'Y','Sales',55000),(9,'Z','HR',52000);","hidden_tests":[{"expected":[{"department":"Engineering","name":"Sia","salary":85000.0},{"department":"Engineering","name":"Nate","salary":85000.0},{"department":"Sales","name":"Uma","salary":55000.0},{"department":"Sales","name":"Y","salary":55000.0},{"department":"HR","name":"Z","salary":52000.0}]}],"ordered_result":false,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc19$::jsonb);

insert into public.questions (category,difficulty,title,description,examples,constraints,input_format,output_format,starter_content,points,is_active,coding_config,sql_config)
values ('sql','hard','Session Activity Leaderboard',$sd20$A gaming platform tracks user sessions and in-game purchases. Produce a leaderboard ranking players by their total score — calculated as: (total_session_minutes × 2) + (total_purchase_amount × 0.5) . Also classify each player as 'Elite' (score ≥ 500), 'Active' (200–499), or 'Casual' (< 200). Include players even if they have zero purchases. Show their rank, username, total score, and tier.

Schema:
```text
players
player_id | username
--- | ---
1 | StarKnight
2 | NovaBlade
3 | IronWolf
4 | CrystalFox

sessions
session_id | player_id | duration_mins
--- | --- | ---
1 | 1 | 120
2 | 1 | 80
3 | 2 | 200
4 | 3 | 50
5 | 4 | 30

purchases
purchase_id | player_id | amount
--- | --- | ---
1 | 1 | 100.00
2 | 1 | 60.00
3 | 2 | 200.00
4 | 3 | 20.00
```

Task:
Write a query using a CTE to compute each player's total score, then use ROW_NUMBER() OVER (ORDER BY total_score DESC) for ranking, and a CASE expression for tier classification. Players with zero purchases must still appear.

PostgreSQL note: use COALESCE for players with no purchases, and aggregate sessions/purchases separately before computing the score so multiple sessions and multiple purchases do not multiply each other in a join.$sd20$,$se20$[{"input":"Use the sample data shown in the statement.","output":"[{\"rank_pos\":1,\"username\":\"NovaBlade\",\"total_score\":500.0,\"tier\":\"Elite\"},{\"rank_pos\":2,\"username\":\"StarKnight\",\"total_score\":480.0,\"tier\":\"Active\"},{\"rank_pos\":3,\"username\":\"IronWolf\",\"total_score\":110.0,\"tier\":\"Casual\"},{\"rank_pos\":4,\"username\":\"CrystalFox\",\"total_score\":60.0,\"tier\":\"Casual\"}]"}]$se20$::jsonb,$sx20$$sx20$,'Write one PostgreSQL SELECT query.', 'Return the requested columns and rows.', '-- Write your PostgreSQL query here
', 30, true, NULL, $sc20${"supported_dialects":["sql","postgresql"],"schema_sql":"CREATE TEMP TABLE players (player_id int, username text); CREATE TEMP TABLE sessions (session_id int, player_id int, duration_mins int); CREATE TEMP TABLE purchases (purchase_id int, player_id int, amount numeric);","seed_sql":"INSERT INTO players VALUES (1,'StarKnight'),(2,'NovaBlade'),(3,'IronWolf'),(4,'CrystalFox'); INSERT INTO sessions VALUES (1,1,120),(2,1,80),(3,2,200),(4,3,50),(5,4,30); INSERT INTO purchases VALUES (1,1,100.0),(2,1,60.0),(3,2,200.0),(4,3,20.0);","public_tests":[{"expected":[{"rank_pos":1,"username":"NovaBlade","total_score":500.0,"tier":"Elite"},{"rank_pos":2,"username":"StarKnight","total_score":480.0,"tier":"Active"},{"rank_pos":3,"username":"IronWolf","total_score":110.0,"tier":"Casual"},{"rank_pos":4,"username":"CrystalFox","total_score":60.0,"tier":"Casual"}]}],"hidden_seed_sql":"INSERT INTO players VALUES (5,'SilverFox'); INSERT INTO sessions VALUES (6,5,100);","hidden_tests":[{"expected":[{"rank_pos":1,"username":"NovaBlade","total_score":500.0,"tier":"Elite"},{"rank_pos":2,"username":"StarKnight","total_score":480.0,"tier":"Active"},{"rank_pos":3,"username":"SilverFox","total_score":200.0,"tier":"Active"},{"rank_pos":4,"username":"IronWolf","total_score":110.0,"tier":"Casual"},{"rank_pos":5,"username":"CrystalFox","total_score":60.0,"tier":"Casual"}]}],"ordered_result":true,"statement_timeout_ms":2000,"max_rows":1000,"float_tolerance":0.01}$sc20$::jsonb);

commit;
