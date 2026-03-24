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
   - Switch to `main`: `git checkout main`
   - Squash merge the branch: `git merge --squash <branch-name>`
   - Commit with a single summary message describing all changes: `git commit -m "..."`

5. Do NOT use regular merge (`git merge` without `--squash`). Always squash.

6. Do NOT rebase onto main. Use squash merge only.

7. If the user asks to "commit" while on a feature branch, commit to the current branch. Only merge to `main` when the user explicitly asks to merge, or says they are done with the branch.

## Subagent / Delegated Task Rules

8. Subagents and delegated tasks MUST NEVER create new git branches, switch branches, or run `git checkout`. All work happens on whatever branch is currently checked out. The orchestrator (parent agent) owns all git operations.

9. Subagents MUST NEVER run `git commit`, `git add`, `git stash`, `git branch`, or any other git command. Only the orchestrator commits code. Subagents write files to disk — that's it.

10. When delegating tasks to subagents, the orchestrator MUST include this instruction: "Do NOT run any git commands. Do NOT create branches. Write files directly to the working directory."

## Branch Scoping and Merge Checkpoints

14. Each feature branch should be scoped to a logical unit of work (e.g., `feat/mvp-backend`, `feat/mvp-frontend`). When the work for that scope is complete, squash-merge it to `main` before starting a new branch for the next scope.

15. Do NOT continue unrelated work on a branch after its scope is done. If backend work is finished on `feat/mvp-backend`, merge it to `main` first, then create `feat/mvp-frontend` for frontend work.

16. Before starting a new feature branch, always check the current branch with `git branch --show-current`. If you're on the wrong branch, switch to `main` first, merge any completed work, then create the new branch.

17. **After completing each task**, evaluate whether the next task still belongs on the current branch. Ask: "Is the next task part of the same logical scope (e.g., frontend, backend, AI integration)?" If not, commit, squash-merge to `main`, and create a new appropriately-named branch before continuing.

18. When a spec checkpoint task passes (e.g., "Ensure all tests pass"), that's a natural merge point. Squash-merge to `main` unless the very next task is tightly coupled to the current branch's scope.

## Node Modules and .gitignore

11. NEVER commit `node_modules/` to git. The `.gitignore` file must include `node_modules/` at all times.

12. When using `git checkout` to restore files from previous commits, NEVER restore `node_modules/`. Only restore specific source file paths (e.g., `packages/backend/src/...`).

13. Before any `git add -A` or `git add .`, always verify that `node_modules/` is in `.gitignore` and not staged. Use `git status` to check if needed.
