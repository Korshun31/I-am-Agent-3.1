-- Migration: company_invitations — unique active invitation per (company, email)
-- Date: 2026-04-27
-- Description:
--   Prevents duplicate active invitations: a company cannot have two open
--   ('sent' or 'pending') invitations for the same email at the same time.
--   Final statuses (revoked / accepted / declined / expired-implicit) are
--   excluded from the constraint, so historical rows do not block new
--   invitations to the same email later.
--
--   Protects against double-click on the "Invite" button before our toast
--   appears, and against any race condition in the Edge Function.

CREATE UNIQUE INDEX IF NOT EXISTS company_invitations_active_email_uniq
ON public.company_invitations (company_id, lower(email))
WHERE status IN ('sent', 'pending');
