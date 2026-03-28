'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { HorpayHouseMark } from '@/src/components/HorpayHouseMark'

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
                <div className="relative flex flex-col items-center justify-center pt-10 pb-12 px-6 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
                    <div className="absolute w-48 h-48 rounded-full bg-white/5 -top-16 -right-10" />
                    <div className="absolute w-28 h-28 rounded-full bg-white/5 bottom-4 -left-8" />

                    <div
                        className="relative mb-4 h-28 w-28 overflow-hidden rounded-[1.35rem] shadow-lg ring-4 ring-white/25 sm:h-32 sm:w-32"
                    >
                        <HorpayHouseMark className="h-full w-full" />
                    </div>
                    <h1 className="relative text-3xl font-bold text-white tracking-tight mb-1">HORPAY</h1>
                    <p className="relative text-white/70 text-sm">ระบบจัดการหอพัก</p>
                </div>

                {/* ── Form Area ── */}
                <div className="flex flex-1 flex-col gap-5 p-6 sm:p-8">
                    <h2 className="text-center text-2xl font-bold text-emerald-600 sm:text-3xl">ลงชื่อเข้าใช้งาน</h2>

                    {error && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="ml-1 block text-s font-semibold uppercase tracking-wider text-gray-400">
                            อีเมล
                        </label>
                        <input
                            type="email"
                            placeholder="owner@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            autoComplete="email"
                            className="h-14 w-full rounded-xl border-2 border-gray-50 bg-gray-50 px-4 text-base text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-emerald-500 focus:bg-white"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="ml-1 block text-s font-semibold uppercase tracking-wider text-gray-400">
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
                                className="h-14 w-full rounded-xl border-2 border-gray-50 bg-gray-50 px-4 pr-12 text-base text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-emerald-500 focus:bg-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400"
                                aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                            >
                                {showPass ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <div
                        onClick={() => router.push('/forgot-password')}
                        className="cursor-pointer text-right text-xs font-bold text-emerald-700 underline transition-colors hover:text-emerald-800"
                    >
                        ลืมรหัสผ่าน?
                    </div>

                    <button
                        type="button"
                        onClick={handleLogin}
                        disabled={loading}
                        className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-200/50 transition-all hover:from-emerald-700 hover:to-teal-600 active:bg-emerald-800 disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                กำลังเข้าสู่ระบบ...
                            </span>
                        ) : (
                            'เข้าสู่ระบบ'
                        )}
                    </button>

                    <div className="my-2 flex items-center gap-4">
                        <div className="h-px flex-1 bg-gray-100" />
                        <span className="text-xs font-medium text-gray-400">ยังไม่มีบัญชี?</span>
                        <div className="h-px flex-1 bg-gray-100" />
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push('/register')}
                        className="w-full rounded-xl border-2 border-emerald-600 py-4 text-lg font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:bg-emerald-100"
                    >
                        ลงทะเบียน — ทดลองใช้ฟรี 30 วัน
                    </button>

                    <p className="mt-auto pt-8 text-center text-xs text-gray-400">
                        แจ้งปัญหาติดต่อ LINE ID : yungtenn2015
                    </p>
                </div>
            </div>
        </div>
    )
}
