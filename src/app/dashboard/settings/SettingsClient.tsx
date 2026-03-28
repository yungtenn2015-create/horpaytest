'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { 
    ChevronLeftIcon, 
    HomeModernIcon, 
    BanknotesIcon, 
    CalendarDaysIcon,
    DevicePhoneMobileIcon,
    MapPinIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'

function normalizeBillingDay(value: unknown, fallback: number): number {
    const fb = Math.min(31, Math.max(1, Math.floor(Number(fallback)) || 1))
    if (value === null || value === undefined || value === '') return fb
    const n = Math.floor(Number(value))
    if (!Number.isFinite(n) || n < 1) return fb
    return Math.min(31, n)
}

type BillingDayForm = number | ''

export default function SettingsClient() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    
    // Form State
    const [dormData, setDormData] = useState({
        name: '',
        address: '',
        contact_number: ''
    })
    
    const [settingsData, setSettingsData] = useState<{
        bank_name: string
        bank_account_no: string
        bank_account_name: string
        billing_day: BillingDayForm
        payment_due_day: BillingDayForm
    }>({
        bank_name: '',
        bank_account_no: '',
        bank_account_name: '',
        billing_day: 30,
        payment_due_day: 5
    })

    const [lineConfig, setLineConfig] = useState({
        channel_id: '',
        channel_secret: '',
        access_token: '',
        owner_line_user_id: ''
    })

    useEffect(() => {
        const fetchDormInfo = async () => {
            setLoading(true)
            try {
                // Get User ID
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/login')
                    return
                }

                // Get Dorm (Assume one for now)
                const { data: dorms } = await supabase
                    .from('dorms')
                    .select('*')
                    .eq('owner_id', user.id)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (dorms && dorms.length > 0) {
                    const dorm = dorms[0]
                    setDormData({
                        name: dorm.name || '',
                        address: dorm.address || '',
                        contact_number: dorm.contact_number || ''
                    })

                    // Get Settings
                    const { data: settings } = await supabase
                        .from('dorm_settings')
                        .select('*')
                        .eq('dorm_id', dorm.id)
                        .single()

                    if (settings) {
                        setSettingsData({
                            bank_name: settings.bank_name || '',
                            bank_account_no: settings.bank_account_no || '',
                            bank_account_name: settings.bank_account_name || '',
                            billing_day: normalizeBillingDay(settings.billing_day, 30),
                            payment_due_day: normalizeBillingDay(settings.payment_due_day, 5)
                        })
                    }

                    // Get LINE Config
                    const { data: lineOa } = await supabase
                        .from('line_oa_configs')
                        .select('*')
                        .eq('dorm_id', dorm.id)
                        .maybeSingle()

                    if (lineOa) {
                        setLineConfig({
                            channel_id: lineOa.channel_id || '',
                            channel_secret: lineOa.channel_secret || '',
                            access_token: lineOa.access_token || '',
                            owner_line_user_id: lineOa.owner_line_user_id || ''
                        })
                    }
                }
            } catch (error) {
                console.error('Error fetching dorm info:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchDormInfo()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setMessage('')
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Update Dorm
            const { data: dorms } = await supabase
                .from('dorms')
                .select('id')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1)

            if (dorms && dorms.length > 0) {
                const dormId = dorms[0].id
                
                await supabase.from('dorms').update({
                    name: dormData.name,
                    address: dormData.address,
                    contact_number: dormData.contact_number
                }).eq('id', dormId)

                // 2. Update Settings
                await supabase.from('dorm_settings').update({
                    bank_name: settingsData.bank_name,
                    bank_account_no: settingsData.bank_account_no,
                    bank_account_name: settingsData.bank_account_name,
                    billing_day: normalizeBillingDay(settingsData.billing_day, 30),
                    payment_due_day: normalizeBillingDay(settingsData.payment_due_day, 5)
                }).eq('dorm_id', dormId)

                // 3. Update LINE Config (Upsert)
                if (lineConfig.channel_id || lineConfig.channel_secret || lineConfig.access_token) {
                    await supabase.from('line_oa_configs').upsert({
                        dorm_id: dormId,
                        channel_id: lineConfig.channel_id,
                        channel_secret: lineConfig.channel_secret,
                        access_token: lineConfig.access_token,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'dorm_id' })
                }

                setMessage('บันทึกข้อมูลเรียบร้อยแล้ว!')
                setTimeout(() => setMessage(''), 3000)
            }
        } catch (error) {
            console.error('Error saving:', error)
            setMessage('เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50/50 pb-24">
            {/* Header */}
            <header className="bg-white px-6 pt-12 pb-6 shadow-sm sticky top-0 z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all active:scale-95"
                    >
                        <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
                    </button>
                    <h1 className="text-xl font-black text-gray-800">ตั้งค่าหอพัก</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
                {/* ── SECTION 1: DORM INFO ── */}
                <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                            <HomeModernIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-black text-gray-800">ข้อมูลพื้นฐาน</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">ชื่อหอพัก</label>
                            <div className="relative group">
                                <BuildingOfficeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input 
                                    type="text"
                                    maxLength={50}
                                    value={dormData.name}
                                    onChange={(e) => setDormData({...dormData, name: e.target.value.slice(0, 50)})}
                                    placeholder="เช่น สมายล์โฮม"
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl pl-12 pr-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">ที่อยู่หอพัก</label>
                            <div className="relative group">
                                <MapPinIcon className="absolute left-4 top-5 w-5 h-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                                <textarea 
                                    rows={3}
                                    maxLength={100}
                                    value={dormData.address}
                                    onChange={(e) => setDormData({...dormData, address: e.target.value.slice(0, 100)})}
                                    placeholder="เลขที่, ซอย, ถนน, แขวง/ตำบล..."
                                    className="w-full bg-gray-50 border-none rounded-2xl pl-12 pr-4 pt-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">เบอร์โทรติดต่อ</label>
                            <div className="relative group">
                                <DevicePhoneMobileIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-indigo-500 transition-colors" />
                                <input 
                                    type="text"
                                    maxLength={10}
                                    value={dormData.contact_number}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setDormData({...dormData, contact_number: val});
                                    }}
                                    placeholder="เช่น 0812345678"
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl pl-12 pr-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── SECTION 2: PAYMENT ── */}
                <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                            <BanknotesIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-black text-gray-800">ช่องทางการรับเงิน</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">ธนาคาร</label>
                                <input 
                                    type="text"
                                    maxLength={30}
                                    value={settingsData.bank_name}
                                    onChange={(e) => setSettingsData({...settingsData, bank_name: e.target.value.slice(0, 30)})}
                                    placeholder="เช่น กสิกรไทย"
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">เลขบัญชี / PromptPay</label>
                                <input 
                                    type="text"
                                    maxLength={20}
                                    value={settingsData.bank_account_no}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^\d\- ]/g, '').slice(0, 20);
                                        setSettingsData({...settingsData, bank_account_no: val});
                                    }}
                                    placeholder="เช่น 092-0-13420-7"
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">ชื่อบัญชี</label>
                            <input 
                                type="text"
                                maxLength={50}
                                value={settingsData.bank_account_name}
                                onChange={(e) => setSettingsData({...settingsData, bank_account_name: e.target.value.slice(0, 50)})}
                                placeholder="เช่น นายสมชาย มั่งคั่ง"
                                className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                    </div>
                </section>

                {/* ── SECTION 3: RULES ── */}
                <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                            <CalendarDaysIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-black text-gray-800">กฎการตัดรอบบิล</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">วันที่ตัดรอบบิล</label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={settingsData.billing_day}
                                    onChange={(e) => {
                                        const raw = e.target.value
                                        if (raw === '') {
                                            setSettingsData({ ...settingsData, billing_day: '' })
                                            return
                                        }
                                        let val = parseInt(raw, 10)
                                        if (Number.isNaN(val)) return
                                        if (val < 1) val = 1
                                        if (val > 31) val = 31
                                        setSettingsData({ ...settingsData, billing_day: val })
                                    }}
                                    onBlur={() => {
                                        const v = settingsData.billing_day
                                        if (v === '' || v === undefined || (typeof v === 'number' && (v < 1 || v > 31))) {
                                            setSettingsData({ ...settingsData, billing_day: 1 })
                                        }
                                    }}
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold focus:ring-2 focus:ring-amber-500/20 transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase tracking-widest">ของเดือน</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">วันครบกำหนดชำระ</label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={settingsData.payment_due_day}
                                    onChange={(e) => {
                                        const raw = e.target.value
                                        if (raw === '') {
                                            setSettingsData({ ...settingsData, payment_due_day: '' })
                                            return
                                        }
                                        let val = parseInt(raw, 10)
                                        if (Number.isNaN(val)) return
                                        if (val < 1) val = 1
                                        if (val > 31) val = 31
                                        setSettingsData({ ...settingsData, payment_due_day: val })
                                    }}
                                    onBlur={() => {
                                        const v = settingsData.payment_due_day
                                        if (v === '' || v === undefined || (typeof v === 'number' && (v < 1 || v > 31))) {
                                            setSettingsData({ ...settingsData, payment_due_day: 5 })
                                        }
                                    }}
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold focus:ring-2 focus:ring-amber-500/20 transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase tracking-widest">ของเดือนถัดไป</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── SECTION 4: LINE NOTIFICATION ── */}
                <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-500">
                            <ChatBubbleLeftRightIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-lg font-black text-gray-800">LINE Messaging API</h2>
                        {lineConfig.owner_line_user_id ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                                <CheckCircleIcon className="w-3.5 h-3.5" />
                                เชื่อมต่อเจ้าของแล้ว
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                                ยังไม่เชื่อมต่อเจ้าของ
                            </div>
                        )}
                    </div>
                    <p className="text-xs font-bold text-gray-400 mb-8 ml-13">ตั้งค่าเพื่อส่งใบแจ้งหนี้และรับแจ้งเตือนสลิปผ่าน LINE</p>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Channel ID</label>
                            <input 
                                type="text"
                                value={lineConfig.channel_id}
                                onChange={(e) => setLineConfig({...lineConfig, channel_id: e.target.value})}
                                placeholder="เช่น 200635xxxx"
                                className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-green-500/20 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Channel Secret</label>
                                <input 
                                    type="password"
                                    value={lineConfig.channel_secret}
                                    onChange={(e) => setLineConfig({...lineConfig, channel_secret: e.target.value})}
                                    placeholder="••••••••••••••••••••"
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-green-500/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Channel Access Token</label>
                                <input 
                                    type="password"
                                    value={lineConfig.access_token}
                                    onChange={(e) => setLineConfig({...lineConfig, access_token: e.target.value})}
                                    placeholder="••••••••••••••••"
                                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-gray-800 font-bold placeholder:text-gray-300 focus:ring-2 focus:ring-green-500/20 transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">💡 วิธีตั้งค่า</p>
                            <ul className="text-xs text-blue-700 font-bold space-y-1 ml-4 list-disc">
                                <li>ไปที่ LINE Developers Console เลือก Channel Messaging API</li>
                                <li>คัดลอก Channel ID, Secret และ Issue 'Channel access token'</li>
                                <li>ตั้งค่า Webhook URL เป็น: <code className="bg-white/80 px-1 rounded">https://yourdomain.com/api/line/webhook</code></li>
                                <li>กด "บันทึกการตั้งค่า" ในหน้านี้</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Message */}
                {message && (
                    <div className="flex items-center gap-2 justify-center py-2 px-10 bg-emerald-50 text-emerald-600 rounded-full font-bold text-sm mx-auto w-fit animate-bounce">
                        <CheckCircleIcon className="w-5 h-5" />
                        {message}
                    </div>
                )}
            </main>

            {/* Bottom Bar for Save */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 px-6 py-4 z-40">
                <div className="max-w-2xl mx-auto">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-16 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[1.25rem] font-black text-lg shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 transition-all hover:shadow-2xl hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? (
                            <ArrowPathIcon className="w-6 h-6 animate-spin" />
                        ) : (
                            <>บันทึกการตั้งค่า</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
