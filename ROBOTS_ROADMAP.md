# REAP Robots — Full Build Roadmap

## Overview
An agentic AI system inside REAP with three robots (Alfred, Atlas, Walkert) that can chat, execute tasks, query REAP data, draft communications, and learn from feedback. Visible only to platform admin (Javier) until explicitly unlocked.

---

## PHASE 1 — Foundation ✅ (Current Sprint)
**Goal: Robots can chat, create tasks, and query REAP data**

### Database (Supabase)
- [x] `robots` table — 3 robot configs (Alfred, Atlas, Walkert)
- [x] `robot_conversations` table — chat history per robot
- [x] `robot_artifacts` table — tasks, drafts, reports
- [x] `robot_tasks` table — task management for robots
- [x] `org_soul` table — mission, vision, values (seeded)
- [x] `style_guide` table — communication rules by channel
- [x] `memories` table — episodic knowledge store
- [x] `exemplars` table — gold-standard examples
- [ ] Knowledge base tables seeded with initial data

### UI
- [x] Robots page in sidebar (admin only, no mobile bottom nav)
- [x] Left sidebar: robot list with avatars
- [x] Center: Slack-style chat with selected robot
- [x] Right pane: Tasks + Drafts tabs (desktop only)
- [x] Notepad tab in Profile Settings (admin only)

### Tools (3 total)
- `assign_task` — create/manage tasks
- `query_deals` — read REAP deals, pipeline, financials
- `query_contacts` — read REAP contacts, lenders, investors

### Edge Function
- `robot-chat` — agentic loop with tool use (needs Anthropic API key)

### NOT in Phase 1
- No outbound drafts (Gmail, email, SMS)
- No knowledge injection into prompts (tables exist but not wired)
- No feedback loop (👍/👎)
- No scheduled jobs
- No web search

---

## PHASE 2 — Knowledge Architecture (3-4 days)
**Goal: Robots feel like part of the team, not a generic chatbot**

### Build
- Knowledge Base management page (5 tabs: Soul, Style, Memories, Exemplars, Settings)
- Inject org_soul + style_guide + memories + exemplars into every system prompt
- Channel detection (email/sms/general) to load relevant style rules
- `search_memories` tool — robots can pull deep context mid-conversation
- `get_exemplars` tool — robots can fetch gold-standard examples
- Prompt caching to reduce token costs

### Result
Every robot speaks with your voice, knows your values, remembers past decisions.

---

## PHASE 3 — Outbound Drafts (2-3 days)
**Goal: Robots can draft real communications for your review**

### Build
- `create_gmail_draft` tool → real Gmail draft via Gmail MCP
- `draft_email` tool → email drafts stored as artifacts
- `draft_text` tool → SMS/text drafts stored as artifacts
- Review & Send modal for each draft type
- Draft-only guardrail enforced in tool code (never auto-send)
- Drafts tab in right pane shows all pending drafts

### Result
Say "Draft an email to Adam about the bridge loan terms" → robot creates a real draft you can review and send.

---

## PHASE 4 — Feedback & Learning Loop (1-2 days)
**Goal: Every interaction makes the system smarter**

### Build
- `feedback_events` table
- 👍/👎/✏️ buttons under every assistant response
- "Save as exemplar" button on artifact cards
- Edit tracking — when you edit a draft, the delta is captured
- `extract-memory` edge function — promotes feedback to memories
- `feedback-capture` edge function — logs events
- Auto-memory extraction from substantive edits

### Result
Edit a robot's email draft → the system learns "don't use that phrase" → next draft is better.

---

## PHASE 5 — More Tools & Data Access (2-3 days)
**Goal: Robots can access your full business context**

### Build
- `query_calendar_events` — read calendar
- `create_calendar_event` — add to calendar
- `query_transactions` — financial data
- `get_financial_summary` — P&L overview
- `query_pipeline_deals` — deal stages, offers, ARV
- `add_pipeline_deal` — create new deals
- `update_deal_stage` — move deals through pipeline
- `list_products_services` — your service offerings
- `query_accounts` — bank/business accounts

### Result
"What's our total pipeline value for deals in underwriting?" → instant answer from real data.

---

## PHASE 6 — Scheduled Jobs & Reports (1-2 days)
**Goal: Robots work for you on autopilot**

### Build
- pg_cron + pg_net Supabase extensions
- `run-brand-audit` edge function (weekly automated report)
- Brand Audit report page with score trends
- Scheduled deal pipeline digest
- Scheduled market research alerts
- Reports tab showing all automated outputs

### Result
Every Saturday at 5 AM, Atlas runs a brand audit with web research and drops a report in your inbox.

---

## PHASE 7 — Advanced Features (Ongoing)
**Goal: Production-grade polish**

### Build
- Per-robot tool gating (Alfred can't access financial tools)
- Named conversation threads ("Q3 Investor Outreach" vs "Personal")
- Dual-bot competing suggestions for outbound comms
- Web search integration (Anthropic built-in, budgeted per call)
- Conversation archiving and search
- Mobile robot access (drawer pattern)
- Multi-user robot access (team members can use robots)
- Robot analytics dashboard (which robot is used most, cost per robot)

---

## API Keys Required
| Service | Status | Purpose |
|---------|--------|---------|
| Anthropic | **NEEDED** | Powers all robot conversations |
| Google Maps | Configured | Geocoding, Street View |
| SendGrid | Configured | Transactional email |
| Supabase | Configured | Database, Auth, Edge Functions |
| Gmail API | Future (Phase 3) | Gmail draft creation |
| Stripe | Future | Payment processing |

## Cost Estimates (Monthly)
| Phase | Estimated Cost | Notes |
|-------|---------------|-------|
| Phase 1 | $5-15/mo | ~100-300 chat turns/mo at $0.03-0.05 each |
| Phase 2-4 | $15-30/mo | Knowledge injection adds ~2K tokens/call |
| Phase 5+ | $30-50/mo | More tools = more turns, but cached prompts help |
| With brand audits | +$2-4/mo | ~$0.40/audit × 4/month |
