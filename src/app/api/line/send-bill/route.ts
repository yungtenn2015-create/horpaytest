import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
        utilities:utility_id(*)
      `)
      .eq('id', billId)
      .maybeSingle();

    if (billError || !bill) {
      console.error('Bill not found:', billError);
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // INITIAL LOG - To see if we even reached here
    await supabaseAdmin.from('line_notification_logs').insert({
        dorm_id: bill.rooms.dorm_id,
        receiver_id: bill.tenants?.line_user_id || 'UNKNOWN',
        message_type: 'debug',
        status: 'starting',
        error_message: `Attempting to send bill ${billId}`
    });

    if (!bill.tenants?.line_user_id) {
       console.error('Tenant has no LINE linked. Bill ID:', billId, 'Tenant:', bill.tenants);
       await supabaseAdmin.from('line_notification_logs').insert({
          dorm_id: bill.rooms.dorm_id,
          receiver_id: 'UNKNOWN',
          message_type: 'error',
          status: 'failed',
          error_message: 'Tenant has no LINE linked'
       });
       return NextResponse.json({ error: 'Tenant has no LINE linked' }, { status: 400 });
    }

    // 2. Fetch Dorm & settings
    const [ { data: dorm }, { data: settings }, { data: dormConfig } ] = await Promise.all([
      supabaseAdmin.from('dorms').select('name, contact_number').eq('id', bill.rooms.dorm_id).single(),
      supabaseAdmin.from('dorm_settings').select('*').eq('dorm_id', bill.rooms.dorm_id).maybeSingle(),
      supabaseAdmin.from('line_oa_configs').select('*').eq('dorm_id', bill.rooms.dorm_id).maybeSingle()
    ]);

    if (!dormConfig) {
      console.error('LINE OA not configured for dorm:', bill.rooms.dorm_id);
      await supabaseAdmin.from('line_notification_logs').insert({
          dorm_id: bill.rooms.dorm_id,
          receiver_id: bill.tenants.line_user_id,
          message_type: 'error',
          status: 'failed',
          error_message: 'LINE OA not configured'
      });
      return NextResponse.json({ error: 'LINE OA not configured' }, { status: 400 });
    }

    // 3. Construct Flex Message
    const flexMessage = createBillFlexMessage(bill, dorm || { name: 'หอพัก' }, settings);

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

    // 5. Log notification (Final result)
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

function createBillFlexMessage(bill: any, dorm: any, bankSettings: any) {
  const dormName = dorm.name || 'หอพัก';
  const roomAmount = Number(bill.room_amount) || 0;
  const utils = bill.utilities;
  const waterAmount = Number(utils?.water_price) || 0;
  const electricAmount = Number(utils?.electric_price) || 0;
  const otherAmount = Number(bill.other_amount) || 0;
  const totalAmount = Number(bill.total_amount) || 0;

  const roomNumber = bill.rooms?.room_number || '-';

  const billingMonth = bill.billing_month ? 
    new Date(bill.billing_month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) : 
    '-';

  const dormLabel = dorm?.contact_number ? 
    `${dormName} (โทร: ${dorm?.contact_number})` : 
    dormName;

  const dueDate = bill.due_date ? 
    new Date(bill.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : 
    '-';

  return {
    type: "flex",
    altText: `${dormName} - แจ้งค่าเช่าห้อง ${roomNumber} (฿${totalAmount.toLocaleString()})`,
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
            text: dormLabel,
            color: "#ECFDF5",
            size: "sm",
            weight: "bold"
          },
          {
            type: "text",
            text: `แจ้งค่าเช่าห้อง ${roomNumber}`,
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
            margin: "4px"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "ชื่อผู้เช่า",
                color: "#6B7280",
                size: "sm"
              },
              {
                type: "text",
                text: bill.tenants?.name || '-',
                color: "#111827",
                weight: "bold",
                size: "sm",
                align: "end"
              }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "sm",
            contents: [
              {
                type: "text",
                text: "ประจำเดือน",
                color: "#6B7280",
                size: "sm"
              },
              {
                type: "text",
                text: billingMonth,
                color: "#111827",
                weight: "bold",
                size: "sm",
                align: "end"
              }
            ]
          },
          {
            type: "separator",
            margin: "xl",
            color: "#F3F4F6"
          },
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
                  {
                    type: "text",
                    text: "ค่าเช่าห้อง",
                    color: "#6B7280",
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `฿${roomAmount.toLocaleString()}`,
                    color: "#111827",
                    weight: "bold",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: "ค่าน้ำประปา",
                        color: "#6B7280",
                        size: "md"
                      },
                      {
                        type: "text",
                        text: `฿${waterAmount.toLocaleString()}`,
                        color: "#111827",
                        weight: "bold",
                        align: "end"
                      }
                    ]
                  },
                  ...(utils ? [{
                    type: "text",
                    text: `มิเตอร์: ${utils.prev_water_meter} → ${utils.curr_water_meter} หน่วย`,
                    color: "#9CA3AF",
                    size: "xs",
                    margin: "xs"
                  }] : [])
                ]
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: "ค่าไฟฟ้า",
                        color: "#6B7280",
                        size: "md"
                      },
                      {
                        type: "text",
                        text: `฿${electricAmount.toLocaleString()}`,
                        color: "#111827",
                        weight: "bold",
                        align: "end"
                      }
                    ]
                  },
                  ...(utils ? [{
                    type: "text",
                    text: `มิเตอร์: ${utils.prev_electric_meter} → ${utils.curr_electric_meter} หน่วย`,
                    color: "#9CA3AF",
                    size: "xs",
                    margin: "xs"
                  }] : [])
                ]
              },
              ...(otherAmount > 0 ? [{
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "อื่นๆ",
                    color: "#6B7280",
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `฿${otherAmount.toLocaleString()}`,
                    color: "#111827",
                    weight: "bold",
                    align: "end"
                  }
                ]
              }] : [])
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "xl",
            contents: [
              {
                type: "text",
                text: "ยอดรวมทั้งสิ้น",
                color: "#111827",
                weight: "bold",
                size: "lg"
              },
              {
                type: "text",
                text: `฿${totalAmount.toLocaleString()}`,
                color: "#10B981",
                weight: "bold",
                size: "xl",
                align: "end"
              }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            backgroundColor: "#FEF2F2",
            paddingAll: "12px",
            cornerRadius: "8px",
            contents: [
              {
                type: "text",
                text: `📅 กำหนดชำระภายในวันที่ ${dueDate}`,
                color: "#B91C1C",
                size: "sm",
                weight: "bold",
                align: "center",
                wrap: true
              }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            backgroundColor: "#F9FAFB",
            paddingAll: "16px",
            cornerRadius: "12px",
            contents: [
              {
                type: "text",
                text: "บัญชีโอนชำระเงิน",
                color: "#374151",
                weight: "bold",
                size: "sm"
              },
              {
                type: "text",
                text: `${bankSettings?.bank_name || '-'}`,
                color: "#111827",
                weight: "bold",
                size: "sm",
                margin: "sm"
              },
              {
                type: "text",
                text: `${bankSettings?.bank_account_no || '-'}`,
                color: "#10B981",
                weight: "bold",
                size: "lg",
                margin: "4px"
              },
              {
                type: "text",
                text: `${bankSettings?.bank_account_name || dormName}`,
                color: "#6B7280",
                size: "sm"
              }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            margin: "xl",
            contents: [
              {
                type: "text",
                text: "⚠️ โอนแล้วส่งสลิปแจ้งในแชทนี้ได้เลยค่ะ",
                color: "#EF4444",
                size: "xs",
                align: "center",
                weight: "bold"
              }
            ]
          }
        ]
      }
    }
  };
}
