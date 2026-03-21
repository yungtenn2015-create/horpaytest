'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'


export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setMsg('')
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน')
      return
    }
    setLoading(true)
    let signInError: unknown
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      signInError = error
    } catch (e) {
      signInError = e
    }
    setLoading(false)
    if (signInError) {
      const maybeMsg =
        signInError instanceof Error
          ? signInError.message
          : typeof signInError === 'string'
            ? signInError
            : ''
      if (
        maybeMsg.includes("Your project's URL and API key are required") ||
        maybeMsg.includes('NEXT_PUBLIC_SUPABASE_URL') ||
        maybeMsg.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      ) {
        setError('ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env.local')
      } else {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      }
    } else {
      router.push('/onboarding') // เปลี่ยนเป็น /dashboard หลัง onboarding เสร็จ
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
      <div className="flex w-full max-w-3xl min-h-[520px] rounded-xl overflow-hidden border border-blue-200">
        {/* Left panel */}
        <div className="flex flex-col justify-center p-10 bg-[#185FA5] flex-1">
          <div className="text-2xl font-medium text-white tracking-tight mb-2">
            HORPAY
          </div>
          <p className="text-sm text-white/50 leading-relaxed max-w-[220px]">
            ระบบจัดการหอพักครบวงจร สำหรับเจ้าของหอยุคใหม่
          </p>
          <div className="mt-10 flex flex-col gap-4">
            {[
              'จัดการหลายหอในที่เดียว',
              'ออกบิลและติดตามสลิปอัตโนมัติ',
              'ทดลองใช้ฟรี 60 วัน ไม่ต้องใช้บัตรเครดิต',
            ].map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-300 shrink-0" />
                <span className="text-sm text-white/60">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col justify-center p-10 bg-blue-50 flex-[1.2]">
          <h1 className="text-lg font-medium text-[#0C447C] mb-5">เข้าสู่ระบบ</h1>

          {msg && (
            <div className="text-sm px-3 py-2.5 rounded-lg mb-4 bg-white text-[#0C447C] border border-blue-200">
              {msg}
            </div>
          )}
          {error && (
            <div className="text-sm px-3 py-2.5 rounded-lg mb-4 bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-[#185FA5] mb-1.5 tracking-wide">
              อีเมล
            </label>
            <input
              type="email"
              placeholder="owner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 text-sm rounded-lg border border-blue-200 bg-white text-[#042C53] placeholder-blue-200 outline-none focus:border-[#185FA5] transition-colors"
            />
          </div>

          <div className="mb-2">
            <label className="block text-xs text-[#185FA5] mb-1.5 tracking-wide">
              รหัสผ่าน
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 text-sm rounded-lg border border-blue-200 bg-white text-[#042C53] placeholder-blue-200 outline-none focus:border-[#185FA5] transition-colors"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-3 py-2.5 rounded-lg bg-[#185FA5] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <button
            onClick={() => setMsg('กรุณาติดต่อ admin เพื่อรีเซ็ตรหัสผ่าน')}
            className="text-xs text-[#378ADD] hover:text-[#185FA5] mt-3 text-center cursor-pointer bg-transparent border-none"
          >
            ลืมรหัสผ่าน?
          </button>

          <div className="flex items-center gap-2.5 my-5">
            <div className="flex-1 h-px bg-blue-200" />
            <span className="text-xs text-[#378ADD]">ยังไม่มีบัญชี?</span>
            <div className="flex-1 h-px bg-blue-200" />
          </div>

          <button
            onClick={() => router.push('/register')}
            className="w-full py-2.5 rounded-lg border border-[#185FA5] text-[#185FA5] text-sm font-medium hover:bg-white transition-colors cursor-pointer bg-transparent"
          >
            ลงทะเบียน — ทดลองใช้ฟรี 60 วัน
          </button>
        </div>
      </div>
    </div>
  )
}

