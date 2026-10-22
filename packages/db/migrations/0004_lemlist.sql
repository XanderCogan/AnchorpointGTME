-- Lemlist activation (Milestone 6, decision 0012). The enrollment ledger makes
-- enrollment idempotent, events are stored once per Lemlist activity, and
-- suppressions are deny-first inputs to every enrollment plan.

CREATE TABLE lemlist_enrollments (
  idempotency_key text PRIMARY KEY,
  campaign_id text NOT NULL,
  contact_key text NOT NULL,
  email text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'enrolled', 'rejected', 'failed')),
  lead_id text,
  detail text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE INDEX lemlist_enrollments_campaign_idx ON lemlist_enrollments (campaign_id, status);

CREATE TABLE lemlist_events (
  activity_id text PRIMARY KEY,
  type text NOT NULL,
  category text NOT NULL,
  campaign_id text,
  lead_id text,
  email text,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lemlist_events_email_idx ON lemlist_events (email, occurred_at DESC);

CREATE TABLE suppressions (
  value text PRIMARY KEY,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activation_controls (
  campaign_id text PRIMARY KEY,
  kill_switch_engaged boolean NOT NULL,
  reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
