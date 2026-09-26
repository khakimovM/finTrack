# Core engineering rules

Always active. These outrank convenience.

## Truthfulness
- Never report a task complete without executing the verification command and reading its output.
- If you could not verify something, say so explicitly: "not verified because X".
- If a requirement in `docs/` is ambiguous, ask. Do not invent a resolution and move on.
- Never fabricate file paths, package names, API responses, or test results.

## Scope discipline
- Change only what the current task requires. No opportunistic refactors, no reformatting
  untouched files, no dependency bumps as a side effect.
- If you notice an unrelated problem, write it down in your report; do not fix it silently.

## Failure handling
- A failing test means the code is wrong until proven otherwise. Fix the code, not the test.
- Never use `.skip`, `.only`, `@ts-ignore`, `eslint-disable` or `as any` to make a check pass.
  If one is genuinely needed, add a comment explaining why and flag it in your report.
- Three consecutive failed attempts at the same fix → stop and report what you tried.

## TypeScript
- `strict: true` everywhere. No `any`. Use `unknown` + narrowing.
- Prefer `type` for unions, `interface` for object contracts that get extended.
- Derive types from Zod schemas (`z.infer<typeof schema>`) rather than declaring them twice.
- No non-null assertions (`!`) to silence the compiler; handle the null case.

## File hygiene
- Max ~300 lines per file. Split by responsibility, not by line count.
- One exported class/component per file, named the same as the file.
- Barrel files (`index.ts`) only at package boundaries, never inside a module.
