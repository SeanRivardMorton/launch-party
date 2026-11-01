# Agent instructions

## Delivery workflow

- Deliver code changes through pull requests.
- Let the existing GitHub Actions pipeline apply production migrations and deploy
  to Cloudflare after changes reach `main`.
- Do not deploy directly or run production migrations unless explicitly requested.
- Local builds, browser checks and local database migrations are appropriate for
  verification before raising a PR.

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
- Default to OpenCode workers in sibling panes in the current tab, preserving
  the current working directory and user focus with `--no-focus`.
- Inspect the current layout before splitting; choose right or down to keep panes
  usable. Do not create new workspaces, tabs, sessions, or worktrees unless asked.
- Read new pane IDs from creation responses. Start workers only in available
  shell panes, using unique, descriptive names such as `lp-auth-review`.
- Workers have independent conversation contexts. Give each a self-contained
  assignment: objective, relevant paths, constraints, file ownership, expected
  output, and appropriate verification commands.
- Assign non-overlapping files to workers that edit the shared checkout. Do not
  overwrite another worker's or the user's changes.

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
