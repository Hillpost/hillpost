---
name: hillpost-cli
description: Drive the hillpost Go CLI to join, compete in, host or judge a hackathon. Use whenever the user mentions Hillpost, a hackathon, joining with an invite code, creating or joining a team, submitting or resubmitting a project, scoring or judging submissions, judging categories, approving judges, join codes, or a hackathon leaderboard.
---

# hillpost CLI

`hillpost` runs Hillpost hackathons from the terminal. Full reference:
`docs/cli/commands.md`, `docs/cli/agents.md`.

## Before anything

```sh
hillpost --version            # not found: see Install below
hillpost whoami --json        # verifies the token
```

If `hillpost` is missing, install it with
`curl -fsSL https://hillpost.dev/install.sh | sh` (macOS, Linux) or
`go install github.com/Hillpost/hillpost/cli@latest`. On Windows take the zip
from https://github.com/Hillpost/hillpost/releases.

## Auth

Set `HILLPOST_TOKEN=hp_...` in the environment. Do not run `hillpost login`:
it is a browser device flow and will hang. Ask the user for a token from the
dashboard's CLI panel if there is none. `HILLPOST_API_URL` points at a
non-production deployment.

## The contract

- Pass `--json` on every command. It prints the raw backend value and nothing
  else, and turns off all prompts and full-screen views.
- Pass `-H <hackathonId>` on every command. Never rely on `hillpost use`, which
  writes shared state to the config file.
- Exit 0 means success; exit 1 means failure with the message on stderr. There
  are no other exit codes.
- Never invoke the TUI: bare `hillpost`, bare `hillpost judge`, and
  `hillpost leaderboard --watch` all need a terminal.
- Timestamps are milliseconds since the epoch. Numbers may arrive as `10.0`;
  parse them as floats.
- Mutations that only confirm a write return the affected id as a bare JSON
  string.

## Command map

Account and hackathons:

```sh
hillpost whoami --json                        # {userId, userName, memberships[]}
hillpost hackathons --json                    # hackathons you belong to
hillpost discover --json                      # public hackathons, no token needed
hillpost join ABC123 --json                   # {hackathonId, alreadyMember}
hillpost join --public <hackathonId> --json
```

Competing:

```sh
hillpost team create "Otters" -H "$H" --json  # "<teamId>"
hillpost team join <teamId> -H "$H" --json
hillpost team list -H "$H" --json
hillpost team show -H "$H" --json             # Team or null
hillpost team leave -H "$H" --json

hillpost submit -H "$H" --json \
  --name NAME --description TEXT --url https://... \
  [--demo URL] [--deployed URL] [--whats-new TEXT]

hillpost submissions list -H "$H" --json
hillpost submissions show <submissionId> --json
hillpost leaderboard -H "$H" --json
```

Judging (an organizer must approve the judge first):

```sh
hillpost judge list -H "$H" --json                  # submissions you can score
hillpost judge score <submissionId> -H "$H" --json \
  --category "Execution" --score 8 [--feedback TEXT]
hillpost judge scores <submissionId> --json         # {mine: [...], all: {...}}
```

Hosting:

```sh
hillpost host create --json \
  --name "Autumn Jam" --start 2026-10-03T09:00 --end 2026-10-05T17:00 \
  [--description TEXT] [--submissions-start D] [--submissions-end D] \
  [--frequency 30] [--public] [--as "Your Name"]

hillpost host show -H "$H" --json
hillpost host codes -H "$H" --json            # competitor and judge join codes
hillpost host settings -H "$H" --json \
  [--name] [--description] [--start] [--end] [--frequency] \
  [--public] [--active] [--feedback-visible] [--scores-visible all|judges|none]

hillpost host categories list -H "$H" --json
hillpost host categories add "Execution" --max 10 [--description TEXT] -H "$H" --json
hillpost host categories edit <categoryId> [--name] [--description] [--max] --json
hillpost host categories remove <categoryId> --json

hillpost host members list -H "$H" --json [--role judge] [--status pending]
hillpost host members approve <memberId> --json
hillpost host members reject <memberId> --json
hillpost host members role <memberId> organizer|judge|competitor --json
hillpost host members remove <memberId> --json
```

Dates accept `2026-10-03`, `2026-10-03T09:00` or RFC3339, read in local time.
Boolean flags need an explicit value to turn off: `--public=false`.

## Common mistakes

- Forgetting `--json`, then trying to parse a styled table.
- Forgetting `-H`, which fails with
  `No hackathon selected. Run: hillpost use <id|code>, or pass -H <id>`.
- Running `hillpost login` in a non-interactive session. Use `HILLPOST_TOKEN`.
- Running bare `hillpost judge` instead of `hillpost judge list`.
- Calling `hillpost submit` without `--name`, `--description` and `--url`.
- Submitting before the team exists: `hillpost team create <name>` first.
- Scoring several categories in one call. One `judge score` call per category;
  re-running replaces the earlier score.
- Retrying a submission after `Rate limited. Please wait N more minute(s)...`.
  The gap is `submissionFrequencyMinutes`, from `hillpost host show`.
- Treating `scoresHidden` or `leaderboardHidden` as an error. They mean the
  organizer is holding scores back.
