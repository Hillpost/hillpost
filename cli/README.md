# hillpost CLI

Join, run and judge Hillpost hackathons from the terminal. The CLI talks to the
Convex backend directly; it needs no Node tooling.

## Build from source

Go 1.25 or newer.

```sh
cd cli
go build -o hillpost .      # hillpost.exe on Windows
```

Put the binary somewhere on your `PATH`, or run it in place.

## Log in

```sh
hillpost login
```

This prints a code and a `hillpost.dev/cli/login` link, opens your browser, and
waits while you approve the terminal. The token is saved to
`%AppData%\hillpost\config.json` on Windows, `~/.config/hillpost/config.json`
elsewhere, with mode 0600.

For CI, create a token in the dashboard and pass it instead:

```sh
hillpost login --token hp_...
# or set it per invocation
HILLPOST_TOKEN=hp_... hillpost whoami
```

`hillpost logout` forgets the saved token.

## First commands

```sh
hillpost whoami                 # who you are and which hackathons you are in
hillpost discover               # public hackathons open right now
hillpost join ABC123            # join with a competitor or judge code
hillpost join --public <id>     # join a public hackathon by id
hillpost hackathons             # hackathons you belong to, current one marked
hillpost use                    # pick the current hackathon interactively
hillpost use <id|code>          # or set it directly
```

## Compete

```sh
hillpost team create "Otters"   # create a team and join it
hillpost team join <teamId>     # join a team, or run with no id to pick one
hillpost team list              # every team in the current hackathon
hillpost team show              # your team and its members
hillpost team leave             # leave your team

hillpost submit                 # form, pre-filled from your last submission
hillpost submit --name Riverbed --description "..." --url https://github.com/...
                                # plus optional --demo, --deployed, --whats-new

hillpost submissions            # every submission, newest first
hillpost submissions show <id>  # one submission, its changelog and judge feedback

hillpost leaderboard            # ranked teams
hillpost leaderboard --watch    # same, redrawn every five seconds, q to quit
```

## Host a hackathon

```sh
hillpost host create --name "Autumn Jam" \
  --start 2026-10-03T09:00 --end 2026-10-05T17:00 \
  --frequency 30 --public
hillpost host create              # or fill in the form, in a terminal
```

Dates accept `2026-10-03`, `2026-10-03T09:00` and full RFC3339 timestamps, and
are read in your local time. A new hackathon becomes the current one.

```sh
hillpost host show                # dates, settings and counts
hillpost host codes               # join codes and their hillpost.dev links
hillpost host settings --frequency 15 --public=false --scores-visible judges
```

`settings` changes only the flags you pass: `--name`, `--description`,
`--start`, `--end`, `--frequency`, `--public`, `--active`, `--feedback-visible`
and `--scores-visible all|judges|none`. For the submissions themselves, use
`hillpost submissions`.

Judging categories:

```sh
hillpost host categories list
hillpost host categories add "Execution" --max 20 --description "Does it work"
hillpost host categories edit <categoryId> --max 10
hillpost host categories remove <categoryId>
```

People:

```sh
hillpost host members list --role judge --status pending
hillpost host members approve <memberId>
hillpost host members reject <memberId>
hillpost host members role <memberId> judge
hillpost host members remove <memberId>
```

## Conventions

- `--json` prints the raw Convex value and nothing else, for scripts and agents.
- `--hackathon`/`-H <id>` overrides the hackathon set by `hillpost use`.
- `HILLPOST_TOKEN` and `HILLPOST_API_URL` override the config file.
- Errors from the backend are printed verbatim and exit 1.
- Nothing prompts when stdin is not a terminal.
