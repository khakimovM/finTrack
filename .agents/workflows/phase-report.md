---
description: Close out a roadmap phase with an honest status report.
---

# /phase-report

1. Read the current phase's acceptance criteria in `docs/06-ROADMAP.md`.
2. Check each one against the actual codebase — open the files, run the endpoints.
   Do not mark something done from memory.
3. Run `/verify`.
4. Produce:

**Phase N — <name>**

| Criterion | Status | Evidence |
|---|---|---|
| ... | ✅ / ❌ / ⚠️ partial | file path, test name, or command output |

- **Implemented:** endpoints, models, screens actually delivered
- **Deviations from spec:** what differs and why
- **Known gaps:** what a reviewer would find missing
- **Decisions needed from the user:** anything you had to guess
- **Next phase:** what it unblocks

Then stop. Do not begin the next phase without approval.
