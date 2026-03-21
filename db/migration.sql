-- ============================================================
-- SaaS Dormitory Management System
-- Migration Script (PostgreSQL)
-- Version 5 — แก้ไขปัญหาจาก review รอบ 2:
--   [v4-FIX 1] id_card_number: เปลี่ยนเป็น BYTEA + encrypt ผ่าน Supabase Vault
--   [v4-FIX 2] billing_month: เพิ่ม NOT NULL ให้ UNIQUE ทำงานจริง
--   [v4-FIX 3] handle_new_user: เปลี่ยน default role เป็น 'tenant'
--   [v4-FIX 4] check_payment_total: เพิ่ม FOR UPDATE ป้องกัน race condition
--   [v4-FIX 5] เพิ่ม index บน tenants.user_id
--   [v5-FIX 1] announcements.target_audience: TEXT → JSONB array
--   [v5-FIX 2] เพิ่ม UNIQUE INDEX กัน active tenant ซ้ำห้อง
--   [v5-FIX 3] trigger ป้องกัน overpay ตอน approve payment
--   [v5-FIX 4] trigger ล็อกยอดเงินบิลหลังสร้าง (ห้ามแก้ amount)
--   [v5-FIX 5] เพิ่ม index ที่ขาด (bills.room_id, payments pending, tenants active)
--   [v5-FIX 6] trigger ตรวจ plan limit (free=1 หอ/20 ห้อง)
--   [v5-FIX 7] trigger คำนวณ utilities อัตโนมัติ (unit + price)
--   [v5-FIX 8] table audit_logs + trigger บันทึก payment และ bill events
--   [v6-FIX 1] bills.tenant_id: CASCADE → RESTRICT (ห้ามลบบิลเมื่อลบ tenant)
--   [v6-FIX 2] check_plan_limit: เพิ่ม BEFORE UPDATE กัน ย้ายห้องข้ามหอเกิน limit
--   [v7-FIX 1] เปลี่ยน plan limit จากจำนวนหอ/ห้อง → trial 60 วัน
--   [v7-FIX 2] เพิ่ม subscription_plan ใน users (monthly/yearly)
--   [v7-FIX 3] เพิ่ม table upgrade_requests (workflow อัปเกรด manual)
--              free + trial ยังไม่หมด = ใช้งานได้เต็มที่ไม่จำกัด
--              free + trial หมดแล้ว  = read-only (INSERT/UPDATE ไม่ได้)
--              pro                   = ไม่จำกัด
-- ============================================================

-- ============================================================
-- ⚠️  SUPABASE ONLY — ห้ามรันในฐานข้อมูล PostgreSQL ทั่วไป
-- ============================================================
-- Script นี้ใช้ Schema และฟังก์ชันที่มีเฉพาะใน Supabase Platform:
--   • auth.users, auth.uid()       → Supabase Auth (ไม่มีใน vanilla PostgreSQL)
--   • vault.decrypted_secrets      → Supabase Vault (ไม่มีใน vanilla PostgreSQL)
--   • storage.foldername()         → Supabase Storage (ไม่มีใน vanilla PostgreSQL)
--
-- วิธีรันที่ถูกต้อง: Supabase Dashboard → SQL Editor → วางโค้ด → Run
-- ============================================================

-- เปิดใช้งาน extension สำหรับสร้าง UUID และ encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- ใช้ gen_random_uuid() และ pgp_sym_encrypt/decrypt
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- ใช้สำหรับ EXCLUDE USING gist ใน migration_line_notification.sql
                                             -- (กัน active token ซ้ำห้อง) ต้องเปิดก่อนรันไฟล์นั้น

-- ============================================================
-- TABLE: users
-- เก็บข้อมูลผู้ใช้งานทั้งหมดในระบบ ทั้งเจ้าของหอและผู้เช่า
-- ============================================================
CREATE TABLE users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสผู้ใช้ สร้างอัตโนมัติแบบ UUID
  email       TEXT        NOT NULL UNIQUE,                       -- อีเมลสำหรับ login ต้องไม่ซ้ำกัน
  name        TEXT        NOT NULL DEFAULT '',                   -- ชื่อ-นามสกุล ใช้แสดง owner / คนตรวจสลิป
  phone       TEXT,                                             -- เบอร์โทรติดต่อ
  role        TEXT        NOT NULL CHECK (role IN ('owner', 'tenant', 'admin')), -- บทบาท: เจ้าของหอ / ผู้เช่า / แอดมิน
  plan_type           TEXT        NOT NULL DEFAULT 'free'
                        CHECK (plan_type IN ('free', 'pro')),        -- แผน: free / pro
  subscription_plan   TEXT
                        CHECK (subscription_plan IN ('monthly', 'yearly')),
                        -- แผนที่เลือกตอนอัปเกรด: รายเดือน / รายปี
                        -- null = ยังไม่ได้อัปเกรด
  trial_expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '60 days',
                        -- free: หมดแล้ว → read-only จนกว่าจะอัปเกรด
                                                                              -- free + ยังไม่หมด = ใช้ได้เต็ม
                                                                              -- free + หมดแล้ว  = read-only
                                                                              -- pro             = ไม่จำกัด
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()                        -- วันเวลาที่สมัครสมาชิก
);

-- ============================================================
-- TABLE: dorms
-- เก็บข้อมูลหอพักแต่ละแห่ง (เจ้าของหอ 1 คนมีได้หลายหอ)
-- ============================================================
CREATE TABLE dorms (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสหอพัก
  owner_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- เจ้าของหอ ถ้าลบ user จะลบหอด้วย
  name           TEXT        NOT NULL,                             -- ชื่อหอพัก
  address        TEXT        NOT NULL,                             -- ที่อยู่หอพัก
  contact_number TEXT,                                            -- เบอร์โทรติดต่อหอพัก
  deleted_at     TIMESTAMPTZ,                                      -- soft delete — null = ยังใช้งานอยู่
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()               -- วันที่เพิ่มหอพักในระบบ
);

-- ============================================================
-- TABLE: dorm_settings
-- เก็บการตั้งค่าของหอพักแต่ละแห่ง (one-to-one กับ dorms)
-- ============================================================
CREATE TABLE dorm_settings (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัส settings
  dorm_id                UUID    NOT NULL UNIQUE REFERENCES dorms(id) ON DELETE CASCADE, -- เชื่อมกับหอพัก (unique = one-to-one)
  water_rate_per_unit    NUMERIC(10,2) NOT NULL DEFAULT 0,            -- ราคาค่าน้ำต่อหน่วย (บาท)
  water_billing_type     TEXT          NOT NULL DEFAULT 'per_unit'    -- รูปแบบการคิดค่าน้ำ ('per_unit' หรือ 'flat_rate')
                         CHECK (water_billing_type IN ('per_unit', 'flat_rate')),
  water_flat_rate        NUMERIC(10,2) NOT NULL DEFAULT 0,            -- ราคาค่าน้ำเหมาจ่ายต่อเดือน (บาท)
  electric_rate_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,            -- ราคาค่าไฟต่อหน่วย (บาท)
  common_fee             NUMERIC(10,2) NOT NULL DEFAULT 0,            -- ค่าส่วนกลางต่อเดือน (บาท) [หมายเหตุ: อาจจะเลิกใช้หรือเก็บรวมไว้ดูยอดเฉยๆ]
  bank_name              TEXT,                                        -- ชื่อธนาคารสำหรับรับโอนเงิน
  bank_account_no        TEXT,                                        -- เลขบัญชีธนาคาร
  bank_account_name      TEXT,                                        -- ชื่อบัญชีธนาคาร
  billing_day            INT CHECK (billing_day BETWEEN 1 AND 31)     -- วันที่ตัดรอบบิลของเดือน (1-31)
);

-- ============================================================
-- TABLE: dorm_services
-- เก็บรายการค่าบริการเพิ่มเติมที่หอพักเรียกเก็บ (เช่น ค่าอินเทอร์เน็ต, ค่าจอดรถ)
-- แยกรายการเพื่อให้แสดงในบิลได้อย่างละเอียด
-- ============================================================
CREATE TABLE dorm_services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dorm_id     UUID        NOT NULL REFERENCES dorms(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,                             -- ชื่อบริการ เช่น "ค่าจอดรถ"
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,                 -- ราคาบริการรายเดือน
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()                -- วันที่สร้าง
);

-- ============================================================
-- TABLE: rooms
-- เก็บข้อมูลห้องพักแต่ละห้องในหอพัก
-- ============================================================
CREATE TABLE rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสห้องพัก
  dorm_id     UUID        NOT NULL REFERENCES dorms(id) ON DELETE CASCADE, -- หอพักที่ห้องนี้สังกัดอยู่
  room_number TEXT        NOT NULL,                              -- เลขห้อง เช่น "101", "A204"
  floor       TEXT,                                             -- ชั้นที่ตั้งของห้อง เช่น "1", "2"
  room_type   TEXT,                                             -- ประเภทห้อง เช่น "standard", "deluxe"
  base_price  NUMERIC(10,2) NOT NULL DEFAULT 0,                 -- ราคาค่าเช่าห้องพื้นฐานต่อเดือน (บาท)
  status      TEXT        NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'occupied', 'maintenance')), -- สถานะห้อง
  deleted_at  TIMESTAMPTZ,                                       -- soft delete — null = ยังใช้งานอยู่
  UNIQUE (dorm_id, room_number)                                 -- ห้องเดียวกันในหอเดียวกันมีเลขห้องซ้ำไม่ได้
);

-- ============================================================
-- TABLE: tenants
-- เก็บข้อมูลผู้เช่าที่อาศัยอยู่ในหอพัก
-- ============================================================
CREATE TABLE tenants (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสผู้เช่า
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL, -- เชื่อมกับ account (null ได้ ถ้าเจ้าของหอเพิ่มเองโดยไม่มี account)
  room_id        UUID        NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT, -- ห้องที่อาศัยอยู่ (หา dorm_id ได้จาก room → dorm)
  name           TEXT        NOT NULL,                             -- ชื่อ-นามสกุลผู้เช่า
  phone          TEXT,                                            -- เบอร์โทรศัพท์ผู้เช่า
  -- [FIX 1] เปลี่ยนจาก TEXT → BYTEA เพื่อรองรับการ encrypt ด้วย Supabase Vault
  -- ⚠️ ก่อนรัน migration นี้ต้องสร้าง secret ใน Vault ก่อน:
  --    Dashboard → Vault → New Secret
  --    Name: "id_card_encrypt_key"  |  Value: (random key ยาวๆ ของคุณ)
  -- วิธีบันทึก:  INSERT ... id_card_number = encrypt_id_card('1234567890123')
  -- วิธีอ่าน:   SELECT decrypt_id_card(id_card_number) FROM tenants ...
  -- (ฟังก์ชัน encrypt_id_card / decrypt_id_card สร้างไว้ด้านล่าง)
  id_card_number BYTEA,                                           -- เลขบัตรประชาชน เข้ารหัสผ่าน Vault (pgp_sym_encrypt)
  status         TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'moved_out')),       -- สถานะ: ยังอยู่ / ย้ายออกแล้ว
  moved_out_at   TIMESTAMPTZ,                                      -- วันเวลาที่ย้ายออก — null = ยังอยู่
  deleted_at     TIMESTAMPTZ,                                      -- soft delete — null = ยังใช้งานอยู่
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()               -- วันที่เช็คอินเข้าพัก
);

-- ============================================================
-- TABLE: lease_contracts
-- เก็บข้อมูลสัญญาเช่า — ทุก field ราคาคือ snapshot ณ วันทำสัญญา
-- ============================================================
CREATE TABLE lease_contracts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสสัญญาเช่า
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- ผู้เช่าที่ทำสัญญา
  room_id        UUID        NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,  -- ห้องที่ระบุในสัญญา
  start_date     DATE        NOT NULL,                             -- วันเริ่มต้นสัญญาเช่า
  end_date       DATE,                                            -- วันสิ้นสุดสัญญา (null = รายเดือนไม่มีกำหนด)
  rent_price     NUMERIC(10,2) NOT NULL DEFAULT 0,                -- snapshot ราคาค่าเช่า ณ วันทำสัญญา (ไม่เปลี่ยนตาม rooms.base_price)
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,                -- ยอดเงินมัดจำ (บาท)
  status         TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'expired', 'terminated')), -- สถานะสัญญา
  file_url       TEXT,                                            -- URL ไฟล์ PDF สัญญาเช่าที่สแกนเก็บไว้
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()               -- วันที่สร้างสัญญาในระบบ
);

-- ============================================================
-- TABLE: utilities
-- เก็บข้อมูลมิเตอร์น้ำ-ไฟของแต่ละห้องในแต่ละเดือน
-- ============================================================
CREATE TABLE utilities (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสการบันทึกมิเตอร์
  room_id             UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, -- ห้องที่บันทึกมิเตอร์
  meter_date          DATE        NOT NULL,                        -- วันที่จดมิเตอร์จริง
  prev_electric_meter INT         NOT NULL DEFAULT 0,              -- ค่ามิเตอร์ไฟฟ้าเดือนที่แล้ว (หน่วย)
  curr_electric_meter INT         NOT NULL DEFAULT 0,              -- ค่ามิเตอร์ไฟฟ้าเดือนนี้ (หน่วย) ต้อง >= prev
  electric_unit       INT         NOT NULL DEFAULT 0,              -- หน่วยไฟที่ใช้ = curr - prev (freeze ไว้)
  prev_water_meter    INT         NOT NULL DEFAULT 0,              -- ค่ามิเตอร์น้ำประปาเดือนที่แล้ว (หน่วย)
  curr_water_meter    INT         NOT NULL DEFAULT 0,              -- ค่ามิเตอร์น้ำประปาเดือนนี้ (หน่วย) ต้อง >= prev
  water_unit          INT         NOT NULL DEFAULT 0,              -- หน่วยน้ำที่ใช้ = curr - prev (freeze ไว้)
  electric_price      NUMERIC(10,2) NOT NULL DEFAULT 0,            -- ยอดค่าไฟที่คำนวณแล้ว (บาท) freeze ณ เวลาบันทึก
  water_price         NUMERIC(10,2) NOT NULL DEFAULT 0,            -- ยอดค่าน้ำที่คำนวณแล้ว (บาท) freeze ณ เวลาบันทึก
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),          -- วันที่บันทึกข้อมูลมิเตอร์ในระบบ
  UNIQUE (room_id, meter_date),                                    -- ห้องเดียวกันจดมิเตอร์ซ้ำวันเดิมไม่ได้
  CHECK (curr_electric_meter >= prev_electric_meter),              -- กันค่าติดลบ: ไฟ
  CHECK (curr_water_meter >= prev_water_meter)                     -- กันค่าติดลบ: น้ำ
);

-- ============================================================
-- TABLE: bills
-- เก็บข้อมูลใบแจ้งหนี้ที่ระบบสร้างให้ผู้เช่าแต่ละเดือน
-- ============================================================
CREATE TABLE bills (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสใบแจ้งหนี้
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
                                  -- [FIX 4] เปลี่ยน CASCADE → RESTRICT
                                  -- เหตุผล: bills เป็นข้อมูลการเงิน ลบ tenant แล้วห้ามลบบิลตาม
                                  -- ต้องใช้ soft delete (deleted_at) แทนการลบจริงเสมอ
  room_id        UUID        NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,  -- ห้องที่เรียกเก็บ
  utility_id     UUID        REFERENCES utilities(id) ON DELETE SET NULL,       -- อ้างอิงข้อมูลมิเตอร์ (null ได้ กรณีบิลพิเศษ)
  billing_month  DATE        NOT NULL,                             -- งวดเดือนของบิล ส่งเป็นวันที่ 1 เสมอ เช่น 2026-03-01
                                                                   -- [FIX 2] NOT NULL จำเป็นมาก — ถ้าเป็น NULL ได้ UNIQUE(tenant_id, billing_month) จะไม่ทำงาน
                                                                   -- เพราะใน SQL: NULL != NULL → INSERT ซ้ำเดือนเดิมได้ไม่จำกัดครั้ง
  room_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,                 -- ยอดค่าเช่าห้อง freeze ณ เวลาออกบิล
  utility_amount NUMERIC(10,2) NOT NULL DEFAULT 0,                 -- ยอดค่าน้ำ+ค่าไฟ freeze ณ เวลาออกบิล
  other_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,                 -- ค่าใช้จ่ายอื่นๆ freeze ณ เวลาออกบิล
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,                 -- ยอดรวมทั้งหมด คำนวณตอน create แล้ว freeze ห้ามแก้ทีหลัง
  due_date       DATE        NOT NULL,                             -- วันครบกำหนดชำระเงิน
  status         TEXT        NOT NULL DEFAULT 'unpaid'
                  CHECK (status IN ('unpaid', 'pending', 'paid', 'overdue')), -- สถานะบิล
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),              -- วันที่ระบบออกบิล
  UNIQUE (tenant_id, billing_month)                               -- กันออกบิลซ้ำในเดือนเดียวกัน
);

-- ============================================================
-- TABLE: payments
-- เก็บข้อมูลการชำระเงินของผู้เช่า (แนบสลิปโอนเงิน)
-- ============================================================
CREATE TABLE payments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสการชำระเงิน
  bill_id      UUID        NOT NULL REFERENCES bills(id) ON DELETE CASCADE, -- บิลที่ชำระ
  amount       NUMERIC(10,2) NOT NULL,                            -- จำนวนเงินที่โอนมา (บาท)
  method       TEXT        NOT NULL DEFAULT 'transfer'
                CHECK (method IN ('transfer', 'cash', 'promptpay')), -- วิธีชำระ: โอน / เงินสด / พร้อมเพย์
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),                -- วันเวลาที่ผู้เช่าแจ้งชำระ
  slip_url     TEXT,                                             -- URL รูปสลิปโอนเงินที่อัปโหลด
  status       TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')), -- สถานะ: รอตรวจ / อนุมัติ / ปฏิเสธ
  comment      TEXT,                                             -- หมายเหตุเมื่อปฏิเสธสลิป เช่น "ยอดเงินไม่ตรง"
  reviewed_by  UUID        REFERENCES users(id) ON DELETE SET NULL, -- คนตรวจสลิป (เจ้าของหอหรือแอดมิน)
  reviewed_at  TIMESTAMPTZ                                        -- วันเวลาที่ตรวจสลิปเสร็จ
);

-- ============================================================
-- TABLE: maintenance
-- เก็บข้อมูลการแจ้งซ่อมของผู้เช่า
-- ============================================================
CREATE TABLE maintenance (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสคำร้องแจ้งซ่อม
  room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, -- ห้องที่แจ้งซ่อม
  tenant_id   UUID        REFERENCES tenants(id) ON DELETE SET NULL,       -- ผู้เช่าที่แจ้งซ่อม (null ได้ ถ้าเจ้าของหอแจ้งเอง)
  title       TEXT        NOT NULL,                              -- หัวข้อปัญหา เช่น "แอร์ไม่เย็น"
  description TEXT,                                             -- รายละเอียดปัญหาเพิ่มเติม
  image_url   TEXT,                                             -- URL รูปภาพจุดที่เสียหาย
  assigned_to UUID        REFERENCES users(id) ON DELETE SET NULL, -- ช่างหรือผู้รับผิดชอบซ่อม (เชื่อมกับ users)
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'in_progress', 'completed')), -- สถานะ: รอ / กำลังซ่อม / เสร็จแล้ว
  resolved_at TIMESTAMPTZ,                                       -- วันเวลาที่ซ่อมเสร็จและปิดงาน
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()                -- วันที่แจ้งซ่อม
);

-- ============================================================
-- TABLE: announcements
-- เก็บประกาศจากเจ้าของหอถึงผู้เช่า
-- ============================================================
CREATE TABLE announcements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- รหัสประกาศ
  dorm_id         UUID        NOT NULL REFERENCES dorms(id) ON DELETE CASCADE, -- หอพักที่ประกาศ
  created_by      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ผู้สร้างประกาศ
  title           TEXT        NOT NULL,                            -- หัวข้อประกาศ เช่น "น้ำประปาหยุดจ่าย 15 ม.ค."
  body            TEXT,                                           -- เนื้อหาประกาศฉบับเต็ม
  -- [v5-FIX 1] เปลี่ยนจาก TEXT → JSONB array
  -- เหตุผล: TEXT ธรรมดา filter ชั้นไม่ได้จริง
  -- รูปแบบ: '["all"]' หรือ '["1","2","3"]' (เลขชั้น)
  -- query: target_audience @> '["all"]' OR target_audience @> '["2"]'
  target_audience JSONB       NOT NULL DEFAULT '["all"]',         -- กลุ่มเป้าหมาย: ["all"] หรือ ["1","2"] (ชั้น)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()              -- วันเวลาที่โพสต์ประกาศ
);


-- ============================================================
-- TABLE: upgrade_requests
-- เก็บคำขออัปเกรด Pro จากเจ้าของหอ
-- workflow: เจ้าของหอกด upgrade → record นี้ถูกสร้าง → เราเห็นใน dashboard
--           เราไปเช็คว่าโอนมาจริงไหม → UPDATE users SET plan_type='pro' เอง
-- ============================================================
CREATE TABLE upgrade_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_plan TEXT        NOT NULL CHECK (subscription_plan IN ('monthly', 'yearly')),
  amount            NUMERIC(10,2) NOT NULL,        -- ยอดที่ควรโอนมา ณ เวลานั้น
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending',   -- รอเราเช็ค
                        'approved',  -- เราอนุมัติแล้ว
                        'rejected'   -- ยอดไม่ตรง / ไม่ได้โอน
                      )),
  note              TEXT,                          -- เจ้าของหอเขียนหมายเหตุได้ เช่น "โอนแล้วนะคะ"
  admin_note        TEXT,                          -- เราจดไว้เอง เช่น "รอยืนยัน ref xxxx"
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ                    -- เวลาที่เราอนุมัติ/ปฏิเสธ
);

CREATE INDEX idx_upgrade_requests_user   ON upgrade_requests(user_id);
CREATE INDEX idx_upgrade_requests_status ON upgrade_requests(status) WHERE status = 'pending';
-- partial index เฉพาะ pending — เราจะเห็น list รอดำเนินการได้เร็ว

-- ============================================================
-- TRIGGER: สร้าง user อัตโนมัติเมื่อ signup (ดู dev_notes.md ข้อ 7)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, plan_type, trial_expires_at)
  -- [FIX 3] เปลี่ยน default role จาก 'owner' → 'tenant'
  -- trial_expires_at: 60 วันนับจากวันสมัคร — ใช้งานเต็มที่ได้ในช่วง trial
  -- หลัง trial หมด: read-only (ดูข้อมูลได้ แต่ INSERT/UPDATE ไม่ได้ จนกว่าจะอัปเกรดเป็น pro)
  VALUES (new.id, new.email, '', 'tenant', 'free', now() + INTERVAL '60 days');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- TRIGGER: กัน Race Condition การจ่ายเงินเกินยอดบิล (ดู dev_notes.md ข้อ 5)
-- ============================================================
CREATE OR REPLACE FUNCTION check_payment_total()
RETURNS trigger AS $$
DECLARE
  v_total_paid NUMERIC;
  v_bill_total NUMERIC;
BEGIN
  -- [FIX 4] เพิ่ม FOR UPDATE เพื่อล็อก row ก่อนอ่านยอด
  -- ปัญหาเดิม: ถ้าผู้เช่าส่งสลิป 2 ครั้งพร้อมกัน (เช่น double-tap)
  --            ทั้งคู่จะอ่าน SUM ได้ค่าเดิมพร้อมกัน → ผ่าน check ทั้งคู่ → ยอดเกิน
  -- วิธีแก้: FOR UPDATE จะล็อก rows ของ bill_id นี้ไว้
  --          transaction ที่ 2 ต้องรอ transaction ที่ 1 commit ก่อน
  --          จึงอ่านยอดใหม่ที่อัปเดตแล้ว → เช็คถูกต้อง
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE bill_id = NEW.bill_id AND status = 'approved'
  FOR UPDATE; -- ← ล็อก rows ป้องกัน concurrent read ยอดเก่า

  SELECT total_amount INTO v_bill_total
  FROM bills WHERE id = NEW.bill_id;

  IF v_total_paid + NEW.amount > v_bill_total THEN
    RAISE EXCEPTION 'ยอดชำระรวมเกินกว่ายอดบิล (ชำระแล้ว: %, ยอดบิล: %)',
      v_total_paid, v_bill_total;  -- แสดงตัวเลขจริงช่วย debug
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_payment_total
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_total();

-- ============================================================
-- INDEXES
-- สร้าง index เพื่อเพิ่มความเร็วในการ query ที่ใช้บ่อย
-- ============================================================
CREATE INDEX idx_dorms_owner        ON dorms(owner_id);           -- ค้นหาหอพักของเจ้าของคนหนึ่งๆ
CREATE INDEX idx_dorm_services_dorm ON dorm_services(dorm_id);    -- ค้นหาบริการของหอพัก
CREATE INDEX idx_rooms_dorm         ON rooms(dorm_id);            -- ค้นหาห้องทั้งหมดในหอพัก
CREATE INDEX idx_tenants_room       ON tenants(room_id);          -- ค้นหาผู้เช่าในห้องหนึ่งๆ
-- [FIX 5] เพิ่ม index บน tenants.user_id
-- เหตุผล: RLS policy หลายตัวทำ WHERE user_id = auth.uid() ทุก request
--         ถ้าไม่มี index → full scan ทุกครั้ง → ช้าเมื่อผู้เช่าเยอะขึ้น
CREATE INDEX idx_tenants_user_id    ON tenants(user_id);          -- เร่ง RLS lookup ของผู้เช่า
CREATE INDEX idx_utilities_room     ON utilities(room_id);        -- ค้นหาประวัติมิเตอร์ของห้อง
CREATE INDEX idx_bills_tenant       ON bills(tenant_id);          -- ค้นหาบิลทั้งหมดของผู้เช่า
CREATE INDEX idx_bills_status       ON bills(status);             -- กรองบิลตามสถานะ (เช่น overdue)
CREATE INDEX idx_payments_bill      ON payments(bill_id);         -- ค้นหาการชำระเงินของบิล
CREATE INDEX idx_maintenance_room   ON maintenance(room_id);      -- ค้นหาประวัติแจ้งซ่อมของห้อง
CREATE INDEX idx_announcements_dorm ON announcements(dorm_id);    -- ค้นหาประกาศของหอพัก

-- Partial index สำหรับ soft delete — index เฉพาะแถวที่ยังไม่ถูกลบ
-- เล็กและเร็วกว่า index ปกติ เมื่อข้อมูลเยอะ (20 หอ+)
CREATE INDEX idx_dorms_deleted_at   ON dorms(deleted_at)   WHERE deleted_at IS NULL; -- กรองเฉพาะหอที่ยังใช้งานอยู่
CREATE INDEX idx_rooms_deleted_at   ON rooms(deleted_at)   WHERE deleted_at IS NULL; -- กรองเฉพาะห้องที่ยังใช้งานอยู่
CREATE INDEX idx_tenants_deleted_at ON tenants(deleted_at) WHERE deleted_at IS NULL; -- กรองเฉพาะผู้เช่าที่ยังอยู่

-- [v5-FIX 5] เพิ่ม index ที่ขาด
CREATE INDEX idx_bills_room ON bills(room_id);
CREATE INDEX idx_users_trial ON users(trial_expires_at) WHERE plan_type = 'free';
-- เร่ง query เช็ค trial หมดหรือยัง — ใช้บ่อยใน is_trial_active()
-- RLS ของ bills ทำ EXISTS (SELECT 1 FROM rooms r WHERE r.id = bills.room_id ...) ทุก query

CREATE INDEX idx_payments_pending ON payments(bill_id) WHERE status = 'pending';
-- partial index เฉพาะ pending — เจ้าของหอ query รายการรอตรวจบ่อยที่สุด
-- ดีกว่า full index บน status เพราะ cardinality ต่ำ (มีแค่ 3 ค่า)

CREATE INDEX idx_tenants_active ON tenants(room_id) WHERE status = 'active' AND deleted_at IS NULL;
-- เร่ง query หาผู้เช่า active ในห้อง ใช้บ่อยใน RLS lookup

-- [v5-FIX 2] กัน active tenant ซ้ำห้อง — 1 ห้อง มี active tenant ได้แค่ 1 คน
-- ใช้ partial index เพราะ tenant ที่ moved_out ไม่นับ ห้องเดิมรับคนใหม่ได้
CREATE UNIQUE INDEX idx_one_active_tenant_per_room
  ON tenants(room_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- ============================================================
-- TRIGGER: ป้องกัน overpay ตอน owner approve payment
-- ============================================================
-- [v5-FIX 3] trigger เดิม check_payment_total เช็คแค่ตอน INSERT (ผู้เช่าส่งสลิป)
-- ปัญหา: owner approve หลายรายการพร้อมกัน อาจทำให้ยอดรวมเกินบิล
-- เช่น: bill = 1,000 บ. มี 2 payment pending ละ 800 บ. approve ทั้งคู่ = 1,600 บ. เกิน
CREATE OR REPLACE FUNCTION check_payment_on_approve()
RETURNS trigger AS $$
DECLARE
  v_total_approved NUMERIC;
  v_bill_total     NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_approved
    FROM payments
    WHERE bill_id = NEW.bill_id AND status = 'approved' AND id != NEW.id
    FOR UPDATE; -- ล็อก rows ป้องกัน concurrent approve

    SELECT total_amount INTO v_bill_total
    FROM bills WHERE id = NEW.bill_id;

    IF v_total_approved + NEW.amount > v_bill_total THEN
      RAISE EXCEPTION 'ไม่สามารถ approve ได้ — ยอดรวมจะเกินบิล (approved: %, กำลัง approve: %, ยอดบิล: %)',
        v_total_approved, NEW.amount, v_bill_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_payment_on_approve
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_on_approve();

-- ============================================================
-- TRIGGER: ล็อกยอดเงินบิลหลังสร้าง ห้ามแก้ amount
-- ============================================================
-- [v5-FIX 4] ป้องกันการแก้ยอดเงินบิลย้อนหลัง
-- แก้ได้เฉพาะ: status, due_date — ห้ามแก้: room_amount, utility_amount, other_amount, total_amount
-- NOTE: ใช้ trigger แทน RLS WITH CHECK เพราะ RLS ไม่มี OLD.value ให้เปรียบ
CREATE OR REPLACE FUNCTION prevent_bill_amount_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.room_amount    IS DISTINCT FROM OLD.room_amount    OR
     NEW.utility_amount IS DISTINCT FROM OLD.utility_amount OR
     NEW.other_amount   IS DISTINCT FROM OLD.other_amount   OR
     NEW.total_amount   IS DISTINCT FROM OLD.total_amount   THEN
    RAISE EXCEPTION
      'ห้ามแก้ยอดเงินในบิลหลังสร้างแล้ว — แก้ได้เฉพาะ status และ due_date (room: % → %, total: % → %)',
      OLD.room_amount, NEW.room_amount, OLD.total_amount, NEW.total_amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_bill_amount_change
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION prevent_bill_amount_change();

-- ============================================================
-- TRIGGER: ตรวจ plan limit (free vs pro)
-- ============================================================
-- [v5-FIX 6] SaaS plan enforcement ใน DB layer
-- free: สร้างหอได้ 1 หอ, ห้องได้ 20 ห้องต่อหอ | pro: ไม่จำกัด
-- เหตุผล: ถ้าเช็คแค่ frontend — user bypass ได้ผ่าน API โดยตรง
-- ============================================================
-- FUNCTION: is_trial_active
-- ============================================================
-- คืน true ถ้า user ยังอยู่ใน trial หรือเป็น pro
-- ใช้ใน trigger และ RLS เพื่อเช็คสิทธิ์ write
CREATE OR REPLACE FUNCTION is_trial_active(p_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND (
        plan_type = 'pro'                          -- pro ไม่จำกัด
        OR trial_expires_at > now()                -- free ที่ยังไม่หมด trial
      )
  );
$$;

-- ============================================================
-- FUNCTION: check_plan_limit
-- ============================================================
CREATE OR REPLACE FUNCTION check_plan_limit()
RETURNS trigger AS $$
DECLARE
  v_owner_id   UUID;  -- v_plan และ v_count ไม่ใช้แล้ว ใช้ is_trial_active() แทน
BEGIN
  -- เช็คเฉพาะ owner ของหอนั้น
  IF TG_TABLE_NAME = 'dorms' THEN
    v_owner_id := NEW.owner_id;
  ELSIF TG_TABLE_NAME = 'rooms' THEN
    SELECT d.owner_id INTO v_owner_id FROM dorms d WHERE d.id = NEW.dorm_id;
  END IF;

  -- free + trial หมดแล้ว → read-only ห้าม INSERT
  IF NOT is_trial_active(v_owner_id) THEN
    RAISE EXCEPTION 'trial_expired: Trial 60 วันหมดแล้ว — อัปเกรดเป็น Pro เพื่อใช้งานต่อ';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_dorm_plan_limit
  BEFORE INSERT ON dorms
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit();

CREATE TRIGGER trg_check_room_plan_limit
  BEFORE INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit();

-- [FIX 2] เพิ่ม BEFORE UPDATE สำหรับกรณีย้ายห้องข้ามหอ (UPDATE rooms.dorm_id)
-- เหตุผล: ถ้าเจ้าของหอ free ย้ายห้องจากหอ A ไปหอ B ที่มี 20 ห้องแล้ว
--         BEFORE INSERT ไม่ดัก เพราะไม่ได้สร้างห้องใหม่
CREATE OR REPLACE FUNCTION check_plan_limit_on_update()
RETURNS trigger AS $$
DECLARE
  v_plan     TEXT;
  v_count    INT;
  v_owner_id UUID;
BEGIN
  -- ทำงานเฉพาะตอน dorm_id เปลี่ยน (ย้ายห้องข้ามหอ)
  IF NEW.dorm_id IS DISTINCT FROM OLD.dorm_id THEN
    SELECT d.owner_id INTO v_owner_id FROM dorms d WHERE d.id = NEW.dorm_id;
    IF NOT is_trial_active(v_owner_id) THEN
      RAISE EXCEPTION 'trial_expired: Trial 60 วันหมดแล้ว — อัปเกรดเป็น Pro เพื่อย้ายห้อง';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_room_plan_limit_update
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION check_plan_limit_on_update();

-- ============================================================
-- TRIGGER: คำนวณ utilities อัตโนมัติ
-- ============================================================
-- [v5-FIX 7] คำนวณ unit และ price ใน DB แทน frontend
-- เหตุผล: ถ้า frontend คำนวณแล้วส่งมา user อาจส่งค่าผิดหรือแก้ตัวเลขเองได้
-- trigger นี้ BEFORE INSERT จะ override ค่าที่ส่งมาเสมอ
-- ดึง rate จาก dorm_settings ของหอที่ห้องนั้นสังกัด
CREATE OR REPLACE FUNCTION calc_utilities()
RETURNS trigger AS $$
DECLARE
  v_electric_rate    NUMERIC;
  v_water_rate       NUMERIC;
  v_water_type       TEXT;
  v_water_flat_rate  NUMERIC;
BEGIN
  SELECT ds.electric_rate_per_unit, ds.water_rate_per_unit, ds.water_billing_type, ds.water_flat_rate
  INTO   v_electric_rate, v_water_rate, v_water_type, v_water_flat_rate
  FROM   dorm_settings ds
  JOIN   rooms r ON r.dorm_id = ds.dorm_id
  WHERE  r.id = NEW.room_id;

  -- คำนวณค่าไฟ (ตามมิเตอร์เสมอ)
  NEW.electric_unit  := NEW.curr_electric_meter - NEW.prev_electric_meter;
  NEW.electric_price := NEW.electric_unit * COALESCE(v_electric_rate, 0);

  -- คำนวณค่าน้ำ (มิเตอร์ หรือ เหมา)
  IF COALESCE(v_water_type, 'per_unit') = 'flat_rate' THEN
    NEW.water_unit  := 0;
    NEW.water_price := COALESCE(v_water_flat_rate, 0);
  ELSE
    NEW.water_unit  := NEW.curr_water_meter - NEW.prev_water_meter;
    NEW.water_price := NEW.water_unit * COALESCE(v_water_rate, 0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_utilities
  BEFORE INSERT ON utilities
  FOR EACH ROW EXECUTE FUNCTION calc_utilities();

-- ============================================================
-- TABLE: audit_logs + TRIGGER
-- ============================================================
-- [v5-FIX 8] บันทึก event สำคัญที่เกี่ยวกับการเงิน
-- เน้น: payment approve/reject, bill status change
-- เหตุผล: ระบบเงินจริงต้องตรวจสอบย้อนหลังได้ว่าใครทำอะไร เมื่อไหร่

CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT        NOT NULL,                              -- table ที่เกิด event
  record_id   UUID        NOT NULL,                              -- id ของ record ที่เปลี่ยน
  action      TEXT        NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_data    JSONB,                                             -- ข้อมูลก่อนเปลี่ยน (null ถ้า insert)
  new_data    JSONB,                                             -- ข้อมูลหลังเปลี่ยน (null ถ้า delete)
  changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL, -- user ที่ทำ action
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_changed_by   ON audit_logs(changed_by);
CREATE INDEX idx_audit_changed_at   ON audit_logs(changed_at DESC);

-- Partial indexes สำหรับ audit_logs RLS — เร็วขึ้นเมื่อ log เยอะ
-- RLS filter ด้วย table_name + record_id บ่อยมาก partial index เล็กกว่า full index
CREATE INDEX idx_audit_payments ON audit_logs(record_id) WHERE table_name = 'payments';
CREATE INDEX idx_audit_bills    ON audit_logs(record_id) WHERE table_name = 'bills';

CREATE OR REPLACE FUNCTION log_audit()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    LOWER(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- บันทึก audit เฉพาะ payments และ bills — 2 table ที่เกี่ยวกับเงินโดยตรง
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER trg_audit_bills
  AFTER INSERT OR UPDATE OR DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION log_audit();


-- ============================================================
-- VAULT HELPER FUNCTIONS: encrypt/decrypt เลขบัตรประชาชน
-- ============================================================
-- ⚠️ ต้องสร้าง secret ใน Vault ก่อนรันส่วนนี้:
--    Supabase Dashboard → Vault → New Secret
--    Name: "id_card_encrypt_key"  |  Value: ใส่ random string ยาวๆ ที่ปลอดภัย
--
-- SECURITY DEFINER = ฟังก์ชันรันด้วยสิทธิ์ของ owner (postgres)
-- ทำให้ authenticated user เรียกใช้ได้ โดยไม่ต้องให้สิทธิ์อ่าน vault โดยตรง
-- → key ไม่มีทางโผล่ใน application code หรือ logs เลย

-- ============================================================
-- RPC: เพิ่มผู้เช่าใหม่และเข้ารหัสบัตร ปชช. ในตัว
-- ============================================================
CREATE OR REPLACE FUNCTION add_tenant(
  p_room_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_id_card_number TEXT
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
  INSERT INTO tenants (room_id, name, phone, id_card_number, status)
  VALUES (p_room_id, p_name, p_phone, v_encrypted_id_card, 'active')
  RETURNING id INTO v_tenant_id;

  -- 3. Update สถานะห้องเป็น 'occupied' (มีผู้เช่าแล้ว)
  UPDATE rooms SET status = 'occupied' WHERE id = p_room_id;

  RETURN v_tenant_id;
END;
$$;


-- ฟังก์ชันเข้ารหัส: เรียกตอน INSERT / UPDATE
CREATE OR REPLACE FUNCTION encrypt_id_card(plain_text TEXT)
RETURNS BYTEA
LANGUAGE plpgsql  -- เปลี่ยนจาก sql → plpgsql เพื่อใช้ IF/RAISE ได้
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp  -- ป้องกัน search_path warning
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- ดึง key จาก Vault
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'id_card_encrypt_key';

  -- [FIX 2] NULL guard: ถ้าไม่มี key ใน Vault → ห้ามเข้ารหัส ให้ throw error ทันที
  -- เหตุผล: pgp_sym_encrypt(text, NULL) คืน NULL เงียบๆ โดยไม่ error
  --         ทำให้ข้อมูลบัตรประชาชนหายไปโดยไม่รู้ตัว
  -- วิธีแก้: ไปสร้าง secret ก่อน Dashboard → Vault → New Secret → "id_card_encrypt_key"
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Vault key "id_card_encrypt_key" ไม่พบ — กรุณาสร้าง secret ใน Supabase Vault ก่อนใช้งาน';
  END IF;

  RETURN pgp_sym_encrypt(plain_text, v_key);
END;
$$;

-- ฟังก์ชันถอดรหัส: เรียกตอน SELECT
CREATE OR REPLACE FUNCTION decrypt_id_card(encrypted_data BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp  -- ป้องกัน search_path warning
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'id_card_encrypt_key';

  -- [FIX 2] NULL guard เช่นเดียวกับ encrypt_id_card
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Vault key "id_card_encrypt_key" ไม่พบ — กรุณาสร้าง secret ใน Supabase Vault ก่อนใช้งาน';
  END IF;

  RETURN pgp_sym_decrypt(encrypted_data, v_key);
END;
$$;

-- จำกัดสิทธิ์: เรียกได้เฉพาะ authenticated user เท่านั้น (ไม่ให้ anon เรียก)
REVOKE ALL ON FUNCTION encrypt_id_card(TEXT)   FROM PUBLIC;
REVOKE ALL ON FUNCTION decrypt_id_card(BYTEA)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION encrypt_id_card(TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_id_card(BYTEA) TO authenticated;

-- ตัวอย่างการใช้งานใน Supabase JS client:
--
--   บันทึก (encrypt):
--   const { error } = await supabase.rpc('encrypt_id_card', { plain_text: '1234567890123' })
--   แล้วเอา result ใส่ใน INSERT tenants(id_card_number)
--
--   อ่าน (decrypt):
--   SELECT id, name, decrypt_id_card(id_card_number) AS id_card_number FROM tenants WHERE id = '...'
