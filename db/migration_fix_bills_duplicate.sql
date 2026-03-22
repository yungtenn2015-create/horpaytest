-- ============================================================
-- FIX: Duplicate Bill for Tenant Moving Room (Same Month)
-- ============================================================

-- เดิม: UNIQUE (tenant_id, billing_month) ห้าม 1 คนมี 2 บิลในเดือนเดียวกัน
-- ใหม่: UNIQUE (tenant_id, room_id, billing_month) ย้ายห้องแล้วมี 2 บิลแยกตามห้องได้

-- 1. ลบ Constraint เดิมทิ้ง (ชื่อ Key มาจาก PostgreSQL/Supabase อัตโนมัติ)
ALTER TABLE public.bills 
DROP CONSTRAINT IF EXISTS bills_tenant_id_billing_month_key;

-- 2. เพิ่ม Constraint ใหม่ที่รวม room_id เข้าไปด้วย 
-- เพื่อให้รองรับกรณีเช่าหลายห้องพร้อมกัน หรือย้ายห้องในเดือนเดียวกัน
ALTER TABLE public.bills 
ADD CONSTRAINT bills_tenant_id_room_id_billing_month_key UNIQUE (tenant_id, room_id, billing_month);

-- หมายเหตุ: วิธีรันคือคัดลอกโค้ดนี้ไปรันใน SQL Editor ของ Supabase Dashboard
