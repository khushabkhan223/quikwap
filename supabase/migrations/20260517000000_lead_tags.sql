-- =============================================================
-- Quikwap: Lead Tags & Summary
-- Migration: 20260517000000_lead_tags.sql
-- =============================================================

-- contacts.tags already exists (text[] NOT NULL DEFAULT '{}') from the initial schema.
-- No change needed there.

-- Add summary column to lead_tracking for Gemini-generated conversation summaries.
ALTER TABLE lead_tracking ADD COLUMN IF NOT EXISTS summary text;
