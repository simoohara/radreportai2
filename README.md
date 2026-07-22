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

## AI Models Used

The application leverages multiple Google Gemini models tailored for specific tasks:
- **`gemini-3.1-pro-preview`**: Used for high-quality text generation (radiology reports) and Google Search-grounded template generation. This model provides superior reasoning for complex medical data.
- **`gemini-2.5-flash`**: Used for medical audio dictation transcription. This model is chosen for its speed and cost-efficiency when processing audio payloads.

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

## Testing

The project uses three layers of testing:
1. **Frontend Tests**: Unit and Component tests using Vitest (JSDOM).
2. **Backend Tests**: Integration tests for API routes using Vitest (Cloudflare miniflare pool) to simulate the database and auth.
3. **End-to-End Tests**: UI interaction tests using Playwright.

To run the frontend and backend tests:
```bash
npm run test
```

To run the End-to-End tests (make sure the dev server is NOT running, as Playwright will start it):
```bash
npx playwright test
```

Automated tests are also run via GitHub Actions on every `push` and `pull_request` to the `main` branch.

## Architecture & Security Notes

- **Atomic Quota Charging**: The application uses a secure "Time-of-Check to Time-of-Use" (TOCTOU) resistant approach for billing. Quota decrements are performed atomically using SQLite's `RETURNING` clause (e.g., `UPDATE users SET generations_remaining = generations_remaining - 1 WHERE id = ? AND generations_remaining > 0 RETURNING ...`). This guarantees that concurrent requests cannot bypass the quota limit.
- **Stateless Auth**: Authentication relies on JWTs combined with a fast `active_sessions` table in D1 to allow for immediate session revocation without maintaining heavy server state.

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
