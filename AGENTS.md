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
- Whenever the user wants to add a new feature, always present a structured plan that covers:
  1. **Problems to Solve**: Clear, plain-language breakdown of the problems and technical gaps that need to be solved.
  2. **Possible Solutions & Senior Developer Recommendation**: Multiple viable options/approaches with pros/cons, followed by what an experienced senior developer would recommend, **why**, and in **what exact order** (including branch strategy and sequencing) they would approach it.
  3. **Test Items & Recommended Edge Cases**: A concrete list of test scenarios and edge cases to test for, followed by developing automated tests for those cases once approved.
- Do not write a proposed plan to `PLAN.md` upfront. First propose and discuss the plan in chat, and only add the approved plan items (with comments/explanations) to `PLAN.md` once we decide which parts of the plan are approved.
- Explain the proposed solution before implementing significant changes.
- Suggest specific tests that should be implemented to test a proposed feature before developing new features.
- Present alternative approaches when meaningful.
- Identify files that will be modified.
- Explain potential risks or breaking changes.
- **Ask for explicit approval before implementing major changes.**
- Never interpret silence as approval.
- If the user rejects a proposal, revise the plan rather than proceeding.

## Coding Rules
- Write code as a senior engineer mentoring junior engineers: prioritize readability and maintainability for engineers of all experience levels.
- Break logic into small, single-responsibility functions or classes rather than long inline blocks or cryptic ternaries.
- Comment code clearly to explain the "why" and make the intent obvious to junior engineers.
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
4. Remaining issues (and whenever an error occurred, clearly explain what caused the problem and how it was fixed)
5. Recommended next steps
6. Update `PROBLEMS.md` (which is ignored by `.gitignore`) with a log entry for any new problems addressed, how they were solved, and the reasoning behind the choice.

## Git
- Always run the relevant automated test suite (`npm test`) and build check (`npm run build`) before proposing or making a commit. Never commit broken or untested code.
- Always suggest separate feature branches when a request spans multiple features.
- Before creating any new branch, always remind the user to delete merged old branches and run `git checkout main && git pull origin main`.
- Commit after each approved change.
- Use extended, descriptive commit messages (a clear summary line followed by bullet points detailing what was added or changed).
- Always show the user the full extended commit message for the changes (both when proposing a commit and after committing).
- Do not commit until the user approves.
- Never deploy using the Vercel CLI (`vercel` / `npx vercel`); all deployments must happen exclusively through GitHub so automated tests run before changes reach `main`.

## Security

<!-- END:nextjs-agent-rules -->
