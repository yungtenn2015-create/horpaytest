-- ============================================================
-- Fix Add Tenant RPC (v2 - Comprehensive)
-- Run this in Supabase SQL Editor to fix add_tenant RPC error
-- ============================================================

-- 1. Ensure all columns exist in tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS car_registration TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS motorcycle_registration TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tenant_contract_id UUID REFERENCES public.tenant_contracts(id);

-- 2. Create/Update lease_contracts table structure
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

-- 3. Consolidated add_tenant function with 14 parameters
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
  -- PDPA-compliant encryption check (if function exists)
  IF p_id_card_number IS NOT NULL AND p_id_card_number != '' THEN
    BEGIN
      v_encrypted_id_card := encrypt_id_card(p_id_card_number);
    EXCEPTION WHEN OTHERS THEN
      -- Fallback if encrypt_id_card function doesn't exist
      v_encrypted_id_card := NULL;
    END;
  END IF;

  -- 1. Insert into tenants table
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

  -- 2. Create Lease Contract record
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

  -- 3. Mark room as occupied
  UPDATE rooms SET status = 'occupied' WHERE id = p_room_id;

  RETURN v_tenant_id;
END;
$$;
