# Project Handover: RadReportAI2

This document records the current deployed state of RadReportAI2 and the most important follow-up work.

## Current status

The application is deployed at `https://radreportai2.simoohara.workers.dev`.

- Frontend: React, Vite, TypeScript, Zustand.
- Backend: Hono on Cloudflare Workers, served with Cloudflare static assets and an `ASSETS` SPA fallback.
- Database: Cloudflare D1 (`radreportai-db`).
- AI provider: Gemini 2.5 Flash through direct REST calls.
- Authentication: Google OAuth and magic links with JWT-backed sessions.

The production Worker, D1 schema, SPA routing, login, templates, dictation, report generation, report copying, profile, settings, and feedback flows are wired up. The initial D1 migration is recorded as applied; `npx wrangler d1 migrations list radreportai-db --remote` reports no pending migrations.

> Deployment note (2026-07-17): all features are deployed and live. Secrets are configured in Cloudflare. Billing UI is built but backend integration (LemonSqueezy) is still pending. Admin user: kontjuj@gmail.com.

## Completed work

### Infrastructure and database

- Worker static assets and `/api/*` / `/auth/*` routing are configured in `worker/index.ts`.
- The D1 binding and schema for users, templates, sessions, magic links, feedback, and hidden templates are live.
- `wrangler.jsonc` declares `worker/db/migrations` as the migration directory.
- Production health, public configuration, API 404 behavior, and protected API authentication were smoke-tested.

### Authentication and account lifecycle

- Google OAuth redirects through `/auth/google/callback`.
- OAuth state is signed and stored in an HttpOnly, SameSite cookie to protect the callback; referral codes are preserved through the Google flow.
- Sessions use `SESSION_SECRET` (not `JWT_SECRET`). The production Worker has a `SESSION_SECRET` configured.
- Magic links use `/auth/magiclink/verify`; the former incorrect `/api/auth/...` path was fixed.
- The landing page surfaces magic-link delivery errors rather than silently claiming success.
- Account deletion is permanent and removes the account plus user-owned data, matching the settings-page language.

### AI, dictation, and quotas

- Gemini report generation, report summarisation, normal-template generation, and French radiology transcription are implemented in `worker/routes/ai.ts` and `worker/services/gemini.ts`.
- **Enhanced Transcription:** The app does not use a traditional Speech-to-Text engine. Instead, it feeds raw audio directly into Gemini 2.5 Flash with two Prompt Engineering enhancements:
  1. **Contextual Priming:** The prompt instructs the AI in French that it is transcribing a medical dictation for a radiology report, forcing domain-aware accuracy.
  2. **Dynamic Keyword Injection:** The app accepts a `keywords` parameter (phrase hints) from the frontend and appends it to the prompt, heavily reducing hallucination for complex anatomical or pathological terms.
  3. **User Custom Keywords:** Users can define their own difficult medical terms ("Mes termes difficiles") in the Settings page. These personal terms are merged with the template's keywords during dictation to further boost accuracy.
- Browser recording chooses a supported audio MIME type, limits recordings to five minutes / 10 MB, cleans up microphone tracks, and shows a live recording timer.
- The transcription endpoint validates authentication, audio format, payload size, and base64 input before calling Gemini.
- Gemini responses are checked for usable text before use.
- Invalid requests and upstream Gemini failures no longer consume a generation; failed calls refund the previously reserved quota.

### Workspace and templates

- Users can select system or personal templates, dictate or type notes, generate and summarise reports, edit report HTML, save templates, generate normal templates, delete their own templates, and copy reports.
- **Bulk Import**: Users can import up to 10 `.txt` or `.docx` templates at once into their active modality.
- **Formatting Toolbar**: The report editor features a built-in rich text toolbar with Undo, Redo, Bold, Italic, and Underline formatting options.
- **Dirty Editor Protection**: A universal warning modal protects against accidental data loss when users try to switch templates or perform destructive actions while they have unsaved edits in the editor.
- The landing page includes a no-signup, interactive example (Radio thorax or TDM cérébrale) that demonstrates sample notes becoming a structured report. It is local sample data only and never calls the AI API.
- First-time users receive a four-step workspace guide that ends by opening the template selector. Only the per-user guide-completion preference is stored in local storage; no report or patient data is persisted there.
- The report editor prevents `contentEditable` race conditions during fast typing while still seamlessly accepting external AI generation updates.
- Notes and report content use the workspace Zustand store, so they remain available while navigating to other app pages during the same browser session. They are intentionally not persisted to local storage because they may contain patient data.
- A smart top-level template search searches names, modalities, and template text, ranks matches, and recognises aliases such as `scanner`/`TDM`, `IRM`/`MRI`, `écho`/`échographie`, and `radio`/`radiographie`.
- Clipboard handling writes styled HTML plus a structured text fallback and includes a legacy rich-copy fallback for browsers that do not support `ClipboardItem`.

### Verification performed

- `npm run build` passes.
- Production dependency audit reports no known vulnerabilities.
- Public production page was inspected without application console errors.
- Production D1 tables and migrations were verified.
- The remaining lint output consists of three non-blocking, pre-existing warnings in `Toast.tsx` and `FeedbackPage.tsx`.

### Settings page

- Theme toggle (dark/light) synced with sidebar toggle via shared `localStorage` key.
- "Forfait actuel" card shows subscription plan badge, expiration date, or remaining generations with progress bar. Links to billing page.
- Custom medical keywords section for transcription accuracy.
- Account deletion with confirmation modal.

### Billing page

- Monthly/annual billing toggle with green "Économisez 15%+" label.
- Three pricing cards: Standard (29€/mo, 299€/yr), Pro (49€/mo, 499€/yr, highlighted), Élite (99€/mo, 999€/yr).
- Responsive grid layout (stacks on mobile).
- CTA buttons show toast placeholder (LemonSqueezy not wired yet).

### Admin page

- Dashboard stats: total users, active subscribers, total templates, total generations.
- Feedback management: list all feedback from all users with status badges.
- Filter by status (all/new/in progress/resolved) and include archived toggle.
- Inline status update via dropdown per row.
- Archive/unarchive toggle per row.
- Hard delete with confirmation modal.
- Backend: `GET /api/admin/stats` endpoint added to `worker/routes/admin.ts`.
- Admin user: `kontjuj@gmail.com` (set via D1 directly).

### Shared footer

- Landing page footer (social links + copyright) added to all authenticated pages except workspace.
- Extracted to `src/components/Footer.tsx` for reuse.
- Layout restructured with `page-scroll` wrapper to accommodate footer below page content.

## Required configuration

All secrets are configured in Cloudflare Worker secrets:

```text
API_KEY ✅
APP_URL=https://radreportai2.simoohara.workers.dev ✅
GOOGLE_CLIENT_ID ✅
GOOGLE_CLIENT_SECRET ✅
SESSION_SECRET ✅
RESEND_API ✅
LEMONSQUEEZY_API_KEY ⬜ (set via Cloudflare dashboard)
LEMONSQUEEZY_STORE_ID ⬜
LEMONSQUEEZY_WEBHOOK_SECRET ⬜
LEMONSQUEEZY_TEST_MODE=true ✅ (Set to false for live production)
LEMONSQUEEZY_VARIANT_ID_STANDARD_MONTHLY ⬜
LEMONSQUEEZY_VARIANT_ID_STANDARD_YEARLY ⬜
LEMONSQUEEZY_VARIANT_ID_PRO_MONTHLY ⬜
LEMONSQUEEZY_VARIANT_ID_PRO_YEARLY ⬜
LEMONSQUEEZY_VARIANT_ID_ELITE_MONTHLY ⬜
LEMONSQUEEZY_VARIANT_ID_ELITE_YEARLY ⬜
FACEBOOK_PIXEL_ID ⬜
FACEBOOK_ACCESS_TOKEN ⬜
GA_MEASUREMENT_ID ⬜
GA_API_SECRET ⬜
```

The LemonSqueezy webhook URL must be configured in the LemonSqueezy dashboard:

```text
https://radreportai2.simoohara.workers.dev/api/webhooks/lemonsqueezy
```

The Google Cloud OAuth redirect URI must be exactly:

```text
https://radreportai2.simoohara.workers.dev/auth/google/callback
```

## Remaining work

### Billing (LemonSqueezy) — implemented

- **Checkout flow:** `POST /api/billing/create-checkout-session` creates a LemonSqueezy checkout URL. The frontend attempts to open it as a LemonSqueezy overlay using `lemonsqueezy.js`. If the overlay script is blocked (e.g. by strict privacy browsers like Comet), it gracefully falls back to navigating directly to the checkout page (`window.location.href`) to bypass popup blockers. Includes test mode support via `LEMONSQUEEZY_TEST_MODE`.
- **Customer portal:** `GET /api/billing/manage-url` fetches the LemonSqueezy customer portal URL for subscription management.
- **Webhook handler:** `POST /api/webhooks/lemonsqueezy` processes `order_created`, `subscription_created`, `subscription_updated`, and `subscription_payment_success` events. HMAC-SHA256 signature verification uses the Web Crypto API (Workers-compatible). User is identified by `custom_data.user_id` with email fallback.
- **Subscription activation:** Sets `subscription_plan`, `subscription_expires_at`, `lemonsqueezy_subscription_id`, and `generations_remaining = NULL` (unlimited).
- **Referral rewards:** On new subscriptions, the referrer gets 1 point. Every 5 points grants 1 free month (defaults to 'Pro' plan).
- **Plans:** Standard (29€/mo, 299€/yr), Pro (49€/mo, 499€/yr), Elite (99€/mo, 999€/yr).

### Analytics (Facebook Pixel & Google Analytics) — implemented

- **Server-Side Tracking:** Facebook Conversions API and Google Analytics Measurement Protocol are integrated via `worker/services/analytics.ts`.
- **Signups:** Triggers `CompleteRegistration` (FB) and `sign_up` (GA) via `auth.ts` when a new user signs up via Google or Magic Link.
- **Generations:** Triggers `GenerateReport` (FB) and `generate_report` (GA) via `ai.ts` when an AI report is successfully generated.
- **Purchases:** Triggers `Subscribe` (FB) and `purchase` (GA) with value/currency via `webhooks.ts` when a LemonSqueezy payment succeeds.

### Rate Limiting (D1-Backed) — implemented

- Built a custom D1-backed rate limiter to work across Cloudflare Edge nodes without incurring paid Cloudflare API costs.
- **Auth Limiter:** Protects `/api/auth/magiclink` with a limit of 5 requests per 15 minutes per IP address.
- **Billing Limiter:** Protects `/api/billing/create-checkout-session` and `/api/billing/manage-url` with a limit of 5 requests per 5 minutes per user ID.
- **AI Endpoints:** Not rate-limited by this middleware because the D1 quota system (`generations_remaining`) already acts as a robust natural rate limit against spam.

### Product features — remaining

- No pending feature requests at this time.

## Remaining work

- **Recommended hardening:** Write automated tests for billing and quota logic.reservations/refunds, template search ranking, auth state validation, and clipboard fallbacks.
- Add browser end-to-end tests for authenticated template selection, dictation, generation, workspace navigation persistence, and PACS paste compatibility.
- Decide on rate limits and usage accounting for transcription separately from report generation.
- Review any regulatory, privacy, and data-processing obligations before using the service with identifiable patient data.
- Add Content Security Policy headers.
- Add error boundary component for React.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
# Fill in API_KEY, SESSION_SECRET, Google OAuth credentials, and APP_URL.
npm run dev
```

For local Google OAuth, add this redirect URI in Google Cloud Console:

```text
http://localhost:5173/auth/google/callback
```

Use the usual commands to manage the production database:

```bash
npx wrangler d1 migrations list radreportai-db --remote
npx wrangler d1 migrations apply radreportai-db --remote
```
