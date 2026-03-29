/** ข้อความเดียวกันสำหรับใบเสร็จ + LINE Flex — จาก dorm_settings.billing_day (1–31) */
export function formatMeterScheduleLine(billingDay: unknown): string | null {
  const n = typeof billingDay === 'number' ? billingDay : Number(billingDay)
  if (!Number.isFinite(n)) return null
  const d = Math.trunc(n)
  if (d < 1 || d > 31) return null
  return `รอบจดมิเตอร์ทุกวันที่ ${d}`
}
