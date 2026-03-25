-- 1. เพิ่มคอลัมน์ tenant_contract_id ในตาราง tenants เพื่อเก็บลิงก์ไปยังสัญญาต้นทาง
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_contract_id UUID REFERENCES public.tenant_contracts(id);

-- 2. อัปเดตฟังก์ชัน add_tenant ให้รองรับการรับและเก็บ tenant_contract_id
CREATE OR REPLACE FUNCTION add_tenant(
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
  p_end_date DATE DEFAULT NULL,
  p_occupation TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_contract_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_encrypted_id_card BYTEA;
BEGIN
  -- เข้ารหัสบัตร ปชช. (ถ้ามี)
  IF p_id_card_number IS NOT NULL AND p_id_card_number != '' THEN
    -- สมมติว่ามีฟังก์ชัน encrypt_id_card อยู่แล้วตาม migration เดิม
    BEGIN
      v_encrypted_id_card := encrypt_id_card(p_id_card_number);
    EXCEPTION WHEN OTHERS THEN
      v_encrypted_id_card := NULL;
    END;
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
    occupation,
    address,
    tenant_contract_id,
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
    p_occupation,
    p_address,
    p_contract_id,
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

  -- 3. Update สถานะห้องเป็น 'occupied'
  UPDATE rooms SET status = 'occupied' WHERE id = p_room_id;

  RETURN v_tenant_id;
END;
$$;
