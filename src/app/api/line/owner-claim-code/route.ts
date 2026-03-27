import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

function generate6DigitCode() {
  const n = crypto.randomInt(0, 1_000_000)
  return String(n).padStart(6, '0')
}

export async function POST(req: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!serviceRoleKey || serviceRoleKey === 'your-service-role-key') {
    return NextResponse.json(
      { success: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env.local' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  try {
    const body = await req.json().catch(() => ({}))
    const dormId = String(body?.dorm_id || '')
    const accessToken = String(body?.access_token || '')

    if (!dormId || !accessToken) {
      return NextResponse.json({ success: false, error: 'Missing dorm_id or access_token' }, { status: 400 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken)
    if (userErr || !userData?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userData.user.id

    const { data: dorm, error: dormErr } = await supabaseAdmin
      .from('dorms')
      .select('id, owner_id')
      .eq('id', dormId)
      .maybeSingle()

    if (dormErr) {
      return NextResponse.json({ success: false, error: dormErr.message }, { status: 500 })
    }
    if (!dorm || dorm.owner_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { data: existingConfig, error: cfgErr } = await supabaseAdmin
      .from('line_oa_configs')
      .select('id, dorm_id')
      .eq('dorm_id', dormId)
      .maybeSingle()

    if (cfgErr) {
      return NextResponse.json({ success: false, error: cfgErr.message }, { status: 500 })
    }
    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: 'กรุณาตั้งค่า LINE Messaging API และกดบันทึกก่อน' },
        { status: 400 }
      )
    }

    const code = generate6DigitCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    const { error: updErr } = await supabaseAdmin
      .from('line_oa_configs')
      .update({
        owner_claim_code: code,
        owner_claim_expires_at: expiresAt,
        owner_claim_used_at: null
      })
      .eq('dorm_id', dormId)

    if (updErr) {
      return NextResponse.json(
        {
          success: false,
          error: updErr.message?.includes('owner_claim_code')
            ? 'ยังไม่ได้รัน SQL Migration (owner_claim_code) ใน Supabase'
            : updErr.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, code, expires_at: expiresAt })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

