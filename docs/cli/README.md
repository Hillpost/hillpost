# hillpost CLI

`hillpost` joins, runs and judges Hillpost hackathons from the terminal. It
talks to the Hillpost Convex backend over HTTPS and needs no Node tooling.

- [Command reference](commands.md)
- [Driving the CLI from an agent](agents.md)

## Install

```sh
curl -fsSL https://hillpost.dev/install.sh | sh
```

macOS and Linux. The script downloads the newest `cli/v*` release, verifies its
checksum, and installs to `/usr/local/bin` when that is writable, else
`~/.local/bin`. Set `HILLPOST_INSTALL_DIR` to choose somewhere else.

With Go 1.25 or newer:

```sh
go install github.com/Hillpost/hillpost/cli/cmd/hillpost@latest
```

On Windows, download the `.zip` for your architecture from the
[releases page](https://github.com/Hillpost/hillpost/releases) and put
`hillpost.exe` somewhere on your `PATH`.

From a clone:

```sh
cd cli
go build -o hillpost ./cmd/hillpost      # hillpost.exe on Windows
```

Check it:

```sh
hillpost --version
```

## Log in

```sh
hillpost login
```

This is a device flow. The CLI prints an eight-character code, opens
`https://hillpost.dev/cli/login?code=XXXX-XXXX` in your browser, and polls every
two seconds while you sign in and approve the terminal. Codes expire after ten
minutes; run `hillpost login` again for a new one.

```
Authorize this terminal
code  4KQ7-W2MH
open  https://hillpost.dev/cli/login?code=4KQ7-W2MH
```

For CI and anywhere without a browser, create a token from the CLI panel on the
Hillpost dashboard and pass it:

```sh
hillpost login --token hp_...
```

Or set it per invocation and skip the config file entirely:

```sh
HILLPOST_TOKEN=hp_... hillpost whoami --json
```

`hillpost logout` forgets the saved token. It does not revoke it; revoke tokens
from the dashboard.

## Dashboard

```sh
hillpost
```

With no arguments, on a terminal, `hillpost` opens a dashboard: who you are,
which hackathon you are in, and a menu of what your role there lets you do.
Every screen is one `enter` away, and `esc` comes back.

| Role | Menu |
| --- | --- |
| competitor | My team, Submit, Submissions, Leaderboard |
| judge | Judge submissions, Leaderboard |
| organizer | Overview (dates, status, join codes), Categories, Members, Submissions, Leaderboard |
| everyone | Switch hackathon, Join a hackathon with a code, Discover public hackathons, Create a hackathon, Log out |

The screens are the commands you already know. Submit is the `hillpost submit`
form, pre-filled from your last submission. Judge is the `hillpost judge`
scoring screen. Members approves and rejects in place with `a` and `r`.
Leaderboard reloads with `r`.

Not logged in, the dashboard offers the same browser login as `hillpost login`,
says what it is waiting for while you approve it, and carries on to the menu.

| Key | What it does |
| --- | --- |
| up/down, `j`/`k` | move |
| `enter` | open the item, or send a form |
| `esc` | back one screen, or cancel a form |
| `?` | show or hide the key list |
| `q` | quit from the menu, back from a screen |
| `ctrl+c` | quit from anywhere |

The dashboard fits an 80x24 terminal. Without a terminal, or with `--json`,
`hillpost` prints the root help and exits 0, so scripts and agents see what they
always did.

## The current hackathon

Almost every command acts on one hackathon. The CLI finds it in this order:

1. `--hackathon <id>` (short `-H`) on the command itself.
2. The hackathon saved by `hillpost use`, which `hillpost join` and
   `hillpost host create` also set.
3. On a terminal, an interactive picker over the hackathons you belong to. The
   pick is not saved.

With `--json`, or when stdin is not a terminal, step 3 is skipped and the
command fails with:

```
No hackathon selected. Run: hillpost use <id|code>, or pass -H <id>
```

```sh
hillpost use                    # pick one interactively
hillpost use jd7abc...          # by hackathon id
hillpost use ABC123             # or by a six-character join code
hillpost hackathons             # the ones you belong to, current one marked *
```

## Output modes

By default commands print styled tables and fields for a human. `--json` prints
the raw backend value, indented, and nothing else: no spinners, no headings, no
confirmation lines. It is a global flag, so it works on any command.

```sh
hillpost hackathons --json
```

`--json` also disables every prompt and every full-screen view, so it is the
right flag for scripts, CI and agents. See [agents.md](agents.md).

Running `hillpost` with no arguments opens the interactive dashboard in a
terminal, and prints help otherwise.

## Environment and config

| Variable | Effect |
| --- | --- |
| `HILLPOST_TOKEN` | Auth token. Overrides the saved one. |
| `HILLPOST_API_URL` | Convex deployment to talk to. Defaults to production. |

The config file holds the token, the current hackathon and its name, written
with mode 0600:

| OS | Path |
| --- | --- |
| Windows | `%AppData%\hillpost\config.json` |
| macOS | `~/Library/Application Support/hillpost/config.json` |
| Linux | `$XDG_CONFIG_HOME/hillpost/config.json`, else `~/.config/hillpost/config.json` |

```json
{
  "token": "hp_...",
  "hackathon_id": "jd7...",
  "hackathon_name": "Autumn Jam"
}
```

`api_url` is also accepted in the file, and `HILLPOST_API_URL` overrides it.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | The command succeeded. |
| 1 | Anything else. The message goes to stderr; stdout stays empty. |

There are no other exit codes. Backend errors are printed verbatim, so branch on
the message when you need to tell failures apart.

## Troubleshooting

**`Not logged in. Run: hillpost login`**
No token in the config file and no `HILLPOST_TOKEN`. Log in, or export the
token.

**`Invalid CLI token`**
The token was revoked or mistyped. Create a new one from the dashboard's CLI
panel, or run `hillpost login` again.

**`This login code has expired`**
The device code lived past ten minutes. Run `hillpost login` again.

**`No hackathon selected. Run: hillpost use <id|code>, or pass -H <id>`**
Nothing set the current hackathon and the CLI cannot prompt. Pass
`-H <hackathonId>` or run `hillpost use`.

**`Rate limited. Please wait N more minute(s) before submitting again.`**
Organizers set a minimum gap between a team's submissions
(`submissionFrequencyMinutes`, 30 by default). Wait it out; retrying sooner
fails the same way. `hillpost host show` prints the gap for the current
hackathon.

**`Only approved judges and organizers can score submissions`**
You joined with a judge code but an organizer has not approved you yet.
`hillpost whoami` shows your status as `pending`. The organizer clears it with
`hillpost host members approve <memberId>`.

**`Submissions are not open yet` / `Submissions are closed`**
The submission window does not include the current time. `hillpost host show`
prints the window.

**`you are not on a team yet, run: hillpost team create <name>`**
Only a team can submit. Create or join one first.

**`cannot reach https://... (set HILLPOST_API_URL to use another deployment)`**
The deployment is unreachable. Check the network, or unset a stale
`HILLPOST_API_URL`.
