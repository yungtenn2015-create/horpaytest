'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { format, subMonths, addMonths, startOfMonth } from 'date-fns'
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    XCircleIcon,
    DocumentTextIcon,
    ArrowPathIcon,
    TrashIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline'

interface Bill {
    id: string;
    room_number: string;
    tenant_name: string;
    billing_month: string;
    total_amount: number;
    room_amount: number;
    utility_amount: number;
    other_amount: number;
    status: 'paid' | 'waiting_verify' | 'unpaid' | 'overdue' | 'cancelled';
    created_at: string;
}

export default function HistoryClient() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [bills, setBills] = useState<Bill[]>([])
    const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()))
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [dormName, setDormName] = useState('รายการประวัติบิล')
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [billToCancel, setBillToCancel] = useState<Bill | null>(null)

    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ]

    useEffect(() => {
        fetchHistory()
    }, [selectedDate])

    async function fetchHistory() {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get Dorm
            const { data: dorms } = await supabase
                .from('dorms')
                .select('id, name')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .limit(1)

            if (!dorms || dorms.length === 0) return
            const dorm = dorms[0]
            setDormName(dorm.name)

            // 2. Get Bills for selected month
            const monthStr = format(selectedDate, 'yyyy-MM-01')

            const { data: billsData, error } = await supabase
                .from('bills')
                .select(`
                    id,
                    total_amount,
                    room_amount,
                    utility_amount,
                    other_amount,
                    status,
                    created_at,
                    billing_month,
                    rooms (room_number),
                    tenants (name)
                `)
                .eq('billing_month', monthStr)
                .order('created_at', { ascending: false })

            if (error) throw error

            const mappedBills = (billsData || []).map((b: any) => ({
                id: b.id,
                room_number: b.rooms?.room_number || 'N/A',
                tenant_name: b.tenants?.name || 'ไม่ทราบชื่อ',
                billing_month: b.billing_month,
                total_amount: b.total_amount,
                room_amount: b.room_amount,
                utility_amount: b.utility_amount,
                other_amount: b.other_amount,
                status: b.status,
                created_at: b.created_at
            }))

            setBills(mappedBills)
        } catch (err) {
            console.error('Fetch history error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleCancelBill() {
        if (!billToCancel) return
        setCancellingId(billToCancel.id)
        const supabase = createClient()

        try {
            // If it's paid, revert to unpaid instead of cancelling
            const newStatus = billToCancel.status === 'paid' ? 'unpaid' : 'cancelled'

            const { error } = await supabase
                .from('bills')
                .update({ status: newStatus })
                .eq('id', billToCancel.id)

            if (error) throw error

            // Refresh data
            await fetchHistory()
            setShowCancelModal(false)
            setBillToCancel(null)
        } catch (err) {
            console.error('Error updating bill:', err)
            alert('ไม่สามารถอัปเดตสถานะบิลได้ โปรดลองอีกครั้ง')
        } finally {
            setCancellingId(null)
        }
    }

    const filteredBills = bills.filter(bill => {
        const matchesSearch = bill.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bill.tenant_name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' 
            ? true 
            : statusFilter === 'unpaid' 
                ? (bill.status === 'unpaid' || bill.status === 'waiting_verify' || bill.status === 'overdue')
                : bill.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'paid':
                return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircleIcon, label: 'ชำระแล้ว' }
            case 'waiting_verify':
                return { bg: 'bg-blue-50', text: 'text-blue-600', icon: ClockIcon, label: 'รอชำระ' }
            case 'cancelled':
                return { bg: 'bg-gray-100', text: 'text-gray-400', icon: XCircleIcon, label: 'ยกเลิกแล้ว' }
            case 'overdue':
                return { bg: 'bg-red-50', text: 'text-red-600', icon: ExclamationCircleIcon, label: 'ค้างชำระ' }
            default:
                return { bg: 'bg-orange-50', text: 'text-orange-600', icon: DocumentTextIcon, label: 'รอชำระ' }
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-md bg-white h-screen sm:h-[850px] shadow-2xl flex flex-col relative overflow-hidden sm:rounded-[2.5rem] border border-gray-100">

                {/* ── HEADER ── */}
                <header className="px-6 pt-10 pb-6 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-50">
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
                        >
                            <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
                        </button>
                        <div className="text-center">
                            <h1 className="text-xl font-black text-gray-800 tracking-tight">ประวัติบิล</h1>
                            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest leading-none mt-1">{dormName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push('/dashboard/billing')}
                                className="h-10 px-3 rounded-xl bg-emerald-50 flex items-center justify-center gap-1.5 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shadow-sm border border-emerald-100"
                            >
                                <BanknotesIcon className="w-4 h-4 stroke-[2.5]" />
                                <span className="text-[10px] font-black uppercase tracking-tight">ออกบิล</span>
                            </button>
                            <button
                                onClick={fetchHistory}
                                className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 hover:bg-purple-100 active:scale-95 transition-all shadow-sm"
                            >
                                <ArrowPathIcon className={`w-5 h-5 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Month Selector */}
                    <div className="flex items-center justify-between bg-purple-50 rounded-[1.5rem] p-4 mb-6 shadow-inner ring-1 ring-purple-100/50">
                        <button
                            onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                            className="w-10 h-10 flex items-center justify-center text-purple-600 hover:bg-white rounded-xl transition-all shadow-sm active:scale-90"
                        >
                            <ChevronLeftIcon className="w-6 h-6 stroke-[3]" />
                        </button>
                        <div className="text-center">
                            <p className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-1">ประจำรอบบิล</p>
                            <p className="text-lg font-black text-purple-900 leading-none">
                                {thaiMonths[selectedDate.getMonth()]} {selectedDate.getFullYear() + 543}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                            className="w-10 h-10 flex items-center justify-center text-purple-600 hover:bg-white rounded-xl transition-all shadow-sm active:scale-90"
                        >
                            <ChevronRightIcon className="w-6 h-6 stroke-[3]" />
                        </button>
                    </div>

                    {/* Search & Tabs */}
                    <div className="space-y-4">
                        <div className="relative group">
                            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-purple-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="ค้นหาเลขห้อง หรือชื่อผู้เช่า..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 bg-gray-50 border-none rounded-2xl pl-12 pr-4 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all outline-none shadow-inner"
                            />
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            {['all', 'paid', 'unpaid', 'cancelled'].map((status) => {
                                const active = statusFilter === status
                                let label = 'ทั้งหมด'
                                if (status === 'paid') label = 'ชำระแล้ว'
                                if (status === 'unpaid') label = 'รอชำระ'
                                if (status === 'cancelled') label = 'ยกเลิก'

                                return (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-4 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border ${active
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-100'
                                                : 'bg-white text-gray-400 border-gray-100 hover:border-purple-200 hover:text-purple-400'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-6 py-8 space-y-4 pb-20 no-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
                            <p className="text-xs font-black text-gray-300 uppercase tracking-widest">กำลังดึงข้อมูล...</p>
                        </div>
                    ) : filteredBills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-gray-50/50 rounded-[2.5rem] border border-dashed border-gray-200 mx-2">
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-gray-200/50 mb-6 border border-gray-50">
                                <DocumentTextIcon className="w-10 h-10 text-gray-200" />
                            </div>
                            <h3 className="text-lg font-black text-gray-400 mb-2">ไม่พบรายการบิล</h3>
                            <p className="text-xs font-bold text-gray-300 leading-relaxed">
                                ไม่พบข้อมูลบิลที่ตรงตามเงื่อนไขในรอบเดือนนี้ <br />
                                โปรดลองเปลี่ยนเดือนหรือคำค้นหาครับ
                            </p>
                        </div>
                    ) : (
                        filteredBills.map((bill) => {
                            const style = getStatusStyle(bill.status)
                            const Icon = style.icon

                            return (
                                <div
                                    key={bill.id}
                                    className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg ${bill.status === 'cancelled' ? 'bg-gray-300' : 'bg-gradient-to-br from-purple-500 to-purple-700'}`}>
                                                {bill.room_number}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-gray-800 leading-none mb-1">{bill.tenant_name}</h4>
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${style.bg} ${style.text} border border-current/10`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">{style.label}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">ยอดรวมสุทธิ</p>
                                            <p className={`text-xl font-black tracking-tight ${bill.status === 'cancelled' ? 'text-gray-300 flex items-center gap-1' : 'text-purple-600'}`}>
                                                {bill.status === 'cancelled' && <span className="text-xs font-bold line-through">฿</span>}
                                                ฿{bill.total_amount.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">ค่าเช่า</p>
                                            <p className="text-[11px] font-black text-gray-600">฿{bill.room_amount.toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-1 border-x border-gray-50 px-2 text-center">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">ค่าน้ำ+ไฟ</p>
                                            <p className="text-[11px] font-black text-gray-600">฿{bill.utility_amount.toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">อื่นๆ</p>
                                            <p className="text-[11px] font-black text-gray-600">฿{bill.other_amount.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <p className="text-[9px] font-bold text-gray-400">
                                            บันทึกเมื่อ: {format(new Date(bill.created_at), 'dd/MM/yyyy HH:mm')}
                                        </p>
                                        <div className="flex items-center gap-4">
                                            {bill.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => {
                                                        setBillToCancel(bill)
                                                        setShowCancelModal(true)
                                                    }}
                                                    className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    {bill.status === 'paid' ? 'ยกเลิกยืนยันจ่าย' : 'ยกเลิกบิล'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => router.push(`/dashboard/billing/receipt/${bill.id}`)}
                                                className={`text-[10px] font-black underline underline-offset-4 decoration-2 ${bill.status === 'cancelled' ? 'text-gray-400 hover:text-gray-600' : 'text-purple-500 hover:text-purple-700'}`}
                                            >
                                                ดูรายละเอียด
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </main>

                {/* ── CANCEL/REVERT MODAL ── */}
                {showCancelModal && billToCancel && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => {
                                setShowCancelModal(false)
                                setBillToCancel(null)
                            }}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white px-8 pt-10 pb-6 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                                    <ExclamationCircleIcon className="w-10 h-10 text-red-500" />
                                </div>
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                                    {billToCancel.status === 'paid' ? 'ยกเลิกยืนยันจ่าย?' : `ยกเลิกบิลห้อง ${billToCancel.room_number}?`}
                                </h2>
                                <p className="text-gray-400 text-xs font-bold mt-2 px-6">
                                    {billToCancel.status === 'paid'
                                        ? `คุณต้องการยกเลิกการยืนยันรับเงินของห้อง ${billToCancel.room_number} ใช่หรือไม่? สถานะจะกลับเป็น 'รอชำระ'`
                                        : `บิลใบนี้จะถูกยกเลิก และเปลี่ยนสถานะเป็น "ยกเลิกแล้ว" คุณยังสามารถออกบิลใหม่ของรอบเดือนนี้ได้ทันทีครับ`
                                    }
                                </p>
                            </div>

                            <div className="p-8 space-y-4">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowCancelModal(false)
                                            setBillToCancel(null)
                                        }}
                                        className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 font-black rounded-2xl transition-all active:scale-95"
                                    >
                                        ย้อนกลับ
                                    </button>
                                    <button
                                        onClick={handleCancelBill}
                                        disabled={cancellingId === billToCancel.id}
                                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50 text-xs whitespace-nowrap"
                                    >
                                        {cancellingId === billToCancel.id ? 'กำลังดำเนินการ...' : (billToCancel.status === 'paid' ? 'ยืนยันยกเลิกรับเงิน' : 'ยืนยันยกเลิกบิล')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
