-- migration_v14_backfill_contracts.sql
-- Backfill tenant_contracts from existing tenants and lease_contracts

DO $$
DECLARE
    r RECORD;
    v_contract_id UUID;
    v_dorm_id UUID;
BEGIN
    -- Loop through all tenants that don't have a linked contract
    FOR r IN 
        SELECT t.*, lc.start_date, lc.end_date, lc.deposit_amount, rm.dorm_id
        FROM public.tenants t
        LEFT JOIN public.lease_contracts lc ON t.id = lc.tenant_id
        JOIN public.rooms rm ON t.room_id = rm.id
        WHERE t.tenant_contract_id IS NULL
    LOOP
        -- 1. Create a contract record
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
            r.dorm_id,
            r.name,
            r.phone,
            r.emergency_contact,
            r.occupation,
            r.car_registration,
            r.motorcycle_registration,
            r.address,
            COALESCE(r.start_date, r.created_at::date),
            COALESCE(r.end_date, (r.created_at + interval '1 year')::date),
            COALESCE(r.deposit_amount, 0),
            CASE 
                WHEN r.status = 'active' THEN 'moved_in'
                WHEN r.status = 'moved_out' THEN 'expired'
                ELSE 'cancelled'
            END
        )
        RETURNING id INTO v_contract_id;

        -- 2. Link the tenant to this new contract
        UPDATE public.tenants 
        SET tenant_contract_id = v_contract_id 
        WHERE id = r.id;

    END LOOP;
END $$;
