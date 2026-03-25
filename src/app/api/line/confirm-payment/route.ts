import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { billId } = await req.json();

    if (!billId) {
      return NextResponse.json({ error: 'billId is required' }, { status: 400 });
    }

    // 1. Fetch Bill Data
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
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    if (!bill.tenants?.line_user_id) {
      return NextResponse.json({ error: 'Tenant has no LINE linked' }, { status: 400 });
    }

    // 2. Fetch Dorm & LINE Config
    const [{ data: dorm }, { data: dormConfig }] = await Promise.all([
      supabaseAdmin.from('dorms').select('name').eq('id', bill.rooms.dorm_id).single(),
      supabaseAdmin.from('line_oa_configs').select('*').eq('dorm_id', bill.rooms.dorm_id).maybeSingle()
    ]);

    if (!dormConfig) {
      return NextResponse.json({ error: 'LINE OA not configured' }, { status: 400 });
    }

    // 3. Construct Flex Message
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
    console.error('Confirm payment error details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function createConfirmFlexMessage(bill: any, dormName: string) {
  const totalAmount = Number(bill.total_amount) || 0;
  const billingMonth = bill.billing_month ?
    new Date(bill.billing_month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) :
    '-';

  return {
    type: "flex",
    altText: "ยืนยันการชำระเงินเรียบร้อยแล้ว",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#10B981",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "ชำระเงินเรียบร้อยแล้ว",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            align: "center"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: bill.tenants?.name || 'ผู้เช่า',
            weight: "bold",
            size: "xl",
            color: "#111827",
            align: "center"
          },
          {
            type: "text",
            text: "ได้รับยอดชำระเงินแล้ว ขอบคุณค่ะ",
            size: "md",
            color: "#6B7280",
            align: "center",
            margin: "8px"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xxl",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "ห้อง",
                    color: "#9CA3AF",
                    size: "sm"
                  },
                  {
                    type: "text",
                    text: bill.rooms?.room_number || '-',
                    color: "#111827",
                    size: "sm",
                    weight: "bold",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "รอบบิล",
                    color: "#9CA3AF",
                    size: "sm"
                  },
                  {
                    type: "text",
                    text: billingMonth,
                    color: "#111827",
                    size: "sm",
                    weight: "bold",
                    align: "end"
                  }
                ]
              },
              {
                type: "separator",
                margin: "md",
                color: "#F3F4F6"
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "md",
                contents: [
                  {
                    type: "text",
                    text: "จำนวนเงินที่ได้รับ",
                    color: "#111827",
                    weight: "bold",
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `฿${totalAmount.toLocaleString()}`,
                    color: "#10B981",
                    weight: "bold",
                    size: "lg",
                    align: "end"
                  }
                ]
              }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xxl",
            contents: [
              {
                type: "text",
                text: dormName,
                color: "#9CA3AF",
                size: "xs",
                align: "center"
              }
            ]
          }
        ]
      }
    }
  };
}
