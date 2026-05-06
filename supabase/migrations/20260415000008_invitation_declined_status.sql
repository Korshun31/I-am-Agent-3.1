-- Add 'declined' status to company_invitations CHECK constraint.
-- Used when user declines invitation through registration modal (TD-040).

ALTER TABLE company_invitations DROP CONSTRAINT IF EXISTS company_invitations_status_check;
ALTER TABLE company_invitations ADD CONSTRAINT company_invitations_status_check
  CHECK (status IN ('sent', 'pending', 'accepted', 'revoked', 'declined'));
