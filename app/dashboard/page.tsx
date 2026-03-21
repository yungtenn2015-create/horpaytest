'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import {
    BellIcon,
    Squares2X2Icon,
    HomeIcon,
    UserGroupIcon,
    DocumentTextIcon,
    PlusIcon,
    Cog6ToothIcon,
    DocumentPlusIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline'

import {
    HomeIcon as HomeIconSolid,
    Squares2X2Icon as Squares2X2IconSolid,
    DocumentTextIcon as DocumentTextIconSolid,
    UserGroupIcon as UserGroupIconSolid,
    Cog6ToothIcon as Cog6ToothIconSolid
} from '@heroicons/react/24/solid'

// Define types for better readability and type safety
interface Dorm {
    id: string;
    name: string;
    owner_id: string;
}

interface Room {
    id: string;
    room_number: string;
    status: 'available' | 'occupied';
    floor: number;
    base_price: number;
    dorm_id: string;
}

export default function DashboardPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('overview')
    const [loading, setLoading] = useState(true)
    const [dorm, setDorm] = useState<Dorm | null>(null)
    const [rooms, setRooms] = useState<Room[]>([])
    const [userInitial, setUserInitial] = useState('O')
    const [userName, setUserName] = useState('')
    const [dbError, setDbError] = useState('') // added error state
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

            // 1. Get Latest Dorm
            const { data: dormsData, error: dormError } = await supabase
                .from('dorms')
                .select('*')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1)

            if (dormError) setDbError(prev => prev + ' [Dorm Error: ' + dormError.message + ']')

            if (dormsData && dormsData.length > 0) {
                setDorm(dormsData[0])

                // 2. Get Rooms
                const { data: roomsData, error: roomsError } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('dorm_id', dormsData[0].id)
                    .order('room_number', { ascending: true })

                console.log("Rooms fetched:", roomsData, "Error:", roomsError)
                if (roomsError) {
                    setDbError(prev => prev + ' [Rooms Error: ' + roomsError.message + ']')
                }

                if (roomsData) {
                    setRooms(roomsData)
                    setStats({
                        total: roomsData.length,
                        occupied: roomsData.filter(r => r.status === 'occupied').length,
                        vacant: roomsData.filter(r => r.status === 'available').length,
                        pendingPayments: 0 // Mock value for now
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
        { id: 'overview', name: 'หน้าหลัก', outlineIcon: HomeIcon, solidIcon: HomeIconSolid },
        { id: 'rooms', name: 'ห้องพัก', outlineIcon: Squares2X2Icon, solidIcon: Squares2X2IconSolid },
        { id: 'billing', name: 'บิล/มิเตอร์', outlineIcon: DocumentTextIcon, solidIcon: DocumentTextIconSolid },
        { id: 'tenants', name: 'ผู้เช่า', outlineIcon: UserGroupIcon, solidIcon: UserGroupIconSolid },
        { id: 'settings', name: 'ตั้งค่า', outlineIcon: Cog6ToothIcon, solidIcon: Cog6ToothIconSolid },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white min-h-[640px] rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                    <p className="text-green-600 font-bold animate-pulse text-sm">กำลังโหลดข้อมูลหอพัก...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col relative pb-24">

                {/* ── Dynamic Main Content ── */}
                {activeTab === 'overview' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full">
                        {/* ── Vibrant Green Header ── */}
                        <header className="bg-gradient-to-br from-green-500 to-green-600 pt-12 pb-24 px-6 rounded-b-[2.5rem] relative overflow-hidden shadow-lg shadow-green-200">
                            {/* Decorative background elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />

                            <div className="relative z-10 flex items-start justify-between">
                                <div className="text-white">
                                    <p className="text-green-100 text-[13px] font-bold tracking-widest uppercase mb-1 drop-shadow-sm">สวัสดีคุณ {userName} 👋</p>
                                    <h1 className="text-3xl font-black tracking-tight drop-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-green-50">{dorm?.name || 'หอพักของฉัน'}</h1>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button className="relative w-11 h-11 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-[1.2rem] flex items-center justify-center text-white transition-all active:scale-95 border border-white/20 shadow-sm">
                                        <BellIcon className="w-6 h-6 stroke-[2]" />
                                        <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-green-500" />
                                    </button>
                                    <div 
                                        onClick={handleLogout}
                                        className="w-12 h-12 bg-white rounded-[1.2rem] flex items-center justify-center text-green-600 font-black text-xl shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 border-2 border-green-100"
                                    >
                                        {userInitial}
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="px-6 -mt-16 relative z-20 space-y-6 pb-20">
                            {/* DB Error Banner */}
                            {dbError && (
                                <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-5 mb-4 shadow-xl shadow-red-100/50">
                                    <h3 className="text-red-600 font-black text-lg mb-1">เกิดข้อผิดพลาดฐานข้อมูล!</h3>
                                    <p className="text-red-500 font-bold text-xs break-words">{dbError}</p>
                                </div>
                            )}

                            {/* ── Stats Grid ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                                        <Squares2X2Icon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">ห้องทั้งหมด</p>
                                        <p className="text-[28px] font-black text-gray-800 leading-none">{stats.total}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 text-green-600 flex items-center justify-center shrink-0 border border-green-100/50">
                                        <HomeIcon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">ห้องว่าง</p>
                                        <p className="text-[28px] font-black text-gray-800 leading-none">{stats.vacant}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100/50">
                                        <UserGroupIcon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">มีผู้เช่า</p>
                                        <p className="text-[28px] font-black text-gray-800 leading-none">{stats.occupied}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/50">
                                        <BanknotesIcon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">รอชำระเงิน</p>
                                        <p className="text-[28px] font-black text-gray-800 leading-none">{stats.pendingPayments}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Quick Actions ── */}
                            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-50">
                                <h3 className="text-sm font-black text-gray-800 mb-4 tracking-tight px-1 text-center">เมนูใช้งานด่วน ✨</h3>
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { name: 'จดมิเตอร์', icon: DocumentPlusIcon, color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100 shadow-green-100/50', path: '/dashboard/meter' },
                                        { name: 'ออกบิล', icon: BanknotesIcon, color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 shadow-blue-100/50' },
                                        { name: 'เพิ่มคนเช่า', icon: UserGroupIcon, color: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100 shadow-orange-100/50', path: '/dashboard/tenants/new' },
                                        { name: 'จัดการห้อง', icon: Squares2X2Icon, color: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 shadow-purple-100/50' },
                                    ].map((action, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => action.path ? router.push(action.path) : alert('กำลังพัฒนาระบบนี้')}
                                            className="flex flex-col items-center gap-2 group active:scale-[0.97] transition-all"
                                        >
                                            <div className={`w-[60px] h-[60px] rounded-[1.2rem] flex items-center justify-center border transition-all shadow-sm ${action.color}`}>
                                                <action.icon className="w-7 h-7 stroke-[1.5]" />
                                            </div>
                                            <span className="text-[11px] font-bold text-gray-500 text-center tracking-tight leading-none group-hover:text-gray-800 transition-colors">{action.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Rooms Preview ── */}
                            <div>
                                <div className="flex items-center justify-between px-2 mb-4">
                                    <div className="flex items-center gap-2 relative">
                                        <div className="absolute -left-2 w-1.5 h-4 bg-green-500 rounded-full" />
                                        <h3 className="text-[15px] font-black text-gray-800 tracking-tight pl-1">สถานะห้องพักล่าสุด</h3>
                                    </div>
                                    <button 
                                        onClick={() => setActiveTab('rooms')}
                                        className="text-xs text-green-600 font-bold bg-green-50 px-4 py-2 rounded-xl hover:bg-green-100 transition-colors active:scale-95"
                                    >
                                        ดูทั้งหมด
                                    </button>
                                </div>
                                <div className="grid gap-3">
                                    {rooms.slice(0, 3).map((room) => (
                                        <div 
                                            key={room.id}
                                            className="bg-white h-[76px] px-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-green-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-3 h-3 rounded-full shadow-sm ${room.status === 'available' ? 'bg-green-500 shadow-green-200' : 'bg-orange-500 shadow-orange-200'}`} />
                                                <div>
                                                    <h4 className="text-xl font-black text-gray-800 leading-none mb-1.5">{room.room_number}</h4>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest leading-none ${room.status === 'available' ? 'text-green-500' : 'text-orange-500'}`}>
                                                        {room.status === 'available' ? 'ห้องว่าง' : 'มีผู้เช่าแล้ว'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col justify-center items-end h-full">
                                                <div className="bg-gray-50 text-gray-400 font-bold text-[10px] px-2.5 py-1 rounded-lg mb-1">ชั้น {room.floor}</div>
                                                <p className="text-xs font-black text-gray-800">฿{room.base_price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Rooms Tab Content ── */}
                {activeTab === 'rooms' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full px-6 pt-12 pb-32">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-black text-gray-800 tracking-tight">ห้องพักทั้งหมด</h1>
                                <p className="text-gray-400 font-bold text-sm mt-1">จำนวน {rooms.length} ห้อง</p>
                            </div>
                            <button className="w-12 h-12 bg-green-500 hover:bg-green-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-lg shadow-green-200 transition-all active:scale-95">
                                <PlusIcon className="w-6 h-6 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="grid gap-4">
                            {rooms.length === 0 ? (
                                <div className="text-center py-10 bg-gray-50 rounded-3xl border border-gray-100">
                                    <p className="text-gray-400 font-bold">ยังไม่มีข้อมูลห้องพัก</p>
                                </div>
                            ) : (
                                rooms.map((room) => (
                                    <div 
                                        key={room.id}
                                        className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col gap-4 group hover:border-green-300 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${room.status === 'available' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                    {room.room_number}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">ชั้น {room.floor}</p>
                                                    <div className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border inline-block ${room.status === 'available' ? 'bg-green-50 text-green-500 border-green-100/50' : 'bg-orange-50 text-orange-500 border-orange-100/50'}`}>
                                                        {room.status === 'available' ? '🟢 ห้องว่าง' : '🟠 มีผู้เช่าแล้ว'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400 font-bold mb-1">ค่าเช่ารายเดือน</p>
                                                <p className="text-lg font-black text-gray-800">฿{room.base_price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ── Other Tabs Placeholder (billing, tenants, settings) ── */}
                {activeTab !== 'overview' && activeTab !== 'rooms' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 h-full relative z-10 bg-white">
                        <div className="w-24 h-24 bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] flex items-center justify-center text-green-500 mb-6 transform -rotate-6 shadow-xl shadow-green-100/50">
                            <Squares2X2Icon className="w-12 h-12 stroke-[2]" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight mb-3">
                            ระบบ {navItems.find(n => n.id === activeTab)?.name}
                        </h2>
                        <p className="text-gray-500 text-[13px] leading-relaxed max-w-[260px] font-medium">
                            หน้านี้กำลังอยู่ระหว่างการพัฒนา รอติดตามการอัปเดตระบบเร็วๆ นี้นะครับ 🚀
                        </p>
                        <button 
                            onClick={() => setActiveTab('overview')}
                            className="mt-8 px-8 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-2xl transition-all active:scale-95 border border-gray-200"
                        >
                            กลับไปหน้าหลัก
                        </button>
                    </div>
                )}

                {/* ── Modern Floating Bottom Navigation ── */}
                <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-2 py-4 pb-6 flex justify-around items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] rounded-b-[3rem]">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = isActive ? item.solidIcon : item.outlineIcon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`relative flex flex-col items-center gap-1.5 w-[72px] transition-all duration-300 ${isActive ? 'text-green-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <div className="relative">
                                    {isActive && (
                                        <div className="absolute inset-0 bg-green-400 opacity-20 blur-md rounded-full scale-[1.3]" />
                                    )}
                                    <Icon className="w-[26px] h-[26px] relative z-10" />
                                </div>
                                <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                    {item.name}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
