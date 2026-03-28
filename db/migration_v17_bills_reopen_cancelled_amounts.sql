-- ============================================================
-- v17: อนุญาตแก้ยอดในบิลเมื่อสถานะเดิมเป็น cancelled
-- ============================================================
-- เหตุผล: เจ้าของยกเลิกบิลแล้วแก้มิเตอร์/ค่าเช่า — ต้องออกบิลใหม่ด้วยยอดใหม่ได้
-- trigger เดิมห้ามแก้ room_amount ฯลฯ ทุกกรณี ทำให้ reopen ไม่ได้
-- รันใน Supabase SQL Editor หลัง deploy โค้ดที่ส่ง patch ยอดตอน reopen

CREATE OR REPLACE FUNCTION public.prevent_bill_amount_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

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
