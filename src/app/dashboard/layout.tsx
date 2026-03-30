'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    HomeIcon,
    Squares2X2Icon,
    DocumentTextIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline'
import {
    HomeIcon as HomeIconSolid,
    Squares2X2Icon as Squares2X2IconSolid,
    DocumentTextIcon as DocumentTextIconSolid,
    ChartBarIcon as ChartBarIconSolid
} from '@heroicons/react/24/solid'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Determine current active tab
    // 1. If we are on /dashboard with a ?tab parameter
    // 2. If we are on a specific sub-page that matches a tab
    const currentTab = searchParams.get('tab') || (pathname === '/dashboard' ? 'overview' : '')

    const navItems = [
        { id: 'overview', name: 'หน้าหลัก', icon: HomeIcon, solidIcon: HomeIconSolid, path: '/dashboard?tab=overview' },
        { id: 'stats', name: 'ภาพรวม', icon: ChartBarIcon, solidIcon: ChartBarIconSolid, path: '/dashboard?tab=stats' },
        { id: 'rooms', name: 'สถานะห้อง', icon: Squares2X2Icon, solidIcon: Squares2X2IconSolid, path: '/dashboard?tab=rooms' },
        { id: 'tenants', name: 'บันทึกสัญญา', icon: DocumentTextIcon, solidIcon: DocumentTextIconSolid, path: '/dashboard?tab=tenants' },
    ]

    const handleNavClick = (path: string) => {
        router.push(path)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Identify if the current path/tab matches one of our nav items
    const activeId = navItems.find(item => {
        if (item.id === 'overview' && pathname === '/dashboard' && (!searchParams.get('tab') || searchParams.get('tab') === 'overview')) return true
        if (currentTab === item.id) return true
        return false
    })?.id || (pathname.startsWith('/dashboard') ? 'overview' : '')
    // Fallback to 'overview' for all sub-pages under /dashboard/

    return (
        <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#fcfdfd]">
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-24">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[92px] bg-white border-t border-gray-100 flex items-center justify-around px-6 z-[100] rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.06)]">
                {navItems.map((item) => {
                    const isActive = activeId === item.id
                    const Icon = isActive ? item.solidIcon : item.icon
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item.path)}
                            className={`flex flex-col items-center gap-2 transition-all duration-300 ${isActive ? 'text-green-600' : 'text-slate-500'}`}
                        >
                            <div className={`p-2.5 rounded-2xl transition-all ${isActive ? 'bg-green-50 shadow-sm' : 'bg-transparent'}`}>
                                <Icon className="w-7 h-7" />
                            </div>
                            <span className={`text-[12px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-90'}`}>
                                {item.name}
                            </span>
                        </button>
                    )
                })}
            </nav>
        </div>
    )
}
