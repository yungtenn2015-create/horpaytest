-- ============================================================
-- Extension: Comprehensive Tenant Move-In (v2)
-- Updates add_tenant to handle lease contracts and new metadata
-- ============================================================

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
  -- 1. เข้ารหัสบัตร ปชช. (ถ้ามีส่งมา)
  IF p_id_card_number IS NOT NULL AND p_id_card_number != '' THEN
    v_encrypted_id_card := encrypt_id_card(p_id_card_number);
  END IF;

  -- 2. Insert ลงตาราง tenants
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

  -- 3. บันทึกสัญญาเช่า (Lease Contract)
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

  -- 4. Update สถานะห้องเป็น 'occupied' (มีผู้เช่าแล้ว)
  UPDATE rooms SET status = 'occupied' WHERE id = p_room_id;

  RETURN v_tenant_id;
END;
$$;
