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
    // Safer approach: do NOT auto-link owner on follow.
    // Everyone gets the same welcome, then owner can claim via OWNER-XXXXXX (generated from dashboard).
    const welcomeFlex = {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${config.dorms?.name || 'หอพัก'}`,
            weight: 'bold',
            size: 'xl',
            color: '#16A34A'
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับค่ะ',
            weight: 'bold',
            size: 'md',
            color: '#4b5563',
            margin: 'sm'
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
            text: 'ไลน์นี้ใช้สำหรับแจ้งเตือนชำระค่าห้อง และรับสลิปจากผู้เช่า',
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
                text: 'ผู้เช่า: พิมพ์ เลขห้อง-เบอร์โทรศัพท์',
                weight: 'bold',
                size: 'sm',
                color: '#4b5563'
              },
              {
                type: 'text',
                text: 'ตัวอย่าง: 101-0812345678',
                size: 'xs',
                color: '#6b7280',
                margin: 'sm'
              },
              {
                type: 'separator',
                margin: 'md'
              },
              {
                type: 'text',
                text: 'เจ้าของหอ: พิมพ์ OWNER-XXXXXX',
                weight: 'bold',
                size: 'sm',
                color: '#4b5563',
                margin: 'md'
              },
              {
                type: 'text',
                text: 'รหัสยืนยันสร้างได้ที่หน้า Settings > การเชื่อมต่อ LINE',
                size: 'xs',
                color: '#6b7280',
                margin: 'sm',
                wrap: true
              }
            ]
          }
        ]
      }
    };

    await replyFlex(replyToken, config.access_token, 'ยินดีต้อนรับสู่ Horpay', welcomeFlex);
  }

  if (type === 'message') {
    if (event.message.type === 'text') {
      const text = event.message.text.trim();

      // Owner claim: OWNER-123456
      // Accept common variations like spaces, different dash characters, or missing dash.
      const normalizedOwnerText = text
        // Remove invisible characters (ZWSP, BOM, etc.)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, '')
        .replace(/[–—−]/g, '-') // en dash/em dash/minus
        .replace(/[：]/g, ':')
        // Convert full-width digits ０-９ to 0-9
        .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
        // Convert Thai digits ๐-๙ to 0-9
        .replace(/[๐-๙]/g, (ch) => String(ch.charCodeAt(0) - 0x0e50));

      console.log('LINE message raw text:', text);
      console.log('LINE message normalizedOwnerText:', normalizedOwnerText);

      // Very tolerant: just find 'owner' + 6 digits anywhere after it
      const digitToAscii = (ch: string) => {
        const codePoint = ch.codePointAt(0) || 0
        // ASCII 0-9
        if (codePoint >= 0x30 && codePoint <= 0x39) return ch
        // Thai digits: ๐-๙ (U+0E50..U+0E59)
        if (codePoint >= 0x0E50 && codePoint <= 0x0E59) return String(codePoint - 0x0E50)
        // Fullwidth digits: ０-９ (U+FF10..U+FF19)
        if (codePoint >= 0xFF10 && codePoint <= 0xFF19) return String(codePoint - 0xFF10)
        // Arabic-Indic digits: ٠-٩ (U+0660..U+0669)
        if (codePoint >= 0x0660 && codePoint <= 0x0669) return String(codePoint - 0x0660)
        // Extended Arabic-Indic digits: ۰-۹ (U+06F0..U+06F9)
        if (codePoint >= 0x06F0 && codePoint <= 0x06F9) return String(codePoint - 0x06F0)
        return ''
      }

      const ownerHasWord = /owner/i.test(normalizedOwnerText)
      const ownerClaimMatch = normalizedOwnerText.match(/owner[^0-9]*([0-9]{6})/i);
      let code: string | null = null

      if (ownerClaimMatch) {
        code = ownerClaimMatch[1]
      } else if (ownerHasWord) {
        // Ultimate fallback: take any 6 decimal digits found after normalization.
        const digitsAny = normalizedOwnerText.match(/\p{Nd}/gu) || []
        if (digitsAny.length >= 6) {
          const mapped = digitsAny.slice(-6).map(digitToAscii).filter(Boolean)
          if (mapped.length === 6) code = mapped.join('')
        }
      }

      if (code) {
        const expiresAt = config.owner_claim_expires_at ? new Date(config.owner_claim_expires_at) : null;
        const isExpired = !expiresAt || isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now();

        if (!config.owner_claim_code) {
          await replyText(replyToken, config.access_token, `ยังไม่มีรหัสยืนยันในระบบ กรุณาให้แอดมินสร้างรหัสที่หน้า Settings > การเชื่อมต่อ LINE ก่อนครับ`);
          return;
        }

        if (isExpired) {
          await replyText(replyToken, config.access_token, `รหัสยืนยันหมดอายุแล้ว กรุณาให้แอดมินสร้างรหัสใหม่ในหน้า Settings > การเชื่อมต่อ LINE ครับ`);
          return;
        }

        if (String(config.owner_claim_code) !== code) {
          await replyText(replyToken, config.access_token, `รหัสยืนยันไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง (รูปแบบ: OWNER-123456)`);
          return;
        }

        const { error: linkErr } = await supabaseAdmin
          .from('line_oa_configs')
          .update({
            owner_line_user_id: lineUserId,
            owner_claim_used_at: new Date().toISOString(),
            owner_claim_code: null,
            owner_claim_expires_at: null
          })
          .eq('id', config.id);

        if (linkErr) {
          await replyText(replyToken, config.access_token, `ผูกบัญชีเจ้าของไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`);
          return;
        }

        await replyText(replyToken, config.access_token, `ผูกบัญชีเจ้าของสำเร็จ ✅ ตอนนี้บัญชีนี้จะได้รับแจ้งเตือนสลิปและแจ้งเตือนจากระบบครับ`);
        return;
      }
      // If user is trying to claim owner but format is wrong, reply with a specific hint.
      if (/owner/i.test(normalizedOwnerText)) {
        await replyText(
          replyToken,
          config.access_token,
          `รูปแบบ Owner Code ไม่ถูกต้องครับ\n\nตัวอย่างที่ถูกต้อง:\n- owner-123456\n- owner123456\n\nหมายเหตุ: ต้องเป็นเลข 6 หลักเท่านั้น`
        );
        return;
      }

      // Pattern: [RoomNum]-[Phone] (owner claim is handled above)
      // We normalize digits so user can input Thai digits / full-width digits / etc.
      const normalizedTenantText = text
        // Remove invisible characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // Normalize dash variants to '-'
        .replace(/[–—−]/g, '-')
        // Convert full-width digits ０-９ to 0-9
        .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
        // Convert Thai digits ๐-๙ to 0-9
        .replace(/[๐-๙]/g, (ch) => String(ch.charCodeAt(0) - 0x0e50))
        // Convert Arabic-Indic digits ٠-٩ to 0-9
        .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
        // Convert Extended Arabic-Indic digits ۰-۹ to 0-9
        .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));

      // Allow separators between room and phone: '-', whitespace, '_', ':'
      // Phone can be 9-10 digits (if 9 digits, we'll prefix with '0')
      const match = normalizedTenantText.match(/^(\w+)[\s\-_:]*([0-9]{9,10})$/);

      if (match) {
        const roomNum = match[1];
        let phoneNum = match[2];
        if (phoneNum.length === 9) {
          phoneNum = `0${phoneNum}`;
        }

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
            const mismatchFlex = {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: 'ข้อมูลไม่ถูกต้อง ⚠️',
                    weight: 'bold',
                    size: 'lg',
                    color: '#d97706'
                  },
                  {
                    type: 'text',
                    text: `ไม่พบข้อมูลที่ตรงกับห้อง ${roomNum} และเบอร์โทรที่ระบุค่ะ`,
                    wrap: true,
                    size: 'sm',
                    margin: 'md',
                    weight: 'bold'
                  },
                  {
                    type: 'text',
                    text: 'กรุณาตรวจสอบเบอร์โทรศัพท์ที่ให้ไว้กับทางหอพัก หรือติดต่อเจ้าหน้าที่เพื่อแก้ไขข้อมูลนะคะ',
                    wrap: true,
                    size: 'sm',
                    margin: 'xs',
                    color: '#6b7280'
                  }
                ]
              }
            };
            await replyFlex(replyToken, config.access_token, 'ข้อมูลไม่ถูกต้อง', mismatchFlex);
          }
        } else {
          const roomNotFoundFlex = {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: 'ไม่พบหมายเลขห้อง ⚠️',
                  weight: 'bold',
                  size: 'lg',
                  color: '#d97706'
                },
                {
                  type: 'text',
                  text: `ไม่พบหมายเลขห้อง ${roomNum} ในระบบของเราค่ะ กรุณาลองตรวจสอบหมายเลขห้องอีกครั้ง`,
                  wrap: true,
                  size: 'sm',
                  margin: 'md',
                  color: '#4b5563'
                }
              ]
            }
          };
          await replyFlex(replyToken, config.access_token, 'ไม่พบหมายเลขห้อง', roomNotFoundFlex);
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
                text: 'กรุณาพิมพ์ข้อมูลในรูปแบบที่กำหนดค่ะ',
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
                    text: 'ผู้เช่า: เลขห้อง-เบอร์โทรศัพท์',
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
                  ,
                  {
                    type: 'separator',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: 'เจ้าของหอ: OWNER-123456',
                    weight: 'bold',
                    size: 'sm',
                    align: 'center',
                    color: '#92400e',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: '(สร้างรหัสได้ที่หน้า Settings > การเชื่อมต่อ LINE)',
                    size: 'xs',
                    align: 'center',
                    color: '#78350f',
                    margin: 'xs',
                    wrap: true
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
