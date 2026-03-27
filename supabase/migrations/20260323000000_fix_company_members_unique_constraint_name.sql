-- =============================================================================
-- B0.4: Привести имя UNIQUE constraint на company_members в соответствие
--       с текущим именем колонки (agent_id → user_id).
--
-- Контекст:
--   Migration 20250321000000_team_feature_stage1_up.sql создала
--   UNIQUE(company_id, agent_id) → имя auto-generated:
--     company_members_company_id_agent_id_key
--   Migration 20250326000000_rename_agent_id_to_user_id.sql переименовала
--   колонку, но НЕ constraint и НЕ его backing index.
--   После rename PostgreSQL отслеживает колонку по OID, поэтому
--   constraint ФУНКЦИОНАЛЬНО верен (проверяет (company_id, user_id)),
--   но ИМЯ устаревшее — вводит в заблуждение.
--
-- Что делает этот скрипт:
--   1. Переименовывает constraint, если он существует под старым именем.
--   2. Создаёт constraint с правильным именем, если он вовсе отсутствует
--      (защита на случай нестандартного имени).
--   3. Idempotent: безопасен при повторном запуске.
-- =============================================================================

DO $$
BEGIN
  -- Шаг 1: переименовать legacy constraint, если он существует
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'company_members_company_id_agent_id_key'
      AND conrelid   = 'public.company_members'::regclass
      AND contype    = 'u'
  ) THEN
    ALTER TABLE public.company_members
      RENAME CONSTRAINT company_members_company_id_agent_id_key
                     TO company_members_company_id_user_id_key;
    RAISE NOTICE 'Renamed constraint to company_members_company_id_user_id_key';
  END IF;

  -- Шаг 2: если правильного constraint всё ещё нет — создать
  -- (защита на случай нестандартного имени при создании)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'company_members_company_id_user_id_key'
      AND conrelid = 'public.company_members'::regclass
      AND contype  = 'u'
  ) THEN
    -- Дополнительная проверка: не создавать дубль, если уже есть
    -- UNIQUE на этих же колонках под другим именем
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.company_members'::regclass
        AND c.contype  = 'u'
        AND (
          SELECT array_agg(a.attname ORDER BY pos.pos)
          FROM LATERAL unnest(c.conkey) WITH ORDINALITY AS pos(attnum, pos)
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = pos.attnum
        ) = ARRAY['company_id', 'user_id']
    ) THEN
      ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_company_id_user_id_key
        UNIQUE (company_id, user_id);
      RAISE NOTICE 'Created new UNIQUE constraint company_members_company_id_user_id_key';
    ELSE
      RAISE NOTICE 'UNIQUE(company_id, user_id) already exists under a different name — skipped';
    END IF;
  ELSE
    RAISE NOTICE 'Constraint company_members_company_id_user_id_key already correct — no action';
  END IF;
END $$;
