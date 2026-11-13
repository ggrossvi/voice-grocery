<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# AI Agent Instructions

## Project Onboarding
Before making changes:
1. Read `README.md`.
2. Read `docs/PROJECT_CONTEXT.md`.
3. Review `docs/ARCHITECTURE.md`.
4. Check `docs/TASKS.md` for current priorities.
5. Follow `docs/CODING_STANDARDS.md` and `docs/SECURITY.md`.

## Planning and Approval
- Explain the proposed solution before implementing significant changes.
- Suggest specific tests that should be implemented to test a proposed feature before developing new features.
- Present alternative approaches when meaningful.
- Identify files that will be modified.
- Explain potential risks or breaking changes.
- **Ask for explicit approval before implementing major changes.**
- Never interpret silence as approval.
- If the user rejects a proposal, revise the plan rather than proceeding.

## Coding Rules
- Prefer simple, maintainable solutions.
- Reuse existing components and functions.
- Do not introduce unnecessary dependencies.
- Follow the existing project architecture.
- Use TypeScript when the project is configured for it.
- Never hardcode credentials or API keys.

## Testing
- Write tests for new business logic before writing business logic code.
- Run relevant existing tests after modifications.
- Do not claim tests passed unless they actually ran.
- Explain failures and unresolved issues.

## Scope Control
- Make only changes necessary for the approved task.
- Do not refactor unrelated code.
- Do not delete working functionality without approval.
- Do not change database schemas without discussing migrations.

## Completion Report
After implementing an approved change, summarize:
1. What changed
2. Which files changed
3. Which tests ran and their results
4. Remaining issues
5. Recommended next steps

## Git
- Always suggest separate feature branches when a request spans multiple features.
- Commit after each approved change.
- Use extended, descriptive commit messages (a clear summary line followed by bullet points detailing what was added or changed).
- Do not commit until the user approves.

## Security

<!-- END:nextjs-agent-rules -->
