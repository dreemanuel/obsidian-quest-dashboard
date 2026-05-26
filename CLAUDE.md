# Quest Dashboard — Project Instructions

Project-specific guidance for working in this repo. See parent `/home/andre/Documents/_personal-projects/CLAUDE.md` for global personal-projects conventions, and `/home/andre/.claude/CLAUDE.md` for user-wide preferences.

## DEVLOG maintenance

**After every successful commit in this project, update `DEVLOG.md` at the project root** with a brief entry covering the change.

### When to add an entry
- Any commit that ships behavior, fixes a bug, or makes a notable infrastructure change
- The first commit of a new dated section starts a new `## YYYY-MM-DD — <short theme>` heading
- Multiple related commits in the same task can be rolled into one entry (don't bloat the log with one entry per atomic TDD commit — group by intent, not by commit count)

### When to skip
- Whitespace-only / formatting / typo-only commits
- Commits that ONLY update `DEVLOG.md` itself (the entry IS the log)
- Auto-formatter or linter cleanup with no behavior change

### Format
- Group by date — append under today's heading if it exists; otherwise add a new `## YYYY-MM-DD — <theme>` section
- Each entry: what shipped + key decisions + gotchas + commit SHA(s) in backticks
- Keep it terse — match the tone of existing entries in `DEVLOG.md`
- Update the "Current state" block at the bottom of the file when the snapshot meaningfully changes (test counts, ports, branch state, etc.)

### Commit strategy
Either commit the DEVLOG update as part of the same commit as the work being logged, OR as a follow-up commit. Both are acceptable. The invariant is that **DEVLOG.md should be current after every push**, not that every code commit must include the log update.

### Stronger enforcement
This is a soft instruction — Claude reads this file and follows it, but nothing prevents a commit from going out without a DEVLOG update. For hard enforcement, configure a Git `post-commit` hook or a Claude Code `PostToolUse` hook on Bash `git commit` invocations. See `update-config` skill for the harness-side hook approach.
