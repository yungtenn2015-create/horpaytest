import { Suspense } from 'react'
import HistoryClient from './HistoryClient'

export const dynamic = 'force-dynamic'

export default function HistoryPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#fcfdfd] flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-black text-gray-400 animate-pulse uppercase tracking-widest">กำลังเตรียมข้อมูลประวัติ...</p>
            </div>
        }>
            <HistoryClient />
        </Suspense>
    )
}
