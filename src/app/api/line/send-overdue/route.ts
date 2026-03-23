import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

export async function GET(req: Request) {
  // We use GET so it can be easily triggered by a cron job URL call
  // For security, you might want to add a secret token in the header or query param
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. Calculate "Yesterday"
    const yesterday = subDays(new Date(), 1);
    const dateStr = format(yesterday, 'yyyy-MM-dd');
    
    console.log('Checking for overdue bills with due_date:', dateStr);

    // 2. Fetch Unpaid Bills due yesterday
    const { data: overdueBills, error: billsError } = await supabaseAdmin
      .from('bills')
      .select(`
        *,
        rooms:room_id (room_number, dorm_id),
        tenants:tenant_id (name, line_user_id),
        utilities:utility_id(*)
      `)
      .eq('status', 'unpaid')
      .eq('due_date', dateStr);

    if (billsError) {
      console.error('Error fetching overdue bills:', billsError);
      return NextResponse.json({ error: billsError.message }, { status: 500 });
    }

    if (!overdueBills || overdueBills.length === 0) {
      return NextResponse.json({ message: 'No overdue bills found for yesterday', date: dateStr });
    }

    console.log(`Found ${overdueBills.length} overdue bills. Processing...`);

    const results = [];

    // 3. Process each bill
    for (const bill of overdueBills) {
      if (!bill.tenants?.line_user_id) {
        results.push({ billId: bill.id, status: 'skipped', reason: 'No LINE ID' });
        continue;
      }

      // Fetch Dorm & settings for each (or group by dorm_id to optimize)
      const [ { data: dorm }, { data: settings }, { data: dormConfig } ] = await Promise.all([
        supabaseAdmin.from('dorms').select('name, contact_number').eq('id', bill.rooms.dorm_id).single(),
        supabaseAdmin.from('dorm_settings').select('*').eq('dorm_id', bill.rooms.dorm_id).maybeSingle(),
        supabaseAdmin.from('line_oa_configs').select('*').eq('dorm_id', bill.rooms.dorm_id).maybeSingle()
      ]);

      if (!dormConfig) {
        results.push({ billId: bill.id, status: 'skipped', reason: 'LINE OA not configured' });
        continue;
      }

      // 4. Construct Overdue Flex Message
      const flexMessage = createOverdueFlexMessage(bill, dorm || { name: 'หอพัก' }, settings);

      // 5. Send via LINE Messaging API
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

      const lineResult = await response.json();

      // Update bill status to 'overdue' if not already
      await supabaseAdmin.from('bills').update({ status: 'overdue' }).eq('id', bill.id);

      // Log notification
      await supabaseAdmin.from('line_notification_logs').insert({
          dorm_id: bill.rooms.dorm_id,
          receiver_id: bill.tenants.line_user_id,
          message_type: 'overdue_flex',
          status: response.ok ? 'sent' : 'failed',
          error_message: response.ok ? null : JSON.stringify(lineResult)
      });

      results.push({ billId: bill.id, status: response.ok ? 'sent' : 'failed', lineResult });
    }

    return NextResponse.json({ 
      message: `Processed ${overdueBills.length} bills`, 
      date: dateStr,
      results 
    });

  } catch (error: any) {
    console.error('Send overdue error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function createOverdueFlexMessage(bill: any, dorm: any, bankSettings: any) {
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
    altText: `⚠️ แจ้งเตือนเกินกำหนดชำระ - ห้อง ${roomNumber} (฿${totalAmount.toLocaleString()})`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F59E0B", // Amber/Yellow for overdue
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "แจ้งเตือนเกินกำหนดชำระ ⚠️",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl"
          },
          {
            type: "text",
            text: `ห้องพักเลขที่ ${roomNumber} | ${dormName}`,
            color: "#FEF3C7",
            size: "sm",
            margin: "sm"
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
            text: "บิลค่าห้องของคุณเกินกำหนดชำระแล้ว กรุณาชำระเงินโดยเร็วที่สุดค่ะ",
            color: "#92400E",
            weight: "bold",
            size: "sm",
            wrap: true
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
                  { type: "text", text: "ประจำเดือน", color: "#6B7280", size: "sm" },
                  { type: "text", text: billingMonth, color: "#111827", weight: "bold", size: "sm", align: "end" }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "ยอดค้างชำระรวม", color: "#111827", weight: "bold", size: "md" },
                  { type: "text", text: `฿${totalAmount.toLocaleString()}`, color: "#D97706", weight: "bold", size: "lg", align: "end" }
                ]
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
                color: "#D97706",
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
            type: "text",
            text: "โอนแล้วส่งสลิปแจ้งในแชทนี้ได้เลยค่ะ",
            color: "#4B5563",
            size: "xs",
            align: "center",
            margin: "xl"
          },
          {
            type: "text",
            text: "ขออภัยหากท่านชำระค่าห้องแล้วค่ะ",
            color: "#9CA3AF",
            size: "xxs",
            align: "center",
            margin: "md",
            style: "italic"
          }
        ]
      }
    }
  };
}
