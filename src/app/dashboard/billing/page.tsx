'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { format, parse } from 'date-fns'
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    BanknotesIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    CheckBadgeIcon,
    ExclamationCircleIcon,
    PrinterIcon,
    ShareIcon,
    Squares2X2Icon,
    ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'

interface Room {
    id: string;
    room_number: string;
    status: 'available' | 'occupied';
    floor: number;
    base_price: number;
}

export default function BillingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [dormName, setDormName] = useState('หอพักของคุณ')
    const [billingData, setBillingData] = useState<any[]>([])
    const [selectedDate, setSelectedDate] = useState(() => {
        const queryMonth = searchParams.get('month')
        if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) {
            try {
                return parse(`${queryMonth}-01`, 'yyyy-MM-dd', new Date())
            } catch (e) {
                const d = new Date()
                return new Date(d.getFullYear(), d.getMonth(), 1)
            }
        }
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [sendToLineMap, setSendToLineMap] = useState<Record<string, boolean>>({})
    const [dueDay, setDueDay] = useState(5)
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
    const [filterFloor, setFilterFloor] = useState<number | 'all'>('all')
    const [filterLineStatus, setFilterLineStatus] = useState<'all' | 'linked' | 'unlinked'>('all')

    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ]

    const nextMonth = () => {
        const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)

        // Prevent going past current month
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        if (next > currentMonthStart) return

        setSelectedDate(next)
    }

    const prevMonth = () => {
        const prev = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
        setSelectedDate(prev)
    }

    useEffect(() => {
        fetchData()
    }, [selectedDate])

    async function fetchData() {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get Dorm
            const { data: dorms } = await supabase
                .from('dorms')
                .select('*')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .limit(1)

            if (!dorms || dorms.length === 0) {
                setLoading(false)
                return
            }
            const dorm = dorms[0]
            setDormName(dorm.name)

            // 1.1 Get Dorm Settings for Due Day
            const { data: settingsData } = await supabase
                .from('dorm_settings')
                .select('billing_due_day')
                .eq('dorm_id', dorm.id)
                .single()

            if (settingsData) {
                setDueDay(settingsData.billing_due_day || 5)
            }

            // 2. Get Rooms & Active Tenants
            const { data: roomsData } = await supabase
                .from('rooms')
                .select(`
                    id, 
                    room_number, 
                    status, 
                    floor, 
                    base_price,
                    tenants(id, name, line_user_id)
                `)
                .eq('dorm_id', dorm.id)
                .is('deleted_at', null)
                .order('room_number', { ascending: true })

            if (roomsData) {
                const roomIds = roomsData.map(r => r.id)
                const monthStart = format(selectedDate, 'yyyy-MM-01')

                // 3. Get Utilities for this month
                const { data: utilsData } = await supabase
                    .from('utilities')
                    .select('*')
                    .in('room_id', roomIds)
                    .eq('meter_date', monthStart)

                // 4. Get Existing Bills for this month
                const { data: billsData } = await supabase
                    .from('bills')
                    .select('*')
                    .in('room_id', roomIds)
                    .eq('billing_month', monthStart)

                // 5. Get Lease Contracts for Rent Price
                const { data: contractsData } = await supabase
                    .from('lease_contracts')
                    .select('*')
                    .eq('status', 'active')

                // 6. Map to UI format
                const mappedBilling = roomsData.map(room => {
                    const activeTenant = (room.tenants as any[])?.find((t: any) => t)
                    const utils = utilsData?.find(u => u.room_id === room.id)
                    const bill = billsData?.find(b => b.room_id === room.id)
                    const contract = contractsData?.find(c => c.tenant_id === activeTenant?.id)

                    const isVacant = room.status === 'available' || !activeTenant
                    const hasMeters = !!utils
                    const isIssued = !!bill

                    let status: 'vacant' | 'pending_meter' | 'ready' | 'issued' | 'waiting_verify' | 'paid' = 'vacant'
                    if (isVacant) status = 'vacant'
                    else if (bill?.status === 'paid') status = 'paid'
                    else if (bill?.status === 'waiting_verify') status = 'waiting_verify'
                    else if (isIssued) status = 'issued'
                    else if (!hasMeters) status = 'pending_meter'
                    else status = 'ready'

                    return {
                        roomId: room.id,
                        roomNumber: room.room_number,
                        tenantId: activeTenant?.id,
                        tenantName: activeTenant?.name,
                        lineUserId: activeTenant?.line_user_id,
                        rent: contract?.rent_price || room.base_price,
                        water: utils?.water_price || 0,
                        electricity: utils?.electric_price || 0,
                        electricityUnit: utils?.electric_unit || 0,
                        waterUnit: utils?.water_unit || 0,
                        others: 0,
                        utilityId: utils?.id,
                        billId: bill?.id,
                        billStatus: bill?.status || 'unpaid',
                        hasMeters,
                        floor: room.floor || Math.floor(parseInt(room.room_number) / 100) || 1,
                        status
                    }
                })
                // Filter only rooms that are NOT vacant
                const occupiedRooms = mappedBilling.filter(r => r.status !== 'vacant')
                setBillingData(occupiedRooms)

                // Initialize sendToLineMap for rooms that have lineUserId
                const newMap = { ...sendToLineMap }
                occupiedRooms.forEach(m => {
                    if (m.lineUserId && newMap[m.roomId] === undefined) {
                        newMap[m.roomId] = true
                    }
                })
                setSendToLineMap(newMap)
            }
        } catch (err) {
            console.error('FetchData error:', err)
        } finally {
            setLoading(false)
        }
    }

    const [issuing, setIssuing] = useState<string | null>(null) // roomId or 'all'
    const [verifying, setVerifying] = useState<string | null>(null)
    const [confirmVerify, setConfirmVerify] = useState<any | null>(null)
    const [confirmRevert, setConfirmRevert] = useState<any | null>(null)

    const handleVerifyPayment = async (item: any) => {
        if (verifying || !item.billId) return
        
        if (!confirmVerify) {
            setConfirmVerify(item)
            return
        }
        setConfirmVerify(null)

        setVerifying(item.roomId)
        const supabase = createClient()
        try {
            // 1. Update bill status to paid
            const { error: billError } = await supabase
                .from('bills')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('id', item.billId)

            if (billError) throw billError

            // 2. Refresh UI
            await fetchData()

            // 3. Send LINE Confirmation via API
            try {
                await fetch('/api/line/confirm-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ billId: item.billId })
                })
            } catch (lineErr) {
                console.error('Failed to send LINE confirmation:', lineErr)
            }

            // alert('ยืนยันการรับชำระเงินเรียบร้อยแล้ว')
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาดในการยืนยันการชำระเงิน')
        } finally {
            setVerifying(null)
        }
    }

    const handleRevertPayment = async (item: any) => {
        if (verifying || !item.billId) return

        if (!confirmRevert) {
            setConfirmRevert(item)
            return
        }
        setConfirmRevert(null)

        setVerifying(item.roomId)
        const supabase = createClient()
        try {
            const { error } = await supabase
                .from('bills')
                .update({
                    status: 'waiting_verify',
                    paid_at: null
                })
                .eq('id', item.billId)

            if (error) throw error
            await fetchData()
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาดในการยกเลิกสถานะ')
        } finally {
            setVerifying(null)
        }
    }

    const handleIssueBill = async (item: any) => {
        if (issuing) return
        setIssuing(item.roomId)
        const supabase = createClient()

        try {
            const monthStart = format(selectedDate, 'yyyy-MM-01')
            const total = item.rent + item.water + item.electricity + item.others

            // 1. Create Bill Record
            const { data: newBill, error: billError } = await supabase
                .from('bills')
                .insert({
                    tenant_id: item.tenantId,
                    room_id: item.roomId,
                    utility_id: item.utilityId,
                    billing_month: monthStart,
                    room_amount: item.rent,
                    utility_amount: item.water + item.electricity,
                    other_amount: item.others,
                    total_amount: total,
                    due_date: format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dueDay), `yyyy-MM-${String(dueDay).padStart(2, '0')}`),
                    status: 'waiting_verify'
                })
                .select()
                .single()

            if (billError) throw billError

            // 2. Call LINE Notification API if tenant has LINE linked
            // 2. Call LINE Notification API if tenant has LINE linked AND toggle is ON
            const shouldSendLine = item.lineUserId && sendToLineMap[item.roomId]
            if (shouldSendLine) {
                await fetch('/api/line/send-bill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ billId: newBill.id })
                })
            }

            // 3. Refresh
            await fetchData()
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาดในการออกบิล')
        } finally {
            setIssuing(null)
        }
    }

    const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const handleDeleteBill = async (item: any) => {
        if (deleting || !item.billId) return

        // If confirmDelete is null, it means we entered from the button, so show the modal
        if (!confirmDelete) {
            setConfirmDelete(item)
            return
        }

        setConfirmDelete(null)

        setDeleting(item.roomId)
        const supabase = createClient()
        try {
            const { error } = await supabase
                .from('bills')
                .delete()
                .eq('id', item.billId)

            if (error) throw error
            await fetchData()
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาดในการลบบิล')
        } finally {
            setDeleting(null)
        }
    }

    const [resending, setResending] = useState<string | null>(null)
    const handleResendLine = async (item: any) => {
        if (resending || !item.billId) return
        setResending(item.roomId)
        try {
            const res = await fetch('/api/line/send-bill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ billId: item.billId })
            })
            if (res.ok) {
                alert('ส่งแจ้งเตือน LINE อีกครั้งเรียบร้อยแล้ว')
            } else {
                alert('ไม่สามารถส่ง LINE ได้ในขณะนี้')
            }
        } catch (err) {
            console.error('Resend error:', err)
        } finally {
            setResending(null)
        }
    }

    const handleIssueAll = async () => {
        const readyRooms = filteredData.filter(d => d.status === 'ready')
        if (readyRooms.length === 0 || issuing) return

        if (!confirm(`ยืนยันออกบิลทั้งหมด ${readyRooms.length} ห้อง?`)) return

        setIssuing('all')
        for (const item of readyRooms) {
            await handleIssueBill(item)
        }
        setIssuing(null)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        )
    }

    const filteredData = (() => {
        let data = [...billingData]
        if (filterFloor !== 'all') {
            data = data.filter(item => item.floor === filterFloor)
        }
        if (filterLineStatus === 'linked') {
            data = data.filter(item => item.lineUserId)
        } else if (filterLineStatus === 'unlinked') {
            data = data.filter(item => !item.lineUserId)
        }
        return data
    })()

    const readyToIssueCount = filteredData.filter(d => d.status === 'ready').length

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center font-sans">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] overflow-hidden flex flex-col relative pb-32 border-gray-100 sm:border sm:rounded-[2.5rem] sm:shadow-2xl">

                {/* ── HEADER ── */}
                <header className="px-6 pt-10 pb-6 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-50">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
                        >
                            <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
                        </button>
                        <h1 className="text-xl font-black text-gray-800 tracking-tight">สรุปยอดบิลค่าเช่า</h1>
                        <button
                            onClick={() => fetchData()}
                            className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all"
                        >
                            <ArrowPathIcon className={`w-5 h-5 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between bg-emerald-50 rounded-2xl p-4">
                        <button
                            onClick={prevMonth}
                            className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                            <ChevronLeftIcon className="w-5 h-5 stroke-[3]" />
                        </button>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">รอบบิลประจำเดือน</p>
                            <p className="text-lg font-black text-emerald-900 leading-none">
                                {thaiMonths[selectedDate.getMonth()]} {selectedDate.getFullYear() + 543}
                            </p>
                        </div>
                        <button
                            onClick={nextMonth}
                            disabled={selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear()}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${(selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear())
                                ? 'text-gray-300 bg-gray-50'
                                : 'text-emerald-600 hover:bg-emerald-100'
                                }`}
                        >
                            <ChevronRightIcon className="w-5 h-5 stroke-[3]" />
                        </button>
                    </div>
                </header>

                {/* ── FILTERS ── */}
                <div className="px-6 py-4 bg-white border-b border-gray-50 flex flex-col gap-4 sticky top-[152px] z-20">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">กรองตามชั้น</span>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => setFilterFloor('all')}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${filterFloor === 'all' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ทั้งหมด
                            </button>
                            {Array.from(new Set(billingData.map(item => item.floor))).sort((a, b) => a - b).map(floor => (
                                <button
                                    key={floor}
                                    onClick={() => setFilterFloor(floor)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${filterFloor === floor ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                                >
                                    ชั้น {floor}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">สถานะ LINE OA</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterLineStatus('all')}
                                className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${filterLineStatus === 'all' ? 'bg-[#06C755] text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                onClick={() => setFilterLineStatus('linked')}
                                className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${filterLineStatus === 'linked' ? 'bg-[#06C755] text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ผูกไลน์แล้ว
                            </button>
                            <button
                                onClick={() => setFilterLineStatus('unlinked')}
                                className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${filterLineStatus === 'unlinked' ? 'bg-[#06C755] text-white shadow-lg shadow-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ยังไม่ผูก
                            </button>
                        </div>
                    </div>
                </div>

                <main className="flex-1 px-4 py-6 pb-20 space-y-8">
                    {/* ── ROOM LIST BY FLOOR ── */}
                    {(() => {
                        const floors = Array.from(new Set(filteredData.map(item => item.floor))).sort((a, b) => a - b)

                        if (filteredData.length === 0) {
                            return (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200 mx-2">
                                    <h3 className="text-lg font-black text-gray-400">ไม่พบข้อมูลห้องที่ตรงตามเงื่อนไข</h3>
                                    <p className="text-sm text-gray-300 font-bold mt-2">โปรดเปลี่ยนตัวกรองหรือลองใหม่อีกครั้ง</p>
                                </div>
                            )
                        }

                        return floors.map(floor => (
                            <section key={floor} className="space-y-4">
                                <h2 className="flex items-center gap-2 px-2">
                                    <span className="w-1 h-5 bg-emerald-500 rounded-full" />
                                    <span className="text-sm font-black text-gray-400 uppercase tracking-widest">ชั้น {floor}</span>
                                </h2>
                                <div className="space-y-3">
                                    {filteredData.filter(item => item.floor === floor).map(item => {
                                        const total = item.rent + item.water + item.electricity + item.others
                                        const isVacant = item.status === 'vacant'
                                        const isIssued = ['issued', 'waiting_verify', 'paid'].includes(item.status)
                                        const noMeters = !item.hasMeters && !isVacant
                                        const isExpanded = expandedRoom === item.roomId

                                        // Status Style Logic
                                        let statusColor = 'bg-gray-400'
                                        let statusBg = 'bg-gray-50'
                                        let statusText = 'text-gray-500'
                                        let statusLabel = 'ไม่ทราบสถานะ'
                                        let StatusIcon = ExclamationCircleIcon

                                        if (item.status === 'paid') {
                                            statusColor = 'bg-emerald-500'
                                            statusBg = 'bg-emerald-50'
                                            statusText = 'text-emerald-600'
                                            statusLabel = 'ชำระเงินแล้ว'
                                            StatusIcon = CheckCircleIcon
                                        }
                                        else if (item.status === 'waiting_verify') {
                                            statusColor = 'bg-blue-500'
                                            statusBg = 'bg-blue-50'
                                            statusText = 'text-blue-600'
                                            statusLabel = 'รอรับเงิน / ยืนยัน'
                                            StatusIcon = ChatBubbleLeftRightIcon
                                        }
                                        else if (isIssued) {
                                            statusColor = 'bg-blue-500'
                                            statusBg = 'bg-blue-50'
                                            statusText = 'text-blue-600'
                                            statusLabel = 'ออกบิลแล้ว'
                                            StatusIcon = CheckCircleIcon
                                        }
                                        else if (noMeters) {
                                            statusColor = 'bg-orange-500'
                                            statusBg = 'bg-orange-50'
                                            statusText = 'text-orange-600'
                                            statusLabel = 'รอมิเตอร์'
                                            StatusIcon = ArrowPathIcon
                                        }
                                        else if (!isVacant) {
                                            statusColor = 'bg-yellow-400'
                                            statusBg = 'bg-yellow-50'
                                            statusText = 'text-yellow-700'
                                            statusLabel = 'พร้อมออกบิล'
                                            StatusIcon = BanknotesIcon
                                        }

                                        return (
                                            <div
                                                key={item.roomId}
                                                className={`overflow-hidden transition-all border-b border-gray-100 last:border-0 ${isExpanded ? 'bg-gray-50/50 rounded-2xl border border-gray-100 p-1' : 'bg-white'}`}
                                            >
                                                {/* Row Item */}
                                                <div
                                                    onClick={() => setExpandedRoom(isExpanded ? null : item.roomId)}
                                                    className="flex items-center justify-between p-3 cursor-pointer active:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3 w-20">
                                                        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-sm ${statusColor}`}>
                                                            {item.roomNumber}
                                                            {item.lineUserId && (
                                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#06C755] rounded-full border-2 border-white flex items-center justify-center shadow-lg transform rotate-6">
                                                                    <ChatBubbleLeftRightIcon className="w-2.5 h-2.5 text-white stroke-[3]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 flex flex-col justify-center">
                                                        {isVacant ? (
                                                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">ห้องว่าง</span>
                                                        ) : (
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                {isIssued && (
                                                                    <span className="text-[8px] font-black bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md uppercase tracking-tighter border border-gray-200 shadow-sm leading-none h-[18px] flex items-center">
                                                                        ส่งบิลแล้ว
                                                                    </span>
                                                                )}
                                                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full w-fit ${statusBg} ${statusText} border border-current/10 shadow-sm h-[18px]`}>
                                                                    <StatusIcon className={`w-2.5 h-2.5 ${!isIssued && !noMeters ? 'animate-bounce' : ''}`} />
                                                                    <span className="text-[9px] font-black uppercase tracking-tight leading-none">
                                                                        {statusLabel}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {!isVacant && (
                                                            <p className="text-[11px] font-bold text-gray-400 truncate max-w-[100px]">{item.tenantName}</p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        {!isVacant && !noMeters && (
                                                            <div className="text-right">
                                                                <p className="text-sm font-black text-gray-800 tracking-tight">฿{total.toLocaleString()}</p>
                                                            </div>
                                                        )}
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-gray-200 rotate-90 text-gray-600' : 'bg-gray-50 text-gray-300'}`}>
                                                            <ChevronRightIcon className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {isExpanded && !isVacant && (
                                                    <div className="px-3 pb-4 pt-2 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                        {/* Details Grid */}
                                                        <div className="grid grid-cols-3 gap-2 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                                            <div className="text-center border-r border-gray-50">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">ค่าเช่า</p>
                                                                <p className="text-xs font-black text-gray-700">฿{item.rent.toLocaleString()}</p>
                                                            </div>
                                                            <div className="text-center border-r border-gray-50">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">ค่าน้ำ</p>
                                                                <p className={`text-xs font-black ${noMeters ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                    {noMeters ? '-' : `฿${item.water.toLocaleString()}`}
                                                                </p>
                                                                {!noMeters && (
                                                                    <p className="text-[8px] text-blue-500 font-bold">({item.waterUnit} หน่วย)</p>
                                                                )}
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">ค่าไฟ</p>
                                                                <p className={`text-xs font-black ${noMeters ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                    {noMeters ? '-' : `฿${item.electricity.toLocaleString()}`}
                                                                </p>
                                                                {!noMeters && (
                                                                    <p className="text-[8px] text-orange-500 font-bold">({item.electricityUnit} หน่วย)</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* LINE Toggle (Only if Linked & Not Issued) */}
                                                        {!isIssued && !noMeters && (
                                                            <div className="flex items-center justify-between px-2">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">
                                                                    LINE NOTIFY
                                                                </p>
                                                                {item.lineUserId ? (
                                                                    <div
                                                                        onClick={() => setSendToLineMap({ ...sendToLineMap, [item.roomId]: !sendToLineMap[item.roomId] })}
                                                                        className="flex items-center gap-2 cursor-pointer"
                                                                    >
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${sendToLineMap[item.roomId] ? 'text-green-600' : 'text-gray-400'}`}>
                                                                            {sendToLineMap[item.roomId] ? 'ON' : 'OFF'}
                                                                        </span>
                                                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${sendToLineMap[item.roomId] ? 'bg-green-500' : 'bg-gray-200'}`}>
                                                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${sendToLineMap[item.roomId] ? 'translate-x-4' : 'translate-x-0'}`} />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-tighter bg-gray-50 px-2 py-0.5 rounded-md">
                                                                        ไม่ได้ผูก LINE
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Actions */}
                                                        <div className="flex gap-2">
                                                            {noMeters ? (
                                                                <button
                                                                    onClick={() => router.push(`/dashboard/meter?month=${format(selectedDate, 'yyyy-MM')}`)}
                                                                    className="flex-1 h-10 bg-orange-500 text-white rounded-xl font-black text-[12px] flex items-center justify-center gap-2"
                                                                >
                                                                    <Squares2X2Icon className="w-4 h-4" /> ไปจดมิเตอร์
                                                                </button>
                                                            ) : isIssued ? (
                                                                <>
                                                                    {item.status === 'waiting_verify' && (
                                                                        <button
                                                                            onClick={() => handleVerifyPayment(item)}
                                                                            disabled={!!verifying}
                                                                            className="flex-1 h-10 bg-blue-600 text-white rounded-xl font-black text-[12px] flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                                                                        >
                                                                            {verifying === item.roomId ? (
                                                                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                                            ) : (
                                                                                <CheckBadgeIcon className="w-4 h-4" />
                                                                            )}
                                                                            ยืนยันรับเงิน
                                                                        </button>
                                                                    )}
                                                                    {item.status === 'paid' ? (
                                                                        <div className="flex-1 flex gap-2">
                                                                            <div className="flex-1 h-10 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 border border-emerald-100">
                                                                                <CheckCircleIcon className="w-4 h-4" /> ชำระเงินแล้ว
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleRevertPayment(item)}
                                                                                disabled={!!verifying}
                                                                                className="h-10 px-3 bg-white border border-gray-200 text-gray-400 rounded-xl font-black text-[10px] flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
                                                                            >
                                                                                <ArrowPathIcon className={`w-3 h-3 ${verifying === item.roomId ? 'animate-spin' : ''}`} />
                                                                                ยกเลิกยืนยัน
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => router.push(`/dashboard/billing/receipt/${item.billId}`)}
                                                                            className="flex-1 h-10 bg-white border border-gray-200 text-gray-600 rounded-xl font-black text-[12px] flex items-center justify-center gap-2"
                                                                        >
                                                                            <PrinterIcon className="w-4 h-4" /> {item.status === 'waiting_verify' ? 'ดูสลิป/บิล' : 'พิมพ์บิล'}
                                                                        </button>
                                                                    )}
                                                                    {item.lineUserId && item.status !== 'paid' && (
                                                                        <button
                                                                            onClick={() => handleResendLine(item)}
                                                                            className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center border border-green-100"
                                                                        >
                                                                            {resending === item.roomId ? (
                                                                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                                            ) : (
                                                                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDeleteBill(item)}
                                                                        className="h-10 px-4 bg-red-50 text-red-600 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 border border-red-100"
                                                                    >
                                                                        {deleting === item.roomId ? (
                                                                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <ExclamationCircleIcon className="w-4 h-4" />
                                                                        )}
                                                                        {item.status === 'waiting_verify' ? 'ยกเลิกออกบิล' : 'ยกเลิก'}
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleIssueBill(item)}
                                                                    disabled={!!issuing}
                                                                    className="flex-1 h-12 bg-emerald-500 text-white rounded-[1.2rem] font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {issuing === item.roomId ? (
                                                                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <BanknotesIcon className="w-4 h-4" />
                                                                    )}
                                                                    กดออกบิลห้องนี้
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        ))
                    })()}
                </main>

                {/* ── STICKY FOOTER ACTION ── */}
                <div className="px-6 py-6 bg-white border-t border-gray-50 sticky bottom-0 z-30 shadow-[0_-20px_40px_rgba(0,0,0,0.03)] sm:rounded-b-[2.5rem]">
                    <button
                        onClick={handleIssueAll}
                        disabled={readyToIssueCount === 0 || !!issuing}
                        className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-[1.8rem] font-black text-lg flex items-center justify-center gap-3 shadow-2xl shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {issuing === 'all' ? (
                            <ArrowPathIcon className="w-6 h-6 animate-spin" />
                        ) : (
                            <CheckCircleIcon className="w-6 h-6" />
                        )}
                        ออกบิลทั้งหมด ({readyToIssueCount} ห้อง)
                    </button>
                </div>
                {/* ── CUSTOM CONFIRM DELETE MODAL ── */}
                {confirmDelete && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <div 
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
                            onClick={() => setConfirmDelete(null)}
                        />
                        <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center border-b border-gray-50">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <ExclamationCircleIcon className="w-10 h-10 text-red-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2 font-noto">ยกเลิกบิลห้อง {confirmDelete.roomNumber}?</h3>
                                <p className="text-sm font-bold text-gray-400 px-4 font-noto">
                                    รายการนี้จะถูกลบออก แต่คุณสามารถกดออกบิลใหม่ได้
                                </p>
                            </div>
                            <div className="p-6 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 font-black rounded-2xl hover:bg-gray-100 transition-colors font-noto"
                                >
                                    ย้อนกลับ
                                </button>
                                <button
                                    onClick={() => handleDeleteBill(confirmDelete)}
                                    className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all font-noto"
                                >
                                    ยืนยันยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CUSTOM CONFIRM VERIFY MODAL ── */}
                {confirmVerify && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <div 
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
                            onClick={() => setConfirmVerify(null)}
                        />
                        <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center border-b border-gray-50">
                                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckBadgeIcon className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2 font-noto">ยืนยันรับชำระเงิน</h3>
                                <p className="text-sm font-bold text-gray-400 px-4 font-noto">
                                    คุณได้รับเงินจากห้อง <span className="text-gray-900">{confirmVerify.roomNumber}</span> เรียบร้อยแล้วใช่หรือไม่?
                                </p>
                            </div>
                            <div className="p-6 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setConfirmVerify(null)}
                                    className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 font-black rounded-2xl hover:bg-gray-100 transition-colors font-noto"
                                >
                                    ยังก่อน
                                </button>
                                <button
                                    onClick={() => handleVerifyPayment(confirmVerify)}
                                    className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all font-noto"
                                >
                                    ยืนยันรับเงิน
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CUSTOM CONFIRM REVERT MODAL ── */}
                {confirmRevert && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <div 
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
                            onClick={() => setConfirmRevert(null)}
                        />
                        <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center border-b border-gray-50">
                                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <ArrowPathIcon className="w-10 h-10 text-blue-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2 font-noto">ยกเลิกการยืนยันเงิน?</h3>
                                <p className="text-sm font-bold text-gray-400 px-4 font-noto">
                                    สถานะของห้อง <span className="text-gray-900">{confirmRevert.roomNumber}</span> จะกลับไปเป็น "รอยืนยัน" อีกครั้ง
                                </p>
                            </div>
                            <div className="p-6 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setConfirmRevert(null)}
                                    className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 font-black rounded-2xl hover:bg-gray-100 transition-colors font-noto"
                                >
                                    ย้อนกลับ
                                </button>
                                <button
                                    onClick={() => handleRevertPayment(confirmRevert)}
                                    className="flex-1 py-4 bg-blue-500 text-white font-black rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all font-noto"
                                >
                                    ยืนยันเปลี่ยน
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
