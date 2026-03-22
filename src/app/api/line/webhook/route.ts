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
    console.log('Webhook received for destination:', destination);

    // Find config by channel_id (destination)
    const { data: config, error: configError } = await supabaseAdmin
      .from('line_oa_configs')
      .select('*, dorms(owner_id, name)')
      .eq('channel_id', destination)
      .maybeSingle();

    if (configError) {
      console.error('Database error fetching config:', configError);
      return new Response('DB Error', { status: 500 });
    }

    if (!config) {
      console.error('No config found in database for destination:', destination);
      console.log('Please check that "Channel ID" in settings matches the Bot User ID from LINE Console.');
      return new Response('Not configured', { status: 404 });
    }

    // Verify Signature
    const hash = crypto
      .createHmac('SHA256', config.channel_secret)
      .update(body)
      .digest('base64');

    console.log('Signature verification - Body hash:', hash);
    console.log('Signature verification - LINE header:', signature);

    if (hash !== signature) {
      console.error('Signature verification failed');
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
    if (!config.owner_line_user_id) {
      await supabaseAdmin
        .from('line_oa_configs')
        .update({ owner_line_user_id: lineUserId })
        .eq('id', config.id);
      
      await replyText(replyToken, config.access_token, `สวัสดีครับเจ้าของหอ ${config.dorms?.name || ''}! ระบบผูกบัญชีเจ้าของสำหรับรับแจ้งเตือนสลิปเรียบร้อยแล้วครับ`);
    } else {
      // Improved Welcome Message for Tenants
      const welcomeMsg = `ยินดีต้อนรับสู่ ${config.dorms?.name || 'หอพักของเรา'}! 😊

เพื่อรับใบแจ้งหนี้ผ่านทาง LINE กรุณายืนยันตัวตนโดยพิมพ์:
"เลขห้อง" ตามด้วย "เบอร์โทรศัพท์"
(ตัวอย่าง: 101 0812345678)`;
      
      await replyText(replyToken, config.access_token, welcomeMsg);
    }
  }

  if (type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();
    
    // Pattern: [RoomNum] [10-digit Phone] (e.g., "101 0812345678")
    const verifyPattern = /^(\w+)\s+(\d{10})$/;
    const match = text.match(verifyPattern);

    if (match) {
      const roomNum = match[1];
      const phoneNum = match[2];

      const { data: rooms } = await supabaseAdmin
        .from('rooms')
        .select('id, room_number, dorm_id')
        .eq('dorm_id', config.dorm_id)
        .eq('room_number', roomNum)
        .single();

      if (rooms) {
        // Find the active tenant in this room matching THIS phone number
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name')
          .eq('room_id', rooms.id)
          .eq('phone', phoneNum)
          .eq('status', 'active')
          .single();

        if (tenant) {
          // Link the tenant
          const { error: updateError } = await supabaseAdmin
            .from('tenants')
            .update({ line_user_id: lineUserId })
            .eq('id', tenant.id);

          if (updateError) {
            await replyText(replyToken, config.access_token, `เกิดข้อผิดพลาดในการผูกบัญชี กรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าหน้าที่`);
          } else {
            await replyText(replyToken, config.access_token, `ยืนยันตัวตนสำเร็จ! 🎉คุณ ${tenant.name} ห้อง ${rooms.room_number} จะเริ่มรับแจ้งเตือนบิลผ่านทาง LINE ตั้งแต่รอบหน้าเป็นต้นไปครับ`);
          }
        } else {
          await replyText(replyToken, config.access_token, `ไม่พบข้อมูลที่ตรงกับห้อง ${roomNum} และเบอร์โทรที่ระบุ กรุณาตรวจสอบเบอร์โทรศัพท์ที่ให้ไว้กับทางหอพักอีกครั้งครับ`);
        }
      } else {
        await replyText(replyToken, config.access_token, `ไม่พบหมายเลขห้อง ${roomNum} ในระบบของเราครับ`);
      }
    } 
    else if (text.toLowerCase() === 'id') {
       await replyText(replyToken, config.access_token, `LINE ID ของคุณคือ: ${lineUserId}`);
    }
    else {
      // Optional: Help message for unrecognized inputs
      const helpMsg = `ดูเหมือนคุณพิมพ์ข้อมูลไม่ครบถ้วน
กรุณาพิมพ์: เลขห้อง [เว้นวรรค] เบอร์โทรศัพท์
(ตัวอย่าง: 101 0812345678)`;
      await replyText(replyToken, config.access_token, helpMsg);
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
