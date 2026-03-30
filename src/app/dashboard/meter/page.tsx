import { Suspense } from 'react'
import MeterClient from './MeterClient'

export const dynamic = 'force-dynamic'

export default function MeterReadingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#fcfdfd] flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-black text-emerald-600 animate-pulse uppercase tracking-widest">กำลังโหลดข้อมูลมิเตอร์...</p>
            </div>
        }>
            <MeterClient />
        </Suspense>
    )
}
