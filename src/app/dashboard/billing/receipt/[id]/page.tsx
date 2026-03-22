'use client'

import { useState, useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import {
    ChevronLeftIcon,
    PrinterIcon,
    ShareIcon,
    ArrowDownTrayIcon,
    CheckBadgeIcon,
    ArrowPathIcon
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
    const [message, setMessage] = useState('')

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

                // 2. Fetch Room & Tenant Info
                const { data: room } = await supabase
                    .from('rooms')
                    .select(`
                        room_number,
                        dorm_id,
                        tenants:lease_contracts(
                            tenant_name,
                            status
                        )
                    `)
                    .eq('id', bill.room_id)
                    .single()

                const activeTenant = (room?.tenants as any[])?.find((t: any) => t.status === 'active') || 
                                    (room?.tenants as any[])?.find((t: any) => t)

                // 3. Fetch Utility Info for meter readings
                let utility = null
                if (bill.utility_id) {
                    const { data: u } = await supabase
                        .from('utilities')
                        .select('*')
                        .eq('id', bill.utility_id)
                        .single()
                    utility = u
                }

                // 4. Fetch Dorm & Settings
                const { data: dorm } = await supabase
                    .from('dorms')
                    .select('*')
                    .eq('id', room?.dorm_id)
                    .single()

                const { data: settings } = await supabase
                    .from('dorm_settings')
                    .select('*')
                    .eq('dorm_id', room?.dorm_id)
                    .single()

                // 5. Prepare Receipt Items
                const items = [
                    { name: 'ค่าเช่าห้องพัก', amount: Number(bill.rent_amount || 0), detail: 'รายเดือน' }
                ]

                if (Number(bill.water_amount || 0) > 0) {
                    const units = utility ? (utility.water_unit - utility.prev_water_unit) : 0
                    items.push({ 
                        name: 'ค่าน้ำประปา', 
                        amount: Number(bill.water_amount || 0), 
                        detail: `มิเตอร์: ${utility?.prev_water_unit || 0} - ${utility?.water_unit || 0} (${units} หน่วย)` 
                    })
                }

                if (Number(bill.electric_amount || 0) > 0) {
                    const units = utility ? (utility.electric_unit - utility.prev_electric_unit) : 0
                    items.push({ 
                        name: 'ค่าไฟฟ้า', 
                        amount: Number(bill.electric_amount || 0), 
                        detail: `มิเตอร์: ${utility?.prev_electric_unit || 0} - ${utility?.electric_unit || 0} (${units} หน่วย)` 
                    })
                }

                if (Number(bill.other_amount || 0) > 0) {
                    items.push({ name: 'ค่าใช้จ่ายอื่นๆ', amount: Number(bill.other_amount || 0), detail: 'เพิ่มเติม' })
                }

                // 6. Format Date Strings
                const billingDate = parseISO(bill.billing_month)
                const formattedMonth = format(billingDate, 'MMMM yyyy', { locale: th })
                const formattedDate = format(new Date(bill.created_at), 'd MMMM yyyy', { locale: th })
                
                const dueDate = bill.due_date ? format(parseISO(bill.due_date), 'd MMMM yyyy', { locale: th }) : '-'

                setData({
                    receiptId: `REC-${bill.id.slice(0, 8).toUpperCase()}`,
                    date: formattedDate,
                    month: formattedMonth,
                    dueDate: dueDate,
                    dormName: dorm?.name || 'หอพัก',
                    address: dorm?.address || '-',
                    dormPhone: dorm?.contact_number || '-',
                    roomNumber: room?.room_number || '-',
                    tenantName: activeTenant?.tenant_name || 'ไม่ระบุชื่อ',
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
            <div
                ref={receiptRef}
                className="max-w-xl mx-auto bg-white sm:rounded-[2.5rem] shadow-2xl shadow-gray-200/50 overflow-hidden relative print:shadow-none print:rounded-none"
            >

                {/* Decoration Circles (Ticket Style) */}
                <div className="absolute top-1/2 -left-4 w-8 h-8 bg-gray-100/50 rounded-full z-10 print:hidden" />
                <div className="absolute top-1/2 -right-4 w-8 h-8 bg-gray-100/50 rounded-full z-10 print:hidden" />

                <div className="p-6 sm:p-8">
                    <div className="text-center mb-10 pt-0">
                        <h2 className="text-2xl font-black text-gray-900 leading-tight mb-1">{data.dormName}</h2>
                        <p className="text-[13px] text-gray-600 font-extrabold max-w-[340px] mx-auto leading-relaxed mb-4">
                            {data.address} {data.dormPhone && `| โทร: ${data.dormPhone}`}
                        </p>
                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                            <span className="text-base font-black text-emerald-600">ใบเสร็จประจำเดือน</span>
                            <span className="text-base font-black text-emerald-600">{data.month}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-dashed border-gray-100">
                        <div>
                            <p className="text-[12px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1.5">เลขที่ใบเสร็จ</p>
                            <p className="text-base font-black text-gray-800 leading-none">{data.receiptId}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[12px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1.5">วันที่ออกบิล</p>
                            <p className="text-base font-black text-gray-800 leading-none">{data.date}</p>
                        </div>
                    </div>

                    {/* Compact Info Grid: Enlarged Typography */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 font-black text-base shadow-sm ring-1 ring-gray-100/50 flex-shrink-0">#</div>
                            <div>
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest italic leading-none mb-1">ห้องพัก</p>
                                <p className="text-xl font-black text-gray-800 leading-none">{data.roomNumber}</p>
                            </div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 font-black text-base shadow-sm ring-1 ring-gray-100/50 flex-shrink-0">👤</div>
                            <div className="truncate">
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest italic leading-none mb-1">ผู้เช่า</p>
                                <p className="text-lg font-black text-gray-800 truncate leading-none">{data.tenantName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Table: Larger Typography for Details */}
                    <div className="space-y-2 mb-4 bg-gray-50/50 rounded-3xl p-4 border border-gray-100/50">
                        {data.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between items-center py-0.5">
                                <div>
                                    <p className="text-[15px] font-black text-gray-800">{item.name}</p>
                                    {item.detail && <p className="text-[12px] font-bold text-gray-400 mt-0.5">{item.detail}</p>}
                                </div>
                                <p className="text-[15px] font-black text-gray-900">฿{(Number(item.amount) || 0).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>

                    {/* Total: Highly Visible and Large */}
                    <div className="bg-emerald-500 rounded-2xl p-4 mb-4 text-white shadow-xl shadow-emerald-100 flex items-center justify-between">
                        <div>
                            <p className="text-[12px] font-black text-emerald-100 uppercase tracking-widest mb-1">ยอดรวมสุทธิ</p>
                            <p className="text-sm font-bold leading-tight italic opacity-95">{bahtText(Number(data.total) || 0)}</p>
                        </div>
                        <p className="text-3xl font-black">฿{(Number(data.total) || 0).toLocaleString()}</p>
                    </div>

                    {/* RESTACKED PAYMENT INFO: OWNER NAME FOCUS */}
                    <div className="bg-emerald-50/50 rounded-[2rem] p-4 border border-emerald-100 flex flex-col items-center">
                        <p className="text-[12px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">ช่องทางการชำระเงิน / โอนเข้าบัญชี</p>

                        <div className="text-center mb-4">
                            <p className="text-2xl font-black text-emerald-600 uppercase tracking-widest leading-tight mb-2">{data.bankName}</p>
                            <h3 className="text-xl font-black text-emerald-600 tracking-tight leading-none">ชื่อบัญชี : {data.bankAccount}</h3>
                        </div>

                        <div className="w-full bg-white rounded-2xl p-4 border border-emerald-100 flex flex-col items-center shadow-sm">
                            <p className="text-2xl font-black text-emerald-600 tracking-widest sm:text-3xl font-mono leading-none py-1">
                                {data.bankNo}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Message: Integrated with padding */}
                <div className="bg-gray-50/50 p-4 text-center border-t border-gray-100">
                    <p className="text-lg text-red-500 underline underline-offset-4 decoration-red-500">
                        กรุณาชำระเงินภายในวันที่ <span className="text-lg text-red-500 underline underline-offset-4 decoration-red-500">{data.dueDate}</span>
                    </p>
                    <p className="text-[10px] font-bold text-gray-300 italic uppercase">Powered by HorPay - Smart Dorm Management</p>
                </div>
            </div>

            {/* ── ACTION BUTTONS (HIDDEN ON PRINT) ── */}
            <div className="max-w-xl mx-auto px-6 mt-10 grid grid-cols-2 gap-4 pb-20 print:hidden">
                <button
                    onClick={handleShareLine}
                    className="col-span-2 h-16 bg-[#06C755] hover:bg-[#05b34d] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-green-100 transition-all active:scale-[0.98]"
                >
                    <ShareIcon className="w-6 h-6" />
                    แชร์ไปยัง LINE
                </button>
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
