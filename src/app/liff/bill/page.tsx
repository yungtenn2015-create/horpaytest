'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { formatMeterScheduleLine } from '@/lib/meter-schedule'
import ReceiptView from '@/src/components/ReceiptView'
import {
    PhotoIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    CloudArrowUpIcon
} from '@heroicons/react/24/outline'

function LIFFBillContent() {
    const searchParams = useSearchParams()
    const billId = searchParams.get('billId')
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [billStatus, setBillStatus] = useState<string>('')
    const [error, setError] = useState<string | null>(null)

    // Upload State
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            if (!billId) {
                setError('กรุณาระบุรหัสใบแจ้งหนี้ (Bill ID)')
                setLoading(false)
                return
            }

            setLoading(true)
            try {
                // 1. Fetch Bill
                const { data: bill, error: billError } = await supabase
                    .from('bills')
                    .select('*')
                    .eq('id', billId)
                    .single()

                if (billError || !bill) {
                    setError('ไม่พบข้อมูลใบแจ้งหนี้')
                    return
                }
                setBillStatus(bill.status)

                // 2. Fetch Room Info
                const { data: room } = await supabase
                    .from('rooms')
                    .select('room_number, dorm_id')
                    .eq('id', bill.room_id)
                    .single()

                // 3. Fetch Tenant Info
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('name')
                    .eq('id', bill.tenant_id)
                    .single()

                // 4. Fetch Utility Info
                let utility = null
                if (bill.utility_id) {
                    const { data: u } = await supabase
                        .from('utilities')
                        .select('*')
                        .eq('id', bill.utility_id)
                        .single()
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

                const isFlatWater = settings?.water_billing_type === 'flat' ||
                    (Number(bill.water_amount) > 0 && Number(utility?.water_unit || 0) === 0)

                if (bill.water_amount > 0) {
                    items.push({
                        name: 'ค่าน้ำประปา11',
                        amount: Number(bill.water_amount),
                        detail: isFlatWater ? '(แบบเหมาจ่าย)' : `มิเตอร์: ${utility?.prev_water_meter || 0} - ${utility?.curr_water_meter || 0} (${utility?.water_unit || 0} หน่วย)`
                    })
                }

                if (bill.electric_amount > 0) {
                    items.push({
                        name: 'ค่าไฟฟ้า',
                        amount: Number(bill.electric_amount),
                        detail: `มิเตอร์: ${utility?.prev_electric_meter || 0} - ${utility?.curr_electric_meter || 0} (${utility?.electric_unit || 0} หน่วย)`
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
                const billTypeCode = bill.bill_type === 'move_out' ? 'MOV' : 'MON'
                const billCode = String(bill.id || '').replace(/-/g, '').slice(-6).toUpperCase()
                const dueDate = bill.due_date ? format(parseISO(bill.due_date), 'd MMMM yyyy', { locale: th }) : '-'
                const meterScheduleLine = formatMeterScheduleLine(settings?.billing_day)

                setData({
                    receiptId: `REC-${billTypeCode}-${room?.room_number || '000'}-${monthYearCode}-${billCode}`,
                    date: formattedDate,
                    month: formattedMonth,
                    dueDate: dueDate,
                    dormName: dorm?.name || 'หอพัก',
                    address: dorm?.address || '-',
                    dormPhone: dorm?.contact_number || '-',
                    roomNumber: room?.room_number || '-',
                    tenantName: tenant?.name || 'ผู้เช่าพัก',
                    bankName: settings?.bank_name || '-',
                    bankNo: settings?.bank_account_no || '-',
                    bankAccount: settings?.bank_account_name || dorm?.name || '-',
                    billType: bill.bill_type === 'move_out' ? 'move_out' : 'monthly',
                    billStatus: bill.status,
                    ...(meterScheduleLine ? { meterScheduleLine } : {}),
                    items: items,
                    total: Number(bill.total_amount || 0)
                })
            } catch (err: any) {
                console.error(err)
                setError('เกิดข้อผิดพลาดในการโหลดข้อมูล')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [billId])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            setFile(selected)
            const reader = new FileReader()
            reader.onloadend = () => setPreview(reader.result as string)
            reader.readAsDataURL(selected)
        }
    }

    const handleSubmit = async () => {
        if (!file || !billId || !data) return
        setUploading(true)

        try {
            // 1. Upload to Supabase Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${billId}/${Date.now()}.${fileExt}`
            const filePath = `slips/${fileName}`

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('slips')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('slips')
                .getPublicUrl(fileName)

            // 2. Insert into Payments
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    bill_id: billId,
                    amount: data.total,
                    method: 'transfer',
                    slip_url: publicUrl,
                    status: 'pending'
                })

            if (paymentError) throw paymentError

            // 3. Update Bill Status
            const { error: billError } = await supabase
                .from('bills')
                .update({ status: 'waiting_verify' })
                .eq('id', billId)

            if (billError) throw billError

            setSubmitted(true)
            setBillStatus('waiting_verify')
        } catch (err: any) {
            console.error(err)
            alert('เกิดข้อผิดพลาดในการส่งหลักฐาน: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
                <p className="text-gray-400 font-bold animate-pulse">กำลังโหลดข้อมูลบิล...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
                    <CloudArrowUpIcon className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-black text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
                <p className="text-gray-500 font-bold mb-6">{error}</p>

                <div className="mb-6 p-4 bg-gray-100 rounded-lg text-[10px] text-gray-400 font-mono break-all text-left">
                    <p>DEBUG INFO:</p>
                    <p>URL: {typeof window !== 'undefined' ? window.location.href : 'loading...'}</p>
                </div>

                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-gray-800 text-white rounded-xl font-black">ลองใหม่อีกครั้ง</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100/50 pb-20">
            {/* ── RECEIPT VIEW ── */}
            <div className="pt-6 sm:pt-10">
                <ReceiptView data={data} />
            </div>

            {/* ── PAYMENT FORM ── */}
            <div className="max-w-xl mx-auto px-6 mt-8">
                {submitted || billStatus === 'waiting_verify' ? (
                    <div className="bg-emerald-500 rounded-[2.5rem] p-8 text-white text-center shadow-xl shadow-emerald-100 animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircleIcon className="w-12 h-12 text-white" />
                        </div>
                        <h3 className="text-2xl font-black mb-2">ส่งหลักฐานสำเร็จ!</h3>
                        <p className="text-emerald-50 font-bold leading-relaxed">
                            ระบบบันทึกการแจ้งชำระเงินเรียบร้อยแล้ว<br />
                            เจ้าหน้าที่จะดำเนินการตรวจสอบในลำดับถัดไปครับ
                        </p>
                    </div>
                ) : billStatus === 'paid' ? (
                    <div className="bg-emerald-50 rounded-[2.5rem] p-8 text-center border-2 border-emerald-100">
                        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircleIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-emerald-600 mb-1">ชำระเงินเรียบร้อยแล้ว</h3>
                        <p className="text-gray-400 font-bold text-sm">ขอบคุณที่ใช้บริการครับ</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                <PhotoIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-black text-gray-800">แจ้งหลักฐานการโอน</h3>
                        </div>

                        {!preview ? (
                            <label className="block w-full cursor-pointer group">
                                <div className="w-full aspect-video border-4 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center gap-3 group-hover:bg-gray-50 group-hover:border-emerald-200 transition-all">
                                    <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                                        <CloudArrowUpIcon className="w-6 h-6" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-black text-gray-400 group-hover:text-emerald-600">กดเพื่อแนบรูปสลิป</p>
                                        <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mt-1">Supports: JPG, PNG</p>
                                    </div>
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            </label>
                        ) : (
                            <div className="space-y-6">
                                <div className="relative aspect-[3/4] max-h-[400px] mx-auto rounded-3xl overflow-hidden shadow-lg border-2 border-emerald-100">
                                    <img src={preview} alt="Slip Preview" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => { setFile(null); setPreview(null) }}
                                        className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur shadow-lg rounded-full flex items-center justify-center text-red-500 hover:bg-red-50"
                                    >
                                        <ArrowPathIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={uploading}
                                    className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <>
                                            <ArrowPathIcon className="w-6 h-6 animate-spin" />
                                            กำลังส่งข้อมูล...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon className="w-6 h-6" />
                                            ยืนยันการชำระเงิน
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="text-center mt-10 text-[10px] font-bold text-gray-300 italic uppercase">Powered by HorPay Technology</p>
        </div>
    )
}

export default function LIFFBillPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        }>
            <LIFFBillContent />
        </Suspense>
    )
}
