-- ============================================================
-- bill_items: Row Level Security (run after migration_bill_items.sql + rls_policies helpers)
-- Fixes: owner cannot INSERT snapshot rows → "violates row-level security policy"
--
-- Run in Supabase → SQL Editor (idempotent)
-- ============================================================

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bill_items: เจ้าของจัดการได้" ON public.bill_items;
DROP POLICY IF EXISTS "bill_items: ผู้เช่าเห็นรายการของบิลตัวเอง" ON public.bill_items;

-- Owner: full access when bill belongs to their dorm (requires is_dorm_owner() from rls_policies.sql)
CREATE POLICY "bill_items: เจ้าของจัดการได้"
  ON public.bill_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      JOIN public.rooms r ON r.id = b.room_id
      WHERE b.id = bill_items.bill_id
        AND is_dorm_owner(r.dorm_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bills b
      JOIN public.rooms r ON r.id = b.room_id
      WHERE b.id = bill_items.bill_id
        AND is_dorm_owner(r.dorm_id)
    )
  );

-- Tenant: read lines for their own bills only
CREATE POLICY "bill_items: ผู้เช่าเห็นรายการของบิลตัวเอง"
  ON public.bill_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      JOIN public.tenants t ON t.id = b.tenant_id
      WHERE b.id = bill_items.bill_id
        AND t.user_id = auth.uid()
    )
  );
