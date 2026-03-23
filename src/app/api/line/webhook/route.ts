import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin (since webhook needs to bypass RLS to write line_user_id)
export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
      await handleEvent(event, config, supabaseAdmin);
    }

    return NextResponse.json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

async function handleEvent(event: any, config: any, supabaseAdmin: any) {
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
      // Phase 2, Step 4: Improved Welcome Message for Tenants (Flex Message)
      const welcomeFlex = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${config.dorms?.name || 'ยินดีต้อนรับค่ะ'}`,
              weight: 'bold',
              size: 'xl',
              color: '#1e3a8a'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: 'ไลน์นี้ใช้สำหรับแจ้งเตือนชำระค่าห้อง',
              wrap: true,
              size: 'sm'
            },
            {
              type: 'text',
              text: 'ลงทะเบียนเพื่อเชื่อมบิลค่าห้องแจ้งเตือนในไลน์',
              wrap: true,
              size: 'sm'
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#f3f4f6',
              paddingAll: 'lg',
              cornerRadius: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'กรุณาพิมพ์: เลขห้อง-เบอร์โทรศัพท์',
                  weight: 'bold',
                  size: 'sm',
                  color: '#4b5563'
                },
                {
                  type: 'text',
                  text: 'ตัวอย่าง: 101-0123456789',
                  size: 'xs',
                  color: '#6b7280',
                  margin: 'sm'
                }
              ]
            },
            {
              type: 'text',
              text: 'พิมพ์เสร็จแล้วส่งมาได้เลยค่ะ 😊',
              size: 'sm',
              wrap: true,
              margin: 'md'
            }
          ]
        }
      };

      await replyFlex(replyToken, config.access_token, 'ยินดีต้อนรับสู่ Horpay', welcomeFlex);
    }
  }

  if (type === 'message') {
    if (event.message.type === 'text') {
      const text = event.message.text.trim();

      // Pattern: [RoomNum]-[10-digit Phone] (e.g., "101-0812345678")
      const verifyPattern = /^(\w+)-(\d{10})$/;
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
              const successFlex = {
                type: 'bubble',
                body: {
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    {
                      type: 'text',
                      text: 'ลงทะเบียนสำเร็จ 🎉',
                      weight: 'bold',
                      size: 'xl',
                      color: '#059669'
                    },
                    {
                      type: 'separator',
                      margin: 'md'
                    },
                    {
                      type: 'box',
                      layout: 'vertical',
                      margin: 'md',
                      spacing: 'sm',
                      contents: [
                        {
                          type: 'text',
                          text: `ยินดีต้อนรับคุณ ${tenant.name}`,
                          wrap: true,
                          weight: 'bold'
                        },
                        {
                          type: 'text',
                          text: `ห้องพัก: ${rooms.room_number}`,
                          size: 'sm',
                          color: '#4b5563'
                        }
                      ]
                    },
                    {
                      type: 'text',
                      text: 'คุณจะเริ่มรับแจ้งเตือนบิลผ่านทาง LINE ตั้งแต่รอบหน้าเป็นต้นค่ะ',
                      wrap: true,
                      size: 'xs',
                      color: '#6b7280',
                      margin: 'md'
                    }
                  ]
                }
              };
              await replyFlex(replyToken, config.access_token, 'ลงทะเบียนสำเร็จ', successFlex);
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
        // Help message for unrecognized inputs (Flex Message)
        const helpFlex = {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              {
                type: 'text',
                text: 'รูปแบบไม่ถูกต้อง ⚠️',
                weight: 'bold',
                size: 'lg',
                color: '#d97706'
              },
              {
                type: 'text',
                text: 'กรุณาพิมพ์ข้อมูลในรูปแบบที่กำหนดเพื่อลงทะเบียนห้องพักค่ะ',
                wrap: true,
                size: 'sm'
              },
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#fffbeb',
                paddingAll: 'md',
                cornerRadius: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: 'เลขห้อง-เบอร์โทรศัพท์',
                    weight: 'bold',
                    size: 'sm',
                    align: 'center',
                    color: '#92400e'
                  },
                  {
                    type: 'text',
                    text: '(ตัวอย่าง: 101-0812345678)',
                    size: 'xs',
                    align: 'center',
                    color: '#78350f',
                    margin: 'xs'
                  }
                ]
              }
            ]
          }
        };
        await replyFlex(replyToken, config.access_token, 'วิธีการลงทะเบียน', helpFlex);
      }
    }
    else if (event.message.type === 'image') {
      // User sent a slip/image
      console.log('User sent an image/slip. No auto-reply as per owner request.');
      // The owner will confirm later via the dashboard
    }
  }

  // Phase 6: Postback Handling (Payment Approval)
  if (type === 'postback') {
    // Logic will be added in Phase 6
  }
}

async function replyFlex(replyToken: string, accessToken: string, altText: string, flexContents: any) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{
        type: 'flex',
        altText: altText,
        contents: flexContents
      }]
    })
  });
  return res.json();
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
