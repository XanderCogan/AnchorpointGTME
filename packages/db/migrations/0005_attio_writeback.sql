-- Attio enrichment writeback. The ledger records what the scoped writeback wrote,
-- so a later run can tell its own values from human-entered ones and a rerun
-- changes nothing. The review queue holds every write the policy refused to make
-- automatically; each item is stored once per deterministic key.

CREATE TABLE attio_writeback_values (
  connection_id text NOT NULL,
  object_type text NOT NULL CHECK (object_type IN ('companies', 'people')),
  record_id text NOT NULL,
  attribute text NOT NULL,
  normalized_value text NOT NULL,
  written_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, object_type, record_id, attribute)
);

CREATE TABLE attio_writeback_created (
  connection_id text NOT NULL,
  object_type text NOT NULL CHECK (object_type IN ('people')),
  source_key text NOT NULL,
  record_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, object_type, source_key)
);

CREATE TABLE attio_writeback_reviews (
  connection_id text NOT NULL,
  review_key text NOT NULL,
  object_type text NOT NULL CHECK (object_type IN ('companies', 'people')),
  record_id text,
  source_key text NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'conflict', 'uncertain_match', 'possible_duplicate', 'persona_unverified', 'company_not_found', 'person_not_found'
  )),
  attribute text,
  current_value text,
  proposed_value text,
  detail text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  queued_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  PRIMARY KEY (connection_id, review_key)
);

CREATE INDEX attio_writeback_reviews_open_idx
  ON attio_writeback_reviews (connection_id, status, queued_at);
