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

## Judging

```sh
hillpost judge                  # scoring screen for the current hackathon
hillpost judge list             # the same submissions as a table
hillpost judge scores <id>      # your scores, and the averages when visible
hillpost judge score <id> --category Creativity --score 8 --feedback "..."
```

`hillpost judge` opens a two-pane screen: submissions on the left, marked `[x]`
once you have scored the current iteration, and the selected project on the
right. `enter` opens the scoring form, one field per category plus feedback,
pre-filled with the scores you already gave; `s` sends them one at a time.

| key | in the list | in the scoring form |
| --- | --- | --- |
| `j` `k` or arrows | move | move between fields (`tab` too) |
| `enter` | open the scoring form | next field, or submit from feedback |
| `s` | - | submit every filled category |
| `o` | open the project URL | open the project URL |
| `esc` | quit | back to the list |
| `q` | quit | quit |

`s`, `o` and `q` are letters in the feedback field, where they type instead.

`judge score` scores one category per call. `--category` takes a category id or
its name ignoring case, and the score has to be between 1 and the category's
maximum. Re-running it replaces your earlier score for that category.

## Conventions

- `--json` prints the raw Convex value and nothing else, for scripts and agents.
- `--hackathon`/`-H <id>` overrides the hackathon set by `hillpost use`.
- `HILLPOST_TOKEN` and `HILLPOST_API_URL` override the config file.
- Errors from the backend are printed verbatim and exit 1.
- Nothing prompts when stdin is not a terminal.
