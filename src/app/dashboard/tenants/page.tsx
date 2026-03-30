import { Suspense } from 'react'
import TenantsClient from './TenantsClient'

export const dynamic = 'force-dynamic'

export default function TenantsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#fcfdfd] flex items-center justify-center p-6">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        }>
            <TenantsClient />
        </Suspense>
    )
}
