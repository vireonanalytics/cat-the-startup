# Cat the Startup 🐾

An AI-assisted deal-triage tool for VC analysts. Upload a pitch deck (or log a startup by hand), and it extracts the basics, runs public research on the founders and company, and generates a structured investment review - verdict, thesis, why-invest, why-not, contradictions, and open unknowns - that a team can discuss, revise, and export to a memo.

Live at [cat-the-startup.vercel.app](https://cat-the-startup.vercel.app).

## Features

- **Deck-based intake** - upload a PDF pitch deck and the name, domain, sector, stage, ask amount, and founders are extracted automatically; anything the deck doesn't cover is left blank to fill in by hand.
- **AI review** - a Claude-generated verdict with supporting evidence, versioned so you can see how the read on a company changed over time and diff between versions.
- **Online research** - public web research on the founders and company at three depths (Fast / Medium / Extended), feeding facts and citations straight into the review.
- **Evidence & discussion** - attach call transcripts and notes that feed the AI review, plus a separate private team chat ("Cat-ch Up") that never does.
- **PurrAI** - an in-page Q&A assistant grounded only in what's already on that startup's page (deck, evidence, research, review).
- **Memo export** - turn the current review into a formatted `.docx` investment-committee memo.
- **Team accounts** - invite-only signup with admin approval, per-team row-level security in Supabase, and an audit trail on status changes.
- **The graveyard** - passed startups move to a browsable archive instead of disappearing.
- **Self-driving product tour** - a first-run walkthrough that navigates itself through the dashboard, deck upload, and every tab of a real startup.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions) + React 19 + TypeScript
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, and row-level security
- [Anthropic Claude](https://www.anthropic.com) via `@anthropic-ai/sdk` — deck extraction, review generation, online research, PurrAI chat
- Tailwind CSS 4
- Deployed on [Vercel](https://vercel.com)

## Project structure

```
src/app/(app)/          Authenticated app shell (dashboard, startup detail, passed, admin)
src/app/login/           Sign-in
src/app/request-access/  Invite-only signup + admin approval flow
src/components/          UI components (review, research, evidence, chat, mascot, product tour)
src/lib/                 Supabase clients, Claude prompts/schemas, shared types and constants
supabase/schema.sql      Full database schema (tables, RLS policies, triggers)
```

## Ownership

A Vireon Analytics LLC product. Private repository - not open for external contributions.
