import { createClient } from '@/lib/supabase-client'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('_test_connection_').select('*').limit(1)

    // ถ้า error เป็น "relation does not exist" แสดงว่าเชื่อมได้แล้ว แค่ตารางไม่มี
    if (error?.code === '42P01') {
      return NextResponse.json({ status: '✅ เชื่อม Supabase ได้แล้ว!', note: 'Connected (table not found is OK)' })
    }

    if (error) {
      return NextResponse.json({ status: '❌ ยังเชื่อมไม่ได้', error: error.message, code: error.code }, { status: 500 })
    }

    return NextResponse.json({ status: '✅ เชื่อม Supabase ได้แล้ว!', data })
  } catch (e: any) {
    return NextResponse.json({ status: '❌ Error', error: e.message }, { status: 500 })
  }
}
