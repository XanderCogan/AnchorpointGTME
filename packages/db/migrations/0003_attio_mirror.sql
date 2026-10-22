-- Read-only Attio mirror (Milestone 3, decision 0011). Rows are written only from
-- Attio read responses; nothing here is sent back to Attio.

CREATE TABLE attio_records (
  connection_id text NOT NULL,
  object_type text NOT NULL,
  record_id text NOT NULL,
  created_at timestamptz NOT NULL,
  source_changed_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  first_synced_at timestamptz NOT NULL DEFAULT now(),
  last_changed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, object_type, record_id)
);

CREATE TABLE attio_sync_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  connection_id text NOT NULL,
  object_type text NOT NULL,
  started_at timestamptz NOT NULL,
  pages integer NOT NULL,
  records_seen integer NOT NULL,
  records_inserted integer NOT NULL,
  records_updated integer NOT NULL,
  records_unchanged integer NOT NULL,
  records_missing integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attio_sync_runs_connection_idx
  ON attio_sync_runs (connection_id, object_type, id DESC);
