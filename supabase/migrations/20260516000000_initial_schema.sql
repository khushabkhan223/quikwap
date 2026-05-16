-- =============================================================
-- Quikwap: Initial Schema
-- Migration: 20260516000000_initial_schema.sql
-- =============================================================


-- ==================
-- TABLE: businesses
-- ==================
CREATE TABLE businesses (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- owner_id links this row to the Supabase Auth user; required for RLS
  owner_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text        UNIQUE NOT NULL,
  phone_number        text        UNIQUE NOT NULL,
  business_name       text        NOT NULL,
  industry            text        NOT NULL
                                    CHECK (industry IN ('real_estate','coaching','clinic','salon','other')),
  subscription_status text        NOT NULL DEFAULT 'trial'
                                    CHECK (subscription_status IN ('active','trial','paused')),
  subscription_plan   text        NOT NULL DEFAULT 'starter'
                                    CHECK (subscription_plan IN ('starter','growth','pro')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Each authenticated user can only see and modify their own business row
CREATE POLICY "businesses_owner_all" ON businesses
  FOR ALL TO authenticated
  USING     (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ==================
-- TABLE: contacts
-- ==================
CREATE TABLE contacts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number    text        NOT NULL,
  name            text,
  is_lead         boolean     NOT NULL DEFAULT true,
  tags            text[]      NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

-- Scoped queries per business
CREATE INDEX contacts_business_id_idx    ON contacts (business_id);
-- Prevent duplicate contacts within the same business
CREATE UNIQUE INDEX contacts_business_phone_idx ON contacts (business_id, phone_number);
-- Fast lead filtering per business
CREATE INDEX contacts_is_lead_idx        ON contacts (business_id, is_lead);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_business_isolation" ON contacts
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- ==================
-- TABLE: messages
-- ==================
CREATE TABLE messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id          uuid        NOT NULL REFERENCES contacts(id)   ON DELETE CASCADE,
  direction           text        NOT NULL CHECK (direction IN ('incoming','outgoing')),
  body                text        NOT NULL,
  external_message_id text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_business_id_idx ON messages (business_id);
CREATE INDEX messages_contact_id_idx  ON messages (contact_id);
-- Descending so "latest messages first" queries hit the index efficiently
CREATE INDEX messages_created_at_idx  ON messages (created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_business_isolation" ON messages
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =====================
-- TABLE: keyword_rules
-- =====================
CREATE TABLE keyword_rules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keywords      text[]      NOT NULL,
  reply_message text        NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX keyword_rules_business_id_idx ON keyword_rules (business_id);

ALTER TABLE keyword_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keyword_rules_business_isolation" ON keyword_rules
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- ==========================
-- TABLE: follow_up_sequences
-- ==========================
CREATE TABLE follow_up_sequences (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  trigger_event text        NOT NULL
                              CHECK (trigger_event IN ('new_contact','no_reply_24h','no_reply_72h','manual')),
  -- Array of {delay_hours: number, message: string} objects
  steps         jsonb       NOT NULL DEFAULT '[]',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX follow_up_sequences_business_id_idx ON follow_up_sequences (business_id);

ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_up_sequences_business_isolation" ON follow_up_sequences
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =====================
-- TABLE: lead_tracking
-- =====================
CREATE TABLE lead_tracking (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id      uuid        NOT NULL REFERENCES contacts(id)   ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','contacted','interested','enrolled','lost')),
  notes           text,
  conversion_date timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_tracking_business_id_idx ON lead_tracking (business_id);
-- Filtering by status is a core dashboard query (e.g. "show all interested leads")
CREATE INDEX lead_tracking_status_idx      ON lead_tracking (business_id, status);

ALTER TABLE lead_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_tracking_business_isolation" ON lead_tracking
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =====================================================================
-- TRIGGER: keep contacts.last_message_at in sync automatically.
-- Without this, every message insert would need a paired UPDATE on
-- contacts, which is easy to miss and causes stale dashboard data.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_update_contact_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE contacts
  SET    last_message_at = NEW.created_at
  WHERE  id = NEW.contact_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_contact_last_message_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_contact_last_message_at();
