-- =============================================================
-- Quikwap: Bot Pause & Deal Closing
-- Migration: 20260519000000_bot_pause_and_closing.sql
-- =============================================================

-- Allow agents to pause the bot for a contact when they take over a conversation.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bot_paused boolean NOT NULL DEFAULT false;

-- Records when an agent clicked "Take Over" — used for 24hr auto-resume later.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS agent_took_over_at timestamptz;

-- Records when an agent marked a deal as closed.
ALTER TABLE lead_tracking ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Records when an agent marked a lead as lost.
ALTER TABLE lead_tracking ADD COLUMN IF NOT EXISTS lost_at timestamptz;
