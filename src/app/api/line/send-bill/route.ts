import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { billId } = await req.json();
    console.log('Sending bill for ID:', billId);

    if (!billId) {
      return NextResponse.json({ error: 'billId is required' }, { status: 400 });
    }

    // 1. Fetch Bill Data with all relations
    const { data: bill, error: billError } = await supabaseAdmin
      .from('bills')
      .select(`
        *,
        rooms:room_id (room_number, dorm_id),
        tenants:tenant_id (name, line_user_id),
        utilities:utility_id (water_price, electric_price)
      `)
      .eq('id', billId)
      .maybeSingle();

    if (billError) {
      console.error('Database error fetching bill:', billError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!bill) {
      console.error('Bill not found for ID:', billId);
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    console.log('Bill data fetched:', JSON.stringify(bill, null, 2));

    if (!bill.tenants?.line_user_id) {
       console.error('Tenant has no LINE linked for bill:', billId);
       return NextResponse.json({ error: 'Tenant has no LINE linked' }, { status: 400 });
    }

    // 2. Fetch Dorm & LINE Config
    const { data: dormConfig, error: configError } = await supabaseAdmin
      .from('line_oa_configs')
      .select('*')
      .eq('dorm_id', bill.rooms.dorm_id)
      .maybeSingle();

    if (configError) {
        console.error('Database error fetching LINE config:', configError);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    if (!dormConfig) {
      console.error('LINE OA not configured for dorm:', bill.rooms.dorm_id);
      return NextResponse.json({ error: 'LINE OA not configured for this dorm' }, { status: 400 });
    }

    // 3. Construct Flex Message
    const { data: dorm } = await supabaseAdmin
      .from('dorms')
      .select('name')
      .eq('id', bill.rooms.dorm_id)
      .single();

    const flexMessage = createBillFlexMessage(bill, dorm?.name || 'หอพัก');
    console.log('Flex message constructed for room:', bill.rooms.room_number);

    // 4. Send via LINE Messaging API
    console.log('Pushing to LINE User ID:', bill.tenants.line_user_id);
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
    console.log('LINE API response status:', response.status);
    console.log('LINE API response body:', JSON.stringify(result, null, 2));

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
    console.error('Send bill error details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function createBillFlexMessage(bill: any, dormName: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const liffUrl = `https://liff.line.me/${liffId}?billId=${bill.id}`;
  
  const roomAmount = Number(bill.room_amount) || 0;
  const waterAmount = Number(bill.utilities?.water_price) || 0;
  const electricAmount = Number(bill.utilities?.electric_price) || 0;
  const otherAmount = Number(bill.other_amount) || 0;
  const totalAmount = Number(bill.total_amount) || 0;
  
  // Format Month Year (Thai)
  // bill.billing_month is string "YYYY-MM-DD"
  const date = new Date(bill.billing_month);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthStr = months[date.getMonth()];
  const yearStr = (date.getFullYear() + 543).toString().slice(-2);

  return {
    type: "flex",
    altText: `ใบแจ้งหนี้เดือน ${monthStr} ${yearStr} - ห้อง ${bill.rooms.room_number}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "INVOICE",
            color: "#ffffff",
            weight: "bold",
            size: "sm",
            letterSpacing: "0.2em"
          },
          {
            type: "text",
            text: dormName,
            color: "#ffffff",
            size: "xl",
            weight: "bold",
            margin: "sm"
          },
          {
            type: "text",
            text: `ห้อง ${bill.rooms.room_number}`,
            color: "#ffffffcc",
            size: "sm",
            weight: "bold"
          }
        ],
        backgroundColor: "#059669",
        paddingAll: "25px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
                { type: "text", text: "ประจำเดือน", size: "sm", color: "#8c8c8c" },
                { type: "text", text: `${monthStr} 25${yearStr}`, size: "sm", color: "#111111", align: "end", weight: "bold" }
            ]
          },
          { type: "separator", margin: "xl" },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ค่าเช่าห้อง", size: "sm", color: "#555555" },
                  { type: "text", text: `฿${roomAmount.toLocaleString()}`, size: "sm", color: "#111111", align: "end", weight: "bold" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ค่าน้ำประปา", size: "sm", color: "#555555" },
                  { type: "text", text: `฿${waterAmount.toLocaleString()}`, size: "sm", color: "#111111", align: "end", weight: "bold" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ค่าไฟฟ้า", size: "sm", color: "#555555" },
                  { type: "text", text: `฿${electricAmount.toLocaleString()}`, size: "sm", color: "#111111", align: "end", weight: "bold" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "อื่นๆ", size: "sm", color: "#555555" },
                  { type: "text", text: `฿${otherAmount.toLocaleString()}`, size: "sm", color: "#111111", align: "end", weight: "bold" }
                ]
              }
            ]
          },
          { type: "separator", margin: "xl" },
          {
            type: "box",
            layout: "horizontal",
            margin: "xl",
            contents: [
              { type: "text", text: "ยอดรวมทั้งสิ้น", weight: "bold", size: "lg", color: "#111111" },
              { type: "text", text: `฿${totalAmount.toLocaleString()}`, weight: "bold", size: "lg", align: "end", color: "#059669" }
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
              label: "ดูรายละเอียด / จ่ายเงิน",
              uri: liffUrl
            },
            style: "primary",
            color: "#059669",
            height: "md"
          }
        ],
        paddingAll: "20px"
      },
      styles: {
        footer: {
          separator: true
        }
      }
    }
  };
}
