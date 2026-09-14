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

## Conventions

- `--json` prints the raw Convex value and nothing else, for scripts and agents.
- `--hackathon`/`-H <id>` overrides the hackathon set by `hillpost use`.
- `HILLPOST_TOKEN` and `HILLPOST_API_URL` override the config file.
- Errors from the backend are printed verbatim and exit 1.
- Nothing prompts when stdin is not a terminal.
