-- AcadFormat V2 — Preservation Snapshot Migration
-- Adds the preservation_snapshot JSONB column to the documents table.
-- This stores an immutable fingerprint of the original uploaded document
-- that the Integrity Validator uses to detect content loss before delivery.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS preservation_snapshot JSONB DEFAULT NULL;

COMMENT ON COLUMN documents.preservation_snapshot IS
  'Immutable snapshot of the original uploaded document captured at analysis time. '
  'Used by the integrity validator to detect content loss during formatting. '
  'Fields: paragraphCount, wordCount, tableCount, headingCount, imageCount, charCount, fingerprint.';
