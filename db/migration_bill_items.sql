-- ============================================================
-- ADD: bill_items (snapshot line items for issued bills)
-- Purpose:
--   Keep issued receipts stable even if dorm_services changes later.
--   Store itemized "other/services" (and optionally more) per bill.
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste and run this file.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.bill_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bill_items_bill_id_idx ON public.bill_items(bill_id);

-- ถัดไป: รัน migration_bill_items_rls.sql (หลัง rls_policies.sql ที่มี is_dorm_owner)
-- เพื่อให้เจ้าของหอ insert รายการค่าบริการลง bill_items ได้จากแอป
