'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { HorpayHouseMark } from '@/src/components/HorpayHouseMark'

type DashboardMenuPageChromeProps = {
    title: string
    subtitle?: React.ReactNode
    headerRight?: React.ReactNode
    children: React.ReactNode
    /** ฝังในแดชบอร์ด — ไม่ครอบ min-h-screen / max-w-lg ชั้นนอกซ้ำ */
    embedded?: boolean
    /** ปุ่มกลับ — ค่าเริ่มต้น `router.push('/dashboard')` */
    onBack?: () => void
}

/**
 * Shell สำหรับหน้าเมนูหลัก (มิเตอร์ / บิล / ประวัติ / ผู้เช่า / เพิ่มผู้เช่า / ย้ายออก / ตั้งค่า)
 * พื้นหลัง #fcfdfd + header เขียวโทนเดียวกับแท็บ Overview
 */
export function DashboardMenuPageChrome({
    title,
    subtitle,
    headerRight,
    children,
    embedded = false,
    onBack,
}: DashboardMenuPageChromeProps) {
    const router = useRouter()
    const handleBack = onBack ?? (() => router.push('/dashboard'))

    const header = (
        <div className="relative z-30 shrink-0">
            <div className="absolute inset-0 bg-primary rounded-b-[2.5rem] shadow-lg overflow-hidden -z-10">
                <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse duration-[4000ms]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-56 h-56 bg-white/5 rounded-full blur-2xl" />
            </div>
            <div className="relative z-10 pt-8 pb-8 px-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="w-10 h-10 shrink-0 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white backdrop-blur-md border border-white/20 shadow-sm transition-all active:scale-95"
                            aria-label="กลับ"
                        >
                            <ArrowLeftIcon className="w-5 h-5 stroke-[3]" />
                        </button>
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                                <HorpayHouseMark className="h-full w-full" />
                            </div>
                            <div className="min-w-0 leading-tight">
                                <p className="text-base font-bold text-white tracking-tight truncate">HORPAY</p>
                                <p className="text-[9px] font-medium text-white/70 truncate">ระบบจัดการหอพัก</p>
                            </div>
                        </div>
                    </div>
                    {headerRight ? (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{headerRight}</div>
                    ) : null}
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-headline font-black text-white tracking-tight drop-shadow-sm">
                        {title}
                    </h1>
                    {subtitle ? (
                        <div className="text-white/85 text-xs font-bold mt-1.5">{subtitle}</div>
                    ) : null}
                </div>
            </div>
        </div>
    )

    if (embedded) {
        return (
            <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#fcfdfd]">
                {header}
                <div
                    className="h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {children}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#fcfdfd] sm:flex sm:items-center sm:justify-center sm:py-8 font-body text-slate-800 antialiased">
            <div className="w-full sm:max-w-lg bg-[#fcfdfd] min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative border-gray-100 sm:border">
                {header}
                {children}
            </div>
        </div>
    )
}
