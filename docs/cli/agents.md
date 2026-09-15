# Driving the hillpost CLI from an agent

The CLI is built so an agent never has to read a table or drive a terminal UI.
Four rules cover everything.

1. **Always pass `--json`.** It prints the raw backend value and nothing else:
   no spinners, no headings, no confirmation lines. It also turns off every
   prompt and every full-screen view, so a command either succeeds or fails with
   a message instead of hanging.
2. **Authenticate with `HILLPOST_TOKEN`.** Export it and skip `hillpost login`
   entirely. The token is the whole credential; there is no session to refresh.
3. **Pass `--hackathon <id>` (`-H`) on every command.** Do not depend on
   `hillpost use`, which writes shared state to the config file. Get the id once
   from `hillpost hackathons --json` or `hillpost join ... --json`.
4. **Never invoke the TUI.** `hillpost` with no arguments, `hillpost judge` with
   no subcommand, and `hillpost leaderboard --watch` all want a terminal. Use
   `hillpost judge list`, `hillpost judge score` and `hillpost leaderboard
   --json` instead.

## Contract

- Exit 0 means success, exit 1 means failure. There are no other codes.
- On success stdout holds one JSON value; on failure stdout is empty and the
  message is on stderr.
- Timestamps are milliseconds since the Unix epoch. Numbers may be spelled `10`
  or `10.0`, so parse them as floats.
- Mutations that only confirm a write return the affected id as a bare JSON
  string, for example `"jt4abc..."`.

Set up once:

```sh
export HILLPOST_TOKEN=hp_...
hillpost whoami --json      # verify the token before anything else
```

Set `HILLPOST_API_URL` to point at a non-production Convex deployment.

## Join a hackathon and form a team

```sh
export HILLPOST_TOKEN=hp_...

H=$(hillpost join ABC123 --json | jq -r .hackathonId)

hillpost team create "Otters" -H "$H" --json
hillpost team show -H "$H" --json
```

`hillpost join` returns `{"hackathonId": "...", "alreadyMember": false}`. It is
safe to repeat: joining twice sets `alreadyMember` to true rather than failing.

To find a hackathon instead of being given a code:

```sh
hillpost discover --json | jq -r '.[] | "\(._id)\t\(.name)"'
hillpost join --public jd7abc... --json
```

## Submit a project

```sh
hillpost submit -H "$H" --json \
  --name Riverbed \
  --description "A river gauge dashboard." \
  --url https://github.com/otters/riverbed \
  --deployed https://riverbed.example \
  --whats-new "Added the map view."
```

`--name`, `--description` and `--url` are required; without them the command
fails rather than opening a form. The reply is the saved submission, so read
`submissionCount` from it to confirm the iteration.

Resubmitting is rate limited by the hackathon's `submissionFrequencyMinutes`.
Read the gap before retrying rather than polling:

```sh
WAIT=$(hillpost host show -H "$H" --json | jq -r .submissionFrequencyMinutes)
```

A submission inside the window fails with
`Rate limited. Please wait N more minute(s) before submitting again.` and exit 1.

## Host a hackathon

```sh
H=$(hillpost host create --json \
  --name "Autumn Jam" \
  --start 2026-10-03T09:00 --end 2026-10-05T17:00 \
  --frequency 30 --public | jq -r ._id)

hillpost host categories add "Execution" --max 10 -H "$H" --json
hillpost host categories add "Creativity" --max 10 -H "$H" --json

hillpost host codes -H "$H" --json
```

`host codes` returns the competitor and judge codes and their
`https://hillpost.dev/join/...` links. Hand the judge code to judges, then
approve them as they arrive:

```sh
hillpost host members list --role judge --status pending -H "$H" --json |
  jq -r '.[]._id' |
  while read -r id; do hillpost host members approve "$id" -H "$H" --json; done
```

Change settings one flag at a time; only the flags you pass are written:

```sh
hillpost host settings -H "$H" --scores-visible judges --feedback-visible --json
```

## Judge submissions

An organizer must approve a judge before scoring works; until then `scores:submit`
fails with `Only approved judges and organizers can score submissions`.

```sh
export HILLPOST_TOKEN=hp_...
H=jd7abc...

hillpost host categories list -H "$H" --json > categories.json

hillpost judge list -H "$H" --json | jq -r '.[]._id' |
  while read -r submission; do
    hillpost judge score "$submission" --category Execution --score 8 \
      --feedback "Works end to end." -H "$H" --json
    hillpost judge score "$submission" --category Creativity --score 7 \
      -H "$H" --json
  done
```

`judge score` scores one category per call. `--category` takes a category id or
its name ignoring case, and the score has to run from 1 to that category's
`maxScore`. Re-running replaces your earlier score for the category.

Read back what you and everyone else gave:

```sh
hillpost judge scores js9abc... -H "$H" --json
```

`{"mine": [...], "all": {"scoresHidden": ..., "entries": [...]}}`. When
`scoresHidden` is true the organizer is holding averages back; that is not an
error.

## Watch the leaderboard

```sh
hillpost leaderboard -H "$H" --json | jq -r '.entries[] | "\(.rank) \(.teamName) \(.overallScore)"'
```

Poll this on your own schedule. Do not use `--watch`, which needs a terminal.
`leaderboardHidden: true` means the organizer has hidden scores from you.

## Common mistakes

| Mistake | What happens |
| --- | --- |
| Omitting `--json` | Styled output with ANSI escapes that is not machine readable. |
| Omitting `-H` in a non-interactive shell | `No hackathon selected. Run: hillpost use <id\|code>, or pass -H <id>` |
| Running `hillpost judge` with no subcommand | `hillpost judge needs a terminal, try: hillpost judge list` |
| `hillpost submit` without `--name --description --url` | `hillpost submit needs ...` instead of a form. |
| Submitting before creating a team | `you are not on a team yet, run: hillpost team create <name>` |
| Scoring several categories in one call | Not supported. One `judge score` call per category. |
| Retrying a rate-limited submission immediately | Fails the same way until the gap has passed. |
| Parsing numbers as integers | Convex spells numbers as doubles; parse as floats. |
