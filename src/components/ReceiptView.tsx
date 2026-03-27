'use client'

import { forwardRef } from 'react'
import { format } from 'date-fns'

// Helper function for Thai Baht Text
export function bahtText(amount: number): string {
    const numbers = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
    const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']

    if (amount === 0) return 'ศูนย์บาทถ้วน'
    const isNegative = amount < 0

    let res = ''
    const str = Math.floor(Math.abs(amount)).toString()
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
    return `${isNegative ? 'ติดลบ' : ''}${res}บาทถ้วน`
}

interface ReceiptViewProps {
    data: {
        receiptId: string;
        date: string;
        month: string;
        dueDate: string;
        dormName: string;
        address: string;
        dormPhone: string;
        roomNumber: string;
        tenantName: string;
        bankName: string;
        bankNo: string;
        bankAccount: string;
        billType?: 'monthly' | 'move_out';
        billStatus?: 'paid' | 'waiting_verify' | 'unpaid' | 'overdue' | 'cancelled';
        items: Array<{ name: string; amount: number; detail?: string }>;
        total: number;
    };
    slipUrl?: string | null;
}

const ReceiptView = forwardRef<HTMLDivElement, ReceiptViewProps>(({ data, slipUrl }, ref) => {
    if (!data) return null;
    // Hide transfer destination fields for refund scenario:
    // - move-out bill
    // - total is negative (owner must refund tenant)
    // This should not depend on bill status because UI must never show
    // "transfer due date/bank" when refund is happening.
    const isRefundScenario =
        data.billType === 'move_out' &&
        Number(data.total || 0) < 0

    return (
        <div
            ref={ref}
            className="max-w-xl mx-auto bg-white sm:rounded-[2.5rem] shadow-2xl shadow-gray-200/50 overflow-hidden relative print:shadow-none print:rounded-none"
        >
            {/* Header: Match LINE Flex Style */}
            <div className="bg-[#10B981] p-8 text-center sm:p-10">
                <p className="text-[#ECFDF5] text-sm font-bold mb-1 opacity-90 tracking-wide">
                    {data.dormName} {data.dormPhone && `| โทร: ${data.dormPhone}`}
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                    {data.billType === 'move_out' ? `บิลปิดบัญชีห้อง ${data.roomNumber}` : `แจ้งค่าเช่าห้อง ${data.roomNumber}`}
                </h2>
            </div>

            <div className="p-6 sm:p-10">
                {/* Billing Month & ID */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100">
                    <div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">
                            {data.billType === 'move_out' ? 'วันที่ออกบิล' : 'ประจำเดือน'}
                        </p>
                        <p className="text-lg font-black text-gray-800">{data.month}</p>
                    </div>
                    <div className="sm:text-right">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">เลขที่ใบเสร็จ</p>
                        <p className="text-sm font-bold text-gray-500">{data.receiptId}</p>
                    </div>
                </div>

                {/* Tenant Name */}
                <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <span className="text-gray-500 font-bold">ชื่อผู้เช่า</span>
                    <span className="text-gray-900 font-black text-lg">{data.tenantName}</span>
                </div>

                {/* Items Breakdown */}
                <div className="space-y-4 mb-10">
                    {data.items.map((item: any, i: number) => (
                        <div key={i} className="flex flex-col border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-lg font-bold text-gray-700">{item.name}</span>
                                <span className="text-lg font-black text-gray-900">฿{(Number(item.amount) || 0).toLocaleString()}</span>
                            </div>
                            {item.detail && (
                                <p className="text-sm font-bold text-gray-400 leading-relaxed">
                                    {item.detail.replace(' - ', ' → ')}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Total Section */}
                <div className={`flex items-center justify-between mb-8 rounded-3xl p-6 border-2 ${Number(data.total) < 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div>
                        <p className={`text-xs font-black uppercase tracking-widest mb-1 ${Number(data.total) < 0 ? 'text-amber-700' : 'text-emerald-600'}`}>ยอดรวมทั้งสิ้น</p>
                        {Number(data.total) < 0 ? (
                            <>
                                <p className="text-sm font-black text-amber-700">
                                    เจ้าของหอต้องคืนเงินให้ผู้เช่า
                                </p>
                                <p className="text-sm font-bold text-amber-700 italic">
                                    {bahtText(Math.abs(Number(data.total) || 0))}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-black text-emerald-700">ผู้เช่าต้องชำระเพิ่ม</p>
                                <p className="text-sm font-bold text-emerald-600 italic">{bahtText(Number(data.total) || 0)}</p>
                            </>
                        )}
                    </div>
                    <p className={`text-4xl font-black ${Number(data.total) < 0 ? 'text-amber-600' : 'text-[#10B981]'}`}>
                        {Math.abs(Number(data.total) || 0).toLocaleString()}
                    </p>
                </div>

                {!isRefundScenario && (
                    <>
                        {/* Due Date Box: Match LINE Style */}
                        <div className="bg-[#FEF2F2] rounded-2xl p-4 mb-8 text-center border border-red-100">
                            <p className="text-[#B91C1C] font-black text-sm sm:text-base flex items-center justify-center gap-2">
                                <span>📅</span> กำหนดชำระภายในวันที่ {data.dueDate}
                            </p>
                        </div>

                        {/* Bank Details: Match LINE Style */}
                        <div className="bg-[#F9FAFB] rounded-[2rem] p-6 sm:p-8 border border-gray-100 text-center">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">ช่องทางการชำระเงิน / โอนเข้าบัญชี</p>
                            
                            <p className="text-xl font-black text-gray-800 mb-1">{data.bankName}</p>
                            <p className="text-[#10B981] text-3xl font-black tracking-wider mb-2 font-mono">{data.bankNo}</p>
                            <p className="text-gray-500 font-bold text-sm">ชื่อบัญชี: {data.bankAccount}</p>
                        </div>
                    </>
                )}

                {/* Slip Proof (Keep as is but style slightly) */}
                {slipUrl && (
                    <div className="mt-12 pt-10 border-t border-dashed border-gray-200 text-center">
                        <p className="text-xs font-black text-gray-300 uppercase tracking-[0.3em] mb-6">หลักฐานการชำระเงิน</p>
                        <div className="max-w-xs mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-gray-100">
                            <img src={slipUrl} alt="Slip" className="w-full h-auto" />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Message */}
            <div className="py-6 text-center bg-gray-50/50 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-300 italic uppercase tracking-widest">
                    Powered by HorPay - Smart Dorm Management
                </p>
            </div>
        </div>
    )
})

ReceiptView.displayName = 'ReceiptView'

export default ReceiptView
