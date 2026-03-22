-- =============================================================================
-- NOTIFICATIONS: таблица уведомлений для Админа и Агентов
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  type          TEXT        NOT NULL,
  -- Типы: 'property_submitted', 'property_approved', 'property_rejected',
  --        'edit_submitted', 'edit_approved', 'edit_rejected',
  --        'price_submitted', 'price_approved', 'price_rejected'
  title         TEXT        NOT NULL,
  body          TEXT,
  property_id   UUID        REFERENCES properties(id) ON DELETE CASCADE,
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  action_taken  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- action_taken = true когда Админ уже нажал Одобрить/Отклонить
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_property  ON notifications(property_id);

-- =============================================================================
-- RLS: каждый видит только свои уведомления
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: own records"
  ON notifications FOR ALL
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- =============================================================================
-- ФУНКЦИЯ: создать уведомление (вызывается из JS)
-- =============================================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id  UUID,
  p_sender_id     UUID,
  p_type          TEXT,
  p_title         TEXT,
  p_body          TEXT,
  p_property_id   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (recipient_id, sender_id, type, title, body, property_id)
  VALUES (p_recipient_id, p_sender_id, p_type, p_title, p_body, p_property_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
