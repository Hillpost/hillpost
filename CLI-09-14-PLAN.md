# Hillpost CLI - Plan (09-14)

Goal: developers join, host, submit to, and judge hackathons from the terminal. Deliverables: a standalone Go CLI (`hillpost`) with a bubbletea TUI, full docs, an agent skill, and `llms.txt`. The CLI stands on its own: it talks to the Convex backend directly and does not depend on the MCP server on `feat/mcp`.

Work is tracked as GitHub issues on `Hillpost/hillpost`, one agent per issue, each PR targeting `feat/dx`.

## 1. How the backend works today

- Every Convex function resolves the caller through Clerk: `convex/auth.ts:7-14` (`getAuthUserId` reads `ctx.auth.getUserIdentity().subject`) and `convex/auth.ts:33-52` (`getAuthUserName` reads `identity.name`).
- Functions import `mutation`/`query` from `./_generated/server` directly, e.g. `convex/hackathons.ts:2`, `convex/scores.ts:2`, `convex/teams.ts`, `convex/members.ts`, `convex/submissions.ts`, `convex/categories.ts`, `convex/leaderboard.ts`, `convex/tracks.ts`, `convex/sponsors.ts`.
- Auth provider config is Clerk only: `convex/auth.config.ts:12-16`. A CLI cannot mint Clerk JWTs, so it needs its own credential.
- The web app already maps every role flow to functions the CLI can reuse unchanged:
  - Join: `convex/hackathons.ts:487` (`join {joinCode}`), `:543` (`joinPublic {hackathonId}`), `:589` (`getByJoinCode`), `:611` (`listPublic`), `:294` (`listMine`).
  - Host: `convex/hackathons.ts:104` (`create`), `:349` (`update`), `:214` (`get`, returns join codes for organizers), `convex/categories.ts:23,51,75,101,119`, `convex/members.ts:69,120,155,213`.
  - Compete: `convex/teams.ts:5,40,78,115,149,173`, `convex/submissions.ts:84` (`create`, rate limited by `submissionFrequencyMinutes`), `:220` (`updateDetails`), `:326` (`getLatestForTeam`), `convex/leaderboard.ts:18`.
  - Judge: `convex/submissions.ts:272` (`list`), `convex/scores.ts:6` (`submit {submissionId, categoryId, score, feedback?}`), `:205` (`getMyScoresForSubmission`), `:102` (`getForSubmission`).
- Convex exposes every public function over plain HTTP: `POST {CONVEX_URL}/api/query` and `POST {CONVEX_URL}/api/mutation` with body `{"path":"hackathons:listMine","args":{...},"format":"json"}`. Response is `{"status":"success","value":...}` or `{"status":"error","errorMessage":"...","errorData":...}`. Production deployment URL: `https://frugal-weasel-98.convex.cloud` (`wrangler.jsonc:14`). Web app: `https://hillpost.dev`.

## 2. Design

### 2.1 CLI tokens that reuse every existing function (backend)

Instead of duplicating business logic, wrap `query`/`mutation` so an optional `cliToken` argument can stand in for a Clerk session:

- `convex/lib/functions.ts` - exports `query` and `mutation` built with `customQuery`/`customMutation` from `convex-helpers/server/customFunctions`. They add `args: { cliToken: v.optional(v.string()) }`. When `cliToken` is present, look it up in `cliTokens` (index `by_token`), throw `"Invalid CLI token"` if missing, and return `ctx: { auth: { getUserIdentity: async () => identity } }` where `identity` is a `UserIdentity` with `subject: userId`, `name: userName`, `pictureUrl: userImageUrl`, `issuer: "hillpost-cli"`, `tokenIdentifier: "hillpost-cli|" + userId`. The `cliToken` arg is consumed and never reaches handlers. When absent, ctx is untouched and Clerk auth applies as today.
- Change needed: every `import { mutation, query } from "./_generated/server"` in `convex/hackathons.ts:2`, `scores.ts:2`, `teams.ts`, `members.ts`, `submissions.ts`, `categories.ts`, `leaderboard.ts`, `tracks.ts`, `sponsors.ts` becomes `from "./lib/functions"`. No handler bodies change.
- `convex/schema.ts` - add:
  - `cliTokens { userId, userName, userImageUrl?, token, label, createdAt, lastUsedAt? }` with indexes `by_token`, `by_userId`.
  - `cliDevices { deviceCode, userCode, status: "pending" | "approved", token?, userName?, expiresAt, createdAt }` with indexes `by_deviceCode`, `by_userCode`.
- Tokens are random 32 bytes (base64url) prefixed `hp_`, generated with `crypto.getRandomValues`. Stored raw (Convex queries cannot use `crypto.subtle`); a small pure-JS hash is not worth the complexity today.

### 2.2 Device login flow

`convex/cli.ts` (all names are the contract other issues build against):

| Function | Kind | Auth | Args | Returns |
|---|---|---|---|---|
| `cli.startDeviceLogin` | mutation | none | `{}` | `{ deviceCode, userCode, verificationUrl, expiresAt, interval }` - `userCode` is `XXXX-XXXX` (no 0/O/1/I), `verificationUrl` is `https://hillpost.dev/cli/login?code=XXXX-XXXX`, expires in 10 min, interval 2s |
| `cli.getDevice` | query | Clerk | `{ userCode }` | `{ status, createdAt, expiresAt } \| null` |
| `cli.approveDevice` | mutation | Clerk | `{ userCode, userName?, userImageUrl?, label? }` | `{ ok: true }`; creates a `cliTokens` row, stores the plaintext token on the device row, sets status approved |
| `cli.claimDevice` | mutation | none | `{ deviceCode }` | `{ status: "pending" } \| { status: "expired" } \| { status: "approved", token, userName }`; on approved, deletes the device row |
| `cli.whoami` | query | cliToken or Clerk | `{}` | `{ userId, userName, memberships: [{ hackathonId, name, role, status, isActive }] }` |
| `cli.listTokens` | query | Clerk | `{}` | `[{ _id, label, createdAt, lastUsedAt, preview }]` (preview = first 7 chars) |
| `cli.createToken` | mutation | Clerk | `{ label }` | `{ token }` (shown once) |
| `cli.revokeToken` | mutation | Clerk | `{ tokenId }` | `{ ok: true }` |

`cli.whoami`, `cli.listTokens`, `cli.createToken`, `cli.revokeToken` use the wrappers from `convex/lib/functions.ts`; the device functions use the base `mutation`/`query` (they must work without any credential or with Clerk only).

### 2.3 Web pages

- `src/app/cli/login/page.tsx` (protected by default in `src/middleware.ts`): reads `?code=`, shows the code, an "Authorize" button that calls `cli.approveDevice` with Clerk name and image (see `src/lib/clerk-user.ts`), and a success state telling the user to return to the terminal. Handles expired/unknown codes.
- Dashboard (`src/app/dashboard/page.tsx`): a "CLI" section with the install one-liner, token list with revoke, and "Create token" showing the plaintext once.

### 2.4 The CLI (Go)

Module `github.com/Hillpost/hillpost/cli` in `cli/`. Go 1.25. Dependencies: `spf13/cobra`, `charmbracelet/bubbletea` v1, `charmbracelet/bubbles`, `charmbracelet/lipgloss` v1, `charmbracelet/huh` (forms). No others without a stated reason.

```
cli/
  main.go
  cmd/            one file per command group, each registers itself in init()
  internal/api/   Convex HTTP client: Query(ctx, path, args, &out), Mutate(...), typed structs
  internal/config/ ~/.config/hillpost/config.json (Windows: %AppData%\hillpost): token, apiUrl, hackathonId
  internal/ui/    lipgloss styles, table rendering, JSON output helper, spinner
  internal/tui/   bubbletea models (judge flow, dashboard)
```

Command surface (final):

```
hillpost                         interactive dashboard (TUI)
hillpost login [--token hp_...]  device flow, opens browser; --token for CI
hillpost logout
hillpost whoami
hillpost hackathons              hackathons I belong to
hillpost discover                public hackathons
hillpost use <id|code>           set current hackathon (stored in config)
hillpost join <code>             join as competitor or judge by code
hillpost join --public <id>      join a public hackathon
hillpost team create <name> | join <teamId> | leave | list | show
hillpost submit [--name --description --url --demo --deployed --whats-new]   interactive form when flags missing
hillpost submissions [list | show <id>]
hillpost leaderboard [--watch]
hillpost host create             interactive form (huh) or flags
hillpost host show | codes | settings [--flag ...]
hillpost host categories list | add | edit | remove
hillpost host members list | approve <memberId> | reject <memberId> | remove <memberId>
hillpost judge                   TUI: pick a submission, score every category with feedback
hillpost judge score <submissionId> --category <id|name> --score N [--feedback ...]
hillpost judge scores <submissionId>
```

Conventions every command follows:
- `--json` prints raw JSON and suppresses styling (agents and scripts depend on this).
- `--hackathon`/`-H <id>` overrides the configured current hackathon. If none is set and stdin is a TTY, prompt a picker from `hackathons:listMine`; otherwise fail with a clear message.
- `HILLPOST_TOKEN` and `HILLPOST_API_URL` env vars override config. Default API URL is the production Convex URL.
- Errors from Convex (`errorMessage`) are shown verbatim, exit code 1. Auth errors say to run `hillpost login`.
- Non-TTY never blocks on interactive input.

### 2.5 Docs, skill, llms.txt

- `docs/cli/README.md` (install, login, concepts), `docs/cli/commands.md` (every command, flags, examples, JSON shapes), `docs/cli/agents.md` (how agents use `--json`).
- `public/llms.txt` (short index) and `public/llms-full.txt` (complete CLI reference) served at hillpost.dev.
- `skills/hillpost-cli/SKILL.md` - Claude Code / agent skill teaching an agent to drive the CLI, plus `.claude/skills/hillpost-cli/SKILL.md` symlink-equivalent copy for this repo.
- `cli/README.md` mirrors install and quick start.

### 2.6 Distribution

- `.goreleaser.yaml` building darwin/linux/windows amd64+arm64 on tags `cli/v*`, GitHub release with archives and checksums.
- `cli/install.sh` (curl | sh) that detects OS/arch and installs the latest release; `go install github.com/Hillpost/hillpost/cli@latest` also works.
- `.github/workflows/cli.yml`: `go vet`, `go test ./...`, `go build` on PRs touching `cli/`.

## 3. Issues and phases

Phase 1 (parallel):
1. Backend: CLI token auth, device flow, `convex/cli.ts` (section 2.1, 2.2).
2. CLI core: scaffold, client, config, `login/logout/whoami/hackathons/discover/use/join` (section 2.4), unit tests against `httptest`.

Phase 2 (after 1 and 2 merge, parallel):
3. Web: `/cli/login` page and dashboard token management (2.3).
4. CLI compete: `team`, `submit`, `submissions`, `leaderboard --watch`.
5. CLI host: `host create/show/codes/settings/categories/members`.
6. CLI judge: `judge` TUI and `judge score/scores`.
7. Distribution: goreleaser, install script, CI (2.6).

Phase 3 (after phase 2):
8. Interactive dashboard: `hillpost` with no args (role-aware home, navigates into the existing flows).
9. Docs, `llms.txt`, agent skill (2.5).

## 4. Verification

- Backend: `npx convex codegen && npx tsc --noEmit -p convex`, then push to the dev deployment and exercise `cli:startDeviceLogin` / `claimDevice` with curl against `/api/mutation`.
- CLI: `go vet`, `go test ./...`, then a real run against the dev deployment: `login` via device flow, `join <code>`, `submit`, `judge score`, `leaderboard`.
- Web: `npm run lint`, `npx tsc --noEmit`, manual pass through `/cli/login`.
- Each PR is reviewed by the orchestrator before merge into `feat/dx`.
