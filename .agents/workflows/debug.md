---
description: Systematically diagnose a bug instead of guessing at fixes.
---

# /debug

1. **Reproduce.** Write the exact steps, the expected result, and the actual result.
   If you cannot reproduce it, say so and ask for details — do not "fix" blind.
2. **Capture evidence.** Real error text, stack trace, failing request/response, SQL query.
   Never paraphrase an error message.
3. **Localise.** Which layer: UI, hook/cache, network, controller, service, repository, SQL,
   schema? Narrow it before editing anything.
4. **Write a failing test** that reproduces the bug at the right layer.
5. **Fix the cause**, not the symptom. Do not add a null check that hides a missing
   `userId` filter, and never loosen an assertion.
6. **Verify** the new test passes and `pnpm verify` is still green.
7. **Report** root cause in one sentence, the fix, and whether the same mistake exists
   elsewhere in the codebase.

Money bugs get extra scrutiny — check the ledger invariants in
`.agents/rules/40-domain-money.md` before concluding.
