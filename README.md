# 🩻 Rad Report AI v2

Radiology report generator powered by Gemini AI. Built on the Cloudflare stack.

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React + TypeScript + Vite |
| **Backend** | Hono (on Cloudflare Workers) |
| **Database** | Cloudflare D1 (SQLite) |
| **AI** | Google Gemini 2.5 Flash (direct REST) |
| **Auth** | Google OAuth 2.0 + Magic Link (JWT) |
| **State** | Zustand |
| **Hosting** | Cloudflare Pages + Workers |

## Features

- 📋 **24+ radiology report templates** across 4 modalities (Radio, TDM, IRM, Écho)
- 🎙️ **Voice dictation** with medical terminology-aware transcription
- ⚡ **AI-powered report generation** with 3 edit levels (Prudent/Équilibré/Amélioré)
- 📝 **Report summarization** for concise versions
- ✨ **AI template generator** with Google Search grounding
- 📋 **PACS-compatible copy** (structured HTML + plain text clipboard)
- 🌗 **Dark/Light theme** with smooth transitions
- 📱 **Fully responsive** (mobile sidebar drawer)

## Getting Started

### Prerequisites

- Node.js 20+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier)
- A Google Cloud project with OAuth 2.0 credentials
- A [Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone and install
git clone https://github.com/your-username/radreportai2.git
cd radreportai2
npm install

# Configure environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your actual keys

# Create D1 database
npx wrangler d1 create radreportai-db
# Copy the database_id into wrangler.jsonc

# Run migrations
npx wrangler d1 execute radreportai-db --local --file=worker/db/migrations/0001_init.sql
npx wrangler d1 execute radreportai-db --local --file=worker/db/seed.sql

# Start dev server
npm run dev
```

### Deploy

```bash
# Apply migrations to production
npx wrangler d1 execute radreportai-db --remote --file=worker/db/migrations/0001_init.sql
npx wrangler d1 execute radreportai-db --remote --file=worker/db/seed.sql

# Set production secrets
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put API_KEY
npx wrangler secret put APP_URL

# Deploy
npm run build
npx wrangler deploy
```

## Project Structure

```
radreportai2/
├── index.html              # Entry HTML
├── wrangler.jsonc           # Cloudflare config
├── vite.config.ts           # Vite + Cloudflare plugin
├── src/                     # Frontend (React)
│   ├── App.tsx              # Router + auth gate
│   ├── index.css            # Design system
│   ├── types.ts             # Shared types
│   ├── components/          # Layout, Toast, ConfirmModal
│   ├── pages/               # Landing, Workspace, Profile, etc.
│   ├── stores/              # Zustand: auth, template, workspace
│   ├── services/api.ts      # API client
│   └── lib/                 # copyHandler, medicalKeywords
├── worker/                  # Backend (Hono on Workers)
│   ├── index.ts             # Hono app entry
│   ├── types.ts             # Env bindings
│   ├── middleware/auth.ts   # JWT + session middleware
│   ├── routes/              # auth, user, templates, ai, ...
│   ├── services/            # gemini, quota
│   └── db/                  # Migrations + seed SQL
└── functions/api/           # Pages Function catch-all
```

## License

Apache-2.0
