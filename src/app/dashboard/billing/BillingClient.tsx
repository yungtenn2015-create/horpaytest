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
    ChatBubbleLeftRightIcon,
    XMarkIcon,
    EyeIcon,
    ClockIcon
} from '@heroicons/react/24/outline'
import ReceiptView from '@/src/components/ReceiptView'

interface Room {
    id: string;
    room_number: string;
    status: 'available' | 'occupied';
    floor: number;
    base_price: number;
}

interface DormServiceItem {
    id: string
    name: string
    price: number
}

interface BillItemRow {
    name: string
    amount: number
}

export default function BillingClient() {
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
    const [billingDay, setBillingDay] = useState(25)
    const [dueDay, setDueDay] = useState(5)
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
    const [filterFloor, setFilterFloor] = useState<number | 'all'>('all')
    const [filterLineStatus, setFilterLineStatus] = useState<'all' | 'linked' | 'unlinked'>('all')
    const [filterWorkingStatus, setFilterWorkingStatus] = useState<'all' | 'pending_meter' | 'ready' | 'issued'>('all')
    const [dormSettings, setDormSettings] = useState<any>(null)
    const [dormServices, setDormServices] = useState<DormServiceItem[]>([])
    const [showPreview, setShowPreview] = useState(false)
    const [previewData, setPreviewData] = useState<any>(null)

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

            // 1.1 Get Dorm Settings
            const { data: settingsData } = await supabase
                .from('dorm_settings')
                .select('*')
                .eq('dorm_id', dorm.id)
                .single()

            if (settingsData) {
                setDormSettings(settingsData)
                setDueDay(settingsData.payment_due_day || 5)
                setBillingDay(settingsData.billing_day || 25)
            }

            // 1.2 Get Dorm Services (Extra monthly services)
            const { data: servicesData } = await supabase
                .from('dorm_services')
                .select('id, name, price')
                .eq('dorm_id', dorm.id)
                .order('created_at', { ascending: true })

            setDormServices((servicesData || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                price: Number(s.price) || 0
            })))

            // 2. Get Rooms & Active Tenants
            const { data: roomsData } = await supabase
                .from('rooms')
                .select(`
                    id, 
                    room_number, 
                    status, 
                    floor, 
                    base_price,
                    tenants(id, name, line_user_id, status)
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
                    .neq('status', 'cancelled')

                // 5. Get Lease Contracts for Rent Price
                // Better to fetch only active contracts for these rooms
                const { data: contractsData } = await supabase
                    .from('lease_contracts')
                    .select('*')
                    .in('room_id', roomIds)
                    .eq('status', 'active')

                // 6. Map to UI format
                const servicesTotal = (servicesData || []).reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0)
                const mappedBilling = roomsData.map(room => {
                    // CRITICAL FIX: Only find the ACTIVE tenant for this room
                    const activeTenant = (room.tenants as any[])?.find((t: any) => t.status === 'active')

                    // Match utils and bill strictly to the active tenant to avoid inheriting old data
                    const utils = utilsData?.find(u => u.room_id === room.id && u.tenant_id === activeTenant?.id)
                    // Match bill to the active tenant (avoid showing old tenant's bill after room turnover)
                    const bill = billsData?.find(
                        (b: any) => b.room_id === room.id && b.tenant_id === activeTenant?.id
                    )
                    const contract = contractsData?.find(c => c.tenant_id === activeTenant?.id)

                    const isVacant = room.status === 'available' || !activeTenant
                    const hasMeters = !!utils
                    const isIssued = !!bill

                    const waterBillingType = settingsData?.water_billing_type || 'per_unit'
                    const isWaterOk = waterBillingType === 'flat_rate' || (utils?.water_unit > 0)
                    const isElectricOk = (utils?.electric_unit > 0)
                    const isReady = !!utils && isWaterOk && isElectricOk

                    if (isVacant) status = 'vacant'
                    else if (bill?.status === 'paid') status = 'paid'
                    else if (bill?.status === 'waiting_verify') status = 'waiting_verify'
                    else if (isIssued) status = 'issued'
                    else if (!isReady) status = 'pending_meter'
                    else status = 'ready'

                    // CRITICAL FIX: If bill exists, use it as the source of truth for amounts
                    // Otherwise, use contract predictions
                    return {
                        roomId: room.id,
                        roomNumber: room.room_number,
                        tenantId: activeTenant?.id,
                        tenantName: activeTenant?.name,
                        lineUserId: activeTenant?.line_user_id,
                        rent: isIssued ? (bill.room_amount || 0) : (contract?.rent_price || room.base_price),
                        electricity: utils?.electric_price || 0,
                        water: utils?.water_price || 0,
                        electricityUnit: utils?.electric_unit || 0,
                        waterUnit: utils?.water_unit || 0,
                        electricityPrev: utils?.prev_electric_meter || 0,
                        electricityCurr: utils?.curr_electric_meter || 0,
                        waterPrev: utils?.prev_water_meter || 0,
                        waterCurr: utils?.curr_water_meter || 0,
                        // Snapshot rule:
                        // - If bill already exists, trust its other_amount (so old bills won't change when settings change)
                        // - If not issued yet, use current dorm_services total
                        others: isIssued ? (bill.other_amount || 0) : servicesTotal,
                        utilityId: utils?.id,
                        billId: bill?.id,
                        billStatus: bill?.status || 'unpaid',
                        hasMeters: isReady, // Use isReady here
                        waterBillingType,
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
    const [confirmIssueAll, setConfirmIssueAll] = useState<any[] | null>(null)

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
                    status: 'unpaid',
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

        // Add Safety Check for 0 Units (Thai warning)
        const isWaterZero = item.waterBillingType !== 'flat_rate' && item.waterUnit === 0
        const isElecZero = item.electricityUnit === 0

        if (isWaterZero || isElecZero) {
            const msg = `ห้อง ${item.roomNumber} มีการใช้${isWaterZero && isElecZero ? 'น้ำและไฟ' : isWaterZero ? 'น้ำ' : 'ไฟ'}เป็น 0 หน่วย\n\nยืนยันจะออกบิลใช่หรือไม่?`;
            if (!window.confirm(msg)) return;
        }

        setIssuing(item.roomId)
        const supabase = createClient()

        try {
            const monthStart = format(selectedDate, 'yyyy-MM-01')
            const total = item.rent + item.water + item.electricity + item.others
            const dueDateStr = (() => {
                const year = selectedDate.getFullYear()
                const month = selectedDate.getMonth()
                const targetMonth = dueDay < billingDay ? month + 1 : month
                const lastDay = new Date(year, targetMonth + 1, 0).getDate()
                const finalDay = Math.min(dueDay, lastDay)
                return format(new Date(year, targetMonth, finalDay), 'yyyy-MM-dd')
            })()

            const { data: existingRows, error: existingErr } = await supabase
                .from('bills')
                .select('id, status, created_at, room_amount, utility_amount, other_amount, total_amount')
                .eq('tenant_id', item.tenantId)
                .eq('room_id', item.roomId)
                .eq('billing_month', monthStart)
                .order('created_at', { ascending: false })

            if (existingErr) throw existingErr

            let newBill: { id: string }
            const rows = (existingRows || []) as Array<{
                id: string
                status: string
                created_at: string
                room_amount: number
                utility_amount: number
                other_amount: number
                total_amount: number
            }>
            const existingActive = rows.find((r) => r.status !== 'cancelled')
            const existingCancelled = rows.find((r) => r.status === 'cancelled')

            if (existingActive) {
                throw new Error('ไม่สามารถออกบิลซ้ำได้: มีบิลในห้องนี้/เดือนนี้อยู่แล้ว (ยังไม่ถูกยกเลิก) หากต้องการออกใหม่ กรุณายกเลิกบิลเดิมก่อน')
            } else if (existingCancelled) {
                    // Accounting rule: issued bill amounts are immutable.
                    // If owner changed inputs, don't silently override old cancelled bill amounts.
                    const nextRoom = Number(item.rent || 0)
                    const nextUtility = Number(item.water || 0) + Number(item.electricity || 0)
                    const nextOther = Number(item.others || 0)
                    const nextTotal = Number(total || 0)

                    const isSameAmount =
                        Number(existingCancelled.room_amount || 0) === nextRoom &&
                        Number(existingCancelled.utility_amount || 0) === nextUtility &&
                        Number(existingCancelled.other_amount || 0) === nextOther &&
                        Number(existingCancelled.total_amount || 0) === nextTotal

                    if (!isSameAmount) {
                        throw new Error(
                            [
                                'ห้องนี้เคยมีบิลเดือนนี้ในระบบแล้ว (แม้จะยกเลิกไปก็ยังมีประวัติอยู่)',
                                'ยอดในระบบจึงไม่ตรงกับที่คำนวณตอนนี้ — ระบบจะไม่ยอมเปลี่ยนตัวเลขในใบเก่าให้ทับเอง',
                                '',
                                'ทำได้อย่างใดอย่างหนึ่ง:',
                                '• ไปดูที่ประวัติบิล ว่ามีบิลเดือนนี้เหลืออยู่หรือไม่',
                                '• หรือลองเลือกเดือนอื่นที่ยังไม่เคยออกบิล',
                            ].join('\n')
                        )
                    }

                    const { data: updated, error: updErr } = await supabase
                        .from('bills')
                        .update({
                            utility_id: item.utilityId,
                            due_date: dueDateStr,
                            status: 'unpaid',
                            paid_at: null
                        })
                        .eq('id', existingCancelled.id)
                        .select('id')
                        .single()
                    if (updErr) throw updErr
                    if (!updated?.id) throw new Error('ไม่สามารถเปิดบิลที่ยกเลิกแล้วใหม่ได้')
                    newBill = { id: updated.id }
            } else {
                const { data: inserted, error: billError } = await supabase
                    .from('bills')
                    .insert({
                        tenant_id: item.tenantId,
                        room_id: item.roomId,
                        utility_id: item.utilityId,
                        bill_type: 'monthly',
                        billing_month: monthStart,
                        room_amount: item.rent,
                        utility_amount: item.water + item.electricity,
                        other_amount: item.others,
                        total_amount: total,
                        due_date: dueDateStr,
                        status: 'unpaid'
                    })
                    .select('id')
                    .single()

                if (billError) {
                    if (billError.code === '23505') {
                        throw new Error(
                            'ไม่สามารถออกบิลซ้ำได้: มีบิลเดือนนี้อยู่ในระบบแล้ว (อาจเป็นข้อจำกัด unique ของฐานข้อมูล หรือบิลที่ยกเลิก/ผู้เช่าคนก่อน) ลองรีเฟรชหน้า หรือตรวจบิลใน Supabase'
                        )
                    }
                    throw billError
                }
                if (!inserted?.id) throw new Error('สร้างบิลไม่สำเร็จ')
                newBill = { id: inserted.id }
            }

            // 1.1 Snapshot extra services into bill_items (replace old lines so re-opened bills stay correct)
            const extraItems: BillItemRow[] = (dormServices || [])
                .map((s) => ({ name: String(s.name || '').trim(), amount: Number(s.price) || 0 }))
                .filter((s) => !!s.name && s.amount > 0)

            {
                const { error: delItemsErr } = await supabase.from('bill_items').delete().eq('bill_id', newBill.id)
                if (delItemsErr) {
                    const msg = String(delItemsErr.message || '')
                    const code = (delItemsErr as any).code
                    const isMissingTable =
                        code === '42P01' ||
                        msg.toLowerCase().includes('could not find the table') ||
                        msg.toLowerCase().includes('relation') ||
                        msg.toLowerCase().includes('schema cache')
                    if (!isMissingTable) throw delItemsErr
                }
            }

            if (extraItems.length > 0) {
                const { error: itemsErr } = await supabase
                    .from('bill_items')
                    .insert(extraItems.map((it) => ({
                        bill_id: newBill.id,
                        name: it.name,
                        amount: it.amount
                    })))

                if (itemsErr) {
                    const msg = String(itemsErr.message || '')
                    const code = (itemsErr as any).code
                    const isMissingTable = code === '42P01' || msg.toLowerCase().includes('could not find the table') || msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('schema cache')
                    if (!isMissingTable) {
                        throw new Error(`บันทึกรายการค่าบริการเพิ่มเติมไม่สำเร็จ: ${itemsErr.message}`)
                    }
                }
            }

            // 2. Call LINE Notification API if tenant has LINE linked AND toggle is ON
            const shouldSendLine = item.lineUserId && sendToLineMap[item.roomId]
            if (shouldSendLine) {
                await fetch('/api/line/send-bill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ billId: newBill.id })
                })
            }

            await fetchData()
        } catch (err: any) {
            const raw = String(err?.message || '')
            const low = raw.toLowerCase()
            let friendly = raw || 'เกิดข้อผิดพลาดในการออกบิล'
            if (raw.includes('ห้ามแก้ยอดเงินในบิลหลังสร้างแล้ว')) {
                friendly = [
                    'ใบแจ้งหนี้ฉบับนี้ถูกออกไปแล้วในระบบ',
                    'ตัวเลขค่าเช่า / ยอดรวมเลยถูกล็อกไว้ — ไม่ให้แก้ภายหลังเหมือนแก้เอกสารที่ออกแล้ว',
                    '',
                    'ถ้าต้องการยอดใหม่:',
                    '• ยกเลิกบิลฉบับนี้ในระบบ (ถ้าระบบให้ยกเลิกได้)',
                    '• แล้วค่อยออกบิลใหม่ตามยอดที่ถูกต้อง',
                ].join('\n')
            } else if (low.includes('row-level security') || low.includes('violates row-level security')) {
                friendly = [
                    'สิทธิ์บันทึกรายการค่าบริการเพิ่มเติม (bill_items) ยังไม่เปิดในระบบ',
                    '',
                    'ให้ผู้ดูแลรันสคริปต์: db/migration_bill_items_rls.sql ใน Supabase SQL Editor',
                    'จากนั้นลองกดออกบิลอีกครั้ง',
                ].join('\n')
            }
            alert(friendly)
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
                .update({
                    status: 'cancelled'
                })
                .eq('id', item.billId)

            if (error) throw error
            await fetchData()
        } catch (err: any) {
            alert(err.message || 'เกิดข้อผิดพลาดในการยกเลิกบิล')
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

    const handlePreviewBill = (item: any) => {
        // Format data to match ReceiptView expectation
        const billingMonthDate = selectedDate
        const formattedMonth = thaiMonths[billingMonthDate.getMonth()] + ' ' + (billingMonthDate.getFullYear() + 543)
        const formattedDate = format(new Date(), 'd MMMM yyyy')

        // Due Date
        const due = (() => {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();
            const targetMonth = dueDay < billingDay ? month + 1 : month;
            const lastDay = new Date(year, targetMonth + 1, 0).getDate();
            const finalDay = Math.min(dueDay, lastDay);
            return new Date(year, targetMonth, finalDay);
        })();
        const formattedDueDate = `${due.getDate()} ${thaiMonths[due.getMonth()]} ${due.getFullYear() + 543}`

        const waterRate = dormSettings?.water_rate_per_unit || 0
        const electricRate = dormSettings?.electric_rate_per_unit || 0
        const waterBillingType = dormSettings?.water_billing_type || 'per_unit'
        const waterFlatRate = dormSettings?.water_flat_rate || 0

        // Calculate dynamic amounts if they are 0 (indicates not yet saved in DB)
        const waterAmt = item.water > 0 ? item.water : (waterBillingType === 'flat_rate' ? waterFlatRate : (item.waterUnit * waterRate))
        const electricAmt = item.electricity > 0 ? item.electricity : (item.electricityUnit * electricRate)

        const itemsArr: any[] = [
            { name: 'ค่าเช่าห้องพัก', amount: Number(item.rent || 0) }
        ]

        if (waterAmt > 0 || item.waterUnit > 0) {
            itemsArr.push({
                name: 'ค่าน้ำประปา',
                amount: Number(waterAmt || 0),
                detail: waterBillingType === 'flat' ? '(แบบเหมาจ่าย)' : `มิเตอร์: ${item.waterPrev || 0} → ${item.waterCurr || 0} หน่วย`
            })
        }

        if (electricAmt > 0 || item.electricityUnit > 0) {
            itemsArr.push({
                name: 'ค่าไฟฟ้า',
                amount: Number(electricAmt || 0),
                detail: `มิเตอร์: ${item.electricityPrev || 0} → ${item.electricityCurr || 0} หน่วย`
            })
        }

        if (dormServices.length > 0) {
            dormServices.forEach((s) => {
                if ((Number(s.price) || 0) <= 0) return
                itemsArr.push({ name: s.name, amount: Number(s.price) || 0 })
            })
        }

        const data = {
            receiptId: `PREVIEW-${item.roomNumber}`,
            date: formattedDate,
            month: formattedMonth,
            dueDate: formattedDueDate,
            dormName: dormName,
            address: dormSettings?.address || '-',
            dormPhone: dormSettings?.contact_number || '-',
            roomNumber: item.roomNumber,
            tenantName: item.tenantName || 'ไม่ระบุชื่อ',
            bankName: dormSettings?.bank_name || '-',
            bankNo: dormSettings?.bank_account_no || '-',
            bankAccount: dormSettings?.bank_account_name || dormName,
            items: itemsArr,
            total: item.rent + waterAmt + electricAmt + (Number(item.others) || 0)
        }

        setPreviewData(data)
        setShowPreview(true)
    }

    const handleIssueAll = async () => {
        const readyRooms = filteredData.filter(d => d.status === 'ready')
        if (readyRooms.length === 0 || issuing) return
        setConfirmIssueAll(readyRooms)
    }

    const executeIssueAll = async () => {
        if (!confirmIssueAll || issuing) return
        const roomsToIssue = [...confirmIssueAll]
        setConfirmIssueAll(null)

        setIssuing('all')
        for (const item of roomsToIssue) {
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

        if (filterWorkingStatus === 'pending_meter') {
            data = data.filter(item => item.status === 'pending_meter')
        } else if (filterWorkingStatus === 'ready') {
            data = data.filter(item => item.status === 'ready')
        } else if (filterWorkingStatus === 'issued') {
            data = data.filter(item => ['issued', 'waiting_verify', 'paid'].includes(item.status))
        }

        return data
    })()

    // Counts for working status
    const countAll = billingData.length
    const countPending = billingData.filter(d => d.status === 'pending_meter').length
    const countReady = billingData.filter(d => d.status === 'ready').length
    const countIssued = billingData.filter(d => ['issued', 'waiting_verify', 'paid'].includes(d.status)).length

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
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push('/dashboard/history')}
                                className="h-10 px-3 rounded-xl bg-purple-50 flex items-center justify-center gap-1.5 text-purple-600 hover:bg-purple-100 active:scale-95 transition-all shadow-sm border border-purple-100"
                            >
                                <ClockIcon className="w-4 h-4 stroke-[2.5]" />
                                <span className="text-[10px] font-black uppercase tracking-tight">ประวัติบิล</span>
                            </button>
                            <button
                                onClick={() => fetchData()}
                                className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shadow-sm"
                            >
                                <ArrowPathIcon className={`w-5 h-5 stroke-[2.5] ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
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
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">สถานะการทำงาน</span>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => setFilterWorkingStatus('all')}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${filterWorkingStatus === 'all' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ทั้งหมด ({countAll})
                            </button>
                            <button
                                onClick={() => setFilterWorkingStatus('pending_meter')}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${filterWorkingStatus === 'pending_meter' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                รอจดมิเตอร์ ({countPending})
                            </button>
                            <button
                                onClick={() => setFilterWorkingStatus('ready')}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${filterWorkingStatus === 'ready' ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                รอออกบิล ({countReady})
                            </button>
                            <button
                                onClick={() => setFilterWorkingStatus('issued')}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${filterWorkingStatus === 'issued' ? 'bg-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ออกบิลแล้ว ({countIssued})
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">สถานะ LINE OA</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterLineStatus('all')}
                                className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${filterLineStatus === 'all' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                onClick={() => setFilterLineStatus('linked')}
                                className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${filterLineStatus === 'linked' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ผูกไลน์แล้ว
                            </button>
                            <button
                                onClick={() => setFilterLineStatus('unlinked')}
                                className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${filterLineStatus === 'unlinked' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                ยังไม่ผูก
                            </button>
                        </div>
                    </div>
                </div>

                <main className="flex-1 px-4 py-6 pb-20 space-y-8">
                    {/* ── ROOM LIST BY FLOOR ── */}
                    {(() => {
                        const floorsArr = Array.from(new Set(filteredData.map(item => item.floor))).sort((a: any, b: any) => a - b)

                        if (filteredData.length === 0) {
                            return (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200 mx-2">
                                    <h3 className="text-lg font-black text-gray-400">ไม่พบข้อมูลห้องที่ตรงตามเงื่อนไข</h3>
                                    <p className="text-sm text-gray-300 font-bold mt-2">โปรดเปลี่ยนตัวกรองหรือลองใหม่อีกครั้ง</p>
                                </div>
                            )
                        }

                        return floorsArr.map((floor: any) => (
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
                                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg transform rotate-6">
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
                                                                    onClick={() => router.push(`/dashboard/meter?month=${format(selectedDate, 'yyyy-MM')}&roomId=${item.roomId}`)}
                                                                    className="flex-1 h-10 bg-orange-500 text-white rounded-xl font-black text-[12px] flex items-center justify-center gap-2"
                                                                >
                                                                    <Squares2X2Icon className="w-4 h-4" /> ไปจดมิเตอร์
                                                                </button>
                                                            ) : isIssued ? (
                                                                <>
                                                                    {(item.status === 'waiting_verify' || item.status === 'issued') && (
                                                                        <button
                                                                            onClick={() => handleVerifyPayment(item)}
                                                                            disabled={!!verifying}
                                                                            className={`flex-1 h-10 ${item.status === 'waiting_verify' ? 'bg-blue-600' : 'bg-emerald-600'} text-white rounded-xl font-black text-[12px] flex items-center justify-center gap-2 shadow-lg shadow-blue-100`}
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
                                                                <>
                                                                    <button
                                                                        onClick={() => handlePreviewBill(item)}
                                                                        className="h-12 px-5 bg-white border border-gray-200 text-gray-600 rounded-[1.2rem] flex items-center justify-center hover:bg-gray-50 transition-all active:scale-95 shadow-sm font-black text-xs whitespace-nowrap"
                                                                    >
                                                                        ตัวอย่างบิล
                                                                    </button>
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
                                                                </>
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
                                    บิลใบนี้จะถูกยกเลิก และเปลี่ยนสถานะเป็น "ยกเลิกแล้ว" คุณสามารถออกบิลใหม่ได้ทันที
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

                {/* ── CUSTOM CONFIRM ISSUE ALL MODAL ── */}
                {confirmIssueAll && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <div
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setConfirmIssueAll(null)}
                        />
                        <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center border-b border-gray-50">
                                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <BanknotesIcon className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2 font-noto">ยืนยันการออกบิล?</h3>
                                <p className="text-sm font-bold text-gray-400 px-4 font-noto">
                                    คุณต้องการออกบิลพร้อมกันทั้งหมด <span className="text-emerald-600 font-black">{confirmIssueAll.length} ห้อง</span> ใช่หรือไม่?
                                </p>
                            </div>
                            <div className="p-6 bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => setConfirmIssueAll(null)}
                                    className="flex-1 py-4 bg-white border border-gray-200 text-gray-400 font-black rounded-2xl hover:bg-gray-100 transition-colors font-noto"
                                >
                                    ยังก่อน
                                </button>
                                <button
                                    onClick={executeIssueAll}
                                    className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 active:scale-95 transition-all font-noto"
                                >
                                    ยืนยันออกบิล
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PREVIEW MODAL ── */}
                {showPreview && previewData && (
                    <div className="fixed inset-0 z-[120] flex flex-col md:py-10">
                        <div
                            className="absolute inset-0 bg-gray-900/80 backdrop-blur-md animate-in fade-in duration-300"
                            onClick={() => setShowPreview(false)}
                        />

                        {/* Close button for mobile (sticky) */}
                        <div className="relative z-10 flex justify-end p-4 md:hidden">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="w-10 h-10 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center text-white"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-10">
                            <div className="max-w-xl mx-auto relative">
                                {/* Close button for desktop */}
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="hidden md:flex absolute -right-16 top-0 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-2xl items-center justify-center text-white transition-all"
                                >
                                    <XMarkIcon className="w-8 h-8" />
                                </button>

                                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-black/50 overflow-hidden transform animate-in slide-in-from-bottom-10 duration-500">
                                    <div className="bg-amber-500 py-3 px-6 text-center">
                                        <p className="text-white text-xs font-black uppercase tracking-[0.2em]">
                                            ตัวอย่างบิล (ยังไม่ได้บันทึก)
                                        </p>
                                    </div>
                                    <ReceiptView data={previewData} />
                                    <div className="p-6 bg-gray-50 text-center flex justify-center">
                                        <button
                                            onClick={() => setShowPreview(false)}
                                            className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all"
                                        >
                                            ปิดหน้าต่าง
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
