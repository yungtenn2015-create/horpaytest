'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowTopRightOnSquareIcon,
    DocumentTextIcon,
    UserPlusIcon,
    BoltIcon,
    BanknotesIcon,
    ArrowRightOnRectangleIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase-client'
import { DashboardMenuPageChrome } from '@/src/components/dashboard/DashboardMenuPageChrome'

const GUIDE_TOPICS: {
    title: string
    description: string
    icon: ComponentType<{ className?: string }>
}[] = [
    {
        title: 'การบันทึกสัญญา',
        description: 'บันทึกข้อมูลสัญญาของผู้เช่า ',
        icon: DocumentTextIcon,
    },
    {
        title: 'การเพิ่มผู้เข้าพัก',
        description: 'ลงทะเบียนผู้เช่าใหม่ดึงข้อมูลมาจากบันทึกสัญญา',
        icon: UserPlusIcon,
    },
    {
        title: 'การจดมิเตอร์',
        description: 'บันทึกเลขมิเตอร์น้ำ–ไฟตามรอบเพื่อคำนวณค่าใช้จ่าย',
        icon: BoltIcon,
    },
    {
        title: 'การออกบิล',
        description: 'สร้างและตรวจสอบบิลค่าเช่าในแต่ละเดือน',
        icon: BanknotesIcon,
    },
    {
        title: 'การแจ้งออก / ย้ายออก',
        description: 'แจ้งย้ายออก ปิดสัญญา และบิลสรุปเมื่อผู้เช่าออก หรือย้ายห้อง',
        icon: ArrowRightOnRectangleIcon,
    },
    {
        title: 'การเชื่อมต่อการแจ้งเตือนจาก LINE OA',
        description: 'ตั้งค่า LINE Official Account ให้ส่งแจ้งเตือนค่าห้องถึงผู้เช่า',
        icon: ChatBubbleLeftRightIcon,
    },
]

export default function HelpClient() {
    const router = useRouter()
    const [authChecked, setAuthChecked] = useState(false)
    const guideUrl = (process.env.NEXT_PUBLIC_HELP_GUIDE_URL ?? '').trim()

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!cancelled && !user) {
                router.replace('/login')
                return
            }
            if (!cancelled) setAuthChecked(true)
        })()
        return () => {
            cancelled = true
        }
    }, [router])

    if (!authChecked) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">กำลังโหลด...</p>
            </div>
        )
    }

    return (
        <DashboardMenuPageChrome
            title="คู่มือการใช้งาน"
            subtitle="สรุปหัวข้อหลัก — รายละเอียดและภาพประกอบอยู่ในคู่มือฉบับเต็ม"
        >
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pb-28">
                <div className="px-5 pt-5 pb-4">
                    {guideUrl ? (
                        <a
                            href={guideUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary px-5 py-4 text-white font-black text-sm shadow-lg shadow-emerald-900/15 hover:brightness-105 active:scale-[0.99] transition-all"
                        >
                            <span>เปิดคู่มือฉบับเต็ม (PDF)</span>
                            <ArrowTopRightOnSquareIcon className="w-5 h-5 shrink-0 stroke-[2.5]" />
                        </a>
                    ) : (
                        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-4 text-center">
                            <p className="text-xs font-bold text-emerald-800 leading-relaxed">
                                ยังไม่ได้ตั้งค่าลิงก์คู่มือ — ใส่{' '}
                                <code className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-emerald-900">
                                    NEXT_PUBLIC_HELP_GUIDE_URL
                                </code>{' '}
                                ในไฟล์สภาพแวดล้อม (เช่น .env.local) แล้ว build ใหม่
                            </p>
                        </div>
                    )}
                </div>

                <div className="px-5 pb-6 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">
                        หัวข้อในคู่มือ
                    </p>
                    <ol className="space-y-2.5">
                        {GUIDE_TOPICS.map((topic, index) => {
                            const Icon = topic.icon
                            return (
                                <li
                                    key={topic.title}
                                    className="flex gap-3.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-primary font-black text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1 pt-0.5">
                                        <div className="flex items-start gap-2">
                                            <Icon className="w-5 h-5 shrink-0 text-emerald-600 stroke-[2] mt-0.5" />
                                            <div>
                                                <p className="font-black text-slate-800 text-[15px] leading-snug">
                                                    {topic.title}
                                                </p>
                                                <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">
                                                    {topic.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                </div>
            </div>
        </DashboardMenuPageChrome>
    )
}
