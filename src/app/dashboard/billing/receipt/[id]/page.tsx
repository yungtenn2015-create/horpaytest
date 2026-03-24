'use client'

import { useState, useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import ReceiptView from '@/src/components/ReceiptView'
import {
    ChevronLeftIcon,
    PrinterIcon,
    ShareIcon,
    ArrowDownTrayIcon,
    CheckBadgeIcon,
    ArrowPathIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'

// Helper function for Thai Baht Text (Simplified version)
function bahtText(amount: number): string {
    const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
    const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']

    if (amount === 0) return 'ศูนย์บาทถ้วน'

    let res = ''
    const str = Math.floor(amount).toString()
    for (let i = 0; i < str.length; i++) {
        const d = parseInt(str[i])
        const unit = units[str.length - i - 1]
        if (d !== 0) {
            if (unit === 'สิบ' && d === 1 && i === str.length - 2) res += ''
            else if (unit === 'สิบ' && d === 2 && i === str.length - 2) res += 'ยี่'
            else if (unit === '' && d === 1 && str.length > 1) res += 'เอ็ด'
            else res += numbers[d]
            res += unit
        }
    }
    return res + 'บาทถ้วน'
}

export default function ReceiptPage() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [slipUrl, setSlipUrl] = useState<string | null>(null)
    const [message, setMessage] = useState('')
    const [billStatus, setBillStatus] = useState<string>('')
    const [verifying, setVerifying] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            if (!params.id) return
            setLoading(true)
            try {
                // 1. Fetch Bill
                const { data: bill, error: billError } = await supabase
                    .from('bills')
                    .select('*')
                    .eq('id', params.id)
                    .single()

                if (billError || !bill) {
                    console.error('Bill not found', billError)
                    return
                }
                setBillStatus(bill.status)

                // 2. Fetch Slip from payments table
                const { data: payment } = await supabase
                    .from('payments')
                    .select('slip_url')
                    .eq('bill_id', bill.id)
                    .order('payment_date', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (payment?.slip_url) {
                    setSlipUrl(payment.slip_url)
                }

                // 3. Fetch Room Info
                const { data: room, error: roomError } = await supabase
                    .from('rooms')
                    .select('room_number, dorm_id')
                    .eq('id', bill.room_id)
                    .single()

                if (roomError) console.error('Error fetching room:', roomError)

                // 3.5 Fetch Tenant Info directly from bill
                const { data: tenant, error: tenantError } = await supabase
                    .from('tenants')
                    .select('name')
                    .eq('id', bill.tenant_id)
                    .single()

                if (tenantError) console.error('Error fetching tenant:', tenantError)

                // 4. Fetch Utility Info for meter readings
                let utility = null
                if (bill.utility_id) {
                    const { data: u, error: uError } = await supabase
                        .from('utilities')
                        .select('*')
                        .eq('id', bill.utility_id)
                        .single()
                    if (uError) console.error('Error fetching utilities:', uError)
                    utility = u
                }

                // 5. Fetch Dorm & Settings
                let dorm = null
                let settings = null

                if (room?.dorm_id) {
                    const [{ data: d }, { data: s }] = await Promise.all([
                        supabase.from('dorms').select('*').eq('id', room.dorm_id).single(),
                        supabase.from('dorm_settings').select('*').eq('dorm_id', room.dorm_id).single()
                    ])
                    dorm = d
                    settings = s
                }

                // 6. Build Items List
                const items: { name: string; amount: number; detail?: string }[] = [
                    { name: 'ค่าเช่าห้องพัก', amount: Number(bill.room_amount || 0) }
                ]

                // Water Logic
                const isFlatWater = settings?.water_billing_type === 'flat' ||
                    (Number(utility?.water_price || 0) > 0 && Number(utility?.water_unit || 0) === 0)

                const waterAmt = Number(utility?.water_price || 0)
                const electricAmt = Number(utility?.electric_price || 0)

                if (waterAmt > 0 || Number(utility?.water_unit || 0) > 0) {
                    items.push({
                        name: 'ค่าน้ำประปา',
                        amount: waterAmt,
                        detail: isFlatWater ? '(แบบเหมาจ่าย)' : `มิเตอร์: ${utility?.prev_water_meter || 0} → ${utility?.curr_water_meter || 0} หน่วย`
                    })
                }

                if (electricAmt > 0 || Number(utility?.electric_unit || 0) > 0) {
                    items.push({
                        name: 'ค่าไฟฟ้า',
                        amount: electricAmt,
                        detail: `มิเตอร์: ${utility?.prev_electric_meter || 0} → ${utility?.curr_electric_meter || 0} หน่วย`
                    })
                }

                if (bill.other_amount > 0) {
                    items.push({ name: 'ค่าใช้จ่ายอื่นๆ', amount: Number(bill.other_amount) })
                }

                // 7. Format Date Strings
                const billingDate = parseISO(bill.billing_month)
                const formattedMonth = format(billingDate, 'MMMM yyyy', { locale: th })
                const formattedDate = format(new Date(bill.created_at), 'd MMMM yyyy', { locale: th })
                const monthYearCode = format(billingDate, 'yyyyMM')

                const dueDate = bill.due_date ? format(parseISO(bill.due_date), 'd MMMM yyyy', { locale: th }) : '-'

                setData({
                    id: bill.id,
                    receiptId: `REC-${room?.room_number || '000'}-${monthYearCode}`,
                    date: formattedDate,
                    month: formattedMonth,
                    dueDate: dueDate,
                    dormName: dorm?.name || 'หอพัก',
                    address: dorm?.address || '-',
                    dormPhone: dorm?.contact_number || '-',
                    roomNumber: room?.room_number || '-',
                    tenantName: tenant?.name || 'ไม่ระบุชื่อ',
                    bankName: settings?.bank_name || '-',
                    bankNo: settings?.bank_account_no || '-',
                    bankAccount: settings?.bank_account_name || dorm?.name || '-',
                    items: items,
                    total: Number(bill.total_amount || 0)
                })
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [params.id])

    const handlePrint = () => {
        window.print()
    }

    const receiptRef = useRef<HTMLDivElement>(null)

    const handleSaveImage = () => {
        if (!receiptRef.current) return

        const node = receiptRef.current

        toPng(node, {
            cacheBust: true,
            pixelRatio: 2,
            width: node.offsetWidth,
            height: node.offsetHeight,
            style: { margin: '0' }
        })
            .then((dataUrl) => {
                const link = document.createElement('a')
                link.download = `Receipt-${data.roomNumber}-${data.month}.png`
                link.href = dataUrl
                link.click()
                setMessage('บันทึกรูปภาพสำเร็จ!')
                setTimeout(() => setMessage(''), 3000)
            })
            .catch((err) => {
                console.error('oops, something went wrong!', err)
            })
    }

    const handleShareLine = () => {
        if (!data) return
        const message = `📋 สรุปยอดบิลค่าเช่า ${data.month}\n🏠 ห้อง: ${data.roomNumber}\n👤 ผู้เช่า: ${data.tenantName}\n------------------\n💰 ยอดรวมทั้งสิ้น: ฿${data.total.toLocaleString()}\n------------------\n🏦 โอนเข้า: ${data.bankName}\n🔢 เลขบัญชี: ${data.bankNo}\n👤 ชื่อบัญชี: ${data.bankAccount}\n------------------\n🙏 ขอบคุณครับ/ค่ะ`
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`
        window.open(lineUrl, '_blank')
    }

    const handleUpdateStatus = async (status: 'paid' | 'unpaid') => {
        if (!data?.id || verifying) return
        setVerifying(true)
        try {
            const { error } = await supabase
                .from('bills')
                .update({
                    status,
                    paid_at: status === 'paid' ? new Date().toISOString() : null
                })
                .eq('id', data.id)

            if (error) throw error

            // 2. Update payment status if exists
            await supabase
                .from('payments')
                .update({ status: status === 'paid' ? 'approved' : 'rejected' })
                .eq('bill_id', data.id)

            setBillStatus(status)
            if (status === 'paid') {
                // Send LINE notification
                await fetch('/api/line/confirm-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ billId: data.id })
                })
            }
            setMessage(status === 'paid' ? 'ยืนยันใบเสร็จสำเร็จ!' : 'ยกเลิกการชำระเงินสำเร็จ!')
            setTimeout(() => setMessage(''), 3000)
        } catch (err: any) {
            alert(err.message)
        } finally {
            setVerifying(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100/50 sm:py-10 font-sans print:bg-white print:py-0">
            {/* ── TOP NAV (HIDDEN ON PRINT) ── */}
            <nav className="max-w-xl mx-auto px-6 mb-6 flex items-center justify-between print:hidden">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all active:scale-95"
                >
                    <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
                </button>
                <h1 className="text-lg font-black text-gray-800">Preview ใบเสร็จ</h1>
                <div className="w-10" />
            </nav>

            {/* ── RECEIPT CARD ── */}
            <ReceiptView ref={receiptRef} data={data} slipUrl={slipUrl} />

            {/* ── ACTION BUTTONS (HIDDEN ON PRINT) ── */}
            <div className="max-w-xl mx-auto px-6 mt-10 space-y-4 pb-20 print:hidden">
                {message && (
                    <div className="bg-emerald-500 text-white p-4 rounded-2xl text-center font-black animate-bounce">
                        {message}
                    </div>
                )}

                {/* Verification Section */}
                {billStatus === 'waiting_verify' && (
                    <button
                        onClick={() => handleUpdateStatus('paid')}
                        disabled={verifying}
                        className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-100 transition-all active:scale-[0.98]"
                    >
                        <CheckBadgeIcon className="w-6 h-6" />
                        {verifying ? 'กำลังบันทึก...' : 'อนุมัติ / รับเงิน'}
                    </button>
                )}

                <button
                    onClick={handleShareLine}
                    className="w-full h-16 bg-[#06C755] hover:bg-[#05b34d] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 transition-all active:scale-[0.98]"
                >
                    <ShareIcon className="w-6 h-6" />
                    แชร์ไปยัง LINE
                </button>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={handlePrint}
                        className="h-14 bg-white border border-gray-200 text-gray-700 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all active:scale-95"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        พิมพ์ใบเสร็จ
                    </button>
                    <button
                        onClick={handleSaveImage}
                        className="h-14 bg-white border border-gray-200 text-gray-700 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all active:scale-95"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5 font-black" />
                        บันทึกรูปภาพ
                    </button>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    nav, .print-hidden, button {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        padding: 0 !important;
                    }
                    .max-w-xl {
                        max-width: 100% !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </div>
    )
}
