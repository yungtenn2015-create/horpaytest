import { Suspense } from 'react'
import HelpClient from './HelpClient'

export const dynamic = 'force-dynamic'

export default function HelpPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">กำลังโหลด...</p>
                </div>
            }
        >
            <HelpClient />
        </Suspense>
    )
}
