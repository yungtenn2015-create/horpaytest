# dev_notes.md — SaaS Dormitory Management System

> อัปเดตล่าสุด: migration v7 + rls_policies v3
> ไฟล์นี้รวมทุกสิ่งที่ developer ต้องรู้ก่อนแตะโค้ด — อ่านตั้งแต่ต้นถึงปลายครั้งแรกที่เข้าโปรเจกต์

---

## สารบัญ

1. [ลำดับการ Deploy](#1-ลำดับการ-deploy)
2. [โครงสร้าง Database ภาพรวม](#2-โครงสร้าง-database-ภาพรวม)
3. [Soft Delete — แนวทางการลบข้อมูล](#3-soft-delete--แนวทางการลบข้อมูล)
4. [Snapshot Pricing — ราคาที่ Freeze ณ เวลาสร้าง](#4-snapshot-pricing--ราคาที่-freeze-ณ-เวลาสร้าง)
5. [การป้องกัน Overpay — 2 ชั้น](#5-การป้องกัน-overpay--2-ชั้น)
6. [การเข้ารหัสเลขบัตรประชาชน (PDPA)](#6-การเข้ารหัสเลขบัตรประชาชน-pdpa)
7. [Trigger handle_new_user — สร้าง User อัตโนมัติ](#7-trigger-handle_new_user--สร้าง-user-อัตโนมัติ)
8. [RLS — หลักการควบคุมสิทธิ์](#8-rls--หลักการควบคุมสิทธิ์)
9. [Trigger ความปลอดภัยของข้อมูล](#9-trigger-ความปลอดภัยของข้อมูล)
10. [Trial Period และ Plan](#10-trial-period-และ-plan)
11. [Utilities — การคำนวณมิเตอร์อัตโนมัติ](#11-utilities--การคำนวณมิเตอร์อัตโนมัติ)
12. [Announcements — target_audience แบบ JSONB](#12-announcements--target_audience-แบบ-jsonb)
13. [Audit Log — บันทึกทุก Event การเงิน](#13-audit-log--บันทึกทุก-event-การเงิน)
14. [Storage Buckets — การจัดเก็บไฟล์](#14-storage-buckets--การจัดเก็บไฟล์)
15. [Indexes — ครบทุกตัวที่มี](#15-indexes--ครบทุกตัวที่มี)
16. [Checklist ก่อน Deploy Production](#16-checklist-ก่อน-deploy-production)
17. [LINE Notification — ไฟล์แยก](#17-line-notification--ไฟล์แยก)

---

## 1. ลำดับการ Deploy

**ต้องทำตามลำดับนี้เท่านั้น** มิฉะนั้น foreign key หรือ Vault function จะ error

```
ขั้นที่ 1  →  สร้าง Vault secret "id_card_encrypt_key"
               Dashboard → Vault → New Secret
               Name: id_card_encrypt_key | Value: (random key ยาวๆ ปลอดภัย)

ขั้นที่ 2  →  สร้าง Storage buckets (ทั้งหมด Private)
               "slips" | "contracts" | "maintenance-images"

ขั้นที่ 3  →  รัน migration.sql ใน SQL Editor

ขั้นที่ 4  →  รัน rls_policies.sql ใน SQL Editor
```

> ⚠️ ถ้าข้ามขั้นที่ 1 ก่อน — `encrypt_id_card()` จะสร้างได้แต่ใช้งานไม่ได้ เพราะ Vault ยังไม่มี key

---

## 2. โครงสร้าง Database ภาพรวม

ระบบมี **12 tables** (เพิ่ม `audit_logs` จาก v4) แบ่งเป็น 4 กลุ่ม:

### กลุ่มผู้ใช้งาน
| Table | หน้าที่ |
|---|---|
| `users` | account ทุกคน (owner / tenant / admin) — สร้างอัตโนมัติเมื่อ signup |
| `dorms` | หอพัก — เจ้าของหอ 1 คน มีได้หลายหอ (ไม่จำกัดในช่วง trial) |
| `dorm_settings` | ตั้งค่าหอ (ราคาน้ำ/ไฟ, เลขบัญชี, วันตัดบิล) — one-to-one กับ dorms |
| `tenants` | ผู้เช่าที่พักอยู่ในห้อง — เชื่อมกับ users ได้แต่ไม่บังคับ |

### กลุ่มห้องและสัญญา
| Table | หน้าที่ |
|---|---|
| `rooms` | ห้องพักแต่ละห้องในหอ (ไม่จำกัดในช่วง trial) |
| `lease_contracts` | สัญญาเช่า — ราคาทุก field เป็น snapshot ณ วันทำสัญญา |

### กลุ่มการเงินและบริการ
| Table | หน้าที่ |
|---|---|
| `utilities` | มิเตอร์น้ำ-ไฟรายเดือน — คำนวณ unit/price อัตโนมัติผ่าน trigger |
| `bills` | ใบแจ้งหนี้รายเดือน — ยอดเงิน freeze หลังสร้าง แก้ไม่ได้ |
| `payments` | การชำระเงิน/สลิปของผู้เช่า — มี 2 ชั้นป้องกัน overpay |
| `maintenance` | คำร้องแจ้งซ่อม |
| `announcements` | ประกาศจากเจ้าของหอ — target ชั้นได้ด้วย JSONB |

### กลุ่ม Audit
| Table | หน้าที่ |
|---|---|
| `audit_logs` | บันทึก event ทุก INSERT/UPDATE/DELETE บน payments และ bills |

### ความสัมพันธ์หลัก (FK Chain)
```
users
 └── dorms (owner_id)
      ├── dorm_settings (dorm_id)
      └── rooms (dorm_id)
           ├── tenants (room_id)  ← max 1 active tenant ต่อห้อง
           │    ├── lease_contracts (tenant_id)
           │    ├── bills (tenant_id)  ← audit_logs
           │    │    └── payments (bill_id)  ← audit_logs
           │    └── maintenance (tenant_id)
           └── utilities (room_id)  ← คำนวณ auto
```

---

## 3. Soft Delete — แนวทางการลบข้อมูล

`dorms`, `rooms`, `tenants` ใช้ **soft delete** — เซต `deleted_at = now()` แทนการลบจริง

### ทำไมถึงต้องทำแบบนี้
- ข้อมูลประวัติการเงิน (bills, payments) ยังต้องอ้างอิง record เก่าได้
- เก็บ audit trail สำหรับตรวจสอบย้อนหลัง
- กัน FK constraint error เมื่อมีข้อมูลลูก

### RLS กรอง Soft Delete อัตโนมัติ (v3)
RLS policies ของ `dorms`, `rooms`, `tenants` มี `AND deleted_at IS NULL` ทั้ง `USING` และ `WITH CHECK` แล้ว — **ข้อมูลที่ soft delete จะไม่ถูก query เจอผ่าน Supabase client โดยอัตโนมัติ**

### วิธี Soft Delete ใน Application
```javascript
// soft delete หอพัก (ไม่ใช้ .delete() โดยตรง)
await supabase
  .from('dorms')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', dormId)

// query ข้อมูลปัจจุบัน — ไม่ต้องกรองเพิ่มเพราะ RLS จัดการให้แล้ว
const { data } = await supabase.from('dorms').select('*')
```

> ⚠️ ถ้า query ผ่าน SQL โดยตรง (ไม่ผ่าน RLS) ต้องกรอง `deleted_at IS NULL` เองทุกครั้ง

### bills และ payments ห้ามลบตาม tenant
`bills.tenant_id` ใช้ `ON DELETE RESTRICT` ไม่ใช่ CASCADE — ถ้าพยายามลบ tenant ที่ยังมีบิลอยู่ DB จะ error ทันที ต้องใช้ soft delete (`deleted_at`) เสมอ ข้อมูลการเงินต้องอยู่ถาวรสำหรับการทำบัญชีและภาษี

---

## 4. Snapshot Pricing — ราคาที่ Freeze ณ เวลาสร้าง

ราคาใน `lease_contracts` และ `bills` เป็น **snapshot** ณ ตอนสร้าง — ไม่เปลี่ยนตามราคาปัจจุบัน

### Tables ที่ใช้ snapshot
| Table | Column | Snapshot มาจาก |
|---|---|---|
| `lease_contracts` | `rent_price` | `rooms.base_price` ณ วันทำสัญญา |
| `bills` | `room_amount` | ค่าเช่า ณ วันออกบิล |
| `bills` | `utility_amount` | ยอดน้ำ+ไฟ ณ วันออกบิล |
| `bills` | `total_amount` | ยอดรวม — **ห้ามแก้หลังสร้าง** (trigger บล็อก) |
| `utilities` | `electric_price`, `water_price` | คำนวณ ณ วันจดมิเตอร์ (trigger อัตโนมัติ) |

### วิธีออกบิลใน Application
```javascript
const settings = await getSettings(dormId)
const bill = {
  room_amount:    currentRentPrice,
  utility_amount: elecUnits * settings.electric_rate_per_unit
                + waterUnits * settings.water_rate_per_unit,
  other_amount:   settings.common_fee,
  total_amount:   room + utility + other,  // freeze หลังจากนี้แก้ไม่ได้
  billing_month:  '2026-03-01',            // วันที่ 1 ของเดือนเสมอ
}
```

---

## 5. การป้องกัน Overpay — 2 ชั้น

ระบบมี **2 trigger** ป้องกันการชำระเงินเกินยอดบิล ทำงานร่วมกัน:

### ชั้นที่ 1: `check_payment_total` — ตอนผู้เช่าส่งสลิป (INSERT)
```
ผู้เช่ากด submit → BEFORE INSERT → นับยอด approved + FOR UPDATE lock
→ ถ้า total + amount > bill → RAISE EXCEPTION
```

### ชั้นที่ 2: `check_payment_on_approve` — ตอนเจ้าของหออนุมัติ (UPDATE)
```
เจ้าของหอกด approve → BEFORE UPDATE → เช็ค status เปลี่ยนเป็น approved
→ นับยอด approved แล้ว (ยกเว้นตัวเอง) + FOR UPDATE lock
→ ถ้า total + amount > bill → RAISE EXCEPTION
```

**ทำไมต้องมี 2 ชั้น:**
ชั้น 1 กัน double-tap จากผู้เช่า ชั้น 2 กันเจ้าของหออนุมัติสลิป pending 2 ใบพร้อมกันที่รวมกันเกินยอดบิล

**Error messages ที่ต้อง handle ใน frontend:**
```
'ยอดชำระรวมเกินกว่ายอดบิล (ชำระแล้ว: X, ยอดบิล: Y)'
'ไม่สามารถ approve ได้ — ยอดรวมจะเกินบิล (approved: X, กำลัง approve: Y, ยอดบิล: Z)'
```

---

## 6. การเข้ารหัสเลขบัตรประชาชน (PDPA)

`tenants.id_card_number` เก็บเป็น **BYTEA** และต้อง encrypt ก่อนบันทึกเสมอ

### Architecture — Supabase Vault
```
Application code
    ↓ เรียก encrypt_id_card('1234567890123')
DB Function (SECURITY DEFINER)
    ↓ ดึง key จาก vault.decrypted_secrets ภายใน DB
Supabase Vault (key ไม่ออกมาข้างนอก)
    ↓
pgp_sym_encrypt → BYTEA เก็บใน tenants.id_card_number
```

### วิธีใช้
```sql
-- บันทึก
INSERT INTO tenants (name, id_card_number)
VALUES ('สมชาย ใจดี', encrypt_id_card('1234567890123'));

-- อ่าน
SELECT id, name, decrypt_id_card(id_card_number) AS id_card_number
FROM tenants WHERE id = $1;
```

```javascript
// Supabase JS client
const { data: encrypted } = await supabase
  .rpc('encrypt_id_card', { plain_text: '1234567890123' })

await supabase.from('tenants').insert({
  name: 'สมชาย ใจดี',
  id_card_number: encrypted,
})
```

> ⚠️ `anon` role ถูก revoke สิทธิ์แล้ว — ต้อง login ก่อนเสมอ

---

## 7. Trigger handle_new_user — สร้าง User อัตโนมัติ

### Default Role = `'tenant'`
ทุกคนที่ signup จะได้ role = `'tenant'` ก่อน แล้วค่อยอัปเดตเป็น `'owner'` ใน onboarding

### Onboarding Flow ที่ Frontend ต้องทำ
```
Signup เสร็จ → หน้า Onboarding "คุณเป็นใคร?"
    │
    ├── เจ้าของหอ
    │     ↓ UPDATE users SET role = 'owner' WHERE id = auth.uid()
    │     ↓ redirect → สร้างหอพัก
    │
    └── ผู้เช่า
          ↓ role คงเป็น 'tenant' (ไม่ต้องทำอะไร)
          ↓ redirect → dashboard ผู้เช่า
```

> ⚠️ ถ้าข้าม onboarding เจ้าของหอจะใช้ระบบไม่ได้เพราะ RLS บล็อก

---

## 8. RLS — หลักการควบคุมสิทธิ์

ระบบใช้ Row Level Security ควบคุมสิทธิ์ทั้งหมด รวม **39 policies**

### หลักการ
- **Default คือ DENY** — ไม่มี policy ที่ match = เข้าไม่ได้
- `USING` = เงื่อนไข SELECT / UPDATE / DELETE
- `WITH CHECK` = เงื่อนไข INSERT / UPDATE
- policy หลายอันบน operation เดียว = OR กัน

### Soft Delete ใน RLS (v3)
`dorms`, `rooms`, `tenants` ทุก policy มี `AND deleted_at IS NULL` — ข้อมูลที่ soft delete ถูก filter ออกอัตโนมัติ

### สิทธิ์แต่ละ Role

| Table | Owner | Tenant |
|---|---|---|
| `dorms` | CRUD เฉพาะหอตัวเอง (active) | ไม่เห็น |
| `dorm_settings` | CRUD เฉพาะหอตัวเอง | ไม่เห็น |
| `rooms` | CRUD ทุก operation | SELECT เฉพาะห้องตัวเอง (active) |
| `tenants` | CRUD ทุก operation | SELECT ตัวเองอย่างเดียว |
| `lease_contracts` | CRUD ทุก operation | SELECT ตัวเองอย่างเดียว |
| `utilities` | CRUD ทุก operation | SELECT ห้องตัวเอง |
| `bills` | SELECT + DELETE + UPDATE status | SELECT ตัวเอง |
| `payments` | CRUD ทุก operation + approve/reject | INSERT + SELECT เท่านั้น |
| `maintenance` | CRUD ทุก operation | INSERT + SELECT เท่านั้น |
| `announcements` | CRUD ทุก operation | SELECT หอที่พักอยู่ |
| `audit_logs` | SELECT log หอตัวเอง | SELECT log ตัวเอง |

### สิ่งที่ผู้เช่าทำไม่ได้ (intentional)
- แก้ข้อมูลตัวเองใน `tenants` — เจ้าของหอแก้ให้เท่านั้น
- แก้/ลบสัญญาเช่า — read-only
- สร้าง/แก้/ลบบิล — เจ้าของหอจัดการ
- แก้/ลบ payment หลัง submit — ส่งสลิปได้ครั้งเดียว เจ้าของหออนุมัติ/ปฏิเสธ

---

## 9. Trigger ความปลอดภัยของข้อมูล

### `prevent_bill_amount_change` — ล็อกยอดเงินบิล
```
BEFORE UPDATE ON bills
ถ้า room_amount / utility_amount / other_amount / total_amount เปลี่ยน → RAISE EXCEPTION
แก้ได้เฉพาะ: status, due_date
```

**ทำไมใช้ trigger ไม่ใช้ RLS:**
RLS `WITH CHECK` เห็นแค่ `NEW` ไม่มี `OLD` ให้เปรียบ trigger เท่านั้นที่เห็นทั้ง `NEW` และ `OLD`

### `idx_one_active_tenant_per_room` — กัน tenant ซ้ำห้อง
```sql
UNIQUE INDEX บน tenants(room_id)
WHERE status = 'active' AND deleted_at IS NULL
```
1 ห้องมี active tenant ได้แค่ 1 คน — tenant ที่ moved_out ไม่นับ ห้องรับคนใหม่ได้

**Error ที่ต้อง handle:**
```javascript
// 'duplicate key value violates unique constraint "idx_one_active_tenant_per_room"'
// → แสดง "ห้องนี้มีผู้เช่าอยู่แล้ว"
```

---

## 10. Trial Period และ Plan

ระบบใช้ **trial 60 วัน** แทนการจำกัดจำนวนหอ/ห้อง — ในช่วง trial ใช้งานได้เต็มที่ไม่จำกัด

| สถานะ | เงื่อนไข | สิทธิ์ |
|---|---|---|
| free + trial ยังไม่หมด | `trial_expires_at > now()` | ใช้งานได้เต็มที่ ไม่จำกัดหอ/ห้อง |
| free + trial หมดแล้ว | `trial_expires_at <= now()` | read-only — INSERT/UPDATE ถูก block |
| pro | `plan_type = 'pro'` | ไม่จำกัด |

### columns ใน users ที่เกี่ยวข้อง
```
trial_expires_at    = now() + 60 days  ← เซตอัตโนมัติตอน signup
plan_type           = 'free' / 'pro'
subscription_plan   = 'monthly' / 'yearly'  ← เซตตอนอัปเกรด
```

### Helper Function `is_trial_active()`
```sql
-- คืน true ถ้ายังใช้งานได้ (pro หรือ trial ยังไม่หมด)
SELECT is_trial_active(user_id);
```
trigger `check_plan_limit` เรียก function นี้ทุกครั้งที่ INSERT/UPDATE dorms หรือ rooms

### Error message ที่ต้อง handle
```
'trial_expired: Trial 60 วันหมดแล้ว — อัปเกรดเป็น Pro เพื่อใช้งานต่อ'
```
prefix `trial_expired:` ช่วยให้ frontend แยก error นี้ออกจาก error อื่นได้ชัดเจน

### อัปเกรดเป็น Pro (manual ผ่าน Supabase Dashboard)
```sql
UPDATE users SET
  plan_type         = 'pro',
  subscription_plan = 'yearly',   -- หรือ 'monthly'
  trial_expires_at  = now() + INTERVAL '999 years'
WHERE email = 'owner@example.com';
```

### table upgrade_requests — เก็บคำขออัปเกรด
เจ้าของหอกดสมัคร pro ในแอป → record ถูกสร้างใน `upgrade_requests` → แจ้งคุณ → คุณเช็คยอดโอน → รัน SQL ด้านบน

---

## 11. Utilities — การคำนวณมิเตอร์อัตโนมัติ

trigger `calc_utilities` ทำงาน `BEFORE INSERT` — **override ค่าที่ frontend ส่งมาเสมอ**

**สิ่งที่ trigger คำนวณให้:**
```
electric_unit  = curr_electric_meter - prev_electric_meter
water_unit     = curr_water_meter    - prev_water_meter
electric_price = electric_unit × dorm_settings.electric_rate_per_unit
water_price    = water_unit    × dorm_settings.water_rate_per_unit
```

**วิธีใช้ใน Application:**
```javascript
// ส่งแค่ค่ามิเตอร์ — ไม่ต้องคำนวณ unit/price เอง
await supabase.from('utilities').insert({
  room_id:             roomId,
  meter_date:          '2026-03-15',
  prev_electric_meter: 1200,
  curr_electric_meter: 1350,
  prev_water_meter:    340,
  curr_water_meter:    365,
  // electric_unit, water_unit, electric_price, water_price ← trigger คำนวณให้
})
```

> ⚠️ ต้องตั้งค่า `dorm_settings.electric_rate_per_unit` และ `water_rate_per_unit` ก่อน — ถ้าไม่มีจะได้ 0 บาท

---

## 12. Announcements — target_audience แบบ JSONB

`target_audience` เปลี่ยนจาก `TEXT` → `JSONB array` เพื่อ filter ชั้นได้จริง

**รูปแบบ:**
```json
["all"]       ← ส่งถึงทุกคนในหอ
["1", "2"]    ← ส่งถึงชั้น 1 และ 2 เท่านั้น
["3"]         ← ส่งถึงชั้น 3 เท่านั้น
```

**Query ใน Application:**
```javascript
const { data } = await supabase
  .from('announcements')
  .select('*')
  .eq('dorm_id', dormId)
  .or('target_audience.cs.["all"],target_audience.cs.["2"]')
  // cs = contains (JSONB @> operator)
```

```sql
-- SQL โดยตรง
SELECT * FROM announcements
WHERE dorm_id = $1
  AND (target_audience @> '["all"]' OR target_audience @> '["2"]');
```

---

## 13. Audit Log — บันทึกทุก Event การเงิน

table `audit_logs` บันทึก INSERT/UPDATE/DELETE ทุกครั้งบน **payments** และ **bills**

### โครงสร้าง
| Column | ความหมาย |
|---|---|
| `table_name` | `payments` หรือ `bills` |
| `record_id` | UUID ของ record ที่เปลี่ยน |
| `action` | `insert` / `update` / `delete` |
| `old_data` | ข้อมูลก่อนเปลี่ยน (JSONB) — null ถ้า insert |
| `new_data` | ข้อมูลหลังเปลี่ยน (JSONB) — null ถ้า delete |
| `changed_by` | UUID ของ user ที่ทำ (จาก `auth.uid()`) |
| `changed_at` | timestamp |

### Query ประวัติ
```javascript
// ดูประวัติ payment
const { data } = await supabase
  .from('audit_logs')
  .select('*')
  .eq('table_name', 'payments')
  .eq('record_id', paymentId)
  .order('changed_at', { ascending: false })
```

### RLS ของ audit_logs
- เจ้าของหอ: เห็น log ของ payments และ bills ในหอตัวเอง
- ผู้เช่า: เห็น log ของ payments และ bills ตัวเอง
- เขียนได้เฉพาะผ่าน trigger — ไม่มี INSERT/UPDATE/DELETE policy

---

## 14. Storage Buckets — การจัดเก็บไฟล์

ระบบใช้ 3 buckets ทั้งหมดเป็น **Private**

| Bucket | Path | ผู้เช่า | เจ้าของหอ |
|---|---|---|---|
| `slips` | `/{dorm_id}/{bill_id}/{filename}` | อัปโหลด + ดูสลิปตัวเอง | ดู + ลบสลิปในหอ |
| `contracts` | `/{dorm_id}/{tenant_id}/{filename}` | ดูสัญญาตัวเอง | จัดการทุก operation |
| `maintenance-images` | `/{dorm_id}/{room_id}/{filename}` | อัปโหลดรูปห้องตัวเอง | ดูรูปทุกห้องในหอ |

> ⚠️ ชื่อ bucket `maintenance-images` ห้ามเปลี่ยน — RLS อ้างชื่อนี้ตรงๆ

**อัปโหลดและอ่านไฟล์:**
```javascript
// อัปโหลด
const path = `${dormId}/${billId}/${Date.now()}_slip.jpg`
await supabase.storage.from('slips').upload(path, file)

// อ่าน (ต้องใช้ signed URL — bucket เป็น private)
const { data: { signedUrl } } = await supabase.storage
  .from('slips')
  .createSignedUrl(path, 3600)  // หมดอายุใน 1 ชั่วโมง

// ห้ามใช้ getPublicUrl() — จะ return URL ที่เปิดไม่ได้
```

---

## 15. Indexes — ครบทุกตัวที่มี

### Regular Indexes
| Index | Column | เหตุผล |
|---|---|---|
| `idx_dorms_owner` | `dorms.owner_id` | query หอของเจ้าของ |
| `idx_rooms_dorm` | `rooms.dorm_id` | query ห้องในหอ |
| `idx_tenants_room` | `tenants.room_id` | query ผู้เช่าในห้อง |
| `idx_tenants_user_id` | `tenants.user_id` | RLS ใช้ทุก request |
| `idx_utilities_room` | `utilities.room_id` | query ประวัติมิเตอร์ |
| `idx_bills_tenant` | `bills.tenant_id` | query บิลของผู้เช่า |
| `idx_bills_status` | `bills.status` | กรองบิล overdue |
| `idx_bills_room` | `bills.room_id` | RLS ของ bills ใช้บ่อยมาก |
| `idx_payments_bill` | `payments.bill_id` | query การชำระเงินของบิล |
| `idx_maintenance_room` | `maintenance.room_id` | query ประวัติแจ้งซ่อม |
| `idx_announcements_dorm` | `announcements.dorm_id` | query ประกาศหอ |
| `idx_audit_table_record` | `audit_logs(table_name, record_id)` | ดู history ของ record |
| `idx_audit_changed_by` | `audit_logs.changed_by` | ดูว่า user ทำอะไร |
| `idx_audit_changed_at` | `audit_logs.changed_at DESC` | เรียงล่าสุด |

### Partial Indexes
| Index | Condition | เหตุผล |
|---|---|---|
| `idx_dorms_deleted_at` | `WHERE deleted_at IS NULL` | กรอง active dorms |
| `idx_rooms_deleted_at` | `WHERE deleted_at IS NULL` | กรอง active rooms |
| `idx_tenants_deleted_at` | `WHERE deleted_at IS NULL` | กรอง active tenants |
| `idx_payments_pending` | `WHERE status = 'pending'` | รายการรอตรวจ — query บ่อยสุด |
| `idx_tenants_active` | `WHERE status = 'active' AND deleted_at IS NULL` | RLS lookup ผู้เช่า |

### Unique Partial Index
| Index | Condition | เหตุผล |
|---|---|---|
| `idx_one_active_tenant_per_room` | `WHERE status = 'active' AND deleted_at IS NULL` | กัน 1 ห้องมีหลาย active tenant |

---

## 16. Checklist ก่อน Deploy Production

### Database Setup
- [ ] สร้าง Vault secret `id_card_encrypt_key` แล้ว
- [ ] สำรอง Vault secret value ไว้ในที่ปลอดภัยนอก Supabase
- [ ] สร้าง Storage buckets ครบ: `slips`, `contracts`, `maintenance-images` (Private ทั้งหมด)
- [ ] เปิด Extensions: `pgcrypto` และ `btree_gist` (Database → Extensions)
- [ ] รัน `migration.sql` สำเร็จไม่มี error
- [ ] รัน `rls_policies.sql` สำเร็จไม่มี error
- [ ] ตั้งค่า `dorm_settings` (electric_rate, water_rate) ก่อน insert utilities

### Frontend / Application
- [ ] หน้า Onboarding เลือก role และอัปเดต `users.role` ตามนั้น
- [ ] ปุ่มส่งสลิปมี debounce หรือ disable หลังกด (ป้องกัน double-submit)
- [ ] ดัก error `ยอดชำระรวมเกินกว่ายอดบิล` และ `ไม่สามารถ approve ได้` แสดงผลที่เหมาะสม
- [ ] ดัก error `trial_expired:` นำไปหน้า upgrade plan
- [ ] ดัก error `duplicate key ... idx_one_active_tenant_per_room` แสดง "ห้องนี้มีผู้เช่าอยู่แล้ว"
- [ ] บันทึก `id_card_number` ผ่าน `encrypt_id_card()` เสมอ
- [ ] แสดง `id_card_number` ผ่าน `decrypt_id_card()` เสมอ
- [ ] query `announcements` ใช้ `@>` operator กรอง target_audience
- [ ] อัปโหลดไฟล์ Storage ใช้ path ตามโครงสร้าง `{dorm_id}/...`
- [ ] อ่านไฟล์ Storage ใช้ `createSignedUrl` ไม่ใช่ `getPublicUrl`

### Security
- [ ] ไม่มี encryption key ใน source code หรือ `.env`
- [ ] ทดสอบ `anon` role เข้าถึงข้อมูลไม่ได้
- [ ] ทดสอบ tenant A มองไม่เห็นข้อมูลของ tenant B
- [ ] ทดสอบ free user ที่ trial หมดแล้ว INSERT ไม่ได้ (read-only)
- [ ] ทดสอบแก้ยอดเงินบิลหลังสร้างไม่ได้

---

## 17. LINE Notification — ไฟล์แยก

ระบบ LINE แยกเป็นไฟล์ `migration_line_notification.sql` รันหลังจาก migration.sql และ rls_policies.sql

### Tables ที่เพิ่มมา
| Table | หน้าที่ |
|---|---|
| `line_oa_configs` | เก็บ channel_id, channel_secret, access_token แยกตามหอ |
| `line_link_tokens` | token ชั่วคราว 7 วัน สำหรับให้ลูกบ้านผูก LINE account |
| `line_notification_logs` | log ทุก message ที่ส่งออก |
| `tenants.line_user_id` | LINE User ID หลังผูกสำเร็จ |

### วิธีผูก LINE ลูกบ้าน
```
เจ้าของหอสร้าง link token → ส่งให้ลูกบ้าน
    ↓
ลูกบ้านกด link → LINE Login → ได้ line_user_id
    ↓
เรียก consume_line_link_token(token, line_user_id)
    ↓
ผูก line_user_id กับ tenant + room สำเร็จ
```

### LINE Quota
- **Push Message** = กิน quota (200/เดือน free tier)
- **Reply Message** = ฟรีไม่จำกัด (ตอบภายใน 30 วินาที)
- แนะนำ: ส่งบิล 1 push + แจ้งผล approve 1 push = 2 push/คน/เดือน → รองรับ 100 ห้อง/หอ

### Checklist ก่อนใช้ LINE
- [ ] สร้าง Messaging API Channel ใน LINE Developers Console
- [ ] สร้าง LIFF App → ได้ `liff_id`
- [ ] ตั้ง Webhook URL ชี้มา Edge Function
- [ ] รัน `migration_line_notification.sql`
- [ ] Deploy Edge Functions: `line-liff-callback`, `line-webhook`, `line-send-bill`

---

*หากพบปัญหาหรือมีการแก้ไข SQL ให้อัปเดตไฟล์นี้พร้อมกันทุกครั้ง*
