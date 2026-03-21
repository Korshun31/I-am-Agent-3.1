-- =============================================================================
-- TEAM FEATURE — Этап 1: Фундамент базы данных
-- =============================================================================
-- Что делает этот файл:
--   1. Создаёт таблицы: companies, company_members, company_invitations
--   2. Создаёт вспомогательные функции и RLS политики
--   3. Добавляет поля в: properties
--   4. Создаёт индексы для быстрого поиска
--   5. Создаёт функции для работы с приглашениями
--
-- ВАЖНО: таблицы создаются ДО функций — иначе Supabase выдаёт ошибку
-- Чтобы ОТМЕНИТЬ: запусти 20250321000000_team_feature_stage1_down.sql
-- =============================================================================

-- =============================================================================
-- ШАГ 1: ТАБЛИЦЫ
-- =============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'agent'
                          CHECK (role IN ('owner', 'agent')),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, agent_id)
);

CREATE TABLE IF NOT EXISTS company_invitations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  invite_token  UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  secret_code   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent', 'pending', 'accepted', 'revoked')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- =============================================================================
-- ШАГ 2: ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (таблицы уже существуют — порядок важен)
-- SECURITY DEFINER — функция выполняется с правами создателя, обходя RLS.
-- Это стандартный паттерн в Supabase для избежания бесконечной рекурсии в политиках.
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_is_company_member(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
      AND agent_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION auth_is_company_owner(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM companies
    WHERE id = p_company_id
      AND owner_id = auth.uid()
  );
END;
$$;

-- =============================================================================
-- ШАГ 3: RLS ПОЛИТИКИ
-- =============================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies: owner full access"
  ON companies FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "companies: members can read"
  ON companies FOR SELECT
  USING (auth_is_company_member(id));

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members: owner full access"
  ON company_members FOR ALL
  USING (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

CREATE POLICY "company_members: see own record"
  ON company_members FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "company_members: see team"
  ON company_members FOR SELECT
  USING (auth_is_company_member(company_id));

ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_invitations: owner full access"
  ON company_invitations FOR ALL
  USING (auth_is_company_owner(company_id))
  WITH CHECK (auth_is_company_owner(company_id));

CREATE POLICY "company_invitations: members can read"
  ON company_invitations FOR SELECT
  USING (auth_is_company_member(company_id));

-- =============================================================================
-- ШАГ 4: НОВЫЕ ПОЛЯ В ТАБЛИЦЕ properties
-- Все существующие объекты получают property_status = 'approved' (не ломаем логику)
-- =============================================================================

-- К какой компании принадлежит объект (NULL = личный объект агента)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Кто ответственный за объект (NULL = "Компания", т.е. Admin)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS responsible_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Статус одобрения объекта (для модерации Admin'ом)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (property_status IN ('draft', 'pending', 'approved', 'rejected'));

-- Причина отклонения (Admin пишет агенту при отклонении)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Кто добавил объект
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================================================
-- ШАГ 5: ИНДЕКСЫ
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_agent_id ON company_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_token ON company_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_company_invitations_company_id ON company_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_email ON company_invitations(email);
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_responsible_agent_id ON properties(responsible_agent_id);

-- =============================================================================
-- ШАГ 6: ФУНКЦИИ ДЛЯ РАБОТЫ С ПРИГЛАШЕНИЯМИ
-- =============================================================================

-- Найти приглашение по токену из ссылки (секретный код не возвращается)
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token UUID)
RETURNS TABLE (
  invitation_id   UUID,
  company_id      UUID,
  company_name    TEXT,
  email           TEXT,
  status          TEXT,
  expires_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.company_id,
    c.name,
    ci.email,
    ci.status,
    ci.expires_at
  FROM company_invitations ci
  JOIN companies c ON c.id = ci.company_id
  WHERE ci.invite_token = p_token
    AND ci.status IN ('sent', 'pending')
    AND ci.expires_at > now();
END;
$$;

-- Проверить секретный код и принять приглашение
CREATE OR REPLACE FUNCTION verify_invitation_secret(p_token UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
BEGIN
  SELECT id INTO v_invitation_id
  FROM company_invitations
  WHERE invite_token = p_token
    AND secret_code = p_code
    AND status IN ('sent', 'pending')
    AND expires_at > now();

  IF v_invitation_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE company_invitations
  SET status = 'accepted'
  WHERE id = v_invitation_id;

  RETURN TRUE;
END;
$$;

-- Сгенерировать 6-значный секретный код
CREATE OR REPLACE FUNCTION generate_secret_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT lpad(floor(random() * 1000000)::text, 6, '0');
$$;
