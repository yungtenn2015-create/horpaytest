-- migration_v15_auto_create_contract_rpc.sql
-- Update add_tenant to automatically create a contract record if not provided

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
  v_dorm_id UUID;
  v_final_contract_id UUID := p_contract_id;
BEGIN
  -- 0. Get Dorm ID from Room
  SELECT dorm_id INTO v_dorm_id FROM public.rooms WHERE id = p_room_id;

  -- 1. Auto-create or Update Contract Record
  IF v_final_contract_id IS NULL THEN
    INSERT INTO public.tenant_contracts (
      dorm_id,
      name,
      phone,
      emergency_contact,
      occupation,
      car_registration,
      motorcycle_registration,
      address,
      start_date,
      end_date,
      deposit_amount,
      status
    )
    VALUES (
      v_dorm_id,
      p_name,
      p_phone,
      p_emergency_contact,
      p_occupation,
      p_car_registration,
      p_motorcycle_registration,
      p_address,
      p_start_date,
      p_end_date,
      p_deposit_amount,
      'moved_in'
    )
    RETURNING id INTO v_final_contract_id;
  ELSE
    -- If contract exists, ensure it is set to 'moved_in'
    UPDATE public.tenant_contracts 
    SET status = 'moved_in' 
    WHERE id = v_final_contract_id;
  END IF;

  -- 2. Encrypt ID Card (if provided)
  IF p_id_card_number IS NOT NULL AND p_id_card_number != '' THEN
    BEGIN
      v_encrypted_id_card := encrypt_id_card(p_id_card_number);
    EXCEPTION WHEN OTHERS THEN
      v_encrypted_id_card := NULL;
    END;
  END IF;

  -- 3. Insert into tenants
  INSERT INTO public.tenants (
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
    v_final_contract_id,
    'active'
  )
  RETURNING id INTO v_tenant_id;

  -- 4. Record Lease Contract (Operational record)
  INSERT INTO public.lease_contracts (
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

  -- 5. Update Room status
  UPDATE public.rooms SET status = 'occupied' WHERE id = p_room_id;

  RETURN v_tenant_id;
END;
$$;
