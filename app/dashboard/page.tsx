'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

// Assuming these icons are imported from a library like @heroicons/react/24/outline
import {
    BellIcon,
    Squares2X2Icon,
    HomeIcon,
    UserGroupIcon,
    DocumentTextIcon,
    PlusIcon,
    Cog6ToothIcon,
} from '@heroicons/react/24/outline'

// Define types for better readability and type safety
interface Dorm {
    id: string;
    name: string;
    owner_id: string;
    // Add other dorm properties if they exist
}

interface Room {
    id: string;
    room_number: string;
    status: 'available' | 'occupied';
    floor: number;
    base_price: number;
    dorm_id: string;
    // Add other room properties if they exist
}

export default function DashboardPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)
    const [dorm, setDorm] = useState<Dorm | null>(null)
    const [rooms, setRooms] = useState<Room[]>([])
    const [userInitial, setUserInitial] = useState('O')
    const [userName, setUserName] = useState('')
    const [stats, setStats] = useState({
        total: 0,
        occupied: 0,
        vacant: 0,
        pendingPayments: 0
    })

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Owner'
            setUserName(name)
            setUserInitial(name.charAt(0).toUpperCase())

            // 1. Get Dorm
            const { data: dormsData } = await supabase
                .from('dorms')
                .select('*')
                .eq('owner_id', user.id)
                .limit(1)

            if (dormsData && dormsData.length > 0) {
                setDorm(dormsData[0])

                // 2. Get Rooms
                const { data: roomsData } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('dorm_id', dormsData[0].id)
                    .order('room_number', { ascending: true })

                if (roomsData) {
                    setRooms(roomsData)
                    setStats({
                        total: roomsData.length,
                        occupied: roomsData.filter(r => r.status === 'occupied').length,
                        vacant: roomsData.filter(r => r.status === 'available').length,
                        pendingPayments: 0
                    })
                }
            } else {
                router.push('/setup-dorm')
            }
            setLoading(false)
        }

        fetchData()
    }, [router])

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    const navItems = [
        { id: 'overview', name: 'หน้าหลัก', icon: HomeIcon },
        { id: 'rooms', name: 'จัดการห้อง', icon: Squares2X2Icon },
        { id: 'billing', name: 'มิเตอร์/บิล', icon: DocumentTextIcon },
        { id: 'tenants', name: 'ผู้เช่า', icon: UserGroupIcon },
        { id: 'settings', name: 'ตั้งค่า', icon: Cog6ToothIcon },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-full max-w-xl bg-white min-h-[640px] rounded-3xl shadow-xl flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold animate-pulse uppercase tracking-widest text-xs">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:p-4">
            <div className="w-full sm:max-w-xl bg-white min-h-screen sm:min-h-[720px] sm:rounded-[3rem] sm:shadow-2xl overflow-hidden flex flex-col relative">

                {/* ── Header (Mobile App Style) ── */}
                <header className="bg-white/70 backdrop-blur-xl sticky top-0 z-40 border-b border-gray-100 px-6 py-5 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <h2 className="font-black text-gray-800 tracking-tight leading-none text-lg">{dorm?.name || 'My Dorm'}</h2>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-none pl-3">OWNER CONSOLE</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="relative p-2.5 bg-gray-50/50 hover:bg-white rounded-xl text-gray-400 border border-transparent hover:border-green-100 transition-all active:scale-95">
                            <BellIcon className="w-6 h-6" />
                            <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                        </button>
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-green-100 active:rotate-3 transition-transform cursor-pointer" onClick={handleLogout}>
                            {userInitial}
                        </div>
                    </div>
                </header>

                {/* ── Main Content Scroll Area ── */}
                <main className="flex-1 overflow-y-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 custom-scrollbar">
                    <div className="p-6 space-y-8">

                        {activeTab === 'overview' && (
                            <>
                                {/* Stats Grid (Mobile Friendly) */}
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'ห้องทั้งหมด', value: stats.total, color: 'from-blue-500 to-blue-600', icon: Squares2X2Icon },
                                        { label: 'ว่างอยู่', value: stats.vacant, color: 'from-green-500 to-green-600', icon: HomeIcon },
                                        { label: 'มีผู้เช่า', value: stats.occupied, color: 'from-orange-500 to-orange-600', icon: UserGroupIcon },
                                        { label: 'รอยืนยันบิล', value: stats.pendingPayments, color: 'from-purple-500 to-purple-600', icon: BellIcon },
                                    ].map((item, i) => (
                                        <div key={i} className="bg-white p-5 rounded-[2.2rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all active:scale-95 duration-300">
                                            <div className={`absolute -right-4 -top-4 w-16 h-16 bg-gradient-to-br ${item.color} opacity-[0.05] rounded-full group-hover:scale-125 transition-transform duration-500`} />
                                            <div className="flex flex-col gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white transition-colors">
                                                    <item.icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                                                    <h3 className="text-2xl font-black text-gray-800 leading-none">{item.value}</h3>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Quick Actions Menu (Horizontal) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-4 bg-green-500 rounded-full" />
                                            <h3 className="font-black text-gray-800 tracking-tight">ใช้งานด่วน</h3>
                                        </div>
                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">เปิดใช้ฟีเจอร์แล้ว</span>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                                        {[
                                            { name: 'จดมิเตอร์', icon: DocumentTextIcon, color: 'bg-blue-50 text-blue-600' },
                                            { name: 'เพิ่มคนเช่า', icon: UserGroupIcon, color: 'bg-green-50 text-green-600' },
                                            { name: 'ประกาศ', icon: BellIcon, color: 'bg-purple-50 text-purple-600' },
                                            { name: 'การเบิกจ่าย', icon: Squares2X2Icon, color: 'bg-orange-50 text-orange-600' },
                                        ].map((act, i) => (
                                            <button key={i} className="flex flex-col items-center gap-2 shrink-0 group">
                                                <div className={`w-14 h-14 rounded-2xl ${act.color} flex items-center justify-center shadow-sm group-active:scale-90 transition-all border border-transparent active:border-current`}>
                                                    <act.icon className="w-7 h-7" />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{act.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Room Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-4 bg-green-500 rounded-full" />
                                            <h3 className="font-black text-gray-800 tracking-tight">สถานะห้องพัก</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="p-2.5 bg-green-600 text-white rounded-xl shadow-lg shadow-green-100 active:scale-95 transition-all">
                                                <PlusIcon className="w-5 h-5 stroke-[3]" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {rooms.map((room) => (
                                            <button
                                                key={room.id}
                                                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-200 active:scale-[0.98] transition-all duration-300 text-center relative overflow-hidden group"
                                            >
                                                <div className={`absolute top-0 left-0 w-full h-1.5 ${room.status === 'available' ? 'bg-green-500' : 'bg-blue-500'} group-hover:h-3 transition-all`} />
                                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-1">FLOOR {room.floor}</span>
                                                <h4 className="text-2xl font-black text-gray-800 tracking-tighter mb-1.5">{room.room_number}</h4>
                                                <div className="flex flex-col items-center gap-2 pt-1">
                                                    <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${room.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {room.status === 'available' ? 'ว่าง' : 'มีคนเช่า'}
                                                    </div>
                                                    <div className="flex items-center gap-1 font-black text-gray-600">
                                                        <span className="text-xs">฿</span>
                                                        <span className="text-sm">{room.base_price.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab !== 'overview' && (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                                    <Squares2X2Icon className="w-10 h-10" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest">SOON</h3>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">กำลังเตรียมระบบ {navItems.find(n => n.id === activeTab)?.name} ครับ</p>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* ── Mobile App Navigation Bar (Always Visible) ── */}
                <nav className="absolute bottom-6 left-6 right-6 bg-white/80 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] shadow-2xl z-50 px-6 py-4 flex items-center justify-between">
                    {navItems.slice(0, 4).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'text-green-600 scale-110' : 'text-gray-400'}`}
                        >
                            <item.icon className="w-7 h-7 stroke-[2]" />
                            <span className="text-[8px] font-black uppercase tracking-widest">{item.name}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-green-600 scale-110' : 'text-gray-400'}`}
                    >
                        <Cog6ToothIcon className="w-7 h-7 stroke-[2]" />
                        <span className="text-[8px] font-black uppercase tracking-widest">ตั้งค่า</span>
                    </button>
                </nav>
            </div>
        </div>
    )
}
