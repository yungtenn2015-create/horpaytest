-- อัปเดต CHECK constraint สำหรับสถานะสัญญา
ALTER TABLE public.tenant_contracts 
DROP CONSTRAINT IF EXISTS tenant_contracts_status_check;

ALTER TABLE public.tenant_contracts 
ADD CONSTRAINT tenant_contracts_status_check 
CHECK (status IN ('pending', 'moved_in', 'cancelled', 'expired'));
