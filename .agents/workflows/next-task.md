---
description: Pick up and execute the next unfinished item from the roadmap.
---

# /next-task

1. Read `docs/06-ROADMAP.md` and identify the first phase whose acceptance criteria are not
   all met. Verify by inspecting the codebase, not by trusting checkboxes.
2. State clearly: **which phase**, **which task**, and **what "done" means** for it.
3. List the files you will create or change, and any schema change involved.
4. Wait for approval if the task touches the database schema, an existing endpoint contract,
   or adds a dependency. Otherwise proceed.
5. Implement as a vertical slice: schema → migration → repository → service → controller →
   shared schema → API client → hook → UI → tests.
6. Run `pnpm verify`. Paste the real output.
7. Report using the format in `.agents/rules/70-git-workflow.md`
   (Done / Verified / Not done / Next).

Do not start the following phase in the same run.
