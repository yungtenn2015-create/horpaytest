'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import {
    ArrowLeftIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ClockIcon,
    ArrowRightOnRectangleIcon,
    ChevronRightIcon,
    HomeIcon,
    ExclamationCircleIcon,
    PlusIcon,
    TrashIcon,
    BoltIcon,
    BeakerIcon
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

interface AvailableRoomOption {
    id: string;
    room_number: string;
    floor: string | null;
    status: string;
}

interface MoveOutSettlement {
    rentAmount: number | '';
    depositAmount: number | '';
    electricPrev: number | '';
    electricCurr: number | '';
    waterPrev: number | '';
    waterCurr: number | '';
    electricRate: number;
    waterRate: number;
    waterFlatRate: number;
    waterBillingType: 'per_unit' | 'flat_rate';
    additionalItems: Array<{
        id: string;
        description: string;
        amount: number | '';
    }>;
}

interface IssuedMoveOutSnapshot {
    roomAmount: number;
    utilityAmount: number;
    otherAmount: number;
    totalAmount: number;
    items: Array<{ name: string; amount: number; detail?: string }>;
}

export default function MoveOutClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [showMoveOutModal, setShowMoveOutModal] = useState(false)
    const [isMovingOut, setIsMovingOut] = useState(false)
    const [isIssuingMoveOutBill, setIsIssuingMoveOutBill] = useState(false)
    const [isSettlingMoveOutBill, setIsSettlingMoveOutBill] = useState(false)
    const [moveOutBillId, setMoveOutBillId] = useState<string | null>(null)
    const [moveOutBillStatus, setMoveOutBillStatus] = useState<string | null>(null)
    const [issuedMoveOutSnapshot, setIssuedMoveOutSnapshot] = useState<IssuedMoveOutSnapshot | null>(null)
    const [showNoticeModal, setShowNoticeModal] = useState(false)
    const [noticeDate, setNoticeDate] = useState('')
    const [isSubmittingNotice, setIsSubmittingNotice] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transferTenant, setTransferTenant] = useState<Tenant | null>(null)
    const [availableRooms, setAvailableRooms] = useState<AvailableRoomOption[]>([])
    const [selectedTargetRoomId, setSelectedTargetRoomId] = useState('')
    const [targetRoomSearch, setTargetRoomSearch] = useState('')
    const [transferErrorMsg, setTransferErrorMsg] = useState('')
    const [loadingTransferRooms, setLoadingTransferRooms] = useState(false)
    const [isTransferringRoom, setIsTransferringRoom] = useState(false)
    const [autoOpenedRoomId, setAutoOpenedRoomId] = useState<string | null>(null)

    // Debt Check States
    const [pendingBills, setPendingBills] = useState<any[]>([])
    const [showDebtWarning, setShowDebtWarning] = useState(false)
    const [isCheckingDebt, setIsCheckingDebt] = useState(false)
    const [loadingSettlement, setLoadingSettlement] = useState(false)
    const createExtraItem = (): MoveOutSettlement['additionalItems'][number] => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: '',
        amount: '' as number | ''
    })
    const [settlement, setSettlement] = useState<MoveOutSettlement>({
        rentAmount: '',
        depositAmount: '',
        electricPrev: '',
        electricCurr: '',
        waterPrev: '',
        waterCurr: '',
        electricRate: 0,
        waterRate: 0,
        waterFlatRate: 0,
        waterBillingType: 'per_unit',
        additionalItems: [createExtraItem()]
    })

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        const loadIssuedSnapshot = async () => {
            if (!moveOutBillId) {
                setIssuedMoveOutSnapshot(null)
                return
            }
            const supabase = createClient()
            try {
                const { data: bill, error: billErr } = await supabase
                    .from('bills')
                    .select('room_amount, utility_amount, other_amount, total_amount')
                    .eq('id', moveOutBillId)
                    .maybeSingle()
                if (billErr) throw billErr

                const { data: items, error: itemsErr } = await supabase
                    .from('bill_items')
                    .select('name, amount, detail')
                    .eq('bill_id', moveOutBillId)
                    .order('created_at', { ascending: true })
                if (itemsErr) throw itemsErr

                setIssuedMoveOutSnapshot({
                    roomAmount: Number(bill?.room_amount || 0),
                    utilityAmount: Number(bill?.utility_amount || 0),
                    otherAmount: Number(bill?.other_amount || 0),
                    totalAmount: Number(bill?.total_amount || 0),
                    items: (items || []).map((it: any) => ({
                        name: String(it?.name || '').trim(),
                        amount: Number(it?.amount || 0),
                        detail: it?.detail ? String(it.detail).trim() : undefined
                    }))
                })
            } catch {
                // Keep UI resilient; user still can open receipt for full detail.
                setIssuedMoveOutSnapshot(null)
            }
        }

        loadIssuedSnapshot()
    }, [moveOutBillId])

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

    const loadSettlementData = async (tenant: Tenant) => {
        setLoadingSettlement(true)
        const supabase = createClient()

        try {
            const { data: leaseRows, error: leaseErr } = await supabase
                .from('lease_contracts')
                .select('rent_price, deposit_amount')
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
            if (leaseErr) throw leaseErr
            let lease = leaseRows?.[0]
            if (!lease) {
                const { data: fallbackRows, error: fbErr } = await supabase
                    .from('lease_contracts')
                    .select('rent_price, deposit_amount')
                    .eq('tenant_id', tenant.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                if (fbErr) throw fbErr
                lease = fallbackRows?.[0]
            }

            const { data: room, error: roomErr } = await supabase
                .from('rooms')
                .select('dorm_id')
                .eq('id', tenant.room_id)
                .maybeSingle()
            if (roomErr) throw roomErr

            let settings: any = null
            if (room?.dorm_id) {
                const { data: s } = await supabase
                    .from('dorm_settings')
                    .select('electric_rate_per_unit, water_rate_per_unit, water_flat_rate, water_billing_type')
                    .eq('dorm_id', room.dorm_id)
                    .maybeSingle()
                settings = s
            }

            const { data: latestUtilities, error: utilErr } = await supabase
                .from('utilities')
                .select('curr_electric_meter, curr_water_meter')
                .eq('room_id', tenant.room_id)
                .order('meter_date', { ascending: false })
                .limit(1)
            if (utilErr) throw utilErr

            const latest = latestUtilities?.[0]
            const prevElectric = Number(latest?.curr_electric_meter || 0)
            const prevWater = Number(latest?.curr_water_meter || 0)

            const rentFromLease = lease?.rent_price != null ? Number(lease.rent_price) : null
            const basePrice = tenant.rooms?.base_price != null ? Number(tenant.rooms.base_price) : null
            setSettlement({
                rentAmount: rentFromLease ?? basePrice ?? '',
                depositAmount: lease?.deposit_amount != null ? Number(lease.deposit_amount) : '',
                electricPrev: latest ? prevElectric : '',
                electricCurr: '',
                waterPrev: latest ? prevWater : '',
                waterCurr: '',
                electricRate: Number(settings?.electric_rate_per_unit || 0),
                waterRate: Number(settings?.water_rate_per_unit || 0),
                waterFlatRate: Number(settings?.water_flat_rate || 0),
                waterBillingType: (settings?.water_billing_type === 'flat_rate' ? 'flat_rate' : 'per_unit'),
                additionalItems: [createExtraItem()]
            })
        } catch (err: any) {
            setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลสรุปย้ายออกได้')
        } finally {
            setLoadingSettlement(false)
        }
    }

    const handleCheckDebt = async (tenant: Tenant) => {
        setSelectedTenant(tenant)
        setErrorMsg('')
        setMoveOutBillId(null)
        setMoveOutBillStatus(null)
        setIsCheckingDebt(true)
        const supabase = createClient()

        try {
            await loadSettlementData(tenant)
            const { data: bills, error } = await supabase
                .from('bills')
                .select('*')
                .eq('tenant_id', tenant.id)
                .in('status', ['unpaid', 'overdue', 'waiting_verify'])

            if (error) throw error

            // Count only real outstanding debt:
            // - exclude move-out bills from this pre-check flow
            // - exclude non-positive totals (refund/credit should not block move-out)
            const debtBills = (bills || []).filter((b: any) => {
                const type = String(b?.bill_type || 'monthly')
                const total = Number(b?.total_amount || 0)
                return type !== 'move_out' && total > 0
            })

            // If there is an existing move-out bill, keep its id/status for next-step button gating.
            const { data: existingMoveOutBill, error: existingMoveOutErr } = await supabase
                .from('bills')
                .select('id, status')
                .eq('tenant_id', tenant.id)
                .eq('bill_type', 'move_out')
                .in('status', ['unpaid', 'overdue', 'waiting_verify', 'paid'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (existingMoveOutErr) throw existingMoveOutErr
            if (existingMoveOutBill?.id) {
                setMoveOutBillId(existingMoveOutBill.id)
                setMoveOutBillStatus(existingMoveOutBill.status || null)
            }

            if (debtBills.length > 0) {
                setPendingBills(debtBills)
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
        if (!moveOutBillId) {
            setErrorMsg('กรุณาออกบิลปิดบัญชีก่อน แล้วค่อยยืนยันย้ายออก')
            return
        }
        setIsMovingOut(true)
        const supabase = createClient()

        try {
            // Hard check from DB before move-out confirmation.
            const { data: moveOutBill, error: billErr } = await supabase
                .from('bills')
                .select('status')
                .eq('id', moveOutBillId)
                .maybeSingle()
            if (billErr) throw billErr
            const latestStatus = String(moveOutBill?.status || '')
            setMoveOutBillStatus(latestStatus || null)
            if (latestStatus !== 'paid') {
                throw new Error('ต้องยืนยันสรุปยอดบิลย้ายออกให้เป็น "ชำระแล้ว" ก่อน จึงจะยืนยันการย้ายออกได้')
            }

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
            setMoveOutBillId(null)
            setMoveOutBillStatus(null)
            setSelectedTenant(null)
            fetchData()
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setIsMovingOut(false)
        }
    }

    const handleIssueMoveOutBill = async () => {
        if (!selectedTenant || isIssuingMoveOutBill) return
        if (settlement.electricCurr === '' || settlement.waterCurr === '') {
            setErrorMsg('กรุณากรอกมิเตอร์ไฟและน้ำปัจจุบัน (เลื่อนขึ้นไปกรอกช่องมิเตอร์ก่อน)')
            return
        }
        const prevE = Number(settlement.electricPrev || 0)
        const currE = Number(settlement.electricCurr)
        const prevW = Number(settlement.waterPrev || 0)
        const currW = Number(settlement.waterCurr)
        if (currE < prevE || currW < prevW) {
            setErrorMsg('เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขก่อนหน้า')
            return
        }
        const hasInvalidAdditionalItem = settlement.additionalItems.some(
            (it) => Number(it.amount || 0) > 0 && !String(it.description || '').trim()
        )
        if (hasInvalidAdditionalItem) {
            setErrorMsg('กรุณาใส่รายละเอียดให้ครบในรายการค่าใช้จ่ายเพิ่มเติมที่มีราคา')
            return
        }

        setErrorMsg('')
        setIsIssuingMoveOutBill(true)
        const supabase = createClient()

        try {
            // Prevent duplicate move-out bill for same tenant.
            // If an active move-out bill already exists, require user to cancel/close it first.
            const { data: existingMoveOutBill, error: existingMoveOutErr } = await supabase
                .from('bills')
                .select('id, status')
                .eq('tenant_id', selectedTenant.id)
                .eq('bill_type', 'move_out')
                .in('status', ['unpaid', 'overdue', 'waiting_verify', 'paid'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (existingMoveOutErr) throw existingMoveOutErr
            if (existingMoveOutBill?.id) {
                setMoveOutBillId(existingMoveOutBill.id)
                setMoveOutBillStatus(existingMoveOutBill.status || null)
                throw new Error('มีบิลปิดบัญชีอยู่แล้ว กรุณาใช้ปุ่ม "ยืนยันรับเงินแล้ว/ยืนยันคืนเงินแล้ว" ในหน้านี้ก่อน หรือยกเลิกบิลเดิมแล้วค่อยออกใหม่')
            }

            // Find first available billing_month (first day of month) to avoid unique clash.
            let billingMonth = ''
            for (let i = 0; i < 24; i++) {
                const d = new Date()
                d.setMonth(d.getMonth() + i, 1)
                const candidate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
                const { data: exists, error: existsErr } = await supabase
                    .from('bills')
                    .select('id')
                    .eq('tenant_id', selectedTenant.id)
                    .eq('billing_month', candidate)
                    .limit(1)
                if (existsErr) throw existsErr
                if (!exists || exists.length === 0) {
                    billingMonth = candidate
                    break
                }
            }
            if (!billingMonth) {
                throw new Error('ไม่พบรอบบิลว่างสำหรับออกบิลปิดบัญชี กรุณาตรวจสอบบิลเดิมก่อน')
            }

            const today = new Date()
            const due = new Date(today)
            due.setDate(due.getDate() + 7)
            const dueDate = due.toISOString().split('T')[0]

            const outstandingAmount = pendingBills.reduce((acc, b) => acc + Number(b.total_amount), 0)
            const electricUnit = Math.max(0, Number(settlement.electricCurr || 0) - Number(settlement.electricPrev || 0))
            const waterUnit = Math.max(0, Number(settlement.waterCurr || 0) - Number(settlement.waterPrev || 0))
            const electricAmount = electricUnit * Number(settlement.electricRate || 0)
            const waterAmount = settlement.waterBillingType === 'flat_rate'
                ? Number(settlement.waterFlatRate || 0)
                : waterUnit * Number(settlement.waterRate || 0)
            const additionalAmountTotal = settlement.additionalItems.reduce((sum, it) => sum + Number(it.amount || 0), 0)

            const otherAmount = outstandingAmount + additionalAmountTotal - Number(settlement.depositAmount || 0)
            const totalAmount = Number(settlement.rentAmount || 0) + electricAmount + waterAmount + otherAmount

            const { data: newBill, error: billErr } = await supabase
                .from('bills')
                .insert({
                    tenant_id: selectedTenant.id,
                    room_id: selectedTenant.room_id,
                    utility_id: null,
                    bill_type: 'move_out',
                    billing_month: billingMonth,
                    room_amount: Number(settlement.rentAmount || 0),
                    utility_amount: electricAmount + waterAmount,
                    other_amount: otherAmount,
                    total_amount: totalAmount,
                    due_date: dueDate,
                    status: 'unpaid'
                })
                .select('id')
                .single()
            if (billErr) throw billErr

            const ep = Number(settlement.electricPrev || 0)
            const ec = Number(settlement.electricCurr || 0)
            const wp = Number(settlement.waterPrev || 0)
            const wc = Number(settlement.waterCurr || 0)

            const lines: Array<{ name: string; amount: number; detail?: string | null }> = []
            if (outstandingAmount > 0) lines.push({ name: 'ยอดค้างชำระเดิม', amount: outstandingAmount })
            if (electricAmount > 0) {
                lines.push({
                    name: 'ค่าไฟฟ้า',
                    amount: electricAmount,
                    detail: `มิเตอร์: ${ep} → ${ec} หน่วย`
                })
            }
            if (waterAmount > 0) {
                lines.push({
                    name: 'ค่าน้ำประปา',
                    amount: waterAmount,
                    detail:
                        settlement.waterBillingType === 'flat_rate'
                            ? '(แบบเหมาจ่าย)'
                            : `มิเตอร์: ${wp} → ${wc} หน่วย`
                })
            }
            settlement.additionalItems.forEach((it) => {
                const amount = Number(it.amount || 0)
                if (amount <= 0) return
                lines.push({ name: String(it.description || '').trim() || 'ค่าใช้จ่ายเพิ่มเติม', amount })
            })
            if (Number(settlement.depositAmount || 0) > 0) {
                lines.push({ name: 'หักเงินมัดจำ', amount: -Number(settlement.depositAmount || 0) })
            }

            if (lines.length > 0) {
                const { error: itemsErr } = await supabase
                    .from('bill_items')
                    .insert(
                        lines.map((l) => ({
                            bill_id: newBill.id,
                            name: l.name,
                            amount: l.amount,
                            ...(l.detail != null && l.detail !== '' ? { detail: l.detail } : {})
                        }))
                    )
                if (itemsErr) throw itemsErr
            }

            setMoveOutBillId(newBill.id)
            setMoveOutBillStatus('unpaid')
        } catch (err: any) {
            setErrorMsg(err.message || 'ไม่สามารถออกบิลปิดบัญชีได้')
        } finally {
            setIsIssuingMoveOutBill(false)
        }
    }

    const handleSettleMoveOutBill = async () => {
        if (!moveOutBillId || !selectedTenant || isSettlingMoveOutBill) return
        setIsSettlingMoveOutBill(true)
        setErrorMsg('')
        const supabase = createClient()
        try {
            // 1) Mark move-out bill as paid/settled.
            const { error: moveOutErr } = await supabase
                .from('bills')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('id', moveOutBillId)
            if (moveOutErr) throw moveOutErr

            // 2) Close outstanding monthly bills for this tenant as settled by deposit/move-out.
            const { error: monthlyErr } = await supabase
                .from('bills')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('tenant_id', selectedTenant.id)
                .eq('bill_type', 'monthly')
                .in('status', ['unpaid', 'overdue', 'waiting_verify'])
                .gt('total_amount', 0)
            if (monthlyErr) throw monthlyErr

            setMoveOutBillStatus('paid')
        } catch (err: any) {
            setErrorMsg(err.message || 'ไม่สามารถยืนยันสรุปยอดบิลย้ายออกได้')
        } finally {
            setIsSettlingMoveOutBill(false)
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

    const handleCancelMoveOutFlow = async () => {
        if (!selectedTenant || isMovingOut) return
        setIsMovingOut(true)
        setErrorMsg('')
        const supabase = createClient()
        try {
            // 1) Cancel existing move-out bill if it is not finalized.
            if (moveOutBillId) {
                const { data: bill, error: getBillErr } = await supabase
                    .from('bills')
                    .select('status')
                    .eq('id', moveOutBillId)
                    .maybeSingle()
                if (getBillErr) throw getBillErr

                const billStatus = String(bill?.status || '')
                if (billStatus === 'paid') {
                    throw new Error('บิลย้ายออกใบนี้ปิดยอดแล้ว กรุณาจัดการที่ประวัติบิลก่อนยกเลิกการย้ายออก')
                }

                if (['unpaid', 'overdue', 'waiting_verify'].includes(billStatus)) {
                    const { error: cancelBillErr } = await supabase
                        .from('bills')
                        .update({ status: 'cancelled' })
                        .eq('id', moveOutBillId)
                    if (cancelBillErr) throw cancelBillErr
                }
            }

            // 2) Clear planned move-out date
            const { error: tenantErr } = await supabase
                .from('tenants')
                .update({ planned_move_out_date: null })
                .eq('id', selectedTenant.id)
            if (tenantErr) throw tenantErr

            setShowMoveOutModal(false)
            setShowDebtWarning(false)
            setPendingBills([])
            setSelectedTenant(null)
            setMoveOutBillId(null)
            setMoveOutBillStatus(null)
            setIssuedMoveOutSnapshot(null)
            await fetchData()
        } catch (err: any) {
            setErrorMsg(err.message || 'ไม่สามารถยกเลิกการย้ายออกได้')
        } finally {
            setIsMovingOut(false)
        }
    }

    const openTransferModal = async (tenant: Tenant) => {
        setTransferTenant(tenant)
        setSelectedTargetRoomId('')
        setTargetRoomSearch('')
        setTransferErrorMsg('')
        setShowTransferModal(true)
        setLoadingTransferRooms(true)
        const supabase = createClient()
        try {
            const { data: currentRoom, error: currentRoomErr } = await supabase
                .from('rooms')
                .select('dorm_id')
                .eq('id', tenant.room_id)
                .maybeSingle()
            if (currentRoomErr) throw currentRoomErr

            if (!currentRoom?.dorm_id) {
                setAvailableRooms([])
                setTransferErrorMsg('ไม่พบข้อมูลหอของห้องปัจจุบัน')
                return
            }

            const { data: rooms, error: roomsErr } = await supabase
                .from('rooms')
                .select('id, room_number, floor, status')
                .eq('dorm_id', currentRoom.dorm_id)
                .eq('status', 'available')
                .neq('id', tenant.room_id)
                .is('deleted_at', null)
                .order('room_number', { ascending: true })
            if (roomsErr) throw roomsErr

            setAvailableRooms((rooms || []) as AvailableRoomOption[])
            if (!rooms || rooms.length === 0) {
                setTransferErrorMsg('ไม่มีห้องว่างให้ย้ายในขณะนี้')
            }
        } catch (err: any) {
            setTransferErrorMsg(err.message || 'ไม่สามารถโหลดรายการห้องว่างได้')
            setAvailableRooms([])
        } finally {
            setLoadingTransferRooms(false)
        }
    }

    const handleTransferRoom = async () => {
        if (!transferTenant || !selectedTargetRoomId || isTransferringRoom) return
        setIsTransferringRoom(true)
        setTransferErrorMsg('')
        const supabase = createClient()

        try {
            // Guard: do not allow transfer if tenant still has real outstanding bills.
            const { data: pendingRows, error: pendingErr } = await supabase
                .from('bills')
                .select('id')
                .eq('tenant_id', transferTenant.id)
                .in('status', ['unpaid', 'overdue', 'waiting_verify'])
                .gt('total_amount', 0)
                .limit(1)
            if (pendingErr) throw pendingErr
            if (pendingRows && pendingRows.length > 0) {
                throw new Error('ผู้เช่ายังมีบิลค้างชำระ กรุณาเคลียร์ที่หน้าประวัติบิลก่อนย้ายห้อง')
            }

            const { error: tenantErr } = await supabase
                .from('tenants')
                .update({ room_id: selectedTargetRoomId })
                .eq('id', transferTenant.id)
            if (tenantErr) throw tenantErr

            const { error: oldRoomErr } = await supabase
                .from('rooms')
                .update({ status: 'available' })
                .eq('id', transferTenant.room_id)
            if (oldRoomErr) throw oldRoomErr

            const { error: newRoomErr } = await supabase
                .from('rooms')
                .update({ status: 'occupied' })
                .eq('id', selectedTargetRoomId)
            if (newRoomErr) throw newRoomErr

            setShowTransferModal(false)
            setTransferTenant(null)
            setSelectedTargetRoomId('')
            setAvailableRooms([])
            await fetchData()
        } catch (err: any) {
            setTransferErrorMsg(err.message || 'ไม่สามารถย้ายห้องได้')
        } finally {
            setIsTransferringRoom(false)
        }
    }

    const filteredTenants = tenants.filter(t => {
        const query = searchQuery.toLowerCase()
        return (
            t.name.toLowerCase().includes(query) ||
            t.rooms.room_number.toLowerCase().includes(query)
        )
    })

    useEffect(() => {
        const roomId = searchParams.get('roomId')
        if (!roomId || autoOpenedRoomId === roomId || tenants.length === 0 || isCheckingDebt) return

        const tenant = tenants.find((t) => t.room_id === roomId)
        if (!tenant) return

        setSearchQuery(tenant.rooms.room_number)
        setAutoOpenedRoomId(roomId)
        handleCheckDebt(tenant)
    }, [searchParams, tenants, autoOpenedRoomId, isCheckingDebt])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        )
    }

    const outstandingAmount = pendingBills.reduce((acc, b) => acc + Number(b.total_amount), 0)
    const electricUnit = Math.max(0, Number(settlement.electricCurr || 0) - Number(settlement.electricPrev || 0))
    const waterUnit = Math.max(0, Number(settlement.waterCurr || 0) - Number(settlement.waterPrev || 0))
    const electricAmount = electricUnit * Number(settlement.electricRate || 0)
    const waterAmount =
        settlement.waterBillingType === 'flat_rate'
            ? Number(settlement.waterFlatRate || 0)
            : waterUnit * Number(settlement.waterRate || 0)
    const additionalAmountTotal = settlement.additionalItems.reduce(
        (sum, it) => sum + Number(it.amount || 0),
        0
    )
    const netMoveOutAmount =
        Number(settlement.rentAmount || 0) +
        outstandingAmount +
        electricAmount +
        waterAmount +
        additionalAmountTotal -
        Number(settlement.depositAmount || 0)

    const isIssuedSnapshotMode = !!moveOutBillId
    const issuedItems = issuedMoveOutSnapshot?.items || []
    const getIssuedLineAmount = (test: (name: string) => boolean) =>
        issuedItems
            .filter((it) => test(it.name))
            .reduce((sum, it) => sum + Number(it.amount || 0), 0)
    const issuedOutstanding = getIssuedLineAmount((n) => n.includes('ยอดค้างชำระเดิม'))
    const isIssuedElectricName = (n: string) => n === 'ค่าไฟฟ้า' || n.startsWith('ค่าไฟย้ายออก')
    const isIssuedWaterName = (n: string) => n === 'ค่าน้ำประปา' || n.startsWith('ค่าน้ำย้ายออก')
    const issuedElectric = getIssuedLineAmount(isIssuedElectricName)
    const issuedWater = getIssuedLineAmount(isIssuedWaterName)
    const issuedDepositDeduct = Math.abs(getIssuedLineAmount((n) => n.includes('หักเงินมัดจำ')))
    const issuedAdditionalItems = issuedItems.filter((it) => {
        const n = it.name
        return !n.includes('ยอดค้างชำระเดิม') &&
            !isIssuedElectricName(n) &&
            !isIssuedWaterName(n) &&
            !n.includes('หักเงินมัดจำ')
    })
    const issuedElectricLine = issuedItems.find((it) => isIssuedElectricName(it.name))
    const issuedWaterLine = issuedItems.find((it) => isIssuedWaterName(it.name))
    const summaryRent = isIssuedSnapshotMode ? Number(issuedMoveOutSnapshot?.roomAmount || 0) : Number(settlement.rentAmount || 0)
    const summaryOutstanding = isIssuedSnapshotMode ? issuedOutstanding : outstandingAmount
    const summaryElectric = isIssuedSnapshotMode ? issuedElectric : electricAmount
    const summaryWater = isIssuedSnapshotMode ? issuedWater : waterAmount
    const summaryDeposit = isIssuedSnapshotMode ? issuedDepositDeduct : Number(settlement.depositAmount || 0)
    const summaryNet = isIssuedSnapshotMode ? Number(issuedMoveOutSnapshot?.totalAmount || 0) : netMoveOutAmount
    const filteredAvailableRooms = availableRooms.filter((r) =>
        String(r.room_number || '').toLowerCase().includes(targetRoomSearch.toLowerCase().trim())
    )

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
                                        แจ้งออกล่วงหน้า
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
                                <button
                                    onClick={() => openTransferModal(tenant)}
                                    className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-2xl font-black text-[13px] transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <HomeIcon className="w-4 h-4" />
                                    ย้ายห้อง
                                </button>
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

                {/* 1.5 Transfer Room Modal */}
                {showTransferModal && transferTenant && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTransferModal(false)} />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                            <div className="bg-emerald-500 p-8 text-white">
                                <HomeIcon className="w-12 h-12 mb-2" />
                                <h3 className="text-2xl font-black tracking-tight">ย้ายห้องผู้เช่า</h3>
                                <p className="text-emerald-50 text-[11px] font-bold">
                                    ห้อง {transferTenant.rooms.room_number} - {transferTenant.name}
                                </p>
                            </div>
                            <div className="p-8 space-y-4">
                                <div>
                                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">เลือกห้องใหม่ (ห้องว่าง)</p>
                                    <div className="relative mb-2">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={targetRoomSearch}
                                            onChange={(e) => setTargetRoomSearch(e.target.value)}
                                            placeholder="ค้นหาเลขห้องว่าง..."
                                            disabled={loadingTransferRooms || isTransferringRoom || availableRooms.length === 0}
                                            className="w-full h-11 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm font-bold text-gray-700 placeholder:text-gray-400 outline-none focus:border-emerald-400 disabled:opacity-60"
                                        />
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2">
                                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                            {loadingTransferRooms ? (
                                                <div className="h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-xs font-black text-gray-400">
                                                    กำลังโหลดห้องว่าง...
                                                </div>
                                            ) : availableRooms.length === 0 ? (
                                                <div className="h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-xs font-black text-gray-400">
                                                    ไม่มีห้องว่างให้เลือก
                                                </div>
                                            ) : filteredAvailableRooms.length === 0 ? (
                                                <div className="h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-xs font-black text-gray-400">
                                                    ไม่พบห้องว่างที่ค้นหา
                                                </div>
                                            ) : (
                                                filteredAvailableRooms.map((r) => {
                                                    const active = selectedTargetRoomId === r.id
                                                    return (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            onClick={() => setSelectedTargetRoomId(r.id)}
                                                            disabled={isTransferringRoom}
                                                            className={`w-full h-12 rounded-xl border text-left px-3 font-black text-sm transition-all ${active
                                                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                                                : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300'
                                                                }`}
                                                        >
                                                            ห้อง {r.room_number}{r.floor ? ` (ชั้น ${r.floor})` : ''}
                                                        </button>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {transferErrorMsg && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                                        {transferErrorMsg}
                                    </div>
                                )}
                                <button
                                    onClick={handleTransferRoom}
                                    disabled={!selectedTargetRoomId || isTransferringRoom || loadingTransferRooms}
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isTransferringRoom ? 'กำลังย้ายห้อง...' : 'ยืนยันย้ายห้อง'}
                                </button>
                                {transferErrorMsg.includes('บิลค้าง') && (
                                    <button
                                        onClick={() => router.push('/dashboard/history?type=move_out')}
                                        className="w-full h-12 bg-white border border-purple-200 text-purple-700 font-black rounded-2xl shadow-sm hover:bg-purple-50 transition-all"
                                    >
                                        ไปหน้าประวัติบิล
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowTransferModal(false)}
                                    className="w-full h-12 bg-gray-100 text-gray-500 font-black rounded-2xl"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Move Out Confirm Modal */}
                {showMoveOutModal && selectedTenant && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMoveOutModal(false)} />
                        <div className="relative w-full max-w-md max-h-[min(92dvh,calc(100dvh-1rem))] sm:max-h-[85dvh] flex flex-col bg-white rounded-[2.5rem] sm:rounded-[2.5rem] rounded-b-none sm:rounded-b-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="shrink-0 bg-[#10B981] p-5 sm:p-6 text-white">
                                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100">
                                    Move-Out Settlement
                                </p>
                                <h3 className="text-2xl font-black tracking-tight mt-1">บิลปิดบัญชี (ย้ายออก)</h3>
                                <p className="text-emerald-50 text-xs font-bold mt-2">
                                    ห้อง {selectedTenant.rooms.room_number} • {selectedTenant.name}
                                </p>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-5 sm:px-6 pt-5 pb-4 space-y-4">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between">
                                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest">วันที่ย้ายออก</span>
                                    <span className="text-sm font-black text-gray-900">
                                        {new Date().toLocaleDateString('th-TH')}
                                    </span>
                                </div>

                                {loadingSettlement ? (
                                    <div className="rounded-2xl border border-gray-100 p-4 text-center text-xs font-bold text-gray-400">
                                        กำลังดึงข้อมูลมัดจำและมิเตอร์ล่าสุด...
                                    </div>
                                ) : moveOutBillId ? (
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[12px] font-bold text-emerald-700">
                                        ออกบิลปิดบัญชีแล้ว ระบบล็อกฟอร์มกรอกข้อมูลเพื่อกันสับสน
                                        หากต้องการแก้ไข ให้ยกเลิกบิลเดิมก่อน แล้วออกใหม่
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                                            <p className="text-xs font-black text-gray-800 uppercase tracking-widest">ข้อมูลตั้งต้น</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[11px] font-black text-gray-700">ค่าเช่ารอบสุดท้าย</label>
                                                    <input
                                                        type="number"
                                                        value={settlement.rentAmount}
                                                        onChange={(e) =>
                                                            setSettlement((p) => ({
                                                                ...p,
                                                                rentAmount: e.target.value === '' ? '' : Number(e.target.value)
                                                            }))
                                                        }
                                                        className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-gray-700">เงินมัดจำ (หักออก)</label>
                                                    <input
                                                        type="number"
                                                        value={settlement.depositAmount}
                                                        onChange={(e) =>
                                                            setSettlement((p) => ({
                                                                ...p,
                                                                depositAmount: e.target.value === '' ? '' : Number(e.target.value)
                                                            }))
                                                        }
                                                        className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                                            <p className="text-xs font-black text-gray-800 uppercase tracking-widest">มิเตอร์ไฟ/น้ำ</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[11px] font-black text-gray-700 flex items-center gap-1.5">
                                                        <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
                                                        ไฟก่อนหน้า
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={settlement.electricPrev}
                                                        onChange={(e) =>
                                                            setSettlement((p) => ({
                                                                ...p,
                                                                electricPrev: e.target.value === '' ? '' : Number(e.target.value)
                                                            }))
                                                        }
                                                        className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-gray-700 flex items-center gap-1.5">
                                                        <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
                                                        ไฟปัจจุบัน
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={settlement.electricCurr}
                                                        onChange={(e) => setSettlement((p) => ({ ...p, electricCurr: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                        placeholder="กรอกมิเตอร์ไฟปัจจุบัน"
                                                        className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-gray-700 flex items-center gap-1.5">
                                                        <BeakerIcon className="w-3.5 h-3.5 text-sky-500" />
                                                        น้ำก่อนหน้า
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={settlement.waterPrev}
                                                        onChange={(e) =>
                                                            setSettlement((p) => ({
                                                                ...p,
                                                                waterPrev: e.target.value === '' ? '' : Number(e.target.value)
                                                            }))
                                                        }
                                                        className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-gray-700 flex items-center gap-1.5">
                                                        <BeakerIcon className="w-3.5 h-3.5 text-sky-500" />
                                                        น้ำปัจจุบัน
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={settlement.waterCurr}
                                                        onChange={(e) => setSettlement((p) => ({ ...p, waterCurr: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                        placeholder="กรอกมิเตอร์น้ำปัจจุบัน"
                                                        className="mt-1 w-full h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-bold text-gray-700">
                                                ⚡ ค่าไฟ: {electricUnit} หน่วย x ฿{Number(settlement.electricRate || 0).toLocaleString()} = ฿{electricAmount.toLocaleString()}
                                            </p>
                                            <p className="text-[11px] font-bold text-gray-700">
                                                💧 ค่าน้ำ: {settlement.waterBillingType === 'flat_rate'
                                                    ? `เหมาจ่าย ฿${Number(settlement.waterFlatRate || 0).toLocaleString()}`
                                                    : `${waterUnit} หน่วย x ฿${Number(settlement.waterRate || 0).toLocaleString()} = ฿${waterAmount.toLocaleString()}`
                                                }
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                                            <p className="text-xs font-black text-gray-800 uppercase tracking-widest">ค่าใช้จ่ายเพิ่มเติม</p>
                                            <div className="space-y-2">
                                                {settlement.additionalItems.map((it, idx) => (
                                                    <div key={it.id} className="grid grid-cols-[minmax(0,1fr)_92px_36px] gap-2 w-full">
                                                        <input
                                                            type="text"
                                                            value={it.description}
                                                            onChange={(e) =>
                                                                setSettlement((p) => ({
                                                                    ...p,
                                                                    additionalItems: p.additionalItems.map((row) =>
                                                                        row.id === it.id ? { ...row, description: e.target.value } : row
                                                                    )
                                                                }))
                                                            }
                                                            placeholder={`รายละเอียดรายการที่ ${idx + 1}`}
                                                            className="h-11 min-w-0 rounded-xl border border-gray-200 px-3 font-bold text-gray-800"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={it.amount}
                                                            onChange={(e) => {
                                                                const nextAmount: number | '' = e.target.value === '' ? '' : Number(e.target.value)
                                                                setSettlement((p) => ({
                                                                    ...p,
                                                                    additionalItems: p.additionalItems.map((row) =>
                                                                        row.id === it.id
                                                                            ? { ...row, amount: nextAmount }
                                                                            : row
                                                                    )
                                                                }))
                                                            }}
                                                            placeholder="ราคา"
                                                            className="h-11 rounded-xl border border-gray-200 px-3 font-black text-gray-700"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setSettlement((p) => ({
                                                                    ...p,
                                                                    additionalItems:
                                                                        p.additionalItems.length > 1
                                                                            ? p.additionalItems.filter((row) => row.id !== it.id)
                                                                            : [createExtraItem()]
                                                                }))
                                                            }
                                                            className="h-11 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 flex items-center justify-center"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSettlement((p) => ({
                                                        ...p,
                                                        additionalItems: [...p.additionalItems, createExtraItem()]
                                                    }))
                                                }
                                                className="w-full h-10 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-xs font-black flex items-center justify-center gap-2"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                                เพิ่มรายการ
                                            </button>
                                        </div>
                                    </>
                                )}

                                <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                                    {isIssuedSnapshotMode && (
                                        <p className="text-[11px] font-black text-emerald-700">
                                            แสดงสรุปจากบิลที่ออกแล้ว
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-gray-800">ค่าเช่าห้องงวดสุดท้าย</span>
                                        <span className="font-black text-gray-800">
                                            ฿{summaryRent.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-gray-800">ยอดค้างชำระเดิม</span>
                                        <span className="font-black text-red-500">
                                            ฿{summaryOutstanding.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-bold text-gray-800">ค่าไฟฟ้า</span>
                                            <span className="font-black text-gray-800">฿{summaryElectric.toLocaleString()}</span>
                                        </div>
                                        {isIssuedSnapshotMode && issuedElectricLine?.detail && (
                                            <p className="text-[11px] font-bold text-gray-400 pl-0.5">
                                                {issuedElectricLine.detail.replace(' - ', ' → ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-bold text-gray-800">ค่าน้ำประปา</span>
                                            <span className="font-black text-gray-800">฿{summaryWater.toLocaleString()}</span>
                                        </div>
                                        {isIssuedSnapshotMode && issuedWaterLine?.detail && (
                                            <p className="text-[11px] font-bold text-gray-400 pl-0.5">
                                                {issuedWaterLine.detail.replace(' - ', ' → ')}
                                            </p>
                                        )}
                                    </div>
                                    {(isIssuedSnapshotMode
                                        ? issuedAdditionalItems.length > 0
                                        : settlement.additionalItems.some(
                                            (it) => Number(it.amount || 0) > 0 || String(it.description || '').trim()
                                        )) && (
                                        <p className="text-[11px] font-black text-gray-800 pt-0.5">ค่าใช้จ่ายเพิ่มเติม (รายละเอียด)</p>
                                    )}
                                    {(isIssuedSnapshotMode
                                        ? issuedAdditionalItems.map((it) => ({ id: it.name, description: it.name, amount: it.amount }))
                                        : settlement.additionalItems.filter((it) => Number(it.amount || 0) > 0 || String(it.description || '').trim())
                                    ).map((it) => (
                                            <div key={`sum-${it.id}`} className="flex items-start justify-between text-[12px]">
                                                <span className="text-gray-700 font-bold pr-3 break-words">
                                                    - {String((it as any).description || '').trim() || 'ไม่ระบุรายการ'}
                                                </span>
                                                <span className="text-gray-800 font-black whitespace-nowrap">
                                                    ฿{Number((it as any).amount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-gray-800">หักเงินมัดจำ</span>
                                        <span className="font-black text-emerald-600">- ฿{summaryDeposit.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="rounded-3xl border-2 border-emerald-100 bg-emerald-50 p-5 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">ยอดสุทธิ ณ วันย้ายออก</p>
                                        <p className="text-xs font-bold text-emerald-700 mt-1">
                                            {summaryNet >= 0 ? 'ผู้เช่าต้องชำระเพิ่ม' : 'เจ้าของต้องคืนเงินให้ผู้เช่า'}
                                        </p>
                                    </div>
                                    <p className="text-2xl font-black text-[#10B981]">
                                        ฿{Math.abs(summaryNet).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="shrink-0 p-5 sm:p-6 pt-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                                {errorMsg && (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">
                                        {errorMsg}
                                    </div>
                                )}
                                <button
                                    onClick={handleIssueMoveOutBill}
                                    disabled={isIssuingMoveOutBill || !!moveOutBillId}
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isIssuingMoveOutBill && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {moveOutBillId ? 'ออกบิลปิดบัญชีแล้ว' : (isIssuingMoveOutBill ? 'กำลังออกบิล...' : 'ออกบิลปิดบัญชี')}
                                </button>
                                {moveOutBillId && (
                                    <button
                                        onClick={() => router.push(`/dashboard/billing/receipt/${moveOutBillId}`)}
                                        className="w-full h-12 bg-white border border-emerald-200 text-emerald-700 font-black rounded-2xl shadow-sm hover:bg-emerald-50 transition-all"
                                    >
                                        ดูรายละเอียดบิลและบันทึก
                                    </button>
                                )}
                                {moveOutBillId && moveOutBillStatus !== 'paid' && (
                                    <button
                                        onClick={handleSettleMoveOutBill}
                                        disabled={isSettlingMoveOutBill}
                                        className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isSettlingMoveOutBill
                                            ? 'กำลังยืนยัน...'
                                            : (summaryNet < 0 ? 'ยืนยันคืนเงินแล้ว' : 'ยืนยันรับเงินแล้ว')}
                                    </button>
                                )}
                                <button
                                    onClick={handleMoveOut}
                                    disabled={isMovingOut || !moveOutBillId || moveOutBillStatus !== 'paid'}
                                    className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isMovingOut && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {isMovingOut ? 'กำลังบันทึก...' : 'ยืนยันการย้ายออก'}
                                </button>
                                {!moveOutBillId && (
                                    <p className="text-[11px] text-center font-bold text-amber-600 -mt-1">
                                        กรุณาออกบิลปิดบัญชีก่อน จึงจะยืนยันย้ายออกได้
                                    </p>
                                )}
                                {moveOutBillId && moveOutBillStatus !== 'paid' && (
                                    <p className="text-[11px] text-center font-bold text-amber-600 -mt-1">
                                        กรุณากดยืนยันรับเงิน/คืนเงินในหน้านี้ก่อน จึงจะยืนยันการย้ายออกได้
                                    </p>
                                )}
                                <button
                                    onClick={handleCancelMoveOutFlow}
                                    disabled={isMovingOut}
                                    className="w-full h-14 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isMovingOut ? 'กำลังยกเลิก...' : 'ยกเลิกย้ายออก'}
                                </button>
                                <button onClick={() => { setShowMoveOutModal(false); setMoveOutBillId(null); setMoveOutBillStatus(null) }} className="w-full h-14 bg-white border border-gray-100 text-gray-400 font-black rounded-2xl shadow-sm hover:bg-gray-50 transition-all">ยกเลิก</button>
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
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-left text-[12px] font-bold leading-snug text-emerald-900">
                                    <p className="font-black text-emerald-800 mb-1.5">ทำอย่างไรต่อ?</p>
                                    <p className="text-emerald-900/90">
                                        ให้ไป<strong className="font-black">ยกเลิกบิลที่ค้าง</strong> ที่หน้าออกบิล
                                        แล้ว<strong className="font-black">กลับมาที่หน้านี้</strong>เพื่อคำนวณสรุปย้ายออก<strong className="font-black">ครั้งเดียว</strong>
                                        — จะได้ไม่สับสนว่ามีทั้งบิลเดิมกับยอดปิดบัญชีซ้ำกัน
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-[11px] text-gray-600 font-medium text-center">
                                    ผู้เช่า <span className="font-black text-gray-800">{selectedTenant.name}</span> มีบิลที่ยังไม่ปิดดังนี้:
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
                                    type="button"
                                    onClick={() => router.push(`/dashboard/billing?room=${selectedTenant.rooms.room_number}`)}
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95"
                                >
                                    ไปหน้าออกบิล — ยกเลิก/ปิดบิลค้าง
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push('/dashboard/history')}
                                    className="w-full h-14 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 font-black rounded-2xl transition-all active:scale-95"
                                >
                                    ไปหน้าประวัติบิล
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDebtWarning(false)}
                                    className="w-full py-3 text-gray-500 font-bold text-sm hover:text-gray-700"
                                >
                                    ปิด — กลับมาคำนวณในหน้านี้หลังจัดการบิลแล้ว
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
