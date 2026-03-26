import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

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
  console.log('Webhook event type:', type);
  console.log('Webhook message type:', event.message?.type || null);
  if (event.message?.type === 'text') {
    console.log('Webhook message text (as-is):', event.message.text);
  }

  if (type === 'follow') {
    // Safer approach: do NOT auto-link owner on follow.
    // Show only tenant guidance here (owner onboarding handled separately by manual guide).
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
              // Owner instructions removed intentionally
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
        .replace(/[０-９]/g, (ch: string) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
        // Convert Thai digits ๐-๙ to 0-9
        .replace(/[๐-๙]/g, (ch: string) => String(ch.charCodeAt(0) - 0x0e50));

      console.log('LINE message raw text:', text);
      console.log('LINE message normalizedOwnerText:', normalizedOwnerText);

      // Very tolerant: just find 'owner' + 6 digits anywhere after it
      const digitToAscii = (ch: string) => {
        const codePoint = ch.codePointAt(0) || 0
        // Generic fallback: try JS numeric conversion for other digit scripts
        const n = Number(ch)
        if (Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 9) return String(n)
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
          await replyText(replyToken, config.access_token, `ยังไม่สามารถดำเนินการได้ในขณะนี้ กรุณาติดต่อผู้ดูแลหอพักครับ`);
          return;
        }

        if (isExpired) {
          await replyText(replyToken, config.access_token, `ยังไม่สามารถดำเนินการได้ในขณะนี้ กรุณาติดต่อผู้ดูแลหอพักครับ`);
          return;
        }

        if (String(config.owner_claim_code) !== code) {
          await replyText(replyToken, config.access_token, `ข้อมูลไม่ถูกต้อง กรุณาติดต่อผู้ดูแลหอพักครับ`);
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

        const ownerLinkedSuccessFlex = {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'ผูกบัญชีเจ้าของหอสำเร็จ ✅',
                weight: 'bold',
                size: 'xl',
                color: '#16A34A',
                align: 'center'
              }
            ]
          },
          body: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#ECFDF5',
            paddingAll: 'lg',
            cornerRadius: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#DCFCE7',
                paddingAll: 'md',
                cornerRadius: 'md',
                contents: [
                  {
                    type: 'text',
                    text: 'ตอนนี้บัญชีนี้จะได้รับแจ้งเตือนสลิปและแจ้งเตือนจากระบบครับ',
                    wrap: true,
                    size: 'sm',
                    color: '#065F46',
                    weight: 'bold'
                  }
                ]
              },
              {
                type: 'separator',
                margin: 'md'
              },
              {
                type: 'text',
                text: 'หากต้องการทดสอบ ลองส่งสลิปจากผู้เช่าในห้องพักนั้นได้เลย',
                wrap: true,
                size: 'xs',
                color: '#166534',
                margin: 'sm'
              }
            ]
          }
        };

        console.log('Sending owner linked success FLEX');
        try {
          await replyFlex(
            replyToken,
            config.access_token,
            'ผูกบัญชีเจ้าของหอสำเร็จ',
            ownerLinkedSuccessFlex
          );
        } catch (err: unknown) {
          console.error('replyFlex failed:', err);
          // Fallback to plain text so user still gets confirmation
          await replyText(
            replyToken,
            config.access_token,
            `ผูกบัญชีเจ้าของหอสำเร็จ ✅ ตอนนี้บัญชีนี้จะได้รับแจ้งเตือนสลิปและแจ้งเตือนจากระบบครับ`
          );
        }
        return;
      }
      // If user is trying to claim owner but format is wrong, reply with a specific hint.
      if (/owner/i.test(normalizedOwnerText)) {
        await replyText(
          replyToken,
          config.access_token,
          `ยังไม่สามารถดำเนินการได้ในขณะนี้ กรุณาติดต่อผู้ดูแลหอพักครับ`
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
        .replace(/[０-９]/g, (ch: string) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
        // Convert Thai digits ๐-๙ to 0-9
        .replace(/[๐-๙]/g, (ch: string) => String(ch.charCodeAt(0) - 0x0e50))
        // Convert Arabic-Indic digits ٠-٩ to 0-9
        .replace(/[٠-٩]/g, (ch: string) => String(ch.charCodeAt(0) - 0x0660))
        // Convert Extended Arabic-Indic digits ۰-۹ to 0-9
        .replace(/[۰-۹]/g, (ch: string) => String(ch.charCodeAt(0) - 0x06f0));

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
                ]
              }
            ]
          }
        };
        await replyFlex(replyToken, config.access_token, 'วิธีการลงทะเบียน', helpFlex);
      }
    }
    else if (event.message.type === 'image') {
      // User sent a slip/image -> store (compressed) then notify owner with approve/reject buttons.
      try {
        const messageId = event.message.id;
        if (!messageId) {
          await replyText(replyToken, config.access_token, 'ไม่พบข้อมูลรูปภาพ กรุณาลองใหม่อีกครั้ง');
          return;
        }

        // 1) Find tenant by LINE user id (must be linked already)
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('id, name, room_id, status')
          .eq('line_user_id', lineUserId)
          .eq('status', 'active')
          .maybeSingle();

        if (!tenant?.id) {
          await replyText(
            replyToken,
            config.access_token,
            'ยังไม่พบการลงทะเบียนห้องพักของคุณครับ\nกรุณาพิมพ์: เลขห้อง-เบอร์โทรศัพท์ (เช่น 101-0812345678)'
          );
          return;
        }

        // 2) Find latest bill for this tenant/room that is not paid/cancelled
        const { data: bill } = await supabaseAdmin
          .from('bills')
          .select('id, status, total_amount, billing_month, room_id, tenant_id, rooms:room_id(room_number, dorm_id)')
          .eq('tenant_id', tenant.id)
          .neq('status', 'paid')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!bill?.id) {
          await replyText(replyToken, config.access_token, 'ไม่พบบิลที่ต้องตรวจสอบในระบบครับ');
          return;
        }

        // 3) Download image from LINE
        const contentRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
          headers: { Authorization: `Bearer ${config.access_token}` }
        });

        if (!contentRes.ok) {
          const errText = await contentRes.text().catch(() => '');
          console.error('LINE content download failed:', contentRes.status, errText);
          await replyText(replyToken, config.access_token, 'ดาวน์โหลดรูปจาก LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
          return;
        }

        const inputBuffer = Buffer.from(await contentRes.arrayBuffer());

        // 4) Compress / resize to save storage
        const compressed = await sharp(inputBuffer)
          .rotate()
          .resize({ width: 1280, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();

        // 5) Upload to Supabase Storage (bucket: slips)
        const filePath = `${bill.id}/${Date.now()}.webp`;
        const upload = await supabaseAdmin.storage
          .from('slips')
          .upload(filePath, compressed, { contentType: 'image/webp', upsert: true });

        if (upload.error) {
          console.error('Supabase upload error:', upload.error);
          await replyText(replyToken, config.access_token, 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
          return;
        }

        const { data: publicUrlData } = supabaseAdmin.storage.from('slips').getPublicUrl(filePath);
        const slipUrl = publicUrlData?.publicUrl || '';

        // 6) Record payment + set bill waiting_verify
        await supabaseAdmin.from('payments').insert({
          bill_id: bill.id,
          amount: Number(bill.total_amount) || 0,
          method: 'transfer',
          slip_url: slipUrl,
          status: 'pending'
        });

        await supabaseAdmin.from('bills').update({ status: 'waiting_verify' }).eq('id', bill.id);

        // 7) Notify owner (push flex with approve/reject)
        if (config.owner_line_user_id) {
          const roomNumber = (bill as any).rooms?.room_number || '-';
          const billingMonth = bill.billing_month
            ? new Date(bill.billing_month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
            : '-';
          const totalAmount = Number(bill.total_amount) || 0;

          const ownerFlex = {
            type: 'flex',
            altText: `ตรวจสลิป ห้อง ${roomNumber} (${tenant.name || 'ผู้เช่า'})`,
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
                  { type: 'text', text: tenant.name || 'ผู้เช่า', size: 'md', weight: 'bold', color: '#111827' },
                  { type: 'text', text: `รอบบิล: ${billingMonth}`, size: 'sm', color: '#6B7280' },
                  {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                      { type: 'text', text: 'ยอดชำระ', size: 'sm', color: '#6B7280', flex: 4 },
                      { type: 'text', text: `฿${totalAmount.toLocaleString()}`, size: 'sm', weight: 'bold', color: '#10B981', align: 'end', flex: 6 }
                    ]
                  },
                  {
                    type: 'button',
                    style: 'link',
                    height: 'sm',
                    action: { type: 'uri', label: 'เปิดดูสลิป', uri: slipUrl }
                  }
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
                    action: { type: 'postback', label: 'อนุมัติ', data: `action=approve&billId=${bill.id}` }
                  },
                  {
                    type: 'button',
                    style: 'secondary',
                    action: { type: 'postback', label: 'ปฏิเสธ', data: `action=reject&billId=${bill.id}` }
                  }
                ]
              }
            }
          };

          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.access_token}`
            },
            body: JSON.stringify({
              to: config.owner_line_user_id,
              messages: [ownerFlex]
            })
          });
        }

        // 8) Acknowledge tenant
        const tenantAckFlex = {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#10B981',
            paddingAll: '16px',
            contents: [
              { type: 'text', text: 'รับสลิปเรียบร้อย ✅', color: '#FFFFFF', weight: 'bold', size: 'lg', align: 'center' }
            ]
          },
          body: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '16px',
            contents: [
              { type: 'text', text: 'กำลังรอเจ้าของหอตรวจสอบ', color: '#065F46', weight: 'bold', size: 'sm', align: 'center', wrap: true }
            ]
          }
        };

        await replyFlex(replyToken, config.access_token, 'รับสลิปเรียบร้อย', tenantAckFlex);
        return;
      } catch (err: unknown) {
        console.error('Slip handling error:', err);
        await replyText(replyToken, config.access_token, 'เกิดข้อผิดพลาดในการรับสลิป กรุณาลองใหม่อีกครั้ง');
        return;
      }
    }
  }

  // Phase 6: Postback Handling (Payment Approval)
  if (type === 'postback') {
    try {
      const dataStr = String(event?.postback?.data || '')
      const params = new URLSearchParams(dataStr)
      const action = params.get('action')
      const billId = params.get('billId')

      if (!action || !billId) {
        await replyText(replyToken, config.access_token, 'ข้อมูลปุ่มไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
        return
      }

      // Only allow owner to approve/reject
      if (!config.owner_line_user_id || config.owner_line_user_id !== lineUserId) {
        await replyText(replyToken, config.access_token, 'คุณไม่มีสิทธิ์ทำรายการนี้')
        return
      }

      // Fetch bill & tenant line id
      const { data: bill } = await supabaseAdmin
        .from('bills')
        .select('id, status, rooms:room_id(dorm_id, room_number), tenants:tenant_id(name, line_user_id), billing_month, total_amount')
        .eq('id', billId)
        .maybeSingle()

      if (!bill) {
        await replyText(replyToken, config.access_token, 'ไม่พบบิลในระบบ')
        return
      }

      if (action === 'approve') {
        // Mark latest payment as approved (if exists) and bill as paid
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('bill_id', billId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (payment?.id) {
          await supabaseAdmin.from('payments').update({ status: 'approved' }).eq('id', payment.id)
        }
        await supabaseAdmin.from('bills').update({ status: 'paid' }).eq('id', billId)

        await replyText(replyToken, config.access_token, 'อนุมัติเรียบร้อย ✅')

        // Notify tenant via existing confirm-payment route (best-effort)
        try {
          const dormId = (bill as any).rooms?.dorm_id
          const { data: dormConfig } = await supabaseAdmin
            .from('line_oa_configs')
            .select('access_token')
            .eq('dorm_id', dormId)
            .maybeSingle()

          if (dormConfig?.access_token && (bill as any).tenants?.line_user_id) {
            // Reuse the same flex format in confirm-payment route by calling it internally is not trivial here,
            // so we push a simple confirmation flex directly.
            const totalAmount = Number((bill as any).total_amount) || 0
            const roomNumber = (bill as any).rooms?.room_number || '-'
            const tenantName = (bill as any).tenants?.name || 'ผู้เช่า'
            const billingMonth = (bill as any).billing_month
              ? new Date((bill as any).billing_month).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
              : '-'

            const tenantFlex = {
              type: 'flex',
              altText: 'ชำระเงินเรียบร้อยแล้ว',
              contents: {
                type: 'bubble',
                header: {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#10B981',
                  paddingAll: '18px',
                  contents: [
                    { type: 'text', text: 'ชำระเงินเรียบร้อยแล้ว', color: '#FFFFFF', weight: 'bold', size: 'xl', align: 'center' }
                  ]
                },
                body: {
                  type: 'box',
                  layout: 'vertical',
                  paddingAll: '18px',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: tenantName, weight: 'bold', size: 'lg', color: '#111827', align: 'center' },
                    { type: 'text', text: `ห้อง ${roomNumber} • ${billingMonth}`, size: 'sm', color: '#6B7280', align: 'center', wrap: true },
                    { type: 'separator', margin: 'md' },
                    {
                      type: 'box',
                      layout: 'horizontal',
                      margin: 'md',
                      contents: [
                        { type: 'text', text: 'จำนวนเงินที่ได้รับ', size: 'sm', color: '#111827', weight: 'bold', flex: 6 },
                        { type: 'text', text: `฿${totalAmount.toLocaleString()}`, size: 'sm', color: '#10B981', weight: 'bold', align: 'end', flex: 4 }
                      ]
                    }
                  ]
                }
              }
            }

            await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${dormConfig.access_token}`
              },
              body: JSON.stringify({
                to: (bill as any).tenants.line_user_id,
                messages: [tenantFlex]
              })
            })
          }
        } catch (e) {
          console.log('Tenant notify failed (ignored):', e)
        }

        return
      }

      if (action === 'reject') {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('bill_id', billId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (payment?.id) {
          await supabaseAdmin.from('payments').update({ status: 'rejected' }).eq('id', payment.id)
        }
        await supabaseAdmin.from('bills').update({ status: 'unpaid' }).eq('id', billId)

        await replyText(replyToken, config.access_token, 'ปฏิเสธเรียบร้อย ❌')
        return
      }

      await replyText(replyToken, config.access_token, 'คำสั่งไม่ถูกต้อง')
      return
    } catch (err) {
      console.error('Postback handler error:', err)
      await replyText(replyToken, config.access_token, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      return
    }
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
