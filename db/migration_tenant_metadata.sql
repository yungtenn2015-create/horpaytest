-- ============================================================
-- Extension: Tenant Metadata (Detailed Vehicle & Emergency Contact)
-- ============================================================

-- 1. เพิ่ม Column ในตาราง tenants แบบแยกประเภทรถ
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS car_registration TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS motorcycle_registration TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- 2. เพิ่ม Comment เพื่ออธิบายการใช้งาน
COMMENT ON COLUMN public.tenants.car_registration IS 'เลขทะเบียนรถยนต์ของผู้เช่า';
COMMENT ON COLUMN public.tenants.motorcycle_registration IS 'เลขทะเบียนรถมอเตอร์ไซค์ของผู้เช่า';
COMMENT ON COLUMN public.tenants.emergency_contact IS 'ข้อมูลติดต่อกรณีฉุกเฉิน (ชื่อ-เบอร์โทร)';
