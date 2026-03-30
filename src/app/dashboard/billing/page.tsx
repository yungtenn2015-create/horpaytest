import { Suspense } from 'react'
import BillingClient from './BillingClient'

export const dynamic = 'force-dynamic'

export default function BillingPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        }>
            <BillingClient />
        </Suspense>
    )
}
