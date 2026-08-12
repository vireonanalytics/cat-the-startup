-- Startup Triage: initial schema
-- Run this once in the Supabase SQL editor for your project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  name text not null,
  role text not null default 'analyst' check (role in ('analyst', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  domain text,
  sector text,
  stage text,
  ask_amount numeric,
  status text not null default 'new' check (status in ('new', 'in_review', 'passed', 'investing')),
  created_by uuid not null references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists startups_team_id_idx on public.startups (team_id);

-- ---------------------------------------------------------------------------
-- Seed: single default team
-- ---------------------------------------------------------------------------

insert into public.teams (name)
select 'Default Team'
where not exists (select 1 from public.teams);

-- ---------------------------------------------------------------------------
-- New-user provisioning: every signup lands on the default team as an analyst.
-- Promote to admin or move teams later with a manual SQL update.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_team_id uuid;
begin
  select id into default_team_id from public.teams order by created_at asc limit 1;

  insert into public.users (id, team_id, name, role)
  values (
    new.id,
    default_team_id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'analyst'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.users enable row level security;
alter table public.startups enable row level security;

-- Helper: current user's team_id, looked up once per statement.
create or replace function public.current_team_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select team_id from public.users where id = auth.uid();
$$;

drop policy if exists "team members can view their own team" on public.teams;
create policy "team members can view their own team"
  on public.teams for select
  to authenticated
  using (id = public.current_team_id());

drop policy if exists "team members can view teammates" on public.users;
create policy "team members can view teammates"
  on public.users for select
  to authenticated
  using (team_id = public.current_team_id());

drop policy if exists "team members can view team startups" on public.startups;
create policy "team members can view team startups"
  on public.startups for select
  to authenticated
  using (team_id = public.current_team_id());

drop policy if exists "team members can create startups for their team" on public.startups;
create policy "team members can create startups for their team"
  on public.startups for insert
  to authenticated
  with check (team_id = public.current_team_id() and created_by = auth.uid());

drop policy if exists "team members can update team startups" on public.startups;
create policy "team members can update team startups"
  on public.startups for update
  to authenticated
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());

-- ---------------------------------------------------------------------------
-- Step 2: documents (pitch decks) and AI-generated reviews
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  type text not null check (type in ('deck', 'transcript')),
  file_url text not null,
  page_image_urls jsonb not null default '[]'::jsonb,
  extracted_text text,
  uploaded_by uuid not null references public.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists documents_startup_id_idx on public.documents (startup_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  snapshot text not null,
  why_invest jsonb not null default '[]'::jsonb,
  why_not jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  model_version text not null
);

create index if not exists reviews_startup_id_idx on public.reviews (startup_id);

alter table public.documents enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "team members can view team documents" on public.documents;
create policy "team members can view team documents"
  on public.documents for select
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = documents.startup_id and s.team_id = public.current_team_id()
    )
  );

drop policy if exists "team members can upload documents for team startups" on public.documents;
create policy "team members can upload documents for team startups"
  on public.documents for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.startups s
      where s.id = documents.startup_id and s.team_id = public.current_team_id()
    )
  );

drop policy if exists "team members can view team reviews" on public.reviews;
create policy "team members can view team reviews"
  on public.reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = reviews.startup_id and s.team_id = public.current_team_id()
    )
  );

drop policy if exists "team members can create reviews for team startups" on public.reviews;
create policy "team members can create reviews for team startups"
  on public.reviews for insert
  to authenticated
  with check (
    exists (
      select 1 from public.startups s
      where s.id = reviews.startup_id and s.team_id = public.current_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: pitch deck PDFs and rendered page images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
select 'startup-documents', 'startup-documents', false
where not exists (select 1 from storage.buckets where id = 'startup-documents');

-- Objects are stored under `${startup_id}/...`, so the first path segment
-- ties every object back to a startup for team-scoped access.

-- Note: `name` is qualified as `storage.objects.name` in the subqueries
-- below. `public.startups` also has a `name` column (the company name), so
-- an unqualified `name` inside the `exists (select ... from startups s)`
-- subquery resolves to `s.name` instead of the object's file path.

drop policy if exists "team members can read team document files" on storage.objects;
create policy "team members can read team document files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'startup-documents'
    and exists (
      select 1 from public.startups s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
      and s.team_id = public.current_team_id()
    )
  );

drop policy if exists "team members can upload team document files" on storage.objects;
create policy "team members can upload team document files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'startup-documents'
    and exists (
      select 1 from public.startups s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
      and s.team_id = public.current_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 3: call transcripts and deck/call contradiction detection
-- ---------------------------------------------------------------------------

-- Transcripts are saved as `documents` rows too (type 'transcript'), but the
-- text is captured directly (pasted, or extracted server-side from an
-- uploaded .txt/.docx) rather than downloaded from storage, so there is no
-- file object backing them. `label` lets the analyst distinguish multiple
-- transcripts on the same startup (e.g. "Intro call 6/12").
alter table public.documents add column if not exists label text;
alter table public.documents alter column file_url drop not null;

alter table public.reviews add column if not exists contradictions jsonb not null default '[]'::jsonb;

drop policy if exists "team members can delete team documents" on public.documents;
create policy "team members can delete team documents"
  on public.documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = documents.startup_id and s.team_id = public.current_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 4: public-data enrichment via web search
-- ---------------------------------------------------------------------------

-- Founder names are recorded as basic startup info (set at creation time)
-- so that enrichment has a public identifier to search on without ever
-- touching deck or transcript content.
alter table public.startups add column if not exists founder_names text;

create table if not exists public.enrichment_findings (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  source text not null default 'web_search' check (source in ('web_search')),
  summary_text text not null,
  raw_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists enrichment_findings_startup_id_idx on public.enrichment_findings (startup_id);

alter table public.enrichment_findings enable row level security;

drop policy if exists "team members can view team enrichment findings" on public.enrichment_findings;
create policy "team members can view team enrichment findings"
  on public.enrichment_findings for select
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = enrichment_findings.startup_id and s.team_id = public.current_team_id()
    )
  );

drop policy if exists "team members can create enrichment findings for team startups" on public.enrichment_findings;
create policy "team members can create enrichment findings for team startups"
  on public.enrichment_findings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.startups s
      where s.id = enrichment_findings.startup_id and s.team_id = public.current_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 5: analyst comments alongside call transcripts; editable startup
-- fields; deletable decks
-- ---------------------------------------------------------------------------

-- 'comment' is a personal note an analyst adds (never sent to the model as
-- review input, unlike 'transcript') - stored as a `documents` row the same
-- way transcripts are, just under a different `type`. The check constraint
-- was declared inline in Step 2 with no explicit name, so Postgres assigned
-- it the default `<table>_<column>_check` name.
alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in ('deck', 'transcript', 'comment'));

-- team members can already update startups (Step 1 policy covers all
-- columns) and delete documents (Step 3 policy covers all types, including
-- decks) - no new RLS policies are needed for inline editing or deck
-- deletion.

-- ---------------------------------------------------------------------------
-- Step 6: unify transcripts and comments into one type with an audience;
-- compact review verdict/thesis; structured last-round summary
-- ---------------------------------------------------------------------------

-- A 'comment' now covers what used to be two separate types ('transcript'
-- and 'comment'). What distinguishes them is `audience`:
--   'evidence'   - factual material (a call transcript, a verified fact) -
--                  sent to the model as review input, same as a transcript
--                  always was. Optionally backed by an uploaded file.
--   'discussion' - team chatter about the startup - never sent to the
--                  model, shown only in the discussion widget.
-- Deck rows have no audience (the check constraint below enforces the split).
alter table public.documents add column if not exists audience text;

update public.documents set audience = 'evidence' where type = 'transcript' and audience is null;
update public.documents set audience = 'discussion' where type = 'comment' and audience is null;
update public.documents set type = 'comment' where type = 'transcript';

alter table public.documents drop constraint if exists documents_type_check;
alter table public.documents add constraint documents_type_check
  check (type in ('deck', 'comment'));

alter table public.documents drop constraint if exists documents_audience_check;
alter table public.documents add constraint documents_audience_check
  check (
    (type = 'comment' and audience in ('evidence', 'discussion'))
    or (type = 'deck' and audience is null)
  );

-- Compact, prioritized review output: a short verdict badge and one-line
-- thesis shown above the detailed why_invest/why_not/contradictions, so an
-- analyst sees the bottom line before any detail.
alter table public.reviews add column if not exists verdict text;
alter table public.reviews add column if not exists thesis text;
alter table public.reviews drop constraint if exists reviews_verdict_check;
alter table public.reviews add constraint reviews_verdict_check
  check (verdict is null or verdict in ('Strong yes', 'Promising', 'Needs diligence', 'Weak fit', 'Pass'));

-- Structured "last round" fact (e.g. "$1.5M · Feb 2025") extracted
-- alongside the free-text funding_history paragraph, so the startup header
-- can show it as one compact fact chip instead of parsing prose.
alter table public.enrichment_findings add column if not exists last_round_summary text;

-- ---------------------------------------------------------------------------
-- Step 7: compact online-research findings with real, search-verified source
-- links, replacing long free-text paragraphs in the UI
-- ---------------------------------------------------------------------------

-- Each finding is {point, source_name, url} - a handful of the most
-- important facts, each citing the exact URL a web search actually
-- returned (verified server-side against raw_results, never trusted as
-- typed by the model - see enrichStartup in actions.ts).
alter table public.enrichment_findings add column if not exists key_findings jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Step 8: dismissible contradictions - an analyst can mark a flagged
-- contradiction as not relevant without re-running the AI, excluding it from
-- the visible review and its count without losing the original AI output
-- ---------------------------------------------------------------------------

-- Indices into this review row's own `contradictions` array (a fixed
-- snapshot from generation) that an analyst has dismissed as not relevant.
-- Scoped to the review row rather than a separate table since a fresh
-- regeneration replaces the whole row anyway - see runReviewGeneration in
-- actions.ts.
alter table public.reviews add column if not exists dismissed_contradiction_indices int[] not null default '{}';

-- The dismiss/restore-contradiction actions update `reviews` rows in place
-- (see setContradictionDismissed in actions.ts) - the table had select and
-- insert policies but no update policy, so those updates were silently
-- blocked by RLS (0 rows affected, no error surfaced) until this policy
-- existed.
drop policy if exists "team members can update team reviews" on public.reviews;
create policy "team members can update team reviews"
  on public.reviews for update
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = reviews.startup_id and s.team_id = public.current_team_id()
    )
  )
  with check (
    exists (
      select 1 from public.startups s
      where s.id = reviews.startup_id and s.team_id = public.current_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 9: review version history - every generation becomes a distinct,
-- numbered, immutable version instead of just an incidental row; each
-- version records exactly which deck/evidence/research inputs produced it
-- ---------------------------------------------------------------------------

-- Reviews were already never updated or deleted on regeneration (every
-- runReviewGeneration call is a fresh insert - see actions.ts) - what's
-- missing is an explicit, gap-free version number per startup, and a record
-- of exactly which deck/evidence/research fed each one, so the UI can show
-- real history and an accurate per-version "generated from" line instead of
-- always describing whatever is live right now.
alter table public.reviews add column if not exists version integer;
alter table public.reviews add column if not exists deck_document_id uuid references public.documents (id) on delete set null;
alter table public.reviews add column if not exists evidence_document_ids uuid[] not null default '{}';
alter table public.reviews add column if not exists enrichment_finding_id uuid references public.enrichment_findings (id) on delete set null;

-- Backfill: every existing review becomes version 1, 2, 3... per startup,
-- ordered by when it was actually generated, so current data becomes real
-- history instead of breaking on the new not-null constraint below.
with ranked as (
  select id, row_number() over (partition by startup_id order by generated_at asc) as rn
  from public.reviews
)
update public.reviews r
set version = ranked.rn
from ranked
where r.id = ranked.id and r.version is null;

alter table public.reviews alter column version set default 1;
alter table public.reviews alter column version set not null;

alter table public.reviews drop constraint if exists reviews_startup_version_unique;
alter table public.reviews add constraint reviews_startup_version_unique unique (startup_id, version);

create index if not exists reviews_startup_id_version_idx on public.reviews (startup_id, version desc);

-- Assigns the next version number atomically per startup on every insert,
-- so the app never has to compute it (or risk a race) itself - a manual
-- Regenerate click and a background auto-regeneration (see
-- maybeTriggerBackgroundRegeneration in actions.ts) can now land at nearly
-- the same time. Locking the parent startups row for the duration serializes
-- concurrent inserts for the same startup so two reviews can't compute the
-- same "next" version.
create or replace function public.set_review_version()
returns trigger
language plpgsql
as $$
begin
  perform 1 from public.startups where id = new.startup_id for update;
  select coalesce(max(version), 0) + 1 into new.version
  from public.reviews
  where startup_id = new.startup_id;
  return new;
end;
$$;

drop trigger if exists reviews_set_version on public.reviews;
create trigger reviews_set_version
  before insert on public.reviews
  for each row execute function public.set_review_version();

-- ---------------------------------------------------------------------------
-- Step 10: allow deleting a startup
-- ---------------------------------------------------------------------------

-- Step 1 gave startups select/insert/update policies but never a delete
-- one, so RLS silently denied every delete (Postgres RLS default-denies any
-- operation with no matching policy) - deleteStartup ran without error but
-- removed zero rows. documents/reviews/enrichment_findings rows for the
-- startup all cascade automatically via their existing FK (see Step 2/3),
-- so no policy changes are needed there.
drop policy if exists "team members can delete team startups" on public.startups;
create policy "team members can delete team startups"
  on public.startups for delete
  to authenticated
  using (team_id = public.current_team_id());

-- ---------------------------------------------------------------------------
-- Step 11: request-to-join signups (replaces open self-service signup)
-- ---------------------------------------------------------------------------

-- No auth.users row exists yet at request time - the password is encrypted
-- app-side (see src/lib/crypto.ts, SIGNUP_REQUEST_SECRET) rather than
-- stored in plaintext, and only decrypted at approval time to hand to
-- supabase.auth.signUp(). This table has no relationship to
-- public.users/teams until an admin approves the request - approval is
-- what actually creates the account (see approveSignupRequest).
create table if not exists public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  password_encrypted text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.users (id) on delete set null
);

create index if not exists signup_requests_status_idx on public.signup_requests (status);

alter table public.signup_requests enable row level security;

-- Anyone can submit a request - there's no team/user context yet to scope
-- this to, since the person doesn't have an account. The request action
-- validates input server-side; this policy only blocks someone from
-- inserting a row that claims to already be "approved".
drop policy if exists "anyone can submit a signup request" on public.signup_requests;
create policy "anyone can submit a signup request"
  on public.signup_requests for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "admins can view signup requests" on public.signup_requests;
create policy "admins can view signup requests"
  on public.signup_requests for select
  to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "admins can decide signup requests" on public.signup_requests;
create policy "admins can decide signup requests"
  on public.signup_requests for update
  to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Step 12: only admins can delete discussion messages
-- ---------------------------------------------------------------------------

-- Replaces the Step 3 delete policy with the same team-membership check
-- plus one more condition: any team member can still delete a deck or an
-- evidence item, but a 'comment' row with audience = 'discussion' now also
-- requires the deleter to be an admin.
drop policy if exists "team members can delete team documents" on public.documents;
create policy "team members can delete team documents"
  on public.documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = documents.startup_id and s.team_id = public.current_team_id()
    )
    and (
      documents.audience is distinct from 'discussion'
      or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Step 13: promote the existing account to admin
-- ---------------------------------------------------------------------------

-- Only the request-approval flow needs an admin, and there's exactly one
-- real user so far - this makes them one, and sets the display name used
-- in the discussion thread's authorship (Step 12 above).
update public.users
set name = 'Artemii', role = 'admin'
where id = (select id from auth.users where email = 'artemiichirkov@gmail.com');

-- ---------------------------------------------------------------------------
-- Step 14: allow deleting a user account without orphaning their records
-- ---------------------------------------------------------------------------

-- startups.created_by and documents.uploaded_by were declared `not null`
-- alongside `on delete set null` (Steps 1/2) - a contradiction: deleting a
-- user cascades to their public.users row (Step: users.id references
-- auth.users on delete cascade), which then tries to null out every startup
-- and document they touched, and fails outright because those columns
-- can't be null. Deleting any user who has ever created a startup or
-- uploaded a document was therefore impossible. Dropping not null lets the
-- already-declared `on delete set null` do what it was meant to - the
-- startup/document rows survive, just with an unattributed creator/uploader
-- (the discussion UI already renders that as "Unknown" - see
-- discussion-chat.tsx).
alter table public.startups alter column created_by drop not null;
alter table public.documents alter column uploaded_by drop not null;

-- ---------------------------------------------------------------------------
-- Step 15: private per-analyst PurrAI chat history
-- ---------------------------------------------------------------------------

-- Unlike documents.audience = 'discussion' (shared with the whole team),
-- PurrAI's conversation is personal to each analyst - two analysts on the
-- same startup each get their own thread, never each other's. That's a
-- stricter boundary than the team-wide RLS pattern used everywhere else in
-- this file, so every policy below is scoped to user_id = auth.uid()
-- *in addition to* the startup belonging to the analyst's team.
create table if not exists public.analyst_chat_messages (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists analyst_chat_messages_lookup_idx
  on public.analyst_chat_messages (startup_id, user_id, created_at);

alter table public.analyst_chat_messages enable row level security;

create policy "analysts can read their own PurrAI messages"
  on public.analyst_chat_messages for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.startups s
      where s.id = analyst_chat_messages.startup_id and s.team_id = public.current_team_id()
    )
  );

create policy "analysts can write their own PurrAI messages"
  on public.analyst_chat_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.startups s
      where s.id = analyst_chat_messages.startup_id and s.team_id = public.current_team_id()
    )
  );

create policy "analysts can clear their own PurrAI messages"
  on public.analyst_chat_messages for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Step 16: audit trail for startup status changes
-- ---------------------------------------------------------------------------

-- Status flips (New -> In review -> Passed/Investing) previously happened
-- silently - nothing recorded who changed it or when, which matters for a
-- multi-analyst tool where "wait, who passed on this?" is a real question.
-- Team-wide visibility (like documents/reviews), not per-analyst-private
-- like Step 15's chat history - anyone on the team should be able to see
-- the full decision trail for a startup they can already see.
create table if not exists public.status_changes (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists status_changes_startup_id_idx
  on public.status_changes (startup_id, changed_at);

alter table public.status_changes enable row level security;

create policy "team members can read their team's status history"
  on public.status_changes for select
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = status_changes.startup_id and s.team_id = public.current_team_id()
    )
  );

create policy "team members can log status changes for their team"
  on public.status_changes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.startups s
      where s.id = status_changes.startup_id and s.team_id = public.current_team_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 17: track the one-time product tour per account, not per browser
-- ---------------------------------------------------------------------------

-- Previously tracked in localStorage, which is scoped to a single browser
-- profile - it reappeared every time an analyst opened a new browser,
-- incognito window, or device, which reads as "random" even though it was
-- working exactly as localStorage always does. This follows the account
-- instead, matching "show it once, ever, per analyst."
alter table public.users
  add column if not exists tour_completed boolean not null default false;

drop policy if exists "users can update their own tour_completed flag" on public.users;
create policy "users can update their own tour_completed flag"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
