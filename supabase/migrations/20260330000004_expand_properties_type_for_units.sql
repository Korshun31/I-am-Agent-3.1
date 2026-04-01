-- P0.1: Prepare DB for new unit types without breaking legacy flows.
-- Adds support for:
--   - resort_house
--   - condo_apartment
-- Backward-compatible: keeps old types and existing rows untouched.

DO $$
DECLARE
  v_typtype   "char";
  v_typname   text;
  v_con       text;
  v_has_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'properties'
      AND c.relkind = 'r'
  ) INTO v_has_table;

  IF NOT v_has_table THEN
    RAISE NOTICE 'public.properties not found, skipping migration.';
    RETURN;
  END IF;

  SELECT t.typtype, t.typname
  INTO v_typtype, v_typname
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE n.nspname = 'public'
    AND c.relname = 'properties'
    AND a.attname = 'type'
    AND NOT a.attisdropped
  LIMIT 1;

  -- Variant A: enum-typed column -> extend enum values.
  IF v_typtype = 'e' THEN
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      'public',
      v_typname,
      'resort_house'
    );
    EXECUTE format(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      'public',
      v_typname,
      'condo_apartment'
    );

    RAISE NOTICE 'Extended enum %.% with resort_house/condo_apartment.', 'public', v_typname;
    RETURN;
  END IF;

  -- Variant B: text/varchar + CHECK constraint(s) -> replace type-related checks
  -- with a single canonical one including new values.
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.properties'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ~* '\mtype\M'
  LOOP
    EXECUTE format('ALTER TABLE public.properties DROP CONSTRAINT %I', v_con);
    RAISE NOTICE 'Dropped type-related check constraint: %', v_con;
  END LOOP;

  ALTER TABLE public.properties
    ADD CONSTRAINT properties_type_check
    CHECK (type IN ('house', 'resort', 'condo', 'resort_house', 'condo_apartment'));

  RAISE NOTICE 'Added properties_type_check with legacy + new types.';
END $$;

-- RLS compatibility check (no logic changes here):
-- detect whether properties policies contain explicit type predicates.
DO $$
DECLARE
  v_cnt integer;
BEGIN
  SELECT COUNT(*)
  INTO v_cnt
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename  = 'properties'
    AND (
      COALESCE(qual, '') ~* '\mtype\M'
      OR COALESCE(with_check, '') ~* '\mtype\M'
    );

  IF v_cnt > 0 THEN
    RAISE NOTICE 'Found % properties policies with type predicates (review if needed).', v_cnt;
  ELSE
    RAISE NOTICE 'No properties RLS policies constrained by type detected.';
  END IF;
END $$;

-- Mini-check SQL (manual run in SQL editor after migration):
-- 1) New type insert tests:
-- INSERT INTO public.properties (id, user_id, responsible_agent_id, name, code, type, property_status)
-- VALUES (gen_random_uuid(), auth.uid(), auth.uid(), 'tmp resort house', 'TMP-RH', 'resort_house', 'pending');
--
-- INSERT INTO public.properties (id, user_id, responsible_agent_id, name, code, type, property_status)
-- VALUES (gen_random_uuid(), auth.uid(), auth.uid(), 'tmp condo apt', 'TMP-CA', 'condo_apartment', 'pending');
--
-- 2) Legacy type insert test:
-- INSERT INTO public.properties (id, user_id, responsible_agent_id, name, code, type, property_status)
-- VALUES (gen_random_uuid(), auth.uid(), auth.uid(), 'tmp legacy house', 'TMP-H', 'house', 'pending');
