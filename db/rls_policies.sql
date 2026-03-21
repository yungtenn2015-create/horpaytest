-- ============================================================
-- RLS Policies — SaaS Dormitory Management System
-- Version 3 — แก้ไขปัญหาจาก review รอบ 2:
--   [v2-FIX 1] storage policy ชื่อชนกับ maintenance table policy → เปลี่ยนชื่อ bucket policies
--   [v2-FIX 2] dorm_settings ขาด DELETE policy
--   [v2-FIX 3] payments ผู้เช่าควร UPDATE/DELETE ไม่ได้
--   [v2-FIX 4] เปลี่ยน IN subquery → EXISTS (เร็วกว่า)
--   [v2-FIX 5] เพิ่ม comment intentional read-only สำหรับ lease_contracts / bills
--   [v3-FIX 1] dorms: เพิ่ม AND deleted_at IS NULL ใน USING และ WITH CHECK
--   [v3-FIX 2] rooms: เพิ่ม AND deleted_at IS NULL ใน USING และ WITH CHECK
--   [v3-FIX 3] tenants: เพิ่ม AND deleted_at IS NULL ใน USING
--   [v3-FIX 4] audit_logs: เปิด RLS
-- Run ไฟล์นี้ใน Supabase SQL Editor หลังจาก migration.sql
-- ============================================================

-- ============================================================
-- STEP 1: Helper Function
-- ใช้เช็คว่า user ที่ login อยู่ตอนนี้เป็นเจ้าของ dorm นั้นไหม
-- เรียกใช้ใน RLS policy แทนการ JOIN ซ้ำทุก table
-- ============================================================
CREATE OR REPLACE FUNCTION is_dorm_owner(p_dorm_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER  -- รันด้วยสิทธิ์ของ function owner ไม่ใช่ user ที่เรียก (ป้องกัน bypass)
STABLE            -- ผลลัพธ์เดิมถ้า input เดิมใน transaction เดียว (ช่วย performance)
SET search_path = public, pg_temp  -- ป้องกัน search_path injection warning ใน Supabase
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dorms
    WHERE id = p_dorm_id
      AND owner_id = auth.uid()  -- auth.uid() คือ UUID ของ user ที่ login อยู่
  );
$$;

-- ============================================================
-- STEP 2: เปิด RLS ทุก table
-- default ของ Supabase คือปิด = ทุกคนเห็นทุกอย่าง
-- ต้องเปิดก่อนถึงจะใส่ policy ได้
-- ============================================================
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dorms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dorm_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE utilities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: Policy แต่ละ table
-- หลักการ RLS ของ Supabase:
--   • default คือ DENY ทั้งหมด — ถ้าไม่มี policy ที่ match จะเข้าไม่ได้เลย
--   • USING      = เงื่อนไขการ SELECT / UPDATE / DELETE (อ่านหรือหาแถวได้)
--   • WITH CHECK = เงื่อนไขการ INSERT / UPDATE (เขียนข้อมูลได้)
--   • policy หลายอันบน operation เดียวกัน = OR กัน (ผ่านอันใดอันหนึ่งก็ได้)
-- ============================================================

-- ------------------------------------------------------------
-- TABLE: users
-- ตัวเองแก้ข้อมูลตัวเองได้ / เจ้าของหอดูข้อมูลผู้เช่าในหอตัวเองได้
-- ไม่มี INSERT policy เพราะ handle_new_user() trigger สร้างให้อัตโนมัติ
-- ไม่มี DELETE policy เพราะลบ user ต้องทำผ่าน Supabase Auth เท่านั้น
--
-- [ข้อ 4 — Intentional Design] owner ไม่มีสิทธิ์แก้ข้อมูลใน users ของ tenant
-- เหตุผล: users.name / users.phone เป็นข้อมูลของ account ตัวเอง ไม่ใช่ของ owner
--         ข้อมูลผู้เช่า (ชื่อ, เบอร์) ที่ owner จัดการได้ อยู่ใน tenants table แทน
--         tenants: เจ้าของจัดการได้ → owner UPDATE tenants ได้อยู่แล้ว
-- ------------------------------------------------------------
CREATE POLICY "users: ดูได้แค่ตัวเอง"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users: แก้ได้แค่ตัวเอง"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- [FIX 4] เปลี่ยนจาก IN subquery → EXISTS เพื่อ performance ดีกว่า
-- เหตุผล: IN โหลด result set ทั้งหมดก่อนเปรียบเทียบ
--         EXISTS หยุดทันทีเมื่อเจอแถวแรกที่ match
CREATE POLICY "users: เจ้าของหอเห็นผู้เช่าในหอตัวเองได้"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      JOIN rooms r ON r.id = t.room_id
      WHERE t.user_id = users.id          -- อ้าง users.id แทน id เพื่อความชัดเจน
        AND t.user_id IS NOT NULL         -- กัน null เพราะ user_id ใน tenants เป็น optional
        AND is_dorm_owner(r.dorm_id)
    )
  );

-- ------------------------------------------------------------
-- TABLE: dorms
-- เจ้าของหอเห็นและแก้ได้แค่หอตัวเอง
-- ผู้เช่าไม่เห็น dorms โดยตรง (เข้าถึงผ่าน rooms แทน)
-- ------------------------------------------------------------
-- [v3-FIX 1] เพิ่ม deleted_at IS NULL ทุก policy ของ dorms
-- เหตุผล: ถ้าไม่กรอง เจ้าของหอจะยังเห็น/แก้หอที่ soft delete ไปแล้วได้
CREATE POLICY "dorms: เจ้าของเห็นได้"
  ON dorms FOR SELECT
  USING (owner_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "dorms: เจ้าของสร้างได้"
  ON dorms FOR INSERT
  WITH CHECK (owner_id = auth.uid());
  -- INSERT ไม่ต้องกรอง deleted_at เพราะหอใหม่จะมี deleted_at = NULL เสมอ

CREATE POLICY "dorms: เจ้าของแก้ได้"
  ON dorms FOR UPDATE
  USING (owner_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (owner_id = auth.uid() AND deleted_at IS NULL);
  -- WITH CHECK กัน undelete ด้วย (ป้องกันการเซต deleted_at กลับเป็น NULL ผ่าน UPDATE)

CREATE POLICY "dorms: เจ้าของลบได้"
  ON dorms FOR DELETE
  USING (owner_id = auth.uid() AND deleted_at IS NULL);
  -- soft delete = UPDATE deleted_at = now() ผ่าน policy "แก้ได้" ด้านบน

-- ------------------------------------------------------------
-- TABLE: dorm_settings
-- เข้าถึงได้ถ้าเป็นเจ้าของ dorm นั้น
-- [FIX 2] เพิ่ม DELETE policy — เดิมขาดไป เจ้าของหอลบ settings ตรงๆ ไม่ได้
-- (แม้ migration จะมี ON DELETE CASCADE จาก dorms แต่ถ้าลบ settings อย่างเดียวจะถูก block)
-- ------------------------------------------------------------
CREATE POLICY "dorm_settings: เจ้าของเห็นได้"
  ON dorm_settings FOR SELECT
  USING (is_dorm_owner(dorm_id));

CREATE POLICY "dorm_settings: เจ้าของสร้างได้"
  ON dorm_settings FOR INSERT
  WITH CHECK (is_dorm_owner(dorm_id));

CREATE POLICY "dorm_settings: เจ้าของแก้ได้"
  ON dorm_settings FOR UPDATE
  USING (is_dorm_owner(dorm_id))
  WITH CHECK (is_dorm_owner(dorm_id));

-- [FIX 2] policy ใหม่ที่เพิ่มเข้ามา
CREATE POLICY "dorm_settings: เจ้าของลบได้"
  ON dorm_settings FOR DELETE
  USING (is_dorm_owner(dorm_id));

-- ------------------------------------------------------------
-- TABLE: rooms
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าเห็นได้แค่ห้องตัวเอง
-- ------------------------------------------------------------
-- [v3-FIX 2] เพิ่ม deleted_at IS NULL ใน rooms policies
-- เหตุผล: ห้องที่ถูก soft delete ไม่ควรมองเห็นหรือแก้ได้
CREATE POLICY "rooms: เจ้าของจัดการได้"
  ON rooms FOR ALL
  USING (is_dorm_owner(dorm_id) AND deleted_at IS NULL)
  WITH CHECK (is_dorm_owner(dorm_id) AND deleted_at IS NULL);
  -- WITH CHECK ป้องกัน INSERT ห้องใหม่ที่มี deleted_at ติดมา และกัน undelete ผ่าน UPDATE

CREATE POLICY "rooms: ผู้เช่าเห็นห้องตัวเอง"
  ON rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE room_id = rooms.id
        AND user_id = auth.uid()
        AND status = 'active'
    )
    AND deleted_at IS NULL  -- ผู้เช่าไม่ควรเห็นห้องที่ถูกลบ
  );

-- ------------------------------------------------------------
-- TABLE: tenants
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าเห็นข้อมูลตัวเอง (อ่านอย่างเดียว)
-- ผู้เช่าแก้ข้อมูลตัวเองไม่ได้ — ต้องให้เจ้าของหอแก้ให้เท่านั้น
-- ------------------------------------------------------------
-- [v3-FIX 3] เพิ่ม deleted_at IS NULL ใน tenants policies
-- เหตุผล: ผู้เช่าที่ soft delete แล้วไม่ควรปรากฏใน query ปกติ
CREATE POLICY "tenants: เจ้าของจัดการได้"
  ON tenants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = tenants.room_id
        AND is_dorm_owner(r.dorm_id)
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = tenants.room_id
        AND is_dorm_owner(r.dorm_id)
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "tenants: ผู้เช่าเห็นตัวเอง"
  ON tenants FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);
  -- ผู้เช่าที่ deleted ไม่ควรเห็น record ของตัวเองอีกต่อไป

-- ------------------------------------------------------------
-- TABLE: lease_contracts
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าอ่านสัญญาตัวเองได้อย่างเดียว
-- intentional: ผู้เช่าแก้/ลบสัญญาไม่ได้ — เจ้าของหอเท่านั้นที่ทำได้
-- ------------------------------------------------------------
CREATE POLICY "lease_contracts: เจ้าของจัดการได้"
  ON lease_contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = lease_contracts.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = lease_contracts.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  );

CREATE POLICY "lease_contracts: ผู้เช่าเห็นตัวเอง"
  ON lease_contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE id = lease_contracts.tenant_id
        AND user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- TABLE: utilities
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าเห็นมิเตอร์ห้องตัวเองได้
-- intentional: ผู้เช่าแก้ค่ามิเตอร์ไม่ได้ — เจ้าของหอจดให้เท่านั้น
-- ------------------------------------------------------------
CREATE POLICY "utilities: เจ้าของจัดการได้"
  ON utilities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = utilities.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = utilities.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  );

CREATE POLICY "utilities: ผู้เช่าเห็นห้องตัวเอง"
  ON utilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE room_id = utilities.room_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ------------------------------------------------------------
-- TABLE: bills
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าเห็นบิลตัวเองได้
-- intentional: ผู้เช่าแก้/ลบบิลไม่ได้ — เจ้าของหอสร้างบิลให้เท่านั้น
-- ------------------------------------------------------------
CREATE POLICY "bills: เจ้าของจัดการได้"
  ON bills FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = bills.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = bills.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  );

CREATE POLICY "bills: ผู้เช่าเห็นบิลตัวเอง"
  ON bills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE id = bills.tenant_id
        AND user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- TABLE: payments
-- เจ้าของหอจัดการได้ทุก operation (รวมถึงอนุมัติ/ปฏิเสธสลิป)
-- ผู้เช่า INSERT ได้อย่างเดียว (ส่งสลิป) — แก้/ลบไม่ได้หลัง submit
-- [FIX 3] แยก policy ให้ชัดเจน: ผู้เช่าทำได้แค่ INSERT + SELECT เท่านั้น
-- ------------------------------------------------------------
CREATE POLICY "payments: เจ้าของจัดการได้"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN rooms r ON r.id = b.room_id
      WHERE b.id = payments.bill_id
        AND is_dorm_owner(r.dorm_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN rooms r ON r.id = b.room_id
      WHERE b.id = payments.bill_id
        AND is_dorm_owner(r.dorm_id)
    )
  );

-- ผู้เช่าส่งสลิปได้ — INSERT อย่างเดียว ห้าม UPDATE/DELETE หลัง submit
-- status จะถูกเจ้าของหอเปลี่ยนเท่านั้น (approved/rejected)
CREATE POLICY "payments: ผู้เช่าส่งสลิปได้"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.id = payments.bill_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "payments: ผู้เช่าเห็นประวัติตัวเอง"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE b.id = payments.bill_id
        AND t.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- TABLE: maintenance
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าแจ้งซ่อมและดูสถานะตัวเองได้
-- ------------------------------------------------------------
CREATE POLICY "maintenance: เจ้าของจัดการได้"
  ON maintenance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = maintenance.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = maintenance.room_id
        AND is_dorm_owner(r.dorm_id)
    )
  );

-- ผู้เช่าแจ้งซ่อมได้ — INSERT อย่างเดียว
-- เหตุผล: ผู้เช่าไม่ควรแก้/ลบคำร้องหลังแจ้งแล้ว เพื่อ audit trail
CREATE POLICY "maintenance: ผู้เช่าแจ้งซ่อมได้"
  ON maintenance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE id = maintenance.tenant_id
        AND user_id = auth.uid()
        AND status = 'active'             -- กัน tenant ที่ย้ายออกแล้วแจ้งซ่อม
    )
  );

CREATE POLICY "maintenance: ผู้เช่าติดตามรายการตัวเอง"
  ON maintenance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE id = maintenance.tenant_id
        AND user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- TABLE: announcements
-- เจ้าของหอจัดการได้ทุก operation / ผู้เช่าเห็นประกาศของหอตัวเอง
-- ------------------------------------------------------------
CREATE POLICY "announcements: เจ้าของจัดการได้"
  ON announcements FOR ALL
  USING (is_dorm_owner(dorm_id))
  WITH CHECK (is_dorm_owner(dorm_id));

CREATE POLICY "announcements: ผู้เช่าเห็นประกาศหอตัวเอง"
  ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenants t
      JOIN rooms r ON r.id = t.room_id
      WHERE r.dorm_id = announcements.dorm_id
        AND t.user_id = auth.uid()
        AND t.status = 'active'
    )
  );

-- ============================================================
-- TABLE: audit_logs RLS
-- ============================================================
-- [v3-FIX 4] เปิด RLS สำหรับ audit_logs
-- เจ้าของหอดูได้เฉพาะ log ที่เกี่ยวกับหอตัวเอง
-- ผู้เช่าดูได้เฉพาะ log ของตัวเอง (payments/bills ตัวเอง)
-- ไม่มี INSERT/UPDATE/DELETE policy — เขียนได้เฉพาะผ่าน trigger (SECURITY DEFINER)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: เจ้าของหอดูได้"
  ON audit_logs FOR SELECT
  USING (
    -- เห็น log ของ payments ที่เกี่ยวกับบิลในหอตัวเอง
    (table_name = 'payments' AND record_id IN (
      SELECT p.id FROM payments p
      JOIN bills b ON b.id = p.bill_id
      JOIN rooms r ON r.id = b.room_id
      WHERE is_dorm_owner(r.dorm_id)
    ))
    OR
    -- เห็น log ของ bills ในหอตัวเอง
    (table_name = 'bills' AND record_id IN (
      SELECT b.id FROM bills b
      JOIN rooms r ON r.id = b.room_id
      WHERE is_dorm_owner(r.dorm_id)
    ))
  );

CREATE POLICY "audit_logs: ผู้เช่าดูได้"
  ON audit_logs FOR SELECT
  USING (
    (table_name = 'payments' AND record_id IN (
      SELECT p.id FROM payments p
      JOIN bills b ON b.id = p.bill_id
      JOIN tenants t ON t.id = b.tenant_id
      WHERE t.user_id = auth.uid()
    ))
    OR
    (table_name = 'bills' AND record_id IN (
      SELECT b.id FROM bills b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE t.user_id = auth.uid()
    ))
  );


-- ============================================================
-- TABLE: upgrade_requests RLS
-- ============================================================
ALTER TABLE upgrade_requests ENABLE ROW LEVEL SECURITY;

-- เจ้าของหอดูและสร้าง request ของตัวเองได้
CREATE POLICY "upgrade_requests: ดูของตัวเองได้"
  ON upgrade_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "upgrade_requests: สร้างได้เฉพาะตัวเอง"
  ON upgrade_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- แก้ไขไม่ได้ — เราจัดการผ่าน service_role เท่านั้น
-- (ป้องกันเจ้าของหอแก้ status เป็น approved เอง)

-- ============================================================
-- STORAGE Policies
-- กำหนดสิทธิ์การเข้าถึงไฟล์ใน Supabase Storage
-- bucket ที่ใช้: "slips" (สลิป), "contracts" (สัญญาเช่า), "maintenance-images" (รูปแจ้งซ่อม)
--
-- [FIX 1] เปลี่ยนชื่อ bucket maintenance → "maintenance-images"
-- เหตุผล: policy ใน storage.objects ทุก bucket อยู่ใน table เดียวกัน
--         ชื่อ policy ต้องไม่ซ้ำกันในระดับ table
--         "maintenance: ..." ชนกับ policy ของ maintenance table ด้านบน → error
--
-- ⚠️  จำเป็นต้องสร้าง bucket ใน Supabase Storage ให้ตรงชื่อ:
--     Dashboard → Storage → New Bucket
--     ชื่อ: "slips", "contracts", "maintenance-images"  (ทั้งหมด private)
--
-- [FIX 3] ทุก policy ที่ใช้ storage.foldername(name)[N] มีการ guard ก่อนแล้วด้วย
--     array_length(storage.foldername(name), 1) >= N
-- เหตุผล: ถ้า path ผิดหรือ upload ไว้ที่ root โดยไม่มี subfolder
--     foldername()[N] จะคืน NULL → condition เป็น FALSE → เข้าไฟล์ไม่ได้แม้เป็นเจ้าของจริง
-- ป้องกัน: ทุก upload ต้องใช้ path ตามโครงสร้างที่กำหนดเสมอ (ดู dev_notes.md ข้อ 14)
-- ============================================================

-- ------------------------------------------------------------
-- bucket: slips (สลิปโอนเงิน)
-- path structure: slips/{dorm_id}/{bill_id}/{filename}
-- index array:               [1]        [2]
-- ผู้เช่าอัปโหลดและดูได้แค่สลิปของ bill ตัวเอง
-- เจ้าของหอดูและลบได้เฉพาะสลิปในหอตัวเอง
-- ------------------------------------------------------------
CREATE POLICY "slips: ผู้เช่าอัปโหลดสลิปตัวเองได้"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'slips'
    AND EXISTS (
      SELECT 1 FROM bills b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE array_length(storage.foldername(name), 1) >= 2  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND b.id::text = (storage.foldername(name))[2]       -- [2] = bill_id ใน path
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "slips: ผู้เช่าดูสลิปตัวเองได้"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'slips'
    AND EXISTS (
      SELECT 1 FROM bills b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE array_length(storage.foldername(name), 1) >= 2  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND b.id::text = (storage.foldername(name))[2]       -- [2] = bill_id ใน path
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "slips: เจ้าของหอดูสลิปในหอตัวเองได้"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'slips'
    AND EXISTS (
      SELECT 1 FROM dorms
      WHERE array_length(storage.foldername(name), 1) >= 1  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND id::text = (storage.foldername(name))[1]          -- [1] = dorm_id ใน path
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY "slips: เจ้าของหอลบสลิปในหอตัวเองได้"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'slips'
    AND EXISTS (
      SELECT 1 FROM dorms
      WHERE array_length(storage.foldername(name), 1) >= 1  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND id::text = (storage.foldername(name))[1]          -- [1] = dorm_id ใน path
        AND owner_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- bucket: contracts (ไฟล์ PDF สัญญาเช่า)
-- path structure: contracts/{dorm_id}/{tenant_id}/{filename}
-- index array:                  [1]         [2]
-- ผู้เช่าดูได้แค่สัญญาตัวเอง / เจ้าของหออัปโหลดและจัดการได้
-- ------------------------------------------------------------
CREATE POLICY "contracts: เจ้าของหอจัดการไฟล์สัญญาได้"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM dorms
      WHERE array_length(storage.foldername(name), 1) >= 1  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND id::text = (storage.foldername(name))[1]          -- [1] = dorm_id ใน path
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM dorms
      WHERE array_length(storage.foldername(name), 1) >= 1  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND id::text = (storage.foldername(name))[1]          -- [1] = dorm_id ใน path
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY "contracts: ผู้เช่าดูสัญญาตัวเองได้"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM tenants
      WHERE array_length(storage.foldername(name), 1) >= 2  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND id::text = (storage.foldername(name))[2]          -- [2] = tenant_id ใน path
        AND user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- bucket: maintenance-images (รูปภาพแจ้งซ่อม)
-- path structure: maintenance-images/{dorm_id}/{room_id}/{filename}
-- index array:                            [1]       [2]
-- ผู้เช่าอัปโหลดได้แค่ห้องตัวเอง (active เท่านั้น) / เจ้าของหอดูได้ทุกห้องในหอ
--
-- [FIX 1] เปลี่ยนชื่อ bucket จาก "maintenance" → "maintenance-images"
--         และเปลี่ยนชื่อ policy ให้ไม่ชนกับ maintenance table policies
-- ------------------------------------------------------------
CREATE POLICY "maintenance-images: ผู้เช่าอัปโหลดรูปห้องตัวเองได้"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-images'
    AND EXISTS (
      SELECT 1 FROM tenants
      WHERE array_length(storage.foldername(name), 1) >= 2  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND room_id::text = (storage.foldername(name))[2]     -- [2] = room_id ใน path
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "maintenance-images: เจ้าของหอดูรูปในหอตัวเองได้"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'maintenance-images'
    AND EXISTS (
      SELECT 1 FROM dorms
      WHERE array_length(storage.foldername(name), 1) >= 1  -- [FIX 3] guard: ป้องกัน path สั้นกว่าที่คาด
          AND id::text = (storage.foldername(name))[1]          -- [1] = dorm_id ใน path
        AND owner_id = auth.uid()
    )
  );
