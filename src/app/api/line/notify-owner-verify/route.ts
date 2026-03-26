import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { billId } = await req.json()
    if (!billId) return NextResponse.json({ error: 'billId is required' }, { status: 400 })

    const { data: bill, error: billError } = await supabaseAdmin
      .from('bills')
      .select('id, status, total_amount, billing_month, room_id, tenant_id, rooms:room_id(room_number, dorm_id), tenants:tenant_id(name)')
      .eq('id', billId)
      .maybeSingle()

    if (billError || !bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

    const dormId = (bill as any).rooms?.dorm_id
    const roomNumber = (bill as any).rooms?.room_number || '-'
    const tenantName = (bill as any).tenants?.name || 'ผู้เช่า'

    const { data: cfg } = await supabaseAdmin
      .from('line_oa_configs')
      .select('access_token, owner_line_user_id')
      .eq('dorm_id', dormId)
      .maybeSingle()

    if (!cfg?.access_token) return NextResponse.json({ error: 'LINE OA not configured' }, { status: 400 })
    if (!cfg?.owner_line_user_id) return NextResponse.json({ error: 'Owner LINE not linked' }, { status: 400 })

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, slip_url, amount, status, created_at')
      .eq('bill_id', billId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const billingMonth = bill.billing_month
      ? new Date(bill.billing_month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
      : '-'

    const totalAmount = Number(bill.total_amount) || 0
    const slipUrl = payment?.slip_url || null

    const flex = {
      type: 'flex',
      altText: `ตรวจสลิป ห้อง ${roomNumber} (${tenantName})`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#10B981',
          paddingAll: '18px',
          contents: [
            { type: 'text', text: 'มีสลิปโอนเงินเข้ามา', color: '#ECFDF5', size: 'sm', weight: 'bold' },
            { type: 'text', text: `ห้อง ${roomNumber}`, color: '#FFFFFF', size: 'xl', weight: 'bold', margin: '4px' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '18px',
          spacing: 'md',
          contents: [
            { type: 'text', text: tenantName, size: 'md', weight: 'bold', color: '#111827' },
            { type: 'text', text: `รอบบิล: ${billingMonth}`, size: 'sm', color: '#6B7280' },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'ยอดชำระ', size: 'sm', color: '#6B7280', flex: 4 },
                { type: 'text', text: `฿${totalAmount.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#10B981', align: 'end', flex: 6 }
              ]
            },
            ...(slipUrl
              ? [
                  {
                    type: 'button',
                    style: 'link',
                    height: 'sm',
                    action: { type: 'uri', label: 'เปิดดูสลิป', uri: slipUrl }
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: 'หมายเหตุ: ยังไม่พบลิงก์สลิป (อาจส่งจากแหล่งอื่น)',
                    size: 'xs',
                    color: '#9CA3AF',
                    wrap: true
                  }
                ])
          ]
        },
        footer: {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#10B981',
              action: { type: 'postback', label: 'อนุมัติ', data: `action=approve&billId=${billId}` }
            },
            {
              type: 'button',
              style: 'secondary',
              action: { type: 'postback', label: 'ปฏิเสธ', data: `action=reject&billId=${billId}` }
            }
          ]
        }
      }
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.access_token}`
      },
      body: JSON.stringify({
        to: cfg.owner_line_user_id,
        messages: [flex]
      })
    })

    const result = await res.json().catch(() => ({}))
    return NextResponse.json({ success: res.ok, result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

