# Development workflow

## Delivery agreement

Every task is delivered through a branch, a dedicated Git worktree and a pull
request. Agents may create these, commit and push task changes, and raise PRs.
The owner reviews and merges them. Agents must not push to `main`, merge PRs or
enable auto-merge.

Independent work branches from `origin/main` and opens a PR against `main`.
Work that requires an unmerged PR branches from that PR and targets its branch.
This creates a stack with a small, reviewable diff at each level:

```text
main ← feat/player-profiles (PR A) ← feat/player-discovery (PR B)
```

Merge order is A, then B. A separate task that does not depend on A or B gets
its own branch from `main`.

## Start a task

Inspect the repository and existing work before choosing a unique branch and
sibling directory. Do not stash, reset or copy unrelated uncommitted changes.

```sh
git status --short --branch
git worktree list
git remote -v
gh pr list
git fetch origin
git worktree add -b feat/task-name ../launch-party-task-name origin/main
```

Run all subsequent task commands from the new worktree. It has its own files
and dependencies, while sharing Git history and remotes with the main checkout.

```sh
pnpm install --frozen-lockfile
```

Configure local `.dev.vars` separately if the task needs it. Never commit local
credentials, runtime state or database contents. Use separate development ports
for simultaneously running worktrees.

## Start dependent work

Confirm the dependency's current PR and head branch using `gh pr view`. Fetch
the latest parent branch before creating the child:

```sh
git fetch origin
git worktree add -b feat/child-task ../launch-party-child-task origin/feat/parent-task
```

Open the child's PR with `--base feat/parent-task`. In the body, state:

```text
Depends on: #<parent PR number>
Base branch: feat/parent-task
Reason: <what this task needs from the parent>
Merge order: #<parent PR number>, then this PR
```

Add a link to the child PR in the parent PR's body or a comment. If the parent
changes while the child is in progress, bring those changes into the child and
verify again before declaring it ready for review.

## Verify and raise a PR

Run checks relevant to the change. Application changes normally require:

```sh
pnpm check
pnpm build
```

Add meaningful tests or browser verification where the task calls for them.
Documentation-only changes do not require an application build.

Before committing, inspect `git status`, `git diff` and recent commit history.
Before opening the PR, also inspect the branch's upstream and its full diff and
commit list against the intended base. Stage only task files.

Example for independent work:

```sh
git diff origin/main...HEAD
git log --oneline origin/main..HEAD
git push -u origin feat/task-name
gh pr create --base main --head feat/task-name --title "Describe the change" --body "Summary and verification results"
```

For a child PR, substitute the parent branch for `main` in both the review and
PR creation commands. Report the PR URL, checks and any unresolved blockers to
the owner. Keep the worktree available for requested revisions.

## Maintain a stack after a parent merges

1. Fetch the latest remote state and check how the parent was merged.
2. If the parent's original commits are in `main` (a regular merge), update the
   child from `origin/main` and retarget its PR to `main`.
3. If the parent was squash-merged or rebase-merged, replay only the child's
   commits onto `origin/main`. Record the original parent tip before losing
   access to the branch, and use it as the boundary for `git rebase --onto`.
   Retargeting alone would leave the parent's old commits in the child's diff.
4. History rewrites of a published child require the owner's approval before
   pushing. When approved, use `git push --force-with-lease`.
5. Retarget with `gh pr edit <child-number> --base main`, review the resulting
   diff and commits, and run the appropriate checks again. Update dependency
   notes and links. Repeat for descendants as each parent merges.

If a parent is closed without merging, stop and resolve the dependency with the
owner before delivering dependent work. Do not silently fold abandoned work
into another PR.

## CI and deployment

GitHub Actions checks PRs against **all base branches**, including stacked PRs.
Only pushes to `main` run production D1 migrations and deploy to Cloudflare.
Merging a child into an unmerged parent does not deploy production; the normal
review order is to merge the bottom of the stack into `main` first.

## Cleanup

After a task is merged or explicitly abandoned, verify its worktree is clean
and remove that task's worktree with `git worktree remove <path>`. Do not use
forced removal or delete branches still needed by dependent PRs. Leave unrelated
worktrees and the owner's main checkout intact.
