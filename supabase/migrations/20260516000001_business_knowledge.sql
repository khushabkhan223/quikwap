-- =============================================================
-- Quikwap: Business Knowledge & Onboarding Messages
-- Migration: 20260516000001_business_knowledge.sql
-- =============================================================


-- =======================
-- TABLE: business_knowledge
-- =======================
CREATE TABLE business_knowledge (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE enforces one knowledge record per business
  business_id         uuid        NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  raw_onboarding_text text,
  structured_data     jsonb       NOT NULL DEFAULT '{}',
  is_confirmed        boolean     NOT NULL DEFAULT false,
  last_updated_at     timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE business_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_knowledge_business_isolation" ON business_knowledge
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- ==========================
-- TABLE: onboarding_messages
-- ==========================
CREATE TABLE onboarding_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Composite index covers both "all messages for a business" and "in order" queries
CREATE INDEX onboarding_messages_business_created_idx
  ON onboarding_messages (business_id, created_at);

ALTER TABLE onboarding_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_messages_business_isolation" ON onboarding_messages
  FOR ALL TO authenticated
  USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );


-- =====================================================================
-- TRIGGER: auto-update last_updated_at when structured_data changes.
-- Uses BEFORE UPDATE so we can set NEW.last_updated_at before the row
-- is written (AFTER triggers cannot modify the row being saved).
-- IS DISTINCT FROM means a no-op update to structured_data won't
-- change the timestamp.
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_update_knowledge_last_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.structured_data IS DISTINCT FROM NEW.structured_data THEN
    NEW.last_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_knowledge_last_updated_at
  BEFORE UPDATE ON business_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_knowledge_last_updated_at();
