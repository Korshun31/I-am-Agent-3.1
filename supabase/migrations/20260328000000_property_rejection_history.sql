-- =============================================================================
-- property_rejection_history
-- Журнал отклонений объектов.
-- Пишется при каждом rejectProperty / rejectPropertyDraft.
-- Никогда не удаляется (только при ON DELETE CASCADE на объекте).
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_rejection_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid        NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reason          text        NOT NULL DEFAULT '',
  rejection_type  text        NOT NULL DEFAULT 'property_submitted'
                              CHECK (rejection_type IN ('property_submitted','edit_submitted','price_submitted','manual')),
  rejected_by     uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by property sorted by date DESC
CREATE INDEX IF NOT EXISTS idx_property_rejection_history_property_date
  ON property_rejection_history (property_id, created_at DESC);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE property_rejection_history ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SELECT: company owner sees history of all company properties
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rejection_history: owner reads company" ON property_rejection_history;
CREATE POLICY "rejection_history: owner reads company"
  ON property_rejection_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN companies c ON c.id = p.company_id
      WHERE p.id        = property_rejection_history.property_id
        AND c.owner_id  = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- SELECT: agent sees history of own + assigned properties
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rejection_history: agent reads own and assigned" ON property_rejection_history;
CREATE POLICY "rejection_history: agent reads own and assigned"
  ON property_rejection_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_rejection_history.property_id
        AND (p.user_id = auth.uid() OR p.responsible_agent_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- INSERT: only company owner (admin) can create rejection records
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rejection_history: owner can insert" ON property_rejection_history;
CREATE POLICY "rejection_history: owner can insert"
  ON property_rejection_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN companies c ON c.id = p.company_id
      WHERE p.id        = property_rejection_history.property_id
        AND c.owner_id  = auth.uid()
    )
  );
