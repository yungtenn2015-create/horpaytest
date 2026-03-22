-- ============================================================
-- Consolidate Move-In Migration (v3 - Complete)
-- Run this in Supabase SQL Editor to fix add_tenant RPC error
-- ============================================================

-- 1. เพิ่ม Column ในตาราง tenants (ถ้ายังไม่มี)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS car_registration TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS motorcycle_registration TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- 2. สร้างตาราง lease_contracts (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS public.lease_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.rooms(id),
    start_date DATE NOT NULL,
    end_date DATE,
    rent_price NUMERIC NOT NULL DEFAULT 0,
    deposit_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. อัปเดตฟังก์ชัน add_tenant ให้รองรับข้อมูลใหม่ครบถ้วน
--    ฟังก์ชันนี้จะบันทึกข้อมูลผู้เช่าและสัญญาเช่าพร้อมกันแบบ Atomic
CREATE OR REPLACE FUNCTION public.add_tenant(
  p_room_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_id_card_number TEXT,
  p_car_registration TEXT DEFAULT NULL,
  p_motorcycle_registration TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_rent_price NUMERIC DEFAULT 0,
  p_deposit_amount NUMERIC DEFAULT 0,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encrypted_id_card BYTEA;
  v_tenant_id UUID;
BEGIN
  -- เข้ารหัสบัตร ปชช. (ถ้ามีส่งมา)
  IF p_id_card_number IS NOT NULL AND p_id_card_number != '' THEN
    v_encrypted_id_card := encrypt_id_card(p_id_card_number);
  END IF;

  -- 1. Insert ลงตาราง tenants
  INSERT INTO tenants (
    room_id, 
    name, 
    phone, 
    id_card_number, 
    car_registration, 
    motorcycle_registration, 
    emergency_contact, 
    status
  )
  VALUES (
    p_room_id, 
    p_name, 
    p_phone, 
    v_encrypted_id_card, 
    p_car_registration, 
    p_motorcycle_registration, 
    p_emergency_contact, 
    'active'
  )
  RETURNING id INTO v_tenant_id;

  -- 2. บันทึกสัญญาเช่า (Lease Contract)
  INSERT INTO lease_contracts (
    tenant_id, 
    room_id, 
    start_date, 
    end_date, 
    rent_price, 
    deposit_amount, 
    status
  )
  VALUES (
    v_tenant_id, 
    p_room_id, 
    p_start_date, 
    p_end_date, 
    p_rent_price, 
    p_deposit_amount, 
    'active'
  );

  -- 3. Update สถานะห้องเป็น 'occupied' (มีผู้เช่าแล้ว)
  UPDATE rooms SET status = 'occupied' WHERE id = p_room_id;

  RETURN v_tenant_id;
END;
$$;
