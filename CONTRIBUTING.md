CONTRIBUTING — WORKFLOW FOR COLLABORATORS
=========================================

GOLDEN RULE
-----------
Never push directly to `master`. All changes arrive as Pull Requests (PR).
The repo owner merges what they like and can undo anything with one command.

WHY
---
The owner's local folder (D:\umbra projects\umbra) is the source of truth.
Never force-push, never rewrite history on `master`, never delete it.
If you change `master` directly, the owner cannot cleanly undo your work.

YOUR FLOW (per change)
----------------------
1. Work in your own copy:
   - If you have a clone: `git checkout -b <yourname>/<feature>`
   - (Alternatively fork the repo and clone your fork.)

2. Make changes. Commit with a clear message, e.g.:
       git add -A
       git commit -m "fix: metering circuit breaker resets on config change"

3. Run the checks before pushing — anything breaking them will be rejected:
       npm run build && npm test && npm run lint

4. Push your branch and open a PR against `master`:
       git push origin <yourname>/<feature>
   (then click "Compare & pull request" on GitHub, or `gh pr create`)

5. Keep your branch up to date with master before asking for review:
       git fetch origin && git merge origin/master

6. Never merge your own PR unless the owner says so.

DEBUGGING
---------
- If you push debug code, put it behind a branch — not on master.
- `scripts/` is full of ready-made test/diagnose scripts: run `npm run dev`
  and watch `~/.umbra/logs/` for structured output.
- Any behaviour change MUST ship with a Jest test (114 tests today, all green).

FOR THE OWNER — REVIEWING AND UNDOING
=====================================

SEE THE CURRENT STATE
---------------------
    git pull                      # fetch + merge collaborators' merged work
    git log --oneline --graph -20 # what changed, in order
    git status                    # your working-copy state

IF YOU LIKE A PR
----------------
Merge it on GitHub (or accept their request). Then pull it locally.

IF YOU DON'T LIKE THEIR WORK — UNDO (3 ways, safest first)
----------------------------------------------------------
A) Undo the most recent merged pile, keeping all history:
       git pull
       git log --oneline -5          # find the good commit hash (e.g. 3d412b1)
       git checkout 3d412b1 -- .     # restore every file to that state
       git commit -m "revert: back to 3d412b1 state"
       git push                      # repo now looks like the good old state

B) Undo a single collaborator commit:
       git revert <commit-hash>      # safe: adds an inverse commit
       git push

C) Hard reset (only if nobody else already pulled the bad work):
       git reset --hard <good-hash>
       git push --force              # DANGER: wipes their commits from repo

For merges, undo the merge commit with:
       git revert -m 1 <merge-commit-hash>

TIP: before any collaborator lands, mark your current state you like:
       git tag good-before-review
After every review you like:   git tag good-<date>
A tag never changes — it is your permanent "restore point".

Never worry: pull requests can be closed/reverted at any time; your local
folder and GitHub always end up identical after the commands above.