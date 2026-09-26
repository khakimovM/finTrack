#!/usr/bin/env node
/**
 * Refuses destructive commands proposed by an agent.
 * Reads the proposed command from argv or stdin and exits non-zero to block it.
 */
const DENY = [
  /prisma\s+migrate\s+reset/i,
  /prisma\s+db\s+push.*--(force|accept-data-loss)/i,
  /drop\s+(database|schema|table)/i,
  /truncate\s+.*cascade/i,
  /rm\s+-rf\s+(\/|~|\.\/(apps|packages|docs|\.agents))/i,
  /git\s+push.*--force(?!-with-lease)/i,
  /git\s+reset\s+--hard/i,
];

const input = process.argv.slice(2).join(' ') || '';
const hit = DENY.find((re) => re.test(input));

if (hit) {
  console.error(
    `[guard] Blocked destructive command: ${input}\n` +
      `Matched rule: ${hit}\n` +
      `Ask the user for explicit approval and run it manually if it is really needed.`,
  );
  process.exit(1);
}
process.exit(0);
