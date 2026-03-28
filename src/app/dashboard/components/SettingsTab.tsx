'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
    BuildingOfficeIcon,
    MapPinIcon,
    DevicePhoneMobileIcon,
    BanknotesIcon,
    PlusIcon,
    ChatBubbleLeftRightIcon,
    LockClosedIcon,
    CheckIcon,
    ClipboardIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    BellIcon,
    CalendarDaysIcon,
    BoltIcon,
    Squares2X2Icon,
    KeyIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'

import {
    BanknotesIcon as BanknotesSolid,
    BuildingOffice2Icon as BuildingOfficeSolid
} from '@heroicons/react/24/solid'

import { Service } from '../DashboardClient'
import { createClient } from '@/lib/supabase-client'

interface SettingsTabProps {
    onCloseSettings: () => void
    activeSettingsTab: string
    setActiveSettingsTab: (tab: string) => void
    dormId: string
    dormData: {
        name: string
        address: string
        contact_number: string
    }
    setDormData: (data: any) => void
    settingsData: {
        bank_name: string
        bank_account_no: string
        bank_account_name: string
        billing_day: number
        payment_due_day: number
        electric_rate_per_unit: number
        water_rate_per_unit: number
        water_billing_type: 'per_unit' | 'flat_rate'
        water_flat_rate: number
    }
    setSettingsData: (data: any) => void
    newServiceName: string
    setNewServiceName: (name: string) => void
    newServicePrice: string
    setNewServicePrice: (price: string) => void
    addService: () => void
    services: Service[]
    removeService: (id: string) => void
    showLineConfig: boolean
    setShowLineConfig: (show: boolean) => void
    lineConfig: {
        channel_id: string
        channel_secret: string
        access_token: string
        owner_line_user_id: string
    }
    setLineConfig: (config: any) => void
    copyToClipboard: (text: string) => void
    copied: boolean
    handleTestConnection: () => void
    handleResetOwnerLine: () => void
    isResettingOwnerLine: boolean
    isTestingConnection: boolean
    testResult: { success: boolean; message: string } | null
    handleSaveSettings: () => void
    savingSettings: boolean
    settingsMessage: string
}

/** หลังพิมพ์เสร็จ / blur — ค่าว่างหรือไม่ถูกต้องใช้ fallback (ค่าที่บันทึกไว้) */
function dayFromDraft(raw: string, fallback: number): number {
    const fb = Math.min(31, Math.max(1, fallback))
    if (raw.trim() === '') return fb
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) return fb
    return Math.min(31, Math.max(1, n))
}

const SettingsTab: React.FC<SettingsTabProps> = ({
    onCloseSettings,
    activeSettingsTab,
    setActiveSettingsTab,
    dormId,
    dormData,
    setDormData,
    settingsData,
    setSettingsData,
    newServiceName,
    setNewServiceName,
    newServicePrice,
    setNewServicePrice,
    addService,
    services,
    removeService,
    showLineConfig,
    setShowLineConfig,
    lineConfig,
    setLineConfig,
    copyToClipboard,
    copied,
    handleTestConnection,
    handleResetOwnerLine,
    isResettingOwnerLine,
    isTestingConnection,
    testResult,
    handleSaveSettings,
    savingSettings,
    settingsMessage
}) => {
    const isDormSection = activeSettingsTab === 'dorm'
    const isLineSection = activeSettingsTab === 'line'

    const [ownerClaim, setOwnerClaim] = useState<{
        code: string
        expiresAt: string | null
        usedAt: string | null
        loading: boolean
        error: string
        success: string
    }>({ code: '', expiresAt: null, usedAt: null, loading: false, error: '', success: '' })

    const [billingDayDraft, setBillingDayDraft] = useState(() => String(settingsData.billing_day))
    const [paymentDueDraft, setPaymentDueDraft] = useState(() => String(settingsData.payment_due_day))

    useEffect(() => {
        setBillingDayDraft(String(settingsData.billing_day))
        setPaymentDueDraft(String(settingsData.payment_due_day))
    }, [settingsData.billing_day, settingsData.payment_due_day])

    const ownerClaimStatus = useMemo(() => {
        if (!ownerClaim.expiresAt) return { isExpired: true, msLeft: 0 }
        const t = new Date(ownerClaim.expiresAt).getTime()
        const msLeft = t - Date.now()
        return { isExpired: msLeft <= 0, msLeft: Math.max(0, msLeft) }
    }, [ownerClaim.expiresAt])

    useEffect(() => {
        const loadOwnerClaim = async () => {
            if (!isLineSection || !dormId) return
            const supabase = createClient()
            try {
                const { data, error } = await supabase
                    .from('line_oa_configs')
                    .select('owner_claim_code, owner_claim_expires_at, owner_claim_used_at')
                    .eq('dorm_id', dormId)
                    .maybeSingle()
                if (error) throw error
                setOwnerClaim(prev => ({
                    ...prev,
                    code: data?.owner_claim_code || '',
                    expiresAt: data?.owner_claim_expires_at || null,
                    usedAt: data?.owner_claim_used_at || null
                }))
            } catch (e: any) {
                // Fallback gracefully if migration not applied yet
                setOwnerClaim(prev => ({
                    ...prev,
                    error: e?.message?.includes('owner_claim_code') ? 'ยังไม่ได้รัน SQL Migration สำหรับ Owner Code' : ''
                }))
            }
        }
        loadOwnerClaim()
    }, [dormId, isLineSection])

    const handleGenerateOwnerCode = async () => {
        if (!dormId) return
        setOwnerClaim(prev => ({ ...prev, loading: true, error: '', success: '' }))
        const supabase = createClient()
        try {
            const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
            if (sessionErr || !sessionData?.session?.access_token) {
                throw new Error('กรุณาเข้าสู่ระบบใหม่ แล้วลองอีกครั้ง')
            }

            const res = await fetch('/api/line/owner-claim-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dorm_id: dormId,
                    access_token: sessionData.session.access_token
                })
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json?.success) {
                throw new Error(json?.error || 'ไม่สามารถสร้างรหัสได้')
            }

            setOwnerClaim(prev => ({
                ...prev,
                code: String(json.code || ''),
                expiresAt: String(json.expires_at || ''),
                usedAt: null,
                success: 'สร้างรหัสยืนยันแล้ว (อายุ 10 นาที)'
            }))
            setTimeout(() => setOwnerClaim(prev => ({ ...prev, success: '' })), 2500)
        } catch (e: any) {
            setOwnerClaim(prev => ({ ...prev, error: e?.message || 'ไม่สามารถสร้างรหัสได้' }))
        } finally {
            setOwnerClaim(prev => ({ ...prev, loading: false }))
        }
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full px-6 pt-12 pb-32">
            <div className="mb-8 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3 flex-wrap">
                        <span className="text-4xl shrink-0">⚙️</span>
                        <span>ตั้งค่าระบบ</span>
                    </h1>
                    <p className="text-gray-400 font-bold text-sm mt-1">จัดการข้อมูลหอพักและตั้งค่าการแจ้งเตือน</p>
                </div>
                <button
                    type="button"
                    onClick={onCloseSettings}
                    className="shrink-0 mt-1 w-11 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors active:scale-95 border border-gray-200/80"
                    aria-label="ปิดและกลับหน้าหลัก"
                >
                    <XMarkIcon className="w-6 h-6 stroke-[2.5]" />
                </button>
            </div>

            <div className="mb-8">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black ${isDormSection ? 'bg-gray-50 text-gray-700 border-gray-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                    {isDormSection ? <BuildingOfficeIcon className="w-4 h-4" /> : <ChatBubbleLeftRightIcon className="w-4 h-4" />}
                    {isDormSection ? 'โหมด: ข้อมูลหอพัก' : 'โหมด: การเชื่อมต่อ LINE'}
                </div>
            </div>

            <div className="space-y-6">
                {isDormSection && (
                    <>
                        {/* Dorm Info Section */}
                        <div className="bg-white rounded-[2.5rem] p-8 border-2 border-gray-50 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 bg-green-50 rounded-2xl text-green-600">
                                    <BuildingOfficeSolid className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-gray-800">ข้อมูลพื้นฐาน</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ชื่อหอพัก</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-green-500 transition-colors">
                                            <BuildingOfficeIcon className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={dormData.name}
                                            onChange={(e) => setDormData({ ...dormData, name: e.target.value })}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-green-500 transition-all outline-none shadow-sm"
                                            placeholder="ระบุชื่อหอพัก..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ที่อยู่หอพัก</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-4 text-gray-300 group-focus-within:text-green-500 transition-colors">
                                            <MapPinIcon className="w-5 h-5" />
                                        </div>
                                        <textarea
                                            rows={3}
                                            value={dormData.address}
                                            onChange={(e) => setDormData({ ...dormData, address: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 py-4 font-bold text-gray-800 focus:bg-white focus:border-green-500 transition-all outline-none resize-none shadow-sm"
                                            placeholder="ระบุที่อยู่..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์ติดต่อ</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-green-500 transition-colors">
                                            <DevicePhoneMobileIcon className="w-5 h-5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={dormData.contact_number}
                                            onChange={(e) => setDormData({ ...dormData, contact_number: e.target.value })}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-green-500 transition-all outline-none shadow-sm"
                                            placeholder="08X-XXX-XXXX"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Info Section */}
                        <div className="bg-white rounded-[2.5rem] p-8 border-2 border-gray-50 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600">
                                    <BanknotesSolid className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-gray-800">ข้อมูลการชำระเงิน</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ธนาคาร</label>
                                    <input
                                        type="text"
                                        value={settingsData.bank_name}
                                        onChange={(e) => setSettingsData({ ...settingsData, bank_name: e.target.value })}
                                        className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:bg-white focus:border-blue-500 transition-all outline-none shadow-sm"
                                        placeholder="เช่น กสิกรไทย"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">เลขบัญชี</label>
                                        <input
                                            type="text"
                                            value={settingsData.bank_account_no}
                                            onChange={(e) => setSettingsData({ ...settingsData, bank_account_no: e.target.value })}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:bg-white focus:border-blue-500 transition-all outline-none shadow-sm"
                                            placeholder="XXX-X-XXXXX-X"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ชื่อบัญชี</label>
                                        <input
                                            type="text"
                                            value={settingsData.bank_account_name}
                                            onChange={(e) => setSettingsData({ ...settingsData, bank_account_name: e.target.value })}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:bg-white focus:border-blue-500 transition-all outline-none shadow-sm"
                                            placeholder="ชื่อ-นามสกุล"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bills & Utilities Section */}
                        <div className="bg-white rounded-[2.5rem] p-8 border-2 border-gray-50 shadow-sm space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 bg-orange-50 rounded-2xl text-orange-600">
                                    <CalendarDaysIcon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-gray-800">รอบบิลและค่าสาธารณูปโภค</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-3 sm:gap-4 items-end max-w-[19rem] sm:max-w-[21rem] mx-auto w-full">
                                    <div className="space-y-1.5 min-w-0">
                                        <label className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-wide ml-0.5 leading-tight min-h-[2.25rem] sm:min-h-[2.5rem] flex flex-col justify-end gap-0">
                                            <span>วันจดมิเตอร์</span>
                                            <span>ตัดรอบบิล</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="31"
                                                inputMode="numeric"
                                                value={billingDayDraft}
                                                onChange={(e) => {
                                                    const raw = e.target.value
                                                    setBillingDayDraft(raw)
                                                    if (raw.trim() === '') return
                                                    const n = parseInt(raw, 10)
                                                    if (Number.isNaN(n)) return
                                                    setSettingsData({
                                                        ...settingsData,
                                                        billing_day: Math.min(31, Math.max(1, n)),
                                                    })
                                                }}
                                                onBlur={() => {
                                                    const c = dayFromDraft(billingDayDraft, settingsData.billing_day)
                                                    setBillingDayDraft(String(c))
                                                    setSettingsData({ ...settingsData, billing_day: c })
                                                }}
                                                className="w-full h-12 sm:h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-3 pr-11 font-bold text-gray-800 focus:bg-white focus:border-orange-500 transition-all outline-none text-center tabular-nums"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 pointer-events-none">วันที่</div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 min-w-0">
                                        <label className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-wide ml-0.5 leading-tight min-h-[2.25rem] sm:min-h-[2.5rem] flex flex-col justify-end">
                                            <span>วันครบกำหนด</span>
                                            <span>ชำระ</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                max="31"
                                                inputMode="numeric"
                                                value={paymentDueDraft}
                                                onChange={(e) => {
                                                    const raw = e.target.value
                                                    setPaymentDueDraft(raw)
                                                    if (raw.trim() === '') return
                                                    const n = parseInt(raw, 10)
                                                    if (Number.isNaN(n)) return
                                                    setSettingsData({
                                                        ...settingsData,
                                                        payment_due_day: Math.min(31, Math.max(1, n)),
                                                    })
                                                }}
                                                onBlur={() => {
                                                    const c = dayFromDraft(paymentDueDraft, settingsData.payment_due_day)
                                                    setPaymentDueDraft(String(c))
                                                    setSettingsData({ ...settingsData, payment_due_day: c })
                                                }}
                                                className="w-full h-12 sm:h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-3 pr-11 font-bold text-gray-800 focus:bg-white focus:border-orange-500 transition-all outline-none text-center tabular-nums"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 pointer-events-none">วันที่</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-50" />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm">
                                                <BoltIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-orange-900 uppercase">ค่าไฟฟ้า</p>
                                                <p className="text-[10px] text-orange-600 font-bold">ราคาต่อหน่วย</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={settingsData.electric_rate_per_unit}
                                                onChange={(e) => setSettingsData({ ...settingsData, electric_rate_per_unit: parseFloat(e.target.value) || 0 })}
                                                className="w-16 h-10 bg-white border border-orange-200 rounded-lg text-center font-black text-orange-700 outline-none"
                                            />
                                            <span className="text-[11px] font-black text-orange-900">฿</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-teal-50/50 rounded-2xl border border-teal-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-teal-500 shadow-sm">
                                                    <ArrowPathIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-teal-900 uppercase">ค่าน้ำประปา</p>
                                                    <select
                                                        value={settingsData.water_billing_type}
                                                        onChange={(e) => setSettingsData({ ...settingsData, water_billing_type: e.target.value as 'per_unit' | 'flat_rate' })}
                                                        className="text-[10px] text-teal-600 font-bold bg-transparent outline-none cursor-pointer"
                                                    >
                                                        <option value="per_unit">ราคาต่อหน่วย</option>
                                                        <option value="flat_rate">เหมาจ่ายรายห้อง</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={settingsData.water_billing_type === 'per_unit' ? settingsData.water_rate_per_unit : settingsData.water_flat_rate}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        if (settingsData.water_billing_type === 'per_unit') {
                                                            setSettingsData({ ...settingsData, water_rate_per_unit: val });
                                                        } else {
                                                            setSettingsData({ ...settingsData, water_flat_rate: val });
                                                        }
                                                    }}
                                                    className="w-16 h-10 bg-white border border-teal-200 rounded-lg text-center font-black text-teal-700 outline-none"
                                                />
                                                <span className="text-[11px] font-black text-teal-900">฿</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Extra Services Section */}
                        <div className="bg-white rounded-[2.5rem] p-8 border-2 border-gray-50 shadow-sm space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2.5 bg-purple-50 rounded-2xl text-purple-600">
                                        <PlusIcon className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-800">ค่าบริการเพิ่มเติม</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-[2] space-y-1">
                                            <input
                                                type="text"
                                                placeholder="ชื่อบริการ (เช่น ค่าเน็ต)"
                                                value={newServiceName}
                                                onChange={(e) => setNewServiceName(e.target.value)}
                                                className="w-full h-12 bg-white border-2 border-gray-100 rounded-xl px-4 text-sm font-bold text-gray-800 outline-none focus:border-purple-500 transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <input
                                                type="number"
                                                placeholder="ราคา"
                                                value={newServicePrice}
                                                onChange={(e) => setNewServicePrice(e.target.value)}
                                                className="w-full h-12 bg-white border-2 border-gray-100 rounded-xl px-4 text-sm font-bold text-gray-800 outline-none focus:border-purple-500 transition-all shadow-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addService}
                                            className="shrink-0 h-12 px-4 bg-purple-50 text-purple-600 border-2 border-purple-100 rounded-xl flex items-center justify-center text-sm font-black hover:bg-purple-100 transition-all active:scale-90"
                                        >
                                            เพิ่ม
                                        </button>
                                    </div>

                                    <div className="space-y-2 min-h-[40px]">
                                        {services.map((s) => (
                                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-2xl animate-in zoom-in-95 duration-200">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-gray-700">{s.name}</span>
                                                    <span className="text-[11px] font-bold text-green-600">{s.price.toLocaleString()} บาท/เดือน</span>
                                                </div>
                                                <button
                                                    onClick={() => removeService(s.id)}
                                                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <PlusIcon className="w-5 h-5 rotate-45" />
                                                </button>
                                            </div>
                                        ))}
                                        {services.length === 0 && (
                                            <p className="text-center py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-2 border-dashed border-gray-100 rounded-2xl">ไม่มีค่าบริการเพิ่มเติม</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {isLineSection && (
                    <div className="space-y-6">
                        <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50 backdrop-blur-sm shadow-sm group hover:shadow-md transition-all duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shadow-sm shadow-green-100">
                                        <ChatBubbleLeftRightIcon className="w-8 h-8 stroke-[2]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-800 tracking-tight">LINE Messaging API</h3>
                                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Line Notification Configuration</p>
                                    </div>
                                </div>

                                {/* Toggle Switch */}
                                <div className="flex flex-col items-end gap-1 px-4 py-2 bg-white rounded-2xl border-2 border-gray-50 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${showLineConfig ? 'text-green-600' : 'text-gray-400'}`}>
                                            {showLineConfig ? 'พร้อมแก้ไข' : 'ปิดอยู่'}
                                        </span>
                                        <button
                                            onClick={() => setShowLineConfig(!showLineConfig)}
                                            className={`relative w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${showLineConfig ? 'bg-green-500' : 'bg-gray-200 shadow-inner'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showLineConfig ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={`grid gap-6 transition-all duration-500 transform ${showLineConfig ? 'opacity-100 translate-y-0 filter-none' : 'opacity-40 translate-y-2 pointer-events-none grayscale-0'}`}>
                                {/* Overlay message when locked */}
                                {!showLineConfig && (
                                    <div className="absolute inset-0 z-50 flex items-center justify-center p-8 text-center bg-white/50 backdrop-blur-[2px] rounded-[2.5rem]">
                                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                                            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-2">
                                                <LockClosedIcon className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm font-black text-gray-700">ฟีเจอร์นี้ถูกปิดใช้งานอยู่</p>
                                            <p className="text-[11px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest">กรุณากดเปิดที่ปุ่มด้านบน<br />เพื่อความปลอดภัยและป้องกันการกดเล่น</p>
                                        </div>
                                    </div>
                                )}
                                {/* Webhook URL Section */}
                                <div className="space-y-2">
                                    <label className="text-[13px] font-black text-gray-500 ml-1">Webhook URL (สำหรับนำไปวางใน LINE Console)</label>
                                    <div className="relative group/webhook">
                                        <input
                                            readOnly
                                            type="text"
                                            value={typeof window !== 'undefined' ? `${window.location.origin}/api/line/webhook` : ''}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 pr-14 font-mono text-[11px] font-bold text-gray-500 transition-all outline-none"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(typeof window !== 'undefined' ? `${window.location.origin}/api/line/webhook` : '')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-90"
                                        >
                                            {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100/50 my-2" />

                                <div className="space-y-2">
                                    <label className="text-[13px] font-black text-gray-500 ml-1">Bot User ID (อัตโนมัติ)</label>
                                    <input
                                        readOnly
                                        type="text"
                                        value={lineConfig.channel_id}
                                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 font-bold text-gray-500 cursor-not-allowed outline-none shadow-sm"
                                        placeholder="จะปรากฏเมื่อทดสอบสำเร็จ..."
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[13px] font-black text-gray-500 ml-1">สถานะเจ้าของ LINE</label>
                                    <div className="flex items-center justify-between gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                        <div>
                                            <p className={`text-sm font-black ${lineConfig.owner_line_user_id ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                {lineConfig.owner_line_user_id ? 'ผูกเจ้าของแล้ว' : 'ยังไม่ผูกเจ้าของ'}
                                            </p>
                                            <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                                                {lineConfig.owner_line_user_id
                                                    ? `LINE ID: ${lineConfig.owner_line_user_id.slice(0, 8)}...`
                                                    : 'ให้เจ้าของหอพิมพ์ Owner Code เพื่อผูกบัญชี'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleResetOwnerLine}
                                            disabled={isResettingOwnerLine}
                                            className="h-10 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-100 font-black text-[11px] transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isResettingOwnerLine ? 'กำลังรีเซ็ต...' : 'รีเซ็ตเจ้าของ LINE'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[13px] font-black text-gray-500 ml-1">ยืนยันเจ้าของหอ (Owner Code)</label>
                                    <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-gray-800 flex items-center gap-2">
                                                    <KeyIcon className="w-4 h-4 text-emerald-600" />
                                                    ใช้รหัสเพื่อผูกเจ้าของให้ถูกคน
                                                </p>
                                                <p className="text-[11px] font-bold text-gray-400 leading-relaxed">
                                                    ให้เจ้าของหอเปิด LINE ที่แอด OA นี้ แล้วพิมพ์: <span className="font-black text-gray-600">owner-xxxxxx</span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleGenerateOwnerCode}
                                                disabled={ownerClaim.loading || !showLineConfig}
                                                className="h-10 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-100 font-black text-[11px] transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                                            >
                                                {ownerClaim.loading ? 'กำลังสร้าง...' : (ownerClaim.code ? 'รีเฟรชรหัส' : 'สร้างรหัส')}
                                            </button>
                                        </div>

                                        {ownerClaim.error && (
                                            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-black">
                                                {ownerClaim.error}
                                            </div>
                                        )}
                                        {ownerClaim.success && (
                                            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-black">
                                                {ownerClaim.success}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1">
                                                <div className={`h-12 rounded-2xl px-4 flex items-center justify-between border-2 ${ownerClaim.code ? (ownerClaimStatus.isExpired ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100') : 'bg-gray-50 border-gray-100'}`}>
                                                    <span className={`font-mono text-[13px] font-black ${ownerClaim.code ? 'text-gray-800' : 'text-gray-400'}`}>
                                                        {ownerClaim.code ? `owner-${ownerClaim.code}` : 'ยังไม่มีรหัส'}
                                                    </span>
                                                    <button
                                                        onClick={() => ownerClaim.code && copyToClipboard(`owner-${ownerClaim.code}`)}
                                                        disabled={!ownerClaim.code}
                                                        className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-90 disabled:opacity-50"
                                                    >
                                                        <ClipboardIcon className="w-5 h-5 text-gray-400" />
                                                    </button>
                                                </div>
                                                <p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${ownerClaim.code ? (ownerClaimStatus.isExpired ? 'text-amber-600' : 'text-gray-400') : 'text-gray-300'}`}>
                                                    {ownerClaim.code
                                                        ? (ownerClaimStatus.isExpired ? 'รหัสหมดอายุแล้ว (สร้างใหม่ได้)' : `หมดอายุ: ${new Date(ownerClaim.expiresAt as string).toLocaleString('th-TH')}`)
                                                        : 'กด “สร้างรหัส” เพื่อเริ่มผูกเจ้าของ'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[13px] font-black text-gray-500 ml-1">Channel Secret</label>
                                    <input
                                        type="password"
                                        value={lineConfig.channel_secret}
                                        onChange={(e) => setLineConfig({ ...lineConfig, channel_secret: e.target.value })}
                                        className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                        placeholder="••••••••••••••••"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-black text-gray-500 ml-1">Channel Access Token</label>
                                        <input
                                            type="password"
                                            value={lineConfig.access_token}
                                            onChange={(e) => setLineConfig({ ...lineConfig, access_token: e.target.value })}
                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                            placeholder="••••••••••••••••"
                                        />
                                    </div>

                                    <button
                                        onClick={handleTestConnection}
                                        disabled={isTestingConnection || !lineConfig.access_token}
                                        className="w-full h-14 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl border-2 border-blue-100 font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {isTestingConnection ? (
                                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                        )}
                                        {isTestingConnection ? 'กำลังตรวจสอบ...' : 'ทดสอบการเชื่อมต่อ'}
                                    </button>

                                    {testResult && (
                                        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in duration-300 ${testResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                            {testResult.success ? <CheckCircleIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
                                            <span className="text-xs font-black">{testResult.message}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Message Indicator */}
            {settingsMessage && (
                <div className="mt-8 flex items-center gap-2 justify-center py-3 px-6 bg-green-50 text-green-600 rounded-full font-black text-xs animate-bounce w-fit mx-auto">
                    <CheckCircleIcon className="w-4 h-4" />
                    {settingsMessage}
                </div>
            )}

            {/* Floating Save Button within Settings Drawer */}
            <div className="absolute bottom-[25px] left-0 right-0 px-6 sm:max-w-lg sm:mx-auto">
                <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full h-16 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-green-100/50 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                    {savingSettings ? (
                        <ArrowPathIcon className="w-6 h-6 animate-spin" />
                    ) : (
                        <>บันทึกการตั้งค่า</>
                    )}
                </button>
            </div>
        </div>
    )
}

export default SettingsTab
