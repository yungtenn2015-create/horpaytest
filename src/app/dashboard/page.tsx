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
    BanknotesIcon,
    UsersIcon,
    UserIcon,
    ArrowRightOnRectangleIcon,
    ChevronRightIcon,
    ClockIcon,
    BuildingOfficeIcon,
    MapPinIcon,
    DevicePhoneMobileIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ChatBubbleLeftRightIcon,
    ClipboardIcon,
    CheckIcon
} from '@heroicons/react/24/outline'

import {
    HomeIcon as HomeIconSolid,
    Squares2X2Icon as Squares2X2IconSolid,
    DocumentTextIcon as DocumentTextIconSolid,
    UserGroupIcon as UserGroupIconSolid,
    Cog6ToothIcon as Cog6ToothIconSolid,
    BuildingOffice2Icon as BuildingOfficeSolid,
    BanknotesIcon as BanknotesSolid,
    UserCircleIcon as UserCircleSolid
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
    deleted_at: string | null;
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
    const [isMenuOpen, setIsMenuOpen] = useState(false) // for user dropdown
    const [pendingRoomIds, setPendingRoomIds] = useState<Set<string>>(new Set())
    const [stats, setStats] = useState({
        total: 0,
        occupied: 0,
        vacant: 0,
        pendingPayments: 0
    })

    // Settings States
    const [activeSettingsTab, setActiveSettingsTab] = useState('dorm')
    const [savingSettings, setSavingSettings] = useState(false)
    const [settingsMessage, setSettingsMessage] = useState('')
    const [dormData, setDormData] = useState({
        name: '',
        address: '',
        contact_number: ''
    })
    const [settingsData, setSettingsData] = useState({
        bank_name: '',
        bank_account_no: '',
        bank_account_name: '',
        billing_day: 30,
        payment_due_day: 5
    })
    const [lineConfig, setLineConfig] = useState({
        channel_id: '',
        channel_secret: '',
        access_token: '',
        owner_line_user_id: ''
    })

    // LINE Settings Helpers
    const [isTestingConnection, setIsTestingConnection] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [copied, setCopied] = useState(false)

    const handleTestConnection = async () => {
        if (!lineConfig.access_token) {
            setTestResult({ success: false, message: 'กรุณากรอก Access Token ก่อนทดสอบ' });
            return;
        }

        setIsTestingConnection(true);
        setTestResult(null);

        try {
            const response = await fetch('/api/line/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: lineConfig.access_token })
            });

            const data = await response.json();
            if (data.success) {
                // Auto-fill channel_id (Bot User ID) from data
                setLineConfig(prev => ({
                    ...prev,
                    channel_id: data.bot.userId
                }));
                setTestResult({ success: true, message: `เชื่อมต่อสำเร็จ! (Bot: ${data.bot.displayName})` });
            } else {
                setTestResult({ success: false, message: data.error || 'การเชื่อมต่อล้มเหลว' });
            }
        } catch (error) {
            setTestResult({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
        } finally {
            setIsTestingConnection(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                    const activeRooms = roomsData.filter(r => r.deleted_at === null)
                    setRooms(activeRooms)

                    // 3. Get Pending Bills
                    const { data: billsData, error: billsError } = await supabase
                        .from('bills')
                        .select('room_id')
                        .in('room_id', activeRooms.map(r => r.id))
                        .in('status', ['unpaid', 'overdue'])

                    const pendingIdsSet = new Set(billsData?.map(b => b.room_id) || [])
                    setPendingRoomIds(pendingIdsSet)

                    setStats({
                        total: activeRooms.length,
                        occupied: activeRooms.filter(r => r.status === 'occupied').length,
                        vacant: activeRooms.filter(r => r.status === 'available').length,
                        pendingPayments: pendingIdsSet.size
                    })

                    // 4. Get Settings
                    const { data: settings } = await supabase
                        .from('dorm_settings')
                        .select('*')
                        .eq('dorm_id', dormsData[0].id)
                        .single()

                    if (settings) {
                        setSettingsData({
                            bank_name: settings.bank_name || '',
                            bank_account_no: settings.bank_account_no || '',
                            bank_account_name: settings.bank_account_name || '',
                            billing_day: settings.billing_day || 30,
                            payment_due_day: settings.payment_due_day || 5
                        })
                    }

                    // 5. Get LINE Config (Safely)
                    try {
                        const { data: lineOa } = await supabase
                            .from('line_oa_configs')
                            .select('*')
                            .eq('dorm_id', dormsData[0].id)
                            .maybeSingle()

                        if (lineOa) {
                            setLineConfig({
                                channel_id: lineOa.channel_id || '',
                                channel_secret: lineOa.channel_secret || '',
                                access_token: lineOa.access_token || '',
                                owner_line_user_id: lineOa.owner_line_user_id || ''
                            })
                        }
                    } catch (lineErr) {
                        console.error("LINE Config Error:", lineErr)
                        // Don't set dbError here to avoid blocking the whole UI
                    }

                    // 5. Set Dorm Data for Settings Tab
                    setDormData({
                        name: dormsData[0].name || '',
                        address: dormsData[0].address || '',
                        contact_number: dormsData[0].contact_number || ''
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

    async function handleSaveSettings() {
        setSavingSettings(true)
        setSettingsMessage('')
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !dorm) return

            // 1. Update Dorm
            await supabase.from('dorms').update({
                name: dormData.name,
                address: dormData.address,
                contact_number: dormData.contact_number
            }).eq('id', dorm.id)

            // 2. Update Settings
            await supabase.from('dorm_settings').update({
                bank_name: settingsData.bank_name,
                bank_account_no: settingsData.bank_account_no,
                bank_account_name: settingsData.bank_account_name,
                billing_day: settingsData.billing_day,
                payment_due_day: settingsData.payment_due_day
            }).eq('dorm_id', dorm.id)

            // 3. Update LINE Config
            const { data: existingLines } = await supabase
                .from('line_oa_configs')
                .select('id')
                .eq('dorm_id', dorm.id)
            
            if (existingLines && existingLines.length > 0) {
                await supabase.from('line_oa_configs').update({
                    channel_id: lineConfig.channel_id,
                    channel_secret: lineConfig.channel_secret,
                    access_token: lineConfig.access_token
                }).eq('dorm_id', dorm.id)
            } else {
                await supabase.from('line_oa_configs').insert({
                    dorm_id: dorm.id,
                    channel_id: lineConfig.channel_id,
                    channel_secret: lineConfig.channel_secret,
                    access_token: lineConfig.access_token
                })
            }

            setSettingsMessage('บันทึกข้อมูลเรียบร้อยแล้ว!')
            // Refresh local dorm name if changed
            setDorm({ ...dorm, name: dormData.name })
            setTimeout(() => setSettingsMessage(''), 3000)
        } catch (error) {
            console.error('Error saving settings:', error)
            setSettingsMessage('เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setSavingSettings(false)
        }
    }

    const navItems = [
        { id: 'overview', name: 'หน้าหลัก', outlineIcon: HomeIcon, solidIcon: HomeIconSolid },
        { id: 'rooms', name: 'สถานะห้องพัก', outlineIcon: Squares2X2Icon, solidIcon: Squares2X2IconSolid },
        { id: 'billing', name: 'บิล/มิเตอร์', outlineIcon: DocumentTextIcon, solidIcon: DocumentTextIconSolid },
        { id: 'tenants', name: 'ผู้เช่า', outlineIcon: UserGroupIcon, solidIcon: UserGroupIconSolid },
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
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col relative pb-24 border-gray-100 sm:border">

                {/* ── Dynamic Main Content ── */}
                {activeTab === 'overview' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full">
                        {/*  HEADER  */}
                        <header className="relative pt-12 pb-24 px-6">
                            {/* ── Background Layer (for clipping and gradient) ── */}
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-b-[2.5rem] overflow-hidden z-0 shadow-lg shadow-green-200">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                            </div>

                            <div className="relative flex items-start justify-between">
                                <div className="text-white">
                                    <p className="text-green-100 text-[13px] font-bold tracking-widest uppercase mb-1 drop-shadow-sm">สวัสดีคุณ {userName} 👋</p>
                                    <h1 className="text-3xl font-black tracking-tight drop-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-green-50">{dorm?.name || 'หอพักของฉัน'}</h1>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button className="relative w-11 h-11 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-[1.2rem] flex items-center justify-center text-white transition-all active:scale-95 border border-white/20 shadow-sm">
                                        <BellIcon className="w-6 h-6 stroke-[2]" />
                                        <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-green-500" />
                                    </button>
                                    <div className="relative">
                                        <div
                                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                                            className="w-12 h-12 bg-white rounded-[1.2rem] flex items-center justify-center text-green-600 shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 border-2 border-green-100"
                                        >
                                            <UserIcon className="w-7 h-7 stroke-[2]" />
                                        </div>

                                        {/* Dropdown Menu */}
                                        {isMenuOpen && (
                                            <>
                                                    <div className="absolute right-0 mt-4 w-[240px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-50 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right">
                                                    {/* Header */}
                                                    <div className="px-6 py-6 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100">
                                                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">ยินดีต้อนรับ</p>
                                                        <h3 className="text-[17px] font-black text-gray-800 tracking-tight leading-none">{userName}</h3>
                                                    </div>

                                                    {/* Menu Items */}
                                                    <div className="p-2.5 space-y-1">
                                                        <button
                                                            onClick={() => {
                                                                setIsMenuOpen(false);
                                                                setActiveTab('settings');
                                                                setActiveSettingsTab('dorm');
                                                            }}
                                                            className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group"
                                                        >
                                                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <BuildingOfficeIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                            </div>
                                                            แก้ไขข้อมูลหอพัก
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                setIsMenuOpen(false);
                                                                setActiveTab('settings');
                                                                setActiveSettingsTab('line');
                                                            }}
                                                            className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group"
                                                        >
                                                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                            </div>
                                                            ตั้งค่า LINE Notification
                                                        </button>

                                                        <div className="h-px bg-gray-100/60 mx-4 my-2" />

                                                        <button
                                                            onClick={handleLogout}
                                                            className="w-full flex items-center gap-4 px-4 py-4 text-left text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-[14.5px] group"
                                                        >
                                                            <div className="w-10 h-10 bg-red-50/50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-400 group-hover:text-red-600 stroke-[2.5]" />
                                                            </div>
                                                            ออกจากระบบ
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
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
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
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
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                                        <UserGroupIcon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">มีผู้เช่า</p>
                                        <p className="text-[28px] font-black text-gray-800 leading-none">{stats.occupied}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100/50">
                                        <BanknotesIcon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">ห้องค้างชำระ</p>
                                        <p className="text-[28px] font-black text-gray-800 leading-none">{stats.pendingPayments}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Quick Actions ── */}
                            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-50">
                                <h2 className="text-sm font-black text-gray-800 mb-4 tracking-tight px-1 text-center">เมนูใช้งาน</h2>
                                <div className="grid grid-cols-3 gap-y-10 gap-x-2">
                                    {[
                                        { name: 'จดมิเตอร์', icon: DocumentPlusIcon, color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100 shadow-green-100/50', path: '/dashboard/meter' },
                                        { name: 'ออกบิล', icon: BanknotesIcon, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 shadow-emerald-100/50', path: '/dashboard/billing' },
                                        { name: 'ประวัติบิล', icon: ClockIcon, color: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 shadow-purple-100/50', path: '/dashboard/history' },
                                        { name: 'ข้อมูลผู้เช่า', icon: UsersIcon, color: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 shadow-blue-100/50', path: '/dashboard/tenants' },
                                        { name: 'เพิ่มผู้เช่า', icon: UserGroupIcon, color: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100 shadow-orange-100/50', path: '/dashboard/tenants/new' },
                                    ].map((action, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (action.path) {
                                                    router.push(action.path);
                                                } else {
                                                    alert('กำลังพัฒนาระบบนี้');
                                                }
                                            }}
                                            className="flex flex-col items-center gap-2.5 group active:scale-[0.95] transition-all"
                                        >
                                            <div className={`w-[74px] h-[74px] rounded-[1.8rem] flex items-center justify-center border-2 transition-all shadow-lg ${action.color}`}>
                                                <action.icon className="w-9 h-9 stroke-[2.2]" />
                                            </div>
                                            <span className="text-[13px] font-black text-gray-700 text-center tracking-tight leading-none group-hover:text-green-600 transition-colors uppercase">{action.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Latest Status ── */}
                            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-50">
                                <div className="flex items-center justify-between mb-5 px-1">
                                    <h2 className="text-sm font-black text-gray-800 tracking-tight">ห้องพักค้างชำระล่าสุด</h2>
                                    <button
                                        onClick={() => setActiveTab('rooms')}
                                        className="text-[12px] font-black text-green-600 uppercase tracking-widest hover:text-green-700 transition-colors"
                                    >
                                        ดูทั้งหมด
                                    </button>
                                </div>

                                <div className="grid gap-3">
                                    {rooms.filter(r => pendingRoomIds.has(r.id)).length > 0 ? (
                                        rooms.filter(r => pendingRoomIds.has(r.id)).slice(0, 3).map((room) => (
                                            <div
                                                key={room.id}
                                                className="bg-white h-[76px] px-5 rounded-2xl border-2 border-red-50 shadow-sm flex items-center justify-between group hover:border-red-300 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-200" />
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">ห้อง</p>
                                                        <h3 className="text-sm font-black text-gray-800 tracking-tight">{room.room_number}</h3>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 px-3 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
                                                        <span className="text-[10px] font-black uppercase text-red-600">ค้างชำระ</span>
                                                    </div>
                                                    <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-red-600 transition-colors" />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-2 border-2 border-dashed border-gray-50 rounded-2xl">
                                            <p className="text-xs font-bold text-gray-400">ไม่มีห้องค้างชำระ</p>
                                        </div>
                                    )}
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
                                <h1 className="text-3xl font-black text-gray-800 tracking-tight">สถานะห้องพักทั้งหมด</h1>
                                <p className="text-gray-400 font-bold text-sm mt-1">จำนวน {rooms.length} ห้อง</p>
                            </div>
                        </div>

                        {rooms.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border border-gray-100">
                                <p className="text-gray-400 font-bold">ยังไม่มีข้อมูลห้องพัก</p>
                            </div>
                        ) : (
                            <div className="space-y-10">
                                {Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b).map(floor => (
                                    <div key={floor} className="space-y-4">
                                        <div className="flex items-center gap-3 px-2">
                                            <div className="h-6 w-1.5 bg-green-500 rounded-full" />
                                            <h2 className="text-lg font-black text-gray-800 tracking-tight">ชั้น {floor}</h2>
                                        </div>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {rooms.filter(r => r.floor === floor).sort((a, b) => a.room_number.localeCompare(b.room_number)).map((room) => {
                                                const isPending = pendingRoomIds.has(room.id);
                                                const isOccupied = room.status === 'occupied';

                                                // Color Logic: Red (Pending) > Blue (Occupied) > Green (Available)
                                                let bgColor = 'bg-green-50';
                                                let textColor = 'text-green-600';
                                                let borderColor = 'border-green-100';
                                                let statusText = 'ว่าง';

                                                if (isPending) {
                                                    bgColor = 'bg-orange-50';
                                                    textColor = 'text-orange-600';
                                                    borderColor = 'border-orange-100';
                                                    statusText = 'ค้างชำระ';
                                                } else if (isOccupied) {
                                                    bgColor = 'bg-blue-50';
                                                    textColor = 'text-blue-600';
                                                    borderColor = 'border-blue-100';
                                                    statusText = 'มีคนพัก';
                                                }

                                                return (
                                                    <div
                                                        key={room.id}
                                                        className={`aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-1 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer ${bgColor} ${borderColor}`}
                                                    >
                                                        <span className={`text-[20px] font-black leading-none ${textColor}`}>{room.room_number}</span>
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor} opacity-80`}>{statusText}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Settings Tab Content (NEW - Consolidated Single Page) ── */}
                {activeTab === 'settings' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative z-10 bg-white">
                        <div className="px-6 pt-12 mb-6">
                            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                                {activeSettingsTab === 'dorm' ? 'ตั้งค่าหอพัก' : 'ตั้งค่า LINE Bot'}
                            </h1>
                            <p className="text-gray-400 font-bold text-sm mt-1">
                                {activeSettingsTab === 'dorm' ? 'จัดการข้อมูลและบัญชีรับเงิน' : 'เชื่อมต่อ LINE Messaging API สำหรับแจ้งเตือน'}
                            </p>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto px-6 pt-2 pb-32 custom-scrollbar">
                            <div className="space-y-6">
                                {activeSettingsTab === 'dorm' && (
                                    <>
                                        {/* Dorm Info Section */}
                                        <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50 backdrop-blur-sm shadow-sm group hover:shadow-md transition-all duration-300">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                                                    <BuildingOfficeIcon className="w-6 h-6 stroke-[2]" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-800 tracking-tight">ข้อมูลหอพัก</h3>
                                                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Dormitory Information</p>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">ชื่อหอพัก</label>
                                                    <div className="relative group/field">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-hover/field:text-green-500 transition-colors">
                                                            <BuildingOfficeIcon className="w-5 h-5" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            maxLength={50}
                                                            value={dormData.name}
                                                            onChange={(e) => setDormData({ ...dormData, name: e.target.value.slice(0, 50) })}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                                            placeholder="ระบุชื่อหอพัก..."
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">ที่อยู่หอพัก</label>
                                                    <div className="relative group/field">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-hover/field:text-green-500 transition-colors">
                                                            <MapPinIcon className="w-5 h-5" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            maxLength={100}
                                                            value={dormData.address}
                                                            onChange={(e) => setDormData({ ...dormData, address: e.target.value.slice(0, 100) })}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                                            placeholder="ระบุที่อยู่หอพัก..."
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">เบอร์โทรติดต่อ</label>
                                                    <div className="relative group/field">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-hover/field:text-green-500 transition-colors">
                                                            <DevicePhoneMobileIcon className="w-5 h-5" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            maxLength={10}
                                                            value={dormData.contact_number}
                                                            onChange={(e) => setDormData({ ...dormData, contact_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                                            placeholder="ระบุเบอร์โทร..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financial Section */}
                                        <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50 backdrop-blur-sm shadow-sm group hover:shadow-md transition-all duration-300">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                                    <BanknotesIcon className="w-6 h-6 stroke-[2]" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-800 tracking-tight">การเงินและบัญชี</h3>
                                                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Payment & Bank Details</p>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">ธนาคาร</label>
                                                        <input
                                                            type="text"
                                                            maxLength={30}
                                                            value={settingsData.bank_name}
                                                            onChange={(e) => setSettingsData({ ...settingsData, bank_name: e.target.value.slice(0, 30) })}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none"
                                                            placeholder="กรุงไทย..."
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">เลขบัญชี</label>
                                                        <input
                                                            type="text"
                                                            maxLength={20}
                                                            value={settingsData.bank_account_no}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^\d\- ]/g, '').slice(0, 20);
                                                                setSettingsData({ ...settingsData, bank_account_no: val });
                                                            }}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none"
                                                            placeholder="092-0-13420-7"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">ชื่อบัญชี</label>
                                                    <input
                                                        type="text"
                                                        maxLength={50}
                                                        value={settingsData.bank_account_name}
                                                        onChange={(e) => setSettingsData({ ...settingsData, bank_account_name: e.target.value.slice(0, 50) })}
                                                        className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none"
                                                        placeholder="ชื่อ-นามสกุล..."
                                                    />
                                                </div>

                                                <div className="pt-4 border-t border-gray-100 flex items-center gap-3 mb-2">
                                                    <CalendarDaysIcon className="w-5 h-5 text-green-500" />
                                                    <span className="text-sm font-black text-gray-700">ตั้งค่ารอบบิล</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">วันจดมิเตอร์ / ตัดรอบบิล</label>
                                                        <input
                                                            type="number"
                                                            min="1" max="31"
                                                            value={settingsData.billing_day}
                                                            onChange={(e) => {
                                                                let val = parseInt(e.target.value);
                                                                if (val > 31) val = 31;
                                                                setSettingsData({ ...settingsData, billing_day: isNaN(val) ? ('' as any) : val });
                                                            }}
                                                            onBlur={() => {
                                                                if (!settingsData.billing_day || settingsData.billing_day < 1) {
                                                                    setSettingsData({ ...settingsData, billing_day: 1 });
                                                                }
                                                            }}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">วันครบกำหนดชำระ</label>
                                                        <input
                                                            type="number"
                                                            min="1" max="31"
                                                            value={settingsData.payment_due_day}
                                                            onChange={(e) => {
                                                                let val = parseInt(e.target.value);
                                                                if (val > 31) val = 31;
                                                                setSettingsData({ ...settingsData, payment_due_day: isNaN(val) ? ('' as any) : val });
                                                            }}
                                                            onBlur={() => {
                                                                if (!settingsData.payment_due_day || settingsData.payment_due_day < 1) {
                                                                    setSettingsData({ ...settingsData, payment_due_day: 5 });
                                                                }
                                                            }}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none shadow-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeSettingsTab === 'line' && (
                                    <div className="space-y-6">
                                        <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50 backdrop-blur-sm shadow-sm group hover:shadow-md transition-all duration-300">
                                            <div className="flex items-center justify-between mb-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shadow-sm shadow-green-100">
                                                        <ChatBubbleLeftRightIcon className="w-8 h-8 stroke-[2]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-gray-800 tracking-tight">LINE Messaging API</h3>
                                                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Line Notification Configuration</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {lineConfig.owner_line_user_id ? (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider">เชื่อมต่อแล้ว</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-400 rounded-full border border-gray-200">
                                                            <span className="text-[10px] font-black uppercase tracking-wider">ยังไม่เชื่อมต่อ</span>
                                                        </div>
                                                    )}
                                                    
                                                    <button 
                                                        onClick={handleTestConnection}
                                                        disabled={isTestingConnection || !lineConfig.access_token}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 rounded-full border border-gray-200 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                                                    >
                                                        {isTestingConnection ? (
                                                            <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                        )}
                                                        ทดสอบการเชื่อมต่อ
                                                    </button>
                                                </div>
                                            </div>

                                            {testResult && (
                                                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${testResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                                    {testResult.success ? <CheckCircleIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
                                                    <span className="text-xs font-bold">{testResult.message}</span>
                                                </div>
                                            )}

                                            <div className="grid gap-6">
                                                {/* Webhook URL Section */}
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">Webhook URL (สำหรับนำไปวางใน LINE Console)</label>
                                                    <div className="relative group/webhook">
                                                        <input
                                                            readOnly
                                                            type="text"
                                                            value={typeof window !== 'undefined' ? `${window.location.origin}/api/line/webhook` : ''}
                                                            className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 pr-14 font-mono text-[11px] font-bold text-gray-500 transition-all outline-none"
                                                        />
                                                        <button
                                                            onClick={() => copyToClipboard(typeof window !== 'undefined' ? `${window.location.origin}/api/line/webhook` : '')}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-all active:scale-90"
                                                        >
                                                            {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <ClipboardIcon className="w-5 h-5 text-gray-400" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-gray-100/50 my-2" />

                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">Bot User ID (พบอัตโนมัติ)</label>
                                                    <input
                                                        readOnly
                                                        type="text"
                                                        value={lineConfig.channel_id}
                                                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 font-bold text-gray-500 cursor-not-allowed outline-none shadow-sm"
                                                        placeholder="จะปรากฏเมื่อทดสอบสำเร็จ..."
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">Channel Secret</label>
                                                    <input
                                                        type="password"
                                                        value={lineConfig.channel_secret}
                                                        onChange={(e) => setLineConfig({ ...lineConfig, channel_secret: e.target.value })}
                                                        className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                                        placeholder="••••••••••••••••"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">Channel Access Token</label>
                                                    <textarea
                                                        value={lineConfig.access_token}
                                                        onChange={(e) => setLineConfig({ ...lineConfig, access_token: e.target.value })}
                                                        className="w-full h-32 bg-white border-2 border-gray-50 rounded-2xl p-5 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm resize-none text-sm break-all"
                                                        placeholder="eyJhbGciOiJIUzI1NiJ9..."
                                                    />
                                                </div>
                                                {!lineConfig.owner_line_user_id && lineConfig.channel_id && (
                                                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                                        <p className="text-[11px] font-bold text-orange-700 leading-relaxed text-center">
                                                            ⚠️ หลังจากบันทึกแล้ว กรุณาเพิ่มเพื่อน LINE OA ของคุณ <br/>เพื่อเชื่อมต่อระบบในฐานะเจ้าของ
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Message Indicator */}
                            {settingsMessage && (
                                <div className="mt-8 flex items-center gap-2 justify-center py-3 px-6 bg-green-50 text-green-600 rounded-full font-black text-xs animate-bounce w-fit mx-auto">
                                    <CheckCircleIcon className="w-4 h-4" />
                                    {settingsMessage}
                                </div>
                            )}
                        </div>

                        {/* Floating Save Button within Settings Drawer */}
                        <div className="absolute bottom-[25px] left-0 right-0 px-6 sm:max-w-lg sm:mx-auto">
                            <button
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className="w-full h-16 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-green-100/50 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {savingSettings ? (
                                    <ArrowPathIcon className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>บันทึกการตั้งค่า</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab !== 'overview' && activeTab !== 'rooms' && activeTab !== 'settings' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 h-full relative z-10 bg-white">
                        <div className="w-24 h-24 bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] flex items-center justify-center text-green-500 mb-6 transform -rotate-6 shadow-xl shadow-green-100/50">
                            <Squares2X2Icon className="w-12 h-12 stroke-[2]" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight mb-3">
                            ระบบ {navItems.find(n => n.id === activeTab)?.name || 'จัดการห้อง'}
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
