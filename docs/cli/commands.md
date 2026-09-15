# hillpost command reference

Every command, its flags, an example, and what `--json` prints. See
[README.md](README.md) for install, login and configuration.

## Global flags

| Flag | Meaning |
| --- | --- |
| `--json` | Print the raw backend value and nothing else. |
| `-H`, `--hackathon <id>` | Act on this hackathon, overriding `hillpost use`. |
| `-h`, `--help` | Help for the command. |
| `-v`, `--version` | Print the version (root command only). |

Timestamps in JSON are milliseconds since the Unix epoch. Ids are Convex
document ids. Numbers may be spelled `10` or `10.0`.

`hillpost` with no arguments opens the interactive dashboard in a terminal, and
prints help otherwise. `hillpost completion <shell>` prints a shell completion
script.

## Shared shapes

Several commands return these.

`Hackathon`:

```json
{
  "_id": "jd7...",
  "_creationTime": 1757808000000.0,
  "name": "Autumn Jam",
  "description": "Two days, one hill.",
  "organizerId": "user_...",
  "startDate": 1759482000000,
  "submissionsStartDate": 1759482000000,
  "submissionsEndDate": 1759683600000,
  "endDate": 1759683600000,
  "submissionFrequencyMinutes": 30,
  "isActive": true,
  "isPublic": true,
  "competitorJoinCode": "ABC123",
  "judgeJoinCode": "XYZ789",
  "createdAt": 1757808000000
}
```

`competitorJoinCode` and `judgeJoinCode` are only present for organizers and
competitors. `hackathons:listMine` adds `"myRole"`, and a lookup by join code
adds `"role"`.

`Team`:

```json
{
  "_id": "jt4...",
  "_creationTime": 1759482100000.0,
  "hackathonId": "jd7...",
  "name": "Otters",
  "createdAt": 1759482100000,
  "members": [
    {
      "_id": "jm2...",
      "userId": "user_...",
      "userName": "Ada",
      "role": "competitor",
      "teamId": "jt4...",
      "status": "approved",
      "joinedAt": 1759482050000
    }
  ]
}
```

`Submission`:

```json
{
  "_id": "js9...",
  "hackathonId": "jd7...",
  "teamId": "jt4...",
  "name": "Riverbed",
  "description": "A river gauge dashboard.",
  "projectUrl": "https://github.com/otters/riverbed",
  "demoUrl": "https://youtu.be/...",
  "deployedUrl": "https://riverbed.example",
  "whatsNew": "Added the map view.",
  "changelog": [
    { "submissionCount": 1, "whatsNew": "", "submittedAt": 1759490000000 }
  ],
  "submittedAt": 1759493600000,
  "submittedBy": "user_...",
  "submissionCount": 2,
  "judgedBy": ["user_..."]
}
```

`submittedBy` and `judgedBy` are blanked for callers who may not see them.

`Category`:

```json
{
  "_id": "jc1...",
  "hackathonId": "jd7...",
  "name": "Execution",
  "description": "Does it work",
  "maxScore": 10,
  "order": 0
}
```

## Account

### `hillpost login`

Log in by approving a code in the browser, or pass `--token` for CI.

| Flag | Meaning |
| --- | --- |
| `--token <hp_...>` | Log in with an existing token instead of the browser flow. |

```sh
hillpost login
hillpost login --token hp_xxx --json
```

JSON:

```json
{ "loggedIn": true, "userName": "Ada" }
```

### `hillpost logout`

Forget the saved token. Prints `Logged out.` and takes no flags of its own.
`--json` prints nothing extra.

```sh
hillpost logout
```

### `hillpost whoami`

Show the logged-in user and their hackathons.

```sh
hillpost whoami --json
```

JSON:

```json
{
  "userId": "user_...",
  "userName": "Ada",
  "memberships": [
    {
      "hackathonId": "jd7...",
      "name": "Autumn Jam",
      "role": "competitor",
      "status": "approved",
      "isActive": true
    }
  ]
}
```

`role` is `organizer`, `judge` or `competitor`; `status` is `pending`,
`approved` or `rejected`.

## Hackathons

### `hillpost discover`

List public hackathons anyone can join. Works without a token.

```sh
hillpost discover --json
```

JSON: an array of `Hackathon`.

### `hillpost hackathons`

List the hackathons you belong to. The table marks the current one with `*`.

```sh
hillpost hackathons --json
```

JSON: an array of `Hackathon`, each with `"myRole"`.

### `hillpost use [id|code]`

Set the hackathon other commands act on, saving it to the config file. With no
argument on a terminal it opens a picker. An argument longer than six characters
is read as a hackathon id, otherwise as a join code.

```sh
hillpost use jd7abc...
hillpost use ABC123
```

JSON:

```json
{ "hackathonId": "jd7...", "name": "Autumn Jam" }
```

### `hillpost join [code]`

Join a hackathon with a competitor or judge invite code, or with `--public` and
a hackathon id. The joined hackathon becomes the current one. Joining with a
judge code leaves you `pending` until an organizer approves you.

| Flag | Meaning |
| --- | --- |
| `--public` | Join a public hackathon by id instead of by code. |

```sh
hillpost join ABC123 --json
hillpost join --public jd7abc... --json
```

JSON:

```json
{ "hackathonId": "jd7...", "alreadyMember": false }
```

## Teams

### `hillpost team list`

List every team in the current hackathon.

```sh
hillpost team list --json
```

JSON: an array of `Team`.

### `hillpost team show`

Show the team you are on.

```sh
hillpost team show --json
```

JSON: one `Team`, or `null` when you are not on a team.

### `hillpost team create <name>`

Create a team in the current hackathon and join it.

```sh
hillpost team create "Otters" --json
```

JSON: the new team id as a JSON string, for example `"jt4..."`.

### `hillpost team join [teamId]`

Join a team in the current hackathon. With no id on a terminal it opens a
picker; with `--json` the id is required. Leave your current team first.

```sh
hillpost team join jt4abc... --json
```

JSON: the team id as a JSON string.

### `hillpost team leave`

Leave your team in the current hackathon.

```sh
hillpost team leave --json
```

JSON: `null`.

## Competing

### `hillpost submit`

Submit or resubmit your team's project. With `--name`, `--description` and
`--url` it submits straight away; otherwise, on a terminal, it opens a form
pre-filled with your last submission. Resubmitting is rate limited by the
hackathon's `submissionFrequencyMinutes`.

| Flag | Meaning |
| --- | --- |
| `--name <string>` | Project name. Required. |
| `--description <string>` | What the project does. Required. |
| `--url <URL>` | Source code URL. Required. |
| `--demo <URL>` | Demo video URL. |
| `--deployed <URL>` | Deployed app URL. |
| `--whats-new <string>` | What changed since the last submission. |

```sh
hillpost submit --json \
  --name Riverbed \
  --description "A river gauge dashboard." \
  --url https://github.com/otters/riverbed \
  --deployed https://riverbed.example \
  --whats-new "Added the map view."
```

JSON: the saved `Submission`, read back after the write.

### `hillpost submissions` / `hillpost submissions list`

List the current hackathon's submissions. The bare command and `list` do the
same thing.

```sh
hillpost submissions --json
```

JSON: an array of `Submission`.

### `hillpost submissions show <id>`

Show one submission. Without `--json` it also prints the changelog and any judge
feedback the hackathon's settings let you see.

```sh
hillpost submissions show js9abc... --json
```

JSON: one `Submission`, or `null`.

### `hillpost leaderboard`

Show the current hackathon's ranked teams.

| Flag | Meaning |
| --- | --- |
| `--watch` | Redraw every five seconds until you press `q`. Needs a terminal. |

```sh
hillpost leaderboard --json
```

JSON:

```json
{
  "entries": [
    {
      "rank": 1,
      "teamId": "jt4...",
      "teamName": "Otters",
      "latestSubmission": { "_id": "js9..." },
      "averageScore": 8.5,
      "overallScore": 17.0,
      "categoryScores": [
        {
          "categoryId": "jc1...",
          "categoryName": "Execution",
          "maxScore": 10,
          "averageScore": 8.5,
          "judgeCount": 2
        }
      ],
      "totalJudgeCount": 2
    }
  ],
  "maxPossibleScore": 20,
  "leaderboardHidden": false
}
```

`latestSubmission` is a full `Submission` or `null`. When `leaderboardHidden` is
true the organizer has hidden scores from you and `entries` carries no scores.

## Judging

### `hillpost judge`

Open the two-pane scoring screen for the current hackathon. Needs a terminal and
has no `--json` form; use the subcommands instead.

```sh
hillpost judge
```

### `hillpost judge list`

List the submissions you can score. The table marks the ones you have already
scored for their current iteration.

```sh
hillpost judge list --json
```

JSON: an array of `Submission`.

### `hillpost judge score <submissionId>`

Score one category of one submission. Re-running it replaces your earlier score
for that category.

| Flag | Meaning |
| --- | --- |
| `--category <id or name>` | Category id, or its name ignoring case. |
| `--score <number>` | Score from 1 to the category maximum. Fractions allowed. |
| `--feedback <string>` | Feedback to leave with the score. |

```sh
hillpost judge score js9abc... --category Execution --score 8 \
  --feedback "Solid, needs error handling." --json
```

JSON: the score id as a JSON string.

### `hillpost judge scores <submissionId>`

Show your scores for a submission, and the averages when the hackathon's
settings make them visible.

```sh
hillpost judge scores js9abc... --json
```

JSON:

```json
{
  "mine": [
    {
      "_id": "jsc...",
      "submissionId": "js9...",
      "categoryId": "jc1...",
      "judgeId": "user_...",
      "score": 8,
      "feedback": "Solid, needs error handling.",
      "scoredAt": 1759494000000,
      "submissionCount": 2
    }
  ],
  "all": {
    "scoresHidden": false,
    "entries": [
      { "categoryId": "jc1...", "averageScore": 8.5, "judgeCount": 2 }
    ]
  }
}
```

## Hosting

### `hillpost host create`

Create a hackathon and make it the current one. Pass the fields as flags, or run
it on a terminal with no `--name` to fill in a form. Dates accept `2026-10-03`,
`2026-10-03T09:00` or a full RFC3339 timestamp, and are read in local time.

| Flag | Meaning |
| --- | --- |
| `--name <string>` | Hackathon name. Required. |
| `--start <date>` | When the hackathon starts. Required. |
| `--end <date>` | When the hackathon ends. Required. |
| `--description <string>` | One paragraph about the hackathon. |
| `--submissions-start <date>` | When submissions open. Defaults to the start. |
| `--submissions-end <date>` | When submissions close. Defaults to the end. |
| `--frequency <int>` | Minutes competitors must wait between submissions. Default 30. |
| `--public` | List it on the public discover page. |
| `--as <string>` | Your display name, when your account has none yet. |

```sh
hillpost host create --json \
  --name "Autumn Jam" \
  --start 2026-10-03T09:00 --end 2026-10-05T17:00 \
  --frequency 30 --public
```

JSON: the created `Hackathon`, including its join codes.

### `hillpost host show`

Show the current hackathon's settings and counts.

```sh
hillpost host show --json
```

JSON: one `Hackathon`. The member, category and submission counts are only in
the human output.

### `hillpost host codes`

Show the competitor and judge join codes.

```sh
hillpost host codes --json
```

JSON:

```json
{
  "competitorJoinCode": "ABC123",
  "judgeJoinCode": "XYZ789",
  "competitorUrl": "https://hillpost.dev/join/ABC123",
  "judgeUrl": "https://hillpost.dev/join/XYZ789"
}
```

Only organizers see `judgeJoinCode`.

### `hillpost host settings`

Change only the settings you pass as flags. Dates are read in local time.
Passing none is an error.

| Flag | Meaning |
| --- | --- |
| `--name <string>` | Rename the hackathon. |
| `--description <string>` | Replace the description. |
| `--start <date>` | Move the start. |
| `--end <date>` | Move the end. |
| `--frequency <int>` | Minutes between submissions. |
| `--public` | List it on the public discover page. |
| `--active` | Whether the hackathon is running. |
| `--feedback-visible` | Let competitors read judge feedback. |
| `--scores-visible <all\|judges\|none>` | Who can see scores. |

Boolean flags take an explicit value to turn something off, for example
`--public=false`.

```sh
hillpost host settings --frequency 15 --scores-visible judges --json
```

JSON: the hackathon id as a JSON string.

### `hillpost host categories list`

List the judging categories.

```sh
hillpost host categories list --json
```

JSON: an array of `Category`, ordered by `order`.

### `hillpost host categories add <name>`

Add a judging category.

| Flag | Meaning |
| --- | --- |
| `--description <string>` | What judges should look for. |
| `--max <int>` | Highest score a judge can give. Default 10. |

```sh
hillpost host categories add "Execution" --max 20 --description "Does it work" --json
```

JSON: the new category id as a JSON string.

### `hillpost host categories edit <categoryId>`

Change a category's name, description or maximum score. Passing none is an
error.

| Flag | Meaning |
| --- | --- |
| `--name <string>` | Rename the category. |
| `--description <string>` | Replace the description. |
| `--max <int>` | Highest score a judge can give. |

```sh
hillpost host categories edit jc1abc... --max 10 --json
```

JSON: the category id as a JSON string.

### `hillpost host categories remove <categoryId>`

Delete a category. Prints a confirmation line, and nothing at all with `--json`.

```sh
hillpost host categories remove jc1abc...
```

### `hillpost host members list`

List members of the current hackathon, optionally filtered. Only organizers can
see the list.

| Flag | Meaning |
| --- | --- |
| `--role <organizer\|judge\|competitor>` | Only this role. |
| `--status <pending\|approved\|rejected>` | Only this status. |

```sh
hillpost host members list --role judge --status pending --json
```

JSON: an array of members, filtered by the flags:

```json
[
  {
    "_id": "jm2...",
    "userId": "user_...",
    "userName": "Ada",
    "role": "judge",
    "teamId": "jt4...",
    "status": "pending",
    "joinedAt": 1759482050000
  }
]
```

### `hillpost host members approve <memberId>` / `hillpost host members reject <memberId>`

Approve or reject a pending member. Judges cannot score until approved.

```sh
hillpost host members approve jm2abc... --json
```

JSON: the member id as a JSON string.

### `hillpost host members role <memberId> <organizer|judge|competitor>`

Change what someone can do.

```sh
hillpost host members role jm2abc... judge --json
```

JSON: the member id as a JSON string.

### `hillpost host members remove <memberId>`

Remove someone from the hackathon. Prints a confirmation line, and nothing at
all with `--json`.

```sh
hillpost host members remove jm2abc...
```


