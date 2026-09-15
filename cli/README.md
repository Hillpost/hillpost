# hillpost CLI

Join, run and judge Hillpost hackathons from the terminal. The CLI talks to the
Convex backend directly; it needs no Node tooling.

## Install

```sh
curl -fsSL https://hillpost.dev/install.sh | sh
```

macOS and Linux. On Windows, download the zip from the
[releases](https://github.com/Hillpost/hillpost/releases) page. With Go 1.25 or
newer, `go install github.com/Hillpost/hillpost/cli@latest`. From this
directory, `go build -o hillpost .`.

## Dashboard

`hillpost` with no arguments opens an interactive, role-aware dashboard that
reaches every flow: see [docs/cli/README.md](../docs/cli/README.md#dashboard).

## Log in

```sh
hillpost login
```

This prints a code, opens `https://hillpost.dev/cli/login?code=...`, and waits
while you approve the terminal. For CI, pass a token instead:

```sh
hillpost login --token hp_...
HILLPOST_TOKEN=hp_... hillpost whoami --json
```

## Documentation

- [docs/cli/README.md](../docs/cli/README.md) - install, login, concepts, exit
  codes, troubleshooting.
- [docs/cli/commands.md](../docs/cli/commands.md) - every command, its flags and
  the JSON it prints with `--json`.
- [docs/cli/agents.md](../docs/cli/agents.md) - driving the CLI from an agent.

`scripts/check-docs.sh` checks the command reference against the built binary:

```sh
go build -o hillpost .
sh scripts/check-docs.sh
```
