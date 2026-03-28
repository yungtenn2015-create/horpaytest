'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    async function handleResetPassword() {
        setError('')
        if (!email) {
            setError('กรุณากรอกอีเมลของคุณ')
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
            })

            if (resetError) throw resetError

            setSuccess(true)
        } catch (e: any) {
            let msg = e?.message || 'เกิดข้อผิดพลาดในการส่งลิงก์รีเซ็ตรหัสผ่าน'
            if (msg.includes('Unable to validate email address')) {
                msg = 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
            }
            setError(msg)
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

                    {/* Back button */}
                    <button
                        onClick={() => router.push('/login')}
                        className="absolute top-6 left-6 text-white/80 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>

                    <h1 className="relative text-2xl font-bold text-white tracking-tight text-center px-4">ลืมรหัสผ่าน?</h1>
                    <p className="relative text-white/70 text-sm mt-1 text-center">ไม่ต้องกังวล เราจะส่งลิงก์รีเซ็ตไปให้ครับ</p>
                </div>

                {/* ── Content Area ── */}
                <div className="flex-1 flex flex-col p-6 sm:p-8 gap-5 font-sans">
                    {!success ? (
                        <>
                            <p className="text-gray-500 text-sm text-center">
                                กรุณากรอกอีเมลที่ใช้สมัครสมาชิก ระบบจะส่งลิงก์เพื่อตั้งรหัสผ่านใหม่ไปให้ทางอีเมลครับ
                            </p>

                            {/* Error */}
                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mt-0.5 shrink-0">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            {/* Email Field */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                                    อีเมลของคุณ
                                </label>
                                <input
                                    type="email"
                                    placeholder="owner@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-13 px-4 rounded-xl border-2 border-gray-50 bg-gray-50 text-gray-800 placeholder-gray-300 outline-none focus:border-emerald-500 focus:bg-white transition-all text-base font-sans"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleResetPassword}
                                disabled={loading}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 font-bold text-lg text-white shadow-lg shadow-emerald-200/50 transition-all hover:from-emerald-700 hover:to-teal-600 active:opacity-95 disabled:opacity-50"
                            >
                                {loading ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
                            </button>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10 text-emerald-600">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">ส่งลิงก์เรียบร้อยแล้ว!</h2>
                            <p className="text-gray-500 text-sm mb-8 px-4">
                                เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่ <span className="font-bold text-gray-700">{email}</span> แล้ว กรุณาตรวจสอบในกล่องจดหมาย (Inboxes) หรือ Junk Mail ครับ
                            </p>
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full py-4 rounded-xl border-2 border-emerald-600 font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:bg-emerald-100"
                            >
                                กลับหน้าเข้าสู่ระบบ
                            </button>
                        </div>
                    )}

                    {/* Back to Login Link */}
                    {!success && (
                        <div className="text-center mt-auto pb-4">
                            <span
                                onClick={() => router.push('/login')}
                                className="cursor-pointer text-sm font-bold text-emerald-700 underline transition-colors hover:text-emerald-800"
                            >
                                กลับไปหน้าเข้าสู่ระบบ
                            </span>
                        </div>
                    )}

                    {/* Footer */}
                    <p className="text-center text-[10px] text-gray-400 pt-6">
                        © 2026 HORPAY — ระบบจัดการหอพัก
                    </p>
                </div>
            </div>
        </div>
    )
}
