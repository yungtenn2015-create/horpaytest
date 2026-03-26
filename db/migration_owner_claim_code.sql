-- Owner Claim Code (LINE) - safer owner linking
-- Adds one-time-ish code with expiry for owner linking via LINE text: OWNER-123456

alter table public.line_oa_configs
  add column if not exists owner_claim_code text,
  add column if not exists owner_claim_expires_at timestamptz,
  add column if not exists owner_claim_used_at timestamptz;

create index if not exists line_oa_configs_owner_claim_code_idx
  on public.line_oa_configs (owner_claim_code);

