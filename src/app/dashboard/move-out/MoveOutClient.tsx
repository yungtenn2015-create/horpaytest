'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ClockIcon,
    ArrowRightOnRectangleIcon,
    ChevronRightIcon,
    HomeIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline'

interface Tenant {
    id: string;
    name: string;
    phone: string | null;
    status: string;
    created_at: string;
    room_id: string;
    tenant_contract_id?: string | null;
    rooms: {
        room_number: string;
        floor: string;
        base_price: number;
    };
    planned_move_out_date?: string | null;
}

export default function MoveOutClient() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [showMoveOutModal, setShowMoveOutModal] = useState(false)
    const [isMovingOut, setIsMovingOut] = useState(false)
    const [showNoticeModal, setShowNoticeModal] = useState(false)
    const [noticeDate, setNoticeDate] = useState('')
    const [isSubmittingNotice, setIsSubmittingNotice] = useState(false)

    // Debt Check States
    const [pendingBills, setPendingBills] = useState<any[]>([])
    const [showDebtWarning, setShowDebtWarning] = useState(false)
    const [isCheckingDebt, setIsCheckingDebt] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Fetch ONLY active tenants
            const { data, error } = await supabase
                .from('tenants')
                .select(`
                    *,
                    rooms (
                        room_number,
                        floor,
                        base_price
                    )
                `)
                .eq('status', 'active')
                .order('rooms(room_number)', { ascending: true })

            if (error) throw error
            setTenants(data as any[] || [])
        } catch (err: any) {
            setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลได้')
        } finally {
            setLoading(false)
        }
    }

    const handleCheckDebt = async (tenant: Tenant) => {
        setSelectedTenant(tenant)
        setErrorMsg('')
        setIsCheckingDebt(true)
        const supabase = createClient()

        try {
            const { data: bills, error } = await supabase
                .from('bills')
                .select('*')
                .eq('tenant_id', tenant.id)
                .in('status', ['unpaid', 'overdue', 'waiting_verify'])

            if (error) throw error

            if (bills && bills.length > 0) {
                setPendingBills(bills)
                setShowDebtWarning(true)
            } else {
                setShowMoveOutModal(true)
            }
        } catch (err: any) {
            setErrorMsg('ไม่สามารถตรวจสอบหนี้ค้างชำระได้: ' + err.message)
        } finally {
            setIsCheckingDebt(false)
        }
    }

    const handleMoveOut = async () => {
        if (!selectedTenant || isMovingOut) return
        setIsMovingOut(true)
        const supabase = createClient()

        try {
            // 1. Update Tenant status to 'moved_out'
            const { error: tError } = await supabase
                .from('tenants')
                .update({
                    status: 'moved_out',
                    moved_out_at: new Date().toISOString()
                })
                .eq('id', selectedTenant.id)
            if (tError) throw tError

            // 2. Update Room status to 'available'
            const { error: rError } = await supabase
                .from('rooms')
                .update({ status: 'available' })
                .eq('id', selectedTenant.room_id)
            if (rError) throw rError

            // 3. Update Lease Contract to 'terminated'
            const { error: lError } = await supabase
                .from('lease_contracts')
                .update({
                    status: 'terminated',
                    end_date: new Date().toISOString().split('T')[0]
                })
                .eq('tenant_id', selectedTenant.id)
                .eq('status', 'active')
            if (lError) throw lError

            // 4. Update Tenant Contract to 'expired'
            if (selectedTenant.tenant_contract_id) {
                const { error: tcError } = await supabase
                    .from('tenant_contracts')
                    .update({ status: 'expired' })
                    .eq('id', selectedTenant.tenant_contract_id)
                if (tcError) throw tcError
            }

            setShowMoveOutModal(false)
            setShowDebtWarning(false)
            setPendingBills([])
            setSelectedTenant(null)
            fetchData()
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setIsMovingOut(false)
        }
    }

    const handleCancelNotice = async () => {
        if (!selectedTenant || isSubmittingNotice) return
        setIsSubmittingNotice(true)
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('tenants')
                .update({ planned_move_out_date: null })
                .eq('id', selectedTenant.id)

            if (error) throw error

            setShowNoticeModal(false)
            setNoticeDate('')
            setSelectedTenant(null)
            fetchData()
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการยกเลิก')
        } finally {
            setIsSubmittingNotice(false)
        }
    }

    const handleSetNotice = async () => {
        if (!selectedTenant || !noticeDate || isSubmittingNotice) return
        setIsSubmittingNotice(true)
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('tenants')
                .update({ planned_move_out_date: noticeDate })
                .eq('id', selectedTenant.id)

            if (error) throw error

            setShowNoticeModal(false)
            setNoticeDate('')
            setSelectedTenant(null)
            fetchData()
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setIsSubmittingNotice(false)
        }
    }

    const filteredTenants = tenants.filter(t => {
        const query = searchQuery.toLowerCase()
        return (
            t.name.toLowerCase().includes(query) ||
            t.rooms.room_number.toLowerCase().includes(query)
        )
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-red-600 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

                {/* ── Header ── */}
                <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
                    <div className="px-6 py-4 sm:py-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 transition-all active:scale-95"
                                >
                                    <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-gray-800 tracking-tight">แจ้งออก/ย้ายออก</h1>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">จัดการการคืนห้องพัก</p>
                                </div>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className={`h-5 w-5 transition-colors duration-300 ${searchQuery ? 'text-emerald-500' : 'text-gray-400'}`} />
                            </div>
                            <input
                                type="text"
                                placeholder="พิมพ์เลขห้อง หรือชื่อผู้เช่า..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl transition-all font-bold text-base outline-none shadow-sm hover:bg-gray-100/50"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                                        <XMarkIcon className="h-4 w-4 stroke-[3]" />
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── List ── */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 pb-20">
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600 text-xs font-bold">
                            {errorMsg}
                        </div>
                    )}

                    {filteredTenants.length > 0 ? (
                        filteredTenants.map((tenant) => (
                            <div
                                key={tenant.id}
                                className={`bg-white p-4 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border flex flex-col gap-4 group transition-all duration-300 ${tenant.planned_move_out_date ? 'border-amber-100 bg-amber-50/10' : 'border-gray-50 hover:border-red-100'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border shadow-sm transition-colors ${tenant.planned_move_out_date ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                                            <span className="text-[10px] font-bold uppercase leading-none mb-1">ห้อง</span>
                                            <span className="text-xl font-black leading-none">{tenant.rooms.room_number}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="text-base font-black text-gray-800 tracking-tight">{tenant.name}</h3>
                                            {tenant.planned_move_out_date ? (
                                                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-full w-fit">
                                                    <ClockIcon className="w-3 h-3" />
                                                    <span className="text-[10px] font-black uppercase tracking-wide">
                                                        แจ้งออก: {new Date(tenant.planned_move_out_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">สถานะ: กำลังพัก</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setSelectedTenant(tenant)
                                            setNoticeDate(new Date().toISOString().split('T')[0])
                                            setShowNoticeModal(true)
                                        }}
                                        className="py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-100 rounded-2xl font-black text-[13px] transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <ClockIcon className="w-4 h-4" />
                                        แจ้งล่วงหน้า
                                    </button>
                                    <button
                                        onClick={() => handleCheckDebt(tenant)}
                                        disabled={isCheckingDebt && selectedTenant?.id === tenant.id}
                                        className="py-3 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 border border-red-100 rounded-2xl font-black text-[13px] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isCheckingDebt && selectedTenant?.id === tenant.id ? (
                                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                        )}
                                        ย้ายออกจริง
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center border border-dashed border-gray-200">
                                <HomeIcon className="w-10 h-10 text-gray-200" />
                            </div>
                            <div>
                                <p className="text-gray-400 font-black text-sm">ไม่พบรายชื่อผู้เช่าที่กำลังพักอยู่</p>
                                <p className="text-gray-300 text-[10px] font-bold uppercase tracking-widest">NO ACTIVE TENANTS FOUND</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Modals ── */}
                {/* 1. Notice Date Modal */}
                {showNoticeModal && selectedTenant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNoticeModal(false)} />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                            <div className="bg-amber-500 p-8 text-white">
                                <ClockIcon className="w-12 h-12 mb-2" />
                                <h3 className="text-2xl font-black tracking-tight">กำหนดวันย้ายออก</h3>
                                <p className="text-amber-50 text-[11px] font-bold">ห้อง {selectedTenant.rooms.room_number} - {selectedTenant.name}</p>
                            </div>
                            <div className="p-8 space-y-6">
                                <input
                                    type="date"
                                    value={noticeDate}
                                    onChange={(e) => setNoticeDate(e.target.value)}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent focus:border-amber-500 rounded-2xl px-5 font-black text-gray-800 outline-none transition-all"
                                />
                                <div className="flex flex-col gap-3">
                                    <button onClick={handleSetNotice} disabled={isSubmittingNotice} className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-100 transition-all active:scale-95">
                                        {isSubmittingNotice ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                                    </button>
                                    {selectedTenant.planned_move_out_date && (
                                        <button 
                                            onClick={handleCancelNotice} 
                                            disabled={isSubmittingNotice}
                                            className="w-full h-14 bg-red-50 hover:bg-red-100 text-red-600 font-black rounded-2xl transition-all active:scale-95 border border-red-100"
                                        >
                                            {isSubmittingNotice ? 'กำลังประมวลผล...' : 'ยกเลิกการแจ้งออก'}
                                        </button>
                                    )}
                                    <button onClick={() => setShowNoticeModal(false)} className="w-full h-14 bg-gray-100 text-gray-400 font-black rounded-2xl">กลับ</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Move Out Confirm Modal */}
                {showMoveOutModal && selectedTenant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMoveOutModal(false)} />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-8 text-center space-y-4">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2 text-red-500 shadow-inner">
                                    <ArrowRightOnRectangleIcon className="w-10 h-10" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 tracking-tight">ยืนยันการย้ายออก?</h3>
                                <p className="text-gray-400 text-sm font-bold leading-relaxed px-4">
                                    คุณต้องการบันทึกการย้ายออกของ <span className="text-gray-800">{selectedTenant.name}</span> ใช่หรือไม่? <br />(ห้องจะกลายเป็นห้องว่างทันที)
                                </p>
                            </div>
                            <div className="p-8 bg-gray-50 flex flex-col gap-3">
                                <button
                                    onClick={handleMoveOut}
                                    disabled={isMovingOut}
                                    className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isMovingOut && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {isMovingOut ? 'กำลังบันทึก...' : 'ยืนยันการย้ายออก'}
                                </button>
                                <button onClick={() => setShowMoveOutModal(false)} className="w-full h-14 bg-white border border-gray-100 text-gray-400 font-black rounded-2xl shadow-sm hover:bg-gray-50 transition-all">ยกเลิก</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Debt Warning Modal */}
                {showDebtWarning && selectedTenant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDebtWarning(false)} />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-red-50 p-8 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                                    <ExclamationCircleIcon className="w-12 h-12 text-red-500" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 tracking-tight">พบหนี้ค้างชำระ!</h3>
                                <p className="text-red-600/60 text-[10px] font-black mt-1 uppercase tracking-widest">Outstanding Debt Detected</p>
                            </div>

                            <div className="px-8 py-6 space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 italic text-[11px] text-gray-400 font-medium text-center">
                                    ผู้เช่า <span className="font-black text-gray-600">{selectedTenant.name}</span> ยังมีบิลที่ยังไม่ได้ชำระดังนี้:
                                </div>

                                {pendingBills.map(bill => (
                                    <div key={bill.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">รอบบิล</p>
                                            <p className="text-sm font-black text-gray-700 leading-none">
                                                {new Date(bill.billing_month).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">ยอดเงิน</p>
                                            <p className="text-base font-black text-red-600 leading-none">
                                                ฿{Number(bill.total_amount).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                <div className="pt-2 border-t border-gray-100 flex items-center justify-between px-2">
                                    <span className="text-sm font-black text-gray-800">รวมยอดค้างชำระทั้งหมด:</span>
                                    <span className="text-xl font-black text-red-600">฿{pendingBills.reduce((acc, b) => acc + Number(b.total_amount), 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="p-8 space-y-3 bg-gray-50">
                                <button
                                    onClick={() => router.push(`/dashboard/billing?room=${selectedTenant.rooms.room_number}`)}
                                    className="w-full h-14 bg-gray-800 hover:bg-black text-white font-black rounded-2xl shadow-lg shadow-gray-200 transition-all active:scale-95"
                                >
                                    ไปจุดชำระเงิน
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDebtWarning(false)
                                        setShowMoveOutModal(true)
                                    }}
                                    className="w-full h-14 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 font-black rounded-2xl transition-all active:scale-95"
                                >
                                    ยืนยันย้ายออกทั้งที่มีหนี้
                                </button>
                                <button
                                    onClick={() => setShowDebtWarning(false)}
                                    className="w-full py-2 text-gray-400 font-bold text-xs"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
