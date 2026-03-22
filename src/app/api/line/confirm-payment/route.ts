import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { billId } = await req.json();
    console.log('Confirming payment for Bill ID:', billId);

    if (!billId) {
      return NextResponse.json({ error: 'billId is required' }, { status: 400 });
    }

    // 1. Fetch Bill Data with all relations
    const { data: bill, error: billError } = await supabaseAdmin
      .from('bills')
      .select(`
        *,
        rooms:room_id (room_number, dorm_id),
        tenants:tenant_id (name, line_user_id)
      `)
      .eq('id', billId)
      .maybeSingle();

    if (billError || !bill) {
      console.error('Bill not found:', billError);
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (!bill.tenants?.line_user_id) {
       return NextResponse.json({ error: 'Tenant has no LINE linked' }, { status: 400 });
    }

    // 2. Fetch Dorm & LINE Config
    const { data: dormConfig } = await supabaseAdmin
      .from('line_oa_configs')
      .select('*')
      .eq('dorm_id', bill.rooms.dorm_id)
      .maybeSingle();

    if (!dormConfig) {
      return NextResponse.json({ error: 'LINE OA not configured' }, { status: 400 });
    }

    // 3. Construct Flex Message
    const { data: dorm } = await supabaseAdmin
      .from('dorms')
      .select('name')
      .eq('id', bill.rooms.dorm_id)
      .single();

    const flexMessage = createConfirmFlexMessage(bill, dorm?.name || 'หอพัก');

    // 4. Send via LINE Messaging API
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dormConfig.access_token}`
      },
      body: JSON.stringify({
        to: bill.tenants.line_user_id,
        messages: [flexMessage]
      })
    });

    const result = await response.json();

    // 5. Log notification
    await supabaseAdmin.from('line_notification_logs').insert({
        dorm_id: bill.rooms.dorm_id,
        receiver_id: bill.tenants.line_user_id,
        message_type: 'flex',
        status: response.ok ? 'sent' : 'failed',
        error_message: response.ok ? null : JSON.stringify(result)
    });

    return NextResponse.json({ success: response.ok, result });
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function createConfirmFlexMessage(bill: any, dormName: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const liffUrl = `https://liff.line.me/${liffId}/dashboard/billing/receipt/${bill.id}`;
  
  const totalAmount = Number(bill.total_amount) || 0;
  
  const date = new Date(bill.billing_month);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthStr = months[date.getMonth()];
  const yearStr = (date.getFullYear() + 543).toString().slice(-2);

  return {
    type: "flex",
    altText: `ยืนยันการรับชำระเงินเดือน ${monthStr} ${yearStr} - ห้อง ${bill.rooms.room_number}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ชำระเงินเรียบร้อยแล้ว",
            color: "#ffffff",
            weight: "bold",
            size: "sm"
          },
          {
            type: "text",
            text: dormName,
            color: "#ffffff",
            size: "xl",
            weight: "bold",
            margin: "sm"
          }
        ],
        backgroundColor: "#06C755",
        paddingAll: "25px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "ได้รับยอดชำระเงินแล้ว ขอบคุณค่ะ",
                size: "md",
                color: "#111111",
                weight: "bold"
              },
              {
                type: "text",
                text: `ห้อง ${bill.rooms.room_number} | รอบบิล ${monthStr} 25${yearStr}`,
                size: "sm",
                color: "#8c8c8c",
                margin: "sm"
              }
            ]
          },
          { type: "separator", margin: "xl" },
          {
            type: "box",
            layout: "horizontal",
            margin: "xl",
            contents: [
              { type: "text", text: "จำนวนเงินที่ได้รับ", weight: "bold", size: "md", color: "#555555" },
              { type: "text", text: `฿${totalAmount.toLocaleString()}`, weight: "bold", size: "lg", align: "end", color: "#06C755" }
            ]
          }
        ],
        paddingAll: "25px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "ดูใบเสร็จรับเงิน",
              uri: liffUrl
            },
            style: "primary",
            color: "#06C755",
            height: "md"
          }
        ],
        paddingAll: "20px"
      }
    }
  };
}
