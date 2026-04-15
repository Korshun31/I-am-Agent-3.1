-- TD-025: Capture auto_set_property_company from live DB.
-- TD-052: Remove dead code — 'submitted' status is not in CHECK constraint
--         and JS always sets property_status before trigger fires.
-- Trigger only auto-sets company_id if not provided.

CREATE OR REPLACE FUNCTION public.auto_set_property_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Find company: first as owner, then as team member
  SELECT id INTO v_company_id
  FROM companies WHERE owner_id = auth.uid() AND status = 'active';

  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_company_id
    FROM company_members WHERE user_id = auth.uid() AND role = 'agent';
  END IF;

  -- Set company_id if not provided
  IF NEW.company_id IS NULL THEN
    NEW.company_id := v_company_id;
  END IF;

  -- Removed: dead code that set property_status = 'submitted'
  -- (status not in CHECK constraint, JS always sets status before trigger)

  RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_set_property_company'
  ) THEN
    CREATE TRIGGER trg_auto_set_property_company
      BEFORE INSERT ON properties
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_set_property_company();
  END IF;
END;
$$;
