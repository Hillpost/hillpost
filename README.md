# 👑 Hillpost

A **king-of-the-hill** style hackathon judging platform where competitors submit projects, judges score in real-time, and a live leaderboard shows who reigns supreme.

## Features

- **Real-time Leaderboard** — Watch scores and rankings update live as judges evaluate submissions
- **Team Submissions** — Competitors form teams and submit projects with rate limiting to keep the competition fair
- **Live Judging** — Judges score across customizable categories with a streamlined interface
- **Custom Categories** — Organizers define scoring categories (Innovation, Technical Difficulty, UI/UX, etc.)
- **Role-based Dashboards** — Different views for organizers, judges, and competitors
- **Join Codes** — Easy onboarding with auto-generated 6-character join codes

## Tech Stack

- **[Next.js](https://nextjs.org)** — React framework for the frontend
- **[Convex](https://convex.dev)** — Real-time backend database
- **[Clerk](https://clerk.com)** — Authentication
- **[Tailwind CSS](https://tailwindcss.com)** — Styling
- **[TypeScript](https://typescriptlang.org)** — Type safety

## CLI

`hillpost` joins, runs and judges hackathons from the terminal, and every
command takes `--json` for scripts and agents.

```sh
curl -fsSL https://hillpost.dev/install.sh | sh
hillpost login
```

See [docs/cli/README.md](docs/cli/README.md) for the full guide,
[docs/cli/commands.md](docs/cli/commands.md) for the command reference and
[docs/cli/agents.md](docs/cli/agents.md) for driving it from an agent.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) account

### 1. Clone the repository

```bash
git clone https://github.com/hillpost/hillpost.git
cd hillpost
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Convex

Create a new Convex project at [dashboard.convex.dev](https://dashboard.convex.dev), then link it:

```bash
npx convex dev
```

This will prompt you to link to your Convex project and push the schema.

### 4. Set up Clerk

1. Create a new application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Get your publishable key and secret key from the Clerk dashboard
3. In your Convex dashboard, go to **Settings > Environment Variables** and add:
   - `CLERK_JWT_ISSUER_DOMAIN` — Your Clerk JWT issuer domain (found in Clerk dashboard under **API Keys**)

### 5. Configure environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 6. Run the development server

Start both the Next.js dev server and Convex in separate terminals:

```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: Next.js frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How It Works

### For Organizers

1. **Create a hackathon** from the dashboard
2. **Share the join code** with participants and judges
3. **Define scoring categories** (e.g., Innovation, Design, Technical Difficulty)
4. **Monitor** the leaderboard and manage members

### For Competitors

1. **Join a hackathon** using the join code
2. **Create or join a team**
3. **Submit your project** with a name, description, and link
4. **Keep improving** — submit updated versions within the rate limit
5. **Watch the leaderboard** to see your ranking

### For Judges

1. **Join a hackathon** as a judge using the join code
2. **Browse submissions** in the judge panel
3. **Score each submission** across all categories
4. **Provide feedback** (optional) for each category
5. **Update scores** anytime as projects improve

## License

[MIT](LICENSE)
