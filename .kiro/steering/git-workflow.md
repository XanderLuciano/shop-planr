---
inclusion: always
---

# Git Branching and Merge Workflow

## Rules

1. NEVER commit directly to `main`. All work MUST happen on a branch.

2. Before starting any new work, create a branch off `main` using one of these prefixes:
   - `feat/` — new features or functionality
   - `chore/` — cleanup, refactoring, UI polish, dependency updates
   - `fix/` — bug fixes
     Example: `git checkout -b feat/barcode-improvements`

3. Make as many commits as needed on the branch. Use clear, descriptive commit messages.

4. When the work is complete and ready to merge:
   - Push the branch to origin: `git push -u origin <branch-name>`
   - Create a Pull Request via the GitHub MCP targeting `main`
   - The PR body MUST start with `Fixes #<issue-number>` or `Relates to #<issue-number>` referencing the original GitHub issue
   - Do NOT merge locally — merging happens through the PR on GitHub

5. NEVER squash-merge locally with `git merge --squash`. NEVER run `git merge` against `main`. All merges happen through Pull Requests on GitHub.

6. Do NOT rebase onto main. All integration happens through PRs.

7. If the user asks to "commit" while on a feature branch, commit to the current branch. Only create a PR when the user explicitly asks to merge, says they are done, or says to create a PR.

## Pull Request Rules

19. Every PR body MUST reference the originating GitHub issue number (e.g., `Fixes #16`, `Relates to #42`).

20. When creating a PR, search open GitHub issues to find the matching ticket. If the branch was created from the Start Issue Workflow hook, the issue number should already be known from that workflow.

21. PR titles should follow conventional commit format: `fix: description`, `feat: description`, `chore: description`.

## Subagent / Delegated Task Rules

8. Subagents and delegated tasks MUST NEVER create new git branches, switch branches, or run `git checkout`. All work happens on whatever branch is currently checked out. The orchestrator (parent agent) owns all git operations.

9. Subagents MUST NEVER run `git commit`, `git add`, `git stash`, `git branch`, or any other git command. Only the orchestrator commits code. Subagents write files to disk — that's it.

10. When delegating tasks to subagents, the orchestrator MUST include this instruction: "Do NOT run any git commands. Do NOT create branches. Write files directly to the working directory."

## Branch Scoping and Merge Checkpoints

14. Each feature branch should be scoped to a logical unit of work (e.g., `feat/mvp-backend`, `feat/mvp-frontend`). When the work for that scope is complete, push and create a PR before starting a new branch for the next scope.

15. Do NOT continue unrelated work on a branch after its scope is done. If backend work is finished on `feat/mvp-backend`, push and PR it first, then create `feat/mvp-frontend` for frontend work.

16. Before starting a new feature branch, always check the current branch with `git branch --show-current`. If you're on the wrong branch, switch to `main` first, then create the new branch.

17. **After completing each task**, evaluate whether the next task still belongs on the current branch. Ask: "Is the next task part of the same logical scope (e.g., frontend, backend, AI integration)?" If not, commit, push, create a PR, and create a new appropriately-named branch before continuing.

18. When a spec checkpoint task passes (e.g., "Ensure all tests pass"), that's a natural merge point. Push and create a PR unless the very next task is tightly coupled to the current branch's scope.

## Node Modules and .gitignore

11. NEVER commit `node_modules/` to git. The `.gitignore` file must include `node_modules/` at all times.

12. When using `git checkout` to restore files from previous commits, NEVER restore `node_modules/`. Only restore specific source file paths (e.g., `packages/backend/src/...`).

13. Before any `git add -A` or `git add .`, always verify that `node_modules/` is in `.gitignore` and not staged. Use `git status` to check if needed.
