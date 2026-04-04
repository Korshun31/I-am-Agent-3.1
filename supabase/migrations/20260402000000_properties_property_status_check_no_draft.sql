-- Remove unused 'draft' from properties.property_status CHECK.
-- Row-level moderation uses pending / approved / rejected only.
-- Edit drafts for property changes live in property_drafts, not in property_status.

ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_property_status_check;

ALTER TABLE public.properties ADD CONSTRAINT properties_property_status_check
  CHECK (property_status IN ('pending', 'approved', 'rejected'));
