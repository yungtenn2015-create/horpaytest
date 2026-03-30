'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function RegisterPage() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')

    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPass, setShowPass] = useState(false)
    const [showConfirmPass, setShowConfirmPass] = useState(false)

    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [hasReadTerms, setHasReadTerms] = useState(false)

    const validatePasswordPolicy = (pw: string): string => {
        const p = pw.trim()
        if (p.length < 8 || p.length > 15) {
            return 'รหัสผ่านต้องมีความยาว 8-15 ตัวอักษร และต้องประกอบด้วยตัวอักษรและตัวเลข'
        }

        // Require at least one Unicode letter and at least one digit.
        const hasLetter = /[\p{L}]/u.test(p)
        const hasDigit = /\d/.test(p)

        if (!hasLetter || !hasDigit) {
            return 'รหัสผ่านต้องประกอบด้วยตัวอักษรและตัวเลข (อย่างน้อยอย่างละ 1 ตัว)'
        }

        return ''
    }

    async function handleRegister() {
        setError('')

        if (!hasReadTerms || !acceptedTerms) {
            setError(hasReadTerms
                ? 'กรุณากดยอมรับข้อกำหนดและเงื่อนไขก่อนดำเนินการต่อ'
                : 'กรุณากดที่ "ข้อกำหนดและเงื่อนไข" เพื่ออ่านก่อน แล้วจึงติ๊กยอมรับ')
            return
        }

        // Basic Validation
        if (!email || !password || !name || !phone) {
            setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (อีเมล, รหัสผ่าน, ชื่อ, เบอร์โทร)')
            return
        }
        if (password !== confirmPassword) {
            setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
            return
        }
        const pwError = validatePasswordPolicy(password)
        if (pwError) {
            setError(pwError)
            return
        }
        if (phone.length < 10) {
            setError('เบอร์โทรศัพท์ต้องมีครบ 10 หลัก')
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()

            const origin = window.location.origin
            // ลิงก์ในอีเมลยืนยันจะพากลับมาที่นี่ → แลก code เป็น session แล้วไปหน้าถัดไป
            // ต้องเพิ่ม `${origin}/auth/callback` ใน Supabase → Redirect URLs ด้วย
            const { data: signData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${origin}/auth/callback?next=/setup-dorm`,
                    data: {
                        name: name,
                        phone: phone,
                        role: 'owner' // Hardcoded as requested
                    }
                }
            })

            if (signUpError) throw signUpError

            // เปิดยืนยันอีเมลใน Supabase → มักได้ user แต่ไม่มี session จนกว่าจะคลิกลิงก์
            if (signData.user && !signData.session) {
                router.push(`/register/check-email?email=${encodeURIComponent(email)}`)
                return
            }

            alert('ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ')
            router.push('/login')

        } catch (e: any) {
            let msg = e?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน'

            if (msg.includes('User already registered')) {
                msg = 'อีเมลนี้ถูกใช้งานไปแล้ว กรุณาเข้าสู่ระบบ'
            } else if (msg.includes('Password should be at least')) {
                msg = 'รหัสผ่านต้องมีความยาว 8-15 ตัวอักษร และต้องประกอบด้วยตัวอักษรและตัวเลข'
            } else if (msg.includes('Unable to validate email address')) {
                msg = 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
            } else if (
                msg.includes('Error sending confirmation email') ||
                msg.includes('confirmation email') ||
                msg.includes('sending email')
            ) {
                msg =
                    'ระบบส่งอีเมลยืนยันไม่สำเร็จ (ฝั่ง Supabase) — ให้ไปที่ Dashboard โปรเจกต์ → Authentication → ตรวจ SMTP / Custom SMTP หรือ Logs; โปรเจกต์ฟรีอาจถูกจำกัดอัตราส่ง หรือต้องตั้งผู้ส่งอีเมลเอง (เช่น Resend, SendGrid)'
            }

            setError(msg)
        }
        setLoading(false)
    }

    const [showTerms, setShowTerms] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:p-4">
            <div className="w-full sm:max-w-md bg-white min-h-screen sm:min-h-[640px] sm:rounded-3xl sm:shadow-2xl overflow-hidden flex flex-col">

                {/* ── Header ── */}
                <div className="relative flex flex-col items-center justify-center pt-10 pb-12 px-6 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
                    <div className="absolute w-48 h-48 rounded-full bg-white/5 -top-16 -right-10" />
                    <div className="absolute w-28 h-28 rounded-full bg-white/5 bottom-4 -left-8" />

                    {/* Back to Login */}
                    <button
                        onClick={() => router.push('/login')}
                        className="absolute top-6 left-6 text-white/80 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                    </button>

                    <h1 className="relative text-2xl font-bold text-white tracking-tight">สร้างบัญชีเจ้าของหอพัก</h1>
                    <p className="relative text-white/70 text-sm mt-1">เริ่มต้นจัดการหอพักของคุณวันนี้</p>
                </div>

                {/* ── Form Area ── */}
                <div className="flex-1 flex flex-col p-6 sm:p-8 gap-5 overflow-y-auto font-sans">

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mt-0.5 shrink-0">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Full Name */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            ชื่อ-นามสกุล <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"

                            value={name}
                            onChange={(e) => setName(e.target.value.slice(0, 30))}
                            maxLength={30}
                            className="w-full h-13 px-4 rounded-xl border-2 border-gray-50 bg-gray-50 text-gray-800 placeholder-gray-300 outline-none focus:border-emerald-500 focus:bg-white transition-all text-base font-sans"
                        />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            เบอร์โทรศัพท์ <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="tel"

                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            maxLength={10}
                            className="w-full h-13 px-4 rounded-xl border-2 border-gray-100 bg-transparent text-gray-800 placeholder-gray-300 outline-none focus:border-emerald-500 focus:bg-white transition-all text-base font-sans"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            อีเมล <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="email"
                            placeholder="owner@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            className="w-full h-13 px-4 rounded-xl border-2 border-gray-100 bg-transparent text-gray-800 placeholder-gray-300 outline-none focus:border-emerald-500 focus:bg-white transition-all text-base font-sans"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            รหัสผ่าน (8-15 ตัวอักษร ต้องมีตัวอักษรและตัวเลข) <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={15}
                                className="w-full h-13 px-4 pr-12 rounded-xl border-2 border-gray-100 bg-transparent text-gray-800 placeholder-gray-300 outline-none focus:border-emerald-500 focus:bg-white transition-all text-base font-sans"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-2"
                            >
                                {showPass ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                            ยืนยันรหัสผ่าน <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPass ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                className="w-full h-13 px-4 pr-12 rounded-xl border-2 border-gray-100 bg-transparent text-gray-800 placeholder-gray-300 outline-none focus:border-emerald-500 focus:bg-white transition-all text-base font-sans"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPass(!showConfirmPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-2"
                            >
                                {showConfirmPass ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Terms — ติ๊กได้เฉพาะหลังอ่านโมดัลและกดยืนยันแล้ว */}
                    <div className="flex items-start gap-2 px-1 mt-2">
                        <input
                            type="checkbox"
                            id="terms"
                            className={`w-4 h-4 accent-emerald-600 shrink-0 mt-0.5 ${hasReadTerms ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                            checked={acceptedTerms}
                            onChange={(e) => {
                                if (!hasReadTerms) {
                                    setError('กรุณากดที่ "ข้อกำหนดและเงื่อนไข" เพื่ออ่านก่อน แล้วจึงติ๊กยอมรับ')
                                    return
                                }
                                setError('')
                                setAcceptedTerms(e.target.checked)
                            }}
                        />
                        <label htmlFor="terms" className="text-xs text-gray-500 select-none leading-relaxed">
                            ฉันยอมรับ{' '}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowTerms(true)
                                    setError('')
                                }}
                                className="text-emerald-700 font-semibold underline cursor-pointer inline p-0 bg-transparent border-0 align-baseline"
                            >
                                ข้อกำหนดและเงื่อนไข
                            </button>
                            {!hasReadTerms && (
                                <span className="block text-[11px] text-amber-600 font-semibold mt-1.5">
                                    ต้องเปิดอ่านข้อกำหนดและและเงื่อนไขก่อน
                                </span>
                            )}
                        </label>
                    </div>

                    {/* Register button */}
                    <button
                        onClick={handleRegister}
                        disabled={loading || !acceptedTerms || !hasReadTerms}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:bg-emerald-800 disabled:opacity-30 disabled:bg-gray-400 disabled:shadow-none text-white font-bold text-lg transition-all shadow-lg shadow-emerald-200/50 mt-4"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                กำลังสร้างบัญชี...
                            </span>
                        ) : 'สมัครสมาชิก'}
                    </button>

                    <div className="text-center text-sm text-gray-500 mt-2">
                        มีบัญชีอยู่แล้ว? <span
                            onClick={() => router.push('/login')}
                            className="text-emerald-700 font-bold underline cursor-pointer"
                        >เข้าสู่ระบบ</span>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-[10px] text-gray-400 mt-auto pt-6">
                        © 2026 HORPAY — ระบบจัดการหอพัก
                    </p>
                </div>
            </div>

            {/* ── Terms Modal ── */}
            {showTerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">ข้อกำหนดและเงื่อนไข</h3>
                            <button
                                type="button"
                                onClick={() => setShowTerms(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                aria-label="ปิด"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-gray-600 leading-relaxed">
                            <section>
                                <h4 className="font-bold text-gray-800 mb-2">1. การใช้งานระบบ</h4>
                                <p>HORPAY เป็นระบบจัดการหอพักแบบ Software-as-a-Service (SaaS) เพื่ออำนวยความสะดวกในการบริหารจัดการหอพัก การจัดทำบิล และการเก็บข้อมูลผู้เช่า</p>
                                <p className="mt-3">ระบบรองรับการแจ้งเตือนผ่าน LINE Official Account เมื่อเจ้าของหอเปิดใช้งานและผู้เช่าผูกบัญชี LINE แล้ว อาจมีการส่งข้อความเกี่ยวกับบิลค่าเช่า สถานะการชำระเงิน หรือประกาศที่เกี่ยวข้องกับการพักอาศัยตามที่ระบบและเจ้าของหอกำหนด</p>
                            </section>
                            <section>
                                <h4 className="font-bold text-gray-800 mb-2">2. ระยะเวลาทดลองใช้ (Trial Period)</h4>
                                <p>ผู้สมัครใหม่จะได้รับสิทธิ์ทดลองใช้งานทุกฟีเจอร์ฟรีเป็นเวลา 30 วัน นับจากวันที่สมัครสมาชิก หลังจากครบกำหนด ระบบอาจจำกัดการเข้าถึงบางฟีเจอร์หากไม่มีการอัปเกรดแผนการใช้งาน</p>
                            </section>
                            <section>
                                <h4 className="font-bold text-gray-800 mb-2">3. ข้อมูลส่วนบุคคล (Privacy & PDPA)</h4>
                                <p>ความปลอดภัยของคุณ HORPAY ดูแลข้อมูลบัญชีของเจ้าของหอด้วยระบบรักษาความปลอดภัยมาตรฐาน ข้อมูลของคุณจะถูกใช้เพื่อการบริหารจัดการระบบและแจ้งเตือนเท่านั้น</p>
                                <p className="mt-3">ความสะดวกในการจัดการผู้เช่า ระบบถูกออกแบบมาเพื่อรองรับการจัดเก็บข้อมูลที่จำเป็น (ชื่อ,เบอร์โทร,ที่อยู่,ทะเบียนรถ) เพื่อใช้ในการออกบิลและทำสัญญาเช่า โดยระบบมีฟีเจอร์ช่วยให้คุณจัดเก็บข้อมูลได้อย่างเป็นระบบและปลอดภัยตามแนวทาง PDPA</p>
                                <p className="mt-3">สิทธิในการจัดการข้อมูล ท่านสามารถเรียกดู แก้ไข หรือลบข้อมูลส่วนบุคคลของท่านและข้อมูลผู้เช่าออกจากระบบได้ทุกเมื่อผ่านเมนูการตั้งค่าภายในแอป</p>
                            </section>
                            <section>
                                <h4 className="font-bold text-gray-800 mb-2">4. ความรับผิดชอบของผู้ใช้</h4>
                                <p>ท่านต้องเก็บรหัสผ่านและการเข้าสู่ระบบเป็นความลับ ไม่ให้ผู้อื่นใช้แทนโดยไม่ได้รับอนุญาต และควรเปลี่ยนรหัสหรือแจ้งผู้ดูแลระบบหากสงสัยว่าบัญชีถูกเข้าถึงโดยไม่ชอบ</p>

                                <p className="mt-3">HORPAY ช่วยให้คุณบันทึกข้อมูลและดูภาพรวมงานหอพักได้ง่ายขึ้น แต่คุณยังต้องเป็นคนเช็คเองว่าตัวเลขตรงกับมิเตอร์จริง ยอดในบิลตรงกับเงินที่รับ</p>
                                <p className="mt-3">เรื่องบัญชี ภาษี หรือสัญญาเช่าที่ซับซ้อน โปรแกรมนี้ไม่ใช่ที่ปรึกษา หากไม่แน่ใจควรถามนักบัญชีหรือที่ปรึกษากฎหมายโดยตรง</p>
                            </section>
                        </div>
                        <div className="p-6 border-t bg-gray-50 space-y-2">
                            <p className="text-[11px] text-center text-gray-500 font-medium">
                                กดปุ่มด้านล่างเมื่ออ่านครบแล้ว — จากนั้นจึงติ๊กยอมรับที่ฟอร์มสมัครได้
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setHasReadTerms(true)
                                    setShowTerms(false)
                                    setError('')
                                }}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-xl transition-colors"
                            >
                                ฉันได้อ่านครบแล้ว
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
