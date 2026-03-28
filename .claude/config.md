# REAP App — Project Context for Claude

## Owner
- **Name:** Javier A. Suarez
- **Email:** javier@thesuarezcapital.com
- **GitHub:** presidentsuarez

## Repository
- **Repo:** https://github.com/presidentsuarez/reap-app
- **Branch:** main
- **Live URL:** https://app.getreap.ai

## Tech Stack
- **Frontend:** React 19 (Create React App, single-page app)
- **Backend:** Supabase (database, auth via Google OAuth, file storage, Edge Functions)
- **Payments:** Stripe (live keys in .env)
- **Deployment:** GitHub Pages via `gh-pages` package
- **Custom Domain:** app.getreap.ai (CNAME in build folder)

## Architecture
- **Main file:** `src/App.js` — monolithic SPA, all views/components in one file (~8000+ lines)
- **Data layer:** `src/dataService.js` — all Supabase queries abstracted here; App.js never queries directly
- **Calculated fields:** Financial metrics (Cap Rate, DSCR, NOI, ROI, etc.) are computed by a Supabase database trigger on save, not in the frontend
- **State management:** React useState/useEffect hooks, no Redux or external state library
- **Routing:** Hash-based (#deal/address, #portfolio/id, #profile), no react-router
- **Styling:** All inline styles, no CSS framework. Design system uses DM Sans, Playfair Display, DM Mono fonts. Primary color: #16a34a (green)

## Key Views & Navigation
- **Sidebar nav (desktop) / Bottom nav (mobile):** Command Center, Real Estate, Contacts, Research, MLS Feed
- **Real Estate sub-tabs:** Dashboard, Pipeline, Portfolios
- **Deal Detail tabs:** Overview, Financials, Refinance, Bridge Loan, Income, Financing, AI Underwriting, AI Summary, Notes, Documents, Shared Deal, Activity
- **Contacts sub-tabs:** Contacts, Investors
- **MLS sub-tabs:** Feed, Upload

## Supabase Tables (known)
- `deals` — main deal/property records
- `deal_documents` — uploaded files and links (has `is_link` column for URL references)
- `deal_activities` — activity timeline and notes
- `deal_shares` — deal sharing with permissions (viewer/editor/admin)
- `organizations` — team/org management
- `org_members` — org membership
- `org_invites` — pending invitations
- `feature_flags` — per-org feature toggles
- `investors` — investor pipeline
- `contacts` / `buyers` — contact management
- `portfolios` — portfolio groupings
- `market_intel` — market research data

## Deployment Steps
To deploy changes to production:
1. Build: `npm run build`
2. Add CNAME: `echo "app.getreap.ai" > build/CNAME`
3. Deploy: `npx gh-pages -d build`

Or simply: `npm run deploy` (predeploy script handles the build)

Note: The .env file with Supabase and Stripe keys must be present for builds.

## GitHub Auth
When starting a new session, Javier will need to provide a GitHub Personal Access Token (PAT) with repo contents + pull requests permissions scoped to this repo. Store credentials via `git config credential.helper store` — never embed tokens in remote URLs.

## Session Quick-Start
When Javier starts a new conversation about REAP:
1. Read this config file first
2. Ask for GitHub PAT if pushing/deploying is needed
3. The folder mount will be at the workspace path — look for `src/App.js` as the main file
4. Always build-test before deploying (`npm run build`)
5. Deploy via fresh clone if the mounted folder has git lock issues
