# REAP App — Project Context for Claude

## Owner
- **Name:** Javier A. Suarez
- **Email:** javier@thesuarezcapital.com
- **GitHub:** presidentsuarez
- **Organization:** Suarez Global

## Repository
- **Repo:** https://github.com/presidentsuarez/reap-app
- **Branch:** main
- **Live URL:** https://app.getreap.ai
- **GitHub PAT:** *(ask Javier — stored locally, not committed for security)*

## Supabase
- **Project Ref:** cpgwnrpaflaftlxrzlar
- **URL:** https://cpgwnrpaflaftlxrzlar.supabase.co
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ3ducnBhZmxhZnRseHJ6bGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NjE3NTUsImV4cCI6MjA1MjUzNzc1NX0.kVOEjKIKAzmqSbGYGi6FBzo3iSlbf0FYmMGBfwMFhC8`
- **Access Token (Management API):** `sbp_8332909c8627956a7bbef27fa22fea35e02850d9`

## API Keys
- **Stripe Publishable:** `pk_live_51SLWy2CPBlmmKk8H`
- **Resend API Key:** `re_KFaHT73z_JE31132r2GGpqikid5Lu54VP`
- **Quo API Key:** `c8cd61b340ee8e99f7811b20c943799924204d6a69dcb80692c03b127ea3bd51`
- **Google Maps API Key:** `AIzaSyCsxeRs8DmPGdyt8DLHbDVjEdr0hF6MTVE` (Maps JavaScript API + Geocoding API enabled, restricted to app.getreap.ai)

## Edge Function Secrets (set via `supabase secrets set`)
These secrets must be set in Supabase for the `send-investor-notifications` Edge Function:
- `RESEND_API_KEY` = `re_KFaHT73z_JE31132r2GGpqikid5Lu54VP`
- `QUO_API_KEY` = `c8cd61b340ee8e99f7811b20c943799924204d6a69dcb80692c03b127ea3bd51`
- `FROM_EMAIL` = `updates@getreap.ai` (or current sending email)
- `FROM_NAME` = `Suarez Global` (dynamic per org in future)
- `QUO_FROM_NUMBER` = `+18136944125` (Quo phone number ID: `PNcbag1oru`)

## Branding Model
- **Reap** = the platform (like Shopify). Always branded as "Powered by Reap · Real Estate Analytics Platform"
- **Suarez Global** (or any company) = the organization using Reap
- Portal header: shows company name dynamically + "Powered by Reap"
- Emails: company name in header, poster name in body, "Powered by Reap · Real Estate Analytics Platform" in footer
- Must be scalable — any team using Reap gets their own branding

## Tech Stack
- **Frontend:** React 19 (Create React App, single-page app)
- **Backend:** Supabase (database, auth via Google OAuth, file storage, Edge Functions)
- **Payments:** Stripe (live keys in .env)
- **Email Notifications:** Resend API (via Edge Function) + Gmail via Zapier MCP (already working)
- **SMS Notifications:** Quo API (via Edge Function)
- **Deployment:** GitHub Pages via `gh-pages` package
- **Custom Domain:** app.getreap.ai (CNAME in build folder)

## Architecture
- **Main file:** `src/App.js` — monolithic SPA, all views/components in one file (~9600+ lines)
- **Data layer:** `src/dataService.js` — all Supabase queries abstracted here; App.js never queries directly
- **Calculated fields:** Financial metrics (Cap Rate, DSCR, NOI, ROI, etc.) computed by Supabase DB trigger on save
- **State management:** React useState/useEffect hooks, no Redux
- **Routing:** Hash-based (#deal/address, #portfolio/id, #profile), no react-router
- **Styling:** All inline styles, no CSS framework. Design system: DM Sans body, Playfair Display headings, DM Mono monospace. Primary color: #16a34a (green)
- **Update type colors:** Construction=#EA580C, Financial=#2563EB, Status=#16A34A, Announcement=#7C3AED

## Key Views & Navigation
- **Sidebar nav (desktop) / Bottom nav (mobile):** Command Center, Real Estate, Contacts, Research, MLS Feed
- **Real Estate sub-tabs:** Dashboard, Pipeline, Portfolios
- **Deal Detail tabs:** Overview, Financials, Refinance, Bridge Loan, Income, Financing, AI Underwriting, AI Summary, Notes, Documents, Shared Deal, Activity
- **Contacts sub-tabs:** Contacts, Investors
- **MLS sub-tabs:** Feed, Upload
- **Investor Portal:** Dashboard, Updates, My Deals, Settings (accessible via portal link)

## Supabase Tables
- `deals` — main deal/property records
- `deal_documents` — uploaded files and links (`is_link` column for URL refs)
- `deal_activities` — activity timeline and notes
- `deal_shares` — deal sharing with permissions (viewer/editor/admin)
- `organizations` — team/org management
- `org_members` — org membership
- `org_invites` — pending invitations
- `feature_flags` — per-org feature toggles
- `investors` — investor pipeline (has `portal_email`, `contact_ids` pipe-delimited, `notification_prefs` JSON string)
- `investor_updates` — posted updates per deal (`is_public` boolean, `update_type`, `posted_by`)
- `investor_update_reads` — read receipts for portal updates
- `investor_notifications` — email/SMS delivery tracking (`status`, `sent_at`, `error_message`)
- `contacts` / `buyers` — contact management
- `portfolios` — portfolio groupings
- `market_intel` — market research data

## Edge Functions
- `generate-summary` — AI summary generation for deals
- `stripe-webhook` — Stripe payment processing
- `send-investor-notifications` — automated email + SMS delivery for investor updates

## Deployment Steps
To deploy changes to production (from any machine):
```bash
cd /tmp && rm -rf reap-deploy
git clone https://presidentsuarez:<PAT>@github.com/presidentsuarez/reap-app.git reap-deploy
cd reap-deploy
# Copy updated src/App.js and .env into the clone
npm install
CI=false npm run build
echo "app.getreap.ai" > build/CNAME
npx gh-pages -d build
```

Or from a workspace with clean git:
```bash
npm run build
echo "app.getreap.ai" > build/CNAME
npx gh-pages -d build
```

## Edge Function Deployment
```bash
brew install supabase/tap/supabase   # if not installed
supabase login
supabase link --project-ref cpgwnrpaflaftlxrzlar
supabase secrets set RESEND_API_KEY=re_KFaHT73z_JE31132r2GGpqikid5Lu54VP
supabase secrets set QUO_API_KEY=c8cd61b340ee8e99f7811b20c943799924204d6a69dcb80692c03b127ea3bd51
supabase secrets set FROM_EMAIL=updates@getreap.ai
supabase secrets set "FROM_NAME=Suarez Global"
supabase secrets set QUO_FROM_NUMBER=+1XXXXXXXXXX  # replace with actual
supabase functions deploy send-investor-notifications
```

## Pending / Future Work
- **Session 4:** Photo/image uploads on construction updates, fund-level grouping, investor onboarding flow, engagement metrics dashboard
- **Quo SMS:** QUO_FROM_NUMBER still needed from Javier
- **Resend domain:** DNS records for getreap.ai (Wix DNS may have limitations)
- **Scalability:** Multi-org support — each org sees their own branding in portal + emails

## Session Quick-Start
When Javier starts a new conversation about REAP:
1. Read this config file first (`.claude/config.md`)
2. All credentials are stored above — no need to ask for them again
3. The folder mount will be at the workspace path — look for `src/App.js` as the main file
4. Always build-test before deploying (`CI=false npm run build`)
5. Deploy via fresh clone in /tmp if the mounted folder has git lock issues
6. The .env file needs: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`
7. Google Maps API key is hardcoded in App.js (REACT_APP_GOOGLE_MAPS_KEY) for the deal pipeline map view
