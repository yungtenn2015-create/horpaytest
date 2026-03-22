import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin (since webhook needs to bypass RLS to write line_user_id)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature');

    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    // Handle multiple LINE OAs
    // We need to find which config this webhook belongs to by checking the 'destination' in the body
    const jsonBody = JSON.parse(body);
    
    // Handle LINE Webhook Verification
    if (!jsonBody.events || jsonBody.events.length === 0) {
      return NextResponse.json({ message: 'OK' });
    }

    const destination = jsonBody.destination; // This is the Channel ID or User ID of the BOT

    // Find config by channel_id (destination)
    const { data: config } = await supabaseAdmin
      .from('line_oa_configs')
      .select('*, dorms(owner_id, name)')
      .eq('channel_id', destination)
      .single();

    if (!config) {
      console.error('No config found for destination:', destination);
      return new Response('Not configured', { status: 404 });
    }

    // Verify Signature
    const hash = crypto
      .createHmac('SHA256', config.channel_secret)
      .update(body)
      .digest('base64');

    if (hash !== signature) {
      return new Response('Invalid signature', { status: 401 });
    }

    // Process Events
    const events = jsonBody.events;
    for (const event of events) {
      await handleEvent(event, config);
    }

    return NextResponse.json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

async function handleEvent(event: any, config: any) {
  const { type, source, replyToken } = event;
  const lineUserId = source.userId;

  if (type === 'follow') {
    // Phase 2, Step 3: Link Owner
    // If we don't have an owner_line_user_id yet, assume the first follower is the owner
    // OR we could check if the lineUserId matches someone who just clicked a link (future)
    if (!config.owner_line_user_id) {
      await supabaseAdmin
        .from('line_oa_configs')
        .update({ owner_line_user_id: lineUserId })
        .eq('id', config.id);
      
      await replyText(replyToken, config.access_token, `สวัสดีครับเจ้าของหอ ${config.dorms.name}! ระบบผูกบัญชีเจ้าของสำหรับรับแจ้งเตือนสลิปเรียบร้อยแล้วครับ`);
    } else {
      // It's a tenant or some other person
      await replyText(replyToken, config.access_token, `สวัสดีครับ! ยินดีต้อนรับสู่ LINE OA ของ ${config.dorms.name} กรุณาแจ้งหมายเลขห้องของคุณเพื่อรับใบแจ้งหนี้ครับ`);
    }
  }

  if (type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    
    // Phase 3: Link Tenant by Room Number
    // Logic: Look for a tenant in this dorm with this room number
    const { data: rooms } = await supabaseAdmin
      .from('rooms')
      .select('id, room_number, dorm_id')
      .eq('dorm_id', config.dorm_id)
      .eq('room_number', text)
      .single();

    if (rooms) {
      // Find the active tenant in this room
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id, name')
        .eq('room_id', rooms.id)
        .eq('status', 'active')
        .single();

      if (tenant) {
        // Link the tenant
        await supabaseAdmin
          .from('tenants')
          .update({ line_user_id: lineUserId })
          .eq('id', tenant.id);

        await replyText(replyToken, config.access_token, `ยืนยันตัวตนสำเร็จ! คุณ ${tenant.name} ห้อง ${rooms.room_number} จะได้รับแจ้งเตือนบิลผ่านทางนี้ครับ`);
      } else {
        await replyText(replyToken, config.access_token, `ไม่พบผู้เช่าที่สถานะปกติในห้อง ${text} กรุณาแจ้งเจ้าของหอพักครับ`);
      }
    } else if (text.toLowerCase() === 'id') {
       await replyText(replyToken, config.access_token, `LINE ID ของคุณคือ: ${lineUserId}`);
    }
  }

  // Phase 6: Postback Handling (Payment Approval)
  if (type === 'postback') {
    // Logic will be added in Phase 6
  }
}

async function replyText(replyToken: string, accessToken: string, text: string) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }]
    })
  });
  return res.json();
}
