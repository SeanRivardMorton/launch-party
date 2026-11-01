# Agent instructions

## Git worktrees and pull requests

The user authorizes creating task branches, worktrees, commits, pushes and PRs
as the default delivery workflow. The user reviews and merges PRs; do not merge
PRs, enable auto-merge, or push directly to `main`.

- Read `DEVELOPMENT.md` for commands and stack maintenance details.
- Inspect status, remotes, open PRs and existing worktrees before starting.
  Preserve uncommitted work and never reuse another task's worktree.
- Create one sibling worktree and descriptive branch per task, starting from
  freshly fetched `origin/main` for independent work. Work only in that task's
  worktree. Install its dependencies separately using the frozen lockfile.
- If a task depends on an unmerged PR, create its branch from that PR's latest
  branch tip and open the child PR against the parent branch, not `main`.
  Independent tasks should target `main` directly.
- Document the parent PR, base branch, dependency reason and merge order in
  every stacked PR. Link the child from the parent PR as well. The coordinator
  owns stack updates; workers must not rewrite shared parent branches.
- Verify the task, review the diff against its intended base, stage only intended
  files, commit, push with upstream tracking, and open a PR with `gh`.
  Include a summary and actual verification results; return the PR URL.
- When a parent merges, update the child's base and ancestry so its PR contains
  only its own changes. Squash/rebase merges require restacking, not merely
  changing the PR base. Re-run checks after restacking. Ask before force-pushing;
  if approved, use `--force-with-lease`, never an unconditional force push.
- Keep worktrees for open PRs available for revisions. Remove only clean,
  task-owned worktrees once their work is merged or explicitly abandoned.

## Herdr orchestration

Use Herdr to coordinate agent workers when a task benefits from independent,
parallel work. This project explicitly authorizes Herdr delegation for those
tasks; the user does not need to request it again on every turn. Handle small,
sequential tasks directly.

### Environment and discovery

- Load the `herdr` skill before managing workers and follow its workflow.
- Verify `HERDR_ENV=1` before inspecting or controlling Herdr. If outside Herdr,
  continue directly and explain that Herdr orchestration is unavailable.
- Use the installed CLI's help as the authority for supported commands and flags.
- Use the caller's pane (`--current`), returned pane IDs, or unique agent names.
  Never rely on whichever pane happens to have UI focus.

### Launching workers

- The primary agent is the coordinator and sole dispatcher by default. Workers
  should report to it rather than dispatching more workers or prompting peers,
  unless their assignment explicitly calls for that coordination.
- Default to OpenCode workers in sibling panes in the current tab, using each
  worker's assigned task worktree and preserving user focus with `--no-focus`.
- Inspect the current layout before splitting; choose right or down to keep panes
  usable. Do not create new workspaces, tabs, or sessions unless asked.
  Task worktrees are authorized by the Git workflow above.
- Read new pane IDs from creation responses. Start workers only in available
  shell panes, using unique, descriptive names such as `lp-auth-review`.
- Workers have independent conversation contexts. Give each a self-contained
  assignment: objective, relevant paths, constraints, file ownership, expected
  output, and appropriate verification commands.
- Give each independent editing worker its own branch and worktree. For related
  tasks, specify the parent branch and PR. Do not overwrite another worker's or
  the user's changes.

### Messaging and progress

Herdr prompts are interactive input, not a separate mailbox. Send assignments to
ready workers, dispatch independent tasks before waiting, and avoid injecting
follow-ups into a worker that is already working.

```bash
# Start in a pane returned by `herdr pane split`:
herdr agent start lp-auth-review --kind opencode --pane <returned-pane-id>

# Dispatch without --wait so other workers can be assigned in parallel:
herdr agent prompt lp-auth-review "<self-contained assignment>"

# After dispatching all independent tasks, wait and collect each result:
herdr agent wait lp-auth-review --timeout 120000
herdr agent read lp-auth-review --source recent-unwrapped --lines 160
```

- Use `herdr agent get <name>` to inspect lifecycle state. A settled state alone
  does not prove the assignment succeeded; read and evaluate the worker's result.
- On a timeout, stalled prompt, unknown state, or blocked worker, inspect state
  and output before taking action. Do not blindly resend a prompt.
- For approval or question dialogs, show the user what is blocking the worker
  rather than approving or answering on their behalf.
- Use prompts for short handoffs and shared files for durable context or long
  artifacts. Avoid competing writes to handoff files. If terminal history cannot
  recover a result, ask the worker to save it to a temporary Markdown file and
  read that file directly.

### Completion and cleanup

- The coordinator collects results, checks changes and appropriate verification,
  resolves integration issues, and gives the user one consolidated answer.
- Report unresolved failures or blockers accurately; do not equate worker
  completion with verified correctness.
- Close only panes created for this task when they are no longer needed. Leave
  demonstration panes open when the user wants to inspect them, and say so.
- Never stop the Herdr server or close unrelated panes, tabs, workspaces, or
  sessions without an explicit user request.
