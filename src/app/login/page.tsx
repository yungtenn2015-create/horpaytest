'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function LoginPage() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPass, setShowPass] = useState(false)

    async function handleLogin() {
        setError('')
        if (!email || !password) {
            setError('กรุณากรอกอีเมลและรหัสผ่าน')
            return
        }
        setLoading(true)
        try {
            const supabase = createClient()
            const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password })
            if (authError) throw authError

            // check if user has any dorm
            if (user) {
                const { data: dorms, error: dormError } = await supabase
                    .from('dorms')
                    .select('id')
                    .eq('owner_id', user.id)
                    .is('deleted_at', null)
                    .limit(1)

                if (dormError) {
                    console.error('Error checking dorms:', dormError)
                    router.push('/dashboard') // fallback to dashboard
                    return
                }

                if (dorms && dorms.length > 0) {
                    router.push('/dashboard')
                } else {
                    router.push('/setup-dorm')
                }
            }
        } catch (e: any) {
            const msg = e?.message || ''
            if (
                msg.includes("Your project's URL and API key are required") ||
                msg.includes('NEXT_PUBLIC_SUPABASE_URL')
            ) {
                setError('ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env.local')
            } else {
                setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
            }
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:p-4">
            <div className="w-full sm:max-w-md bg-white min-h-screen sm:min-h-[640px] sm:rounded-3xl sm:shadow-2xl overflow-hidden flex flex-col">

                {/* ── Header ── */}
                <div className="relative flex flex-col items-center justify-center pt-10 pb-12 px-6 bg-gradient-to-br from-green-800 to-green-500">
                    <div className="absolute w-48 h-48 rounded-full bg-white/5 -top-16 -right-10" />
                    <div className="absolute w-28 h-28 rounded-full bg-white/5 bottom-4 -left-8" />

                    {/* Logo (Home Icon as requested earlier) */}
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 mb-4 shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-9 h-9">
                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-5 5A1 1 0 005 9h1v4a1 1 0 001 1h2a1 1 0 001-1v-2h4v2a1 1 0 001 1h2a1 1 0 001-1V9h1a1 1 0 00.707-1.707l-5-5z" />
                        </svg>
                    </div>
                    <h1 className="relative text-3xl font-bold text-white tracking-tight mb-1">HORPAY</h1>
                    <p className="relative text-white/70 text-sm">ระบบจัดการหอพักครบวงจร</p>
                </div>

                {/* ── Form Area ── */}
                <div className="flex-1 flex flex-col p-6 sm:p-8 gap-5">
                    <h2 className="font-bold text-gray-800 text-xl">เข้าสู่ระบบ</h2>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mt-0.5 shrink-0">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            อีเมล
                        </label>
                        <input
                            type="email"
                            placeholder="owner@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            autoComplete="email"
                            className="w-full h-13 px-4 rounded-xl border-2 border-gray-50 bg-gray-50 text-gray-800 placeholder-gray-300 outline-none focus:border-green-500 focus:bg-white transition-all text-base"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            รหัสผ่าน
                        </label>
                        <div className="relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                autoComplete="current-password"
                                className="w-full h-13 px-4 pr-12 rounded-xl border-2 border-gray-50 bg-gray-50 text-gray-800 placeholder-gray-300 outline-none focus:border-green-500 focus:bg-white transition-all text-base"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-2"
                                aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                            >
                                {showPass ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Forgot password */}
                    <div
                        onClick={() => router.push('/forgot-password')}
                        className="text-xs text-green-700 font-bold underline cursor-pointer hover:text-green-800 transition-colors text-right"
                    >
                        ลืมรหัสผ่าน?
                    </div>

                    {/* Login button */}
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 text-white font-bold text-lg transition-all shadow-lg shadow-green-100 mt-2"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                กำลังเข้าสู่ระบบ...
                            </span>
                        ) : 'เข้าสู่ระบบ'}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-2">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-xs text-gray-400 font-medium">ยังไม่มีบัญชี?</span>
                        <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Register button */}
                    <button
                        onClick={() => router.push('/register')}
                        className="w-full py-4 rounded-xl border-2 border-green-600 text-green-700 font-bold text-lg hover:bg-green-50 active:bg-green-100 transition-all"
                    >
                        ลงทะเบียน — ทดลองใช้ฟรี 60 วัน
                    </button>

                    {/* Footer */}
                    <p className="text-center text-xs text-gray-400 mt-auto pt-8">
                        © 2026 HORPAY — ระบบจัดการหอพักอัจฉริยะ สนใจติดต่อ 083-264-3659
                    </p>
                </div>
            </div>
        </div>
    )
}
