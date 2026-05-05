-- Migration: contacts.type — restrict to canonical values
-- Date: 2026-05-05
-- TD-098: Поле contacts.type принимает любую строку. Должно принимать
-- только 'clients' или 'owners'.
--
-- Adds CHECK constraint at DB level. JS forms write only canonical values,
-- this is a defense-in-depth measure: any direct service-layer or REST call
-- bypassing forms with a non-canonical value will be rejected with
-- PostgreSQL error 23514 (check_violation).
--
-- Sandbox precheck before apply:
--   SELECT type, COUNT(*) FROM contacts
--   WHERE type NOT IN ('clients','owners') OR type IS NULL
--   GROUP BY type;
-- If non-zero rows — clean manually before applying.
--
-- Production (doosuanuttihcyxtkarf) — apply at final release after the
-- same precheck.

ALTER TABLE contacts
  ADD CONSTRAINT contacts_type_check CHECK (type IN ('clients', 'owners'));

COMMENT ON CONSTRAINT contacts_type_check ON contacts IS
  'TD-098: restrict contacts.type to clients/owners. JS forms write only these values, this is DB-level defense.';
