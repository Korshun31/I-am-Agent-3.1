-- Migration: contacts.name — forbid empty / whitespace-only names
-- Date: 2026-04-27
-- TD-101: Имя контакта может быть пустой строкой (NOT NULL но дефолт '').
--
-- Adds CHECK constraint at DB level. JS forms (AddContactModal mobile,
-- WebContactEditPanel web) already validate name.trim() !== '' before
-- calling createContact / updateContact, so this is a defense-in-depth
-- measure: any direct service-layer or REST call bypassing forms with an
-- empty / whitespace-only name will be rejected with PostgreSQL error
-- 23514 (check_violation).
--
-- Sandbox precheck (2026-04-27): SELECT * FROM contacts WHERE
-- trim(coalesce(name,'')) = '' returned 0 rows — safe to apply.
-- Production (doosuanuttihcyxtkarf) — apply at final release after the
-- same precheck.

ALTER TABLE contacts
  ADD CONSTRAINT contacts_name_not_blank CHECK (trim(name) <> '');

COMMENT ON CONSTRAINT contacts_name_not_blank ON contacts IS
  'TD-101: forbid empty / whitespace-only contact names. JS forms also validate, this is DB-level defense.';
