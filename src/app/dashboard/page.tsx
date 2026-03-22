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
    CheckIcon,
    ChartBarIcon,
    IdentificationIcon,
    KeyIcon,
    LockClosedIcon
} from '@heroicons/react/24/outline'

import {
    HomeIcon as HomeIconSolid,
    Squares2X2Icon as Squares2X2IconSolid,
    DocumentTextIcon as DocumentTextIconSolid,
    UserGroupIcon as UserGroupIconSolid,
    Cog6ToothIcon as Cog6ToothIconSolid,
    BuildingOffice2Icon as BuildingOfficeSolid,
    BanknotesIcon as BanknotesSolid,
    UserCircleIcon as UserCircleSolid,
    ChartBarIcon as ChartBarIconSolid
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
    status: 'available' | 'occupied' | 'maintenance';
    floor: string;
    base_price: number;
    tenants?: {
        name: string;
        phone: string | null;
        line_user_id: string | null;
        status: string;
    }[];
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

    // Overview Stats States
    const [overviewData, setOverviewData] = useState({
        monthlyRevenue: 0,
        collectedRevenue: 0,
        pendingRevenue: 0,
        projectedRevenue: 0,
        occupancyRate: 0,
        waterUnits: 0,
        waterAmount: 0,
        electricityUnits: 0,
        electricityAmount: 0,
        billStatusCounts: {
            paid: 0,
            waiting_verify: 0,
            unpaid: 0
        },
        historicalRevenue: [] as { month: string, amount: number }[]
    })
    const [fetchingOverview, setFetchingOverview] = useState(false)

    // Change Password States
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [passwordData, setPasswordData] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    })

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')

        if (!passwordData.oldPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            setPasswordError('กรุณากรอกข้อมูลให้ครบถ้วน')
            return
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('รหัสผ่านใหม่ไม่ตรงกัน')
            return
        }

        if (passwordData.newPassword.length < 6) {
            setPasswordError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
            return
        }

        setIsSubmittingPassword(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !user.email) throw new Error('ไม่พบข้อมูลผู้ใช้')

            // Re-authenticate to verify old password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: passwordData.oldPassword
            })

            if (signInError) {
                setPasswordError('รหัสผ่านเดิมไม่ถูกต้อง')
                setIsSubmittingPassword(false)
                return
            }

            // Update user with new password
            const { error: updateError } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            })

            if (updateError) {
                setPasswordError(updateError.message)
            } else {
                setPasswordSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!')
                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
                setTimeout(() => {
                    setIsChangePasswordOpen(false)
                    setPasswordSuccess('')
                }, 2000)
            }
        } catch (err: any) {
            setPasswordError(err.message || 'เกิดข้อผิดพลาดบางอย่าง')
        } finally {
            setIsSubmittingPassword(false)
        }
    }

    // LINE Settings Helpers
    const [showLineConfig, setShowLineConfig] = useState(false)
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
                    .select('*, tenants(name, phone, line_user_id, status)')
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

    useEffect(() => {
        if (activeTab === 'stats' && dorm?.id) {
            fetchOverviewData(dorm.id)
        }
    }, [activeTab, dorm])

    async function fetchOverviewData(dormId: string) {
        setFetchingOverview(true)
        const supabase = createClient()
        const now = new Date()

        // Start of current month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        // Last 6 months range
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

        try {
            // 1. Current Month Bills
            const { data: monthBills } = await supabase
                .from('bills')
                .select('*')
                .eq('dorm_id', dormId)
                .gte('period_start', startOfMonth)
                .is('deleted_at', null)

            // 2. Historical Revenue (last 6 months - PAID)
            const { data: historyBills } = await supabase
                .from('bills')
                .select('total_amount, period_start')
                .eq('dorm_id', dormId)
                .eq('status', 'paid')
                .gte('period_start', sixMonthsAgo)
                .is('deleted_at', null)

            // 3. Occupancy
            const { count: totalRooms } = await supabase
                .from('rooms')
                .select('*', { count: 'exact', head: true })
                .eq('dorm_id', dormId)
                .is('deleted_at', null)

            const { count: occupiedRooms } = await supabase
                .from('rooms')
                .select('*', { count: 'exact', head: true })
                .eq('dorm_id', dormId)
                .eq('status', 'occupied')
                .is('deleted_at', null)

            let collected = 0
            let pending = 0
            let water = 0
            let waterAmt = 0
            let electric = 0
            let electricAmt = 0
            let counts = { paid: 0, waiting_verify: 0, unpaid: 0 }

            monthBills?.forEach(b => {
                if (b.status === 'paid') {
                    collected += (b.total_amount || 0)
                    counts.paid++
                } else if (b.status === 'waiting_verify') {
                    pending += (b.total_amount || 0)
                    counts.waiting_verify++
                } else {
                    pending += (b.total_amount || 0)
                    counts.unpaid++
                }

                // Units calculation
                water += (b.water_curr - b.water_prev) || 0
                waterAmt += (b.water_amount || 0)
                electric += (b.electric_curr - b.electric_prev) || 0
                electricAmt += (b.electric_amount || 0)
            })

            // Process History
            const historyMap = new Map<string, number>()
            historyBills?.forEach(b => {
                const m = new Date(b.period_start).toLocaleDateString('th-TH', { month: 'short' })
                historyMap.set(m, (historyMap.get(m) || 0) + (b.total_amount || 0))
            })

            const historicalRevenue = []
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const m = d.toLocaleDateString('th-TH', { month: 'short' })
                historicalRevenue.push({ month: m, amount: historyMap.get(m) || 0 })
            }

            setOverviewData({
                monthlyRevenue: collected + pending,
                collectedRevenue: collected,
                pendingRevenue: pending,
                projectedRevenue: collected + pending,
                occupancyRate: totalRooms ? Math.round((occupiedRooms || 0) / totalRooms * 100) : 0,
                waterUnits: water,
                waterAmount: waterAmt,
                electricityUnits: electric,
                electricityAmount: electricAmt,
                billStatusCounts: counts,
                historicalRevenue
            })

        } catch (err) {
            console.error('Overview Data Error:', err)
        } finally {
            setFetchingOverview(false)
        }
    }

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
        { id: 'stats', name: 'ภาพรวม', outlineIcon: ChartBarIcon, solidIcon: ChartBarIconSolid },
        { id: 'rooms', name: 'สถานะห้อง', outlineIcon: Squares2X2Icon, solidIcon: Squares2X2IconSolid },
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
                        <header className="relative pt-14 pb-20 px-6">
                            {/* App Name at Top Center */}
                            <div className="absolute top-5 left-0 right-0 flex justify-center z-10 pointer-events-none">
                                <span className="text-[15px] font-black tracking-[0.5em] text-white/60 uppercase drop-shadow-lg">HORPAY</span>
                            </div>

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
                                                                router.push('/dashboard/rooms'); // Link to dedicated manage rooms page
                                                            }}
                                                            className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group"
                                                        >
                                                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <Squares2X2Icon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                            </div>
                                                            จัดการห้องพัก
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

                                                        <button
                                                            onClick={() => {
                                                                setIsMenuOpen(false);
                                                                setIsChangePasswordOpen(true);
                                                                setPasswordError('');
                                                                setPasswordSuccess('');
                                                                setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
                                                            }}
                                                            className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group"
                                                        >
                                                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                                                <LockClosedIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                            </div>
                                                            เปลี่ยนรหัสผ่าน
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
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
                                        <Squares2X2Icon className="w-5 h-5 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">ห้องทั้งหมด</p>
                                        <p className="text-2xl font-black text-gray-800 leading-none">{stats.total}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-50 to-green-100 text-green-600 flex items-center justify-center shrink-0 border border-green-100/50">
                                        <HomeIcon className="w-5 h-5 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">ห้องว่าง</p>
                                        <p className="text-2xl font-black text-gray-800 leading-none">{stats.vacant}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                                        <UserGroupIcon className="w-5 h-5 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">มีผู้เช่า</p>
                                        <p className="text-2xl font-black text-gray-800 leading-none">{stats.occupied}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100/50">
                                        <BanknotesIcon className="w-5 h-5 stroke-[2]" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-gray-400 font-bold mb-0.5 tracking-wide">ห้องค้างชำระ</p>
                                        <p className="text-2xl font-black text-gray-800 leading-none">{stats.pendingPayments}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Quick Actions ── */}
                            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-50">
                                <h2 className="text-sm font-black text-gray-800 mb-4 tracking-tight px-1 text-center">เมนูใช้งาน</h2>
                                <div className="grid grid-cols-3 gap-y-10 gap-x-2">
                                    {[
                                        { name: 'จดมิเตอร์', icon: DocumentPlusIcon, color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100 shadow-green-100/50', path: '/dashboard/meter' },
                                        { name: 'จัดการบิล & การชำระเงิน', icon: BanknotesIcon, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 shadow-emerald-100/50', path: '/dashboard/billing' },
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
                                            <div className={`w-[64px] h-[64px] rounded-[1.5rem] flex items-center justify-center border-2 transition-all shadow-lg ${action.color}`}>
                                                <action.icon className="w-7 h-7 stroke-[2.2]" />
                                            </div>
                                            <span className="text-[12px] font-black text-gray-700 text-center tracking-tight leading-none group-hover:text-green-600 transition-colors uppercase">{action.name}</span>
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

                {/* ── Stats Tab Content (NEW) ── */}
                {activeTab === 'stats' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full px-6 pt-12 pb-32">
                        <div className="mb-8">
                            <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                                <span className="text-4xl">📊</span> ภาพรวมหอพัก
                            </h1>
                            <p className="text-gray-400 font-bold text-sm mt-1">สรุปข้อมูลการเงินและสถานะรายเดือน</p>
                        </div>

                        {fetchingOverview ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-10 h-10 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                                <p className="text-gray-400 font-bold text-sm">กำลังคำนวณข้อมูล...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* ── Revenue Card ── */}
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-[1.8rem] p-5 text-green-700 shadow-sm border border-green-100">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <p className="text-green-600 text-[11px] font-black uppercase tracking-widest mb-1">รายรับเดือนนี้</p>
                                            <h2 className="text-3xl font-black tracking-tight">฿{overviewData.monthlyRevenue.toLocaleString()}</h2>
                                        </div>
                                        <div className="bg-white/50 p-2.5 rounded-2xl backdrop-blur-md">
                                            <BanknotesSolid className="w-6 h-6" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-green-600">เก็บแล้ว {Math.round((overviewData.collectedRevenue / (overviewData.monthlyRevenue || 1)) * 100)}%</span>
                                                <span className="text-green-800">฿{overviewData.collectedRevenue.toLocaleString()}</span>
                                            </div>
                                            <div className="h-2 bg-green-200/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-600 transition-all duration-1000"
                                                    style={{ width: `${(overviewData.collectedRevenue / (overviewData.monthlyRevenue || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold pt-2 border-t border-green-200/50 text-green-600">
                                            <span>ยังไม่เก็บ</span>
                                            <span className="text-green-800">฿{overviewData.pendingRevenue.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Revenue Graph ── */}
                                <div className="bg-white rounded-[1.5rem] p-5 border-2 border-gray-50 shadow-sm">
                                    <h3 className="text-sm font-black text-gray-800 mb-6 flex items-center gap-2">
                                        <ClockIcon className="w-4 h-4 text-green-500" />
                                        รายรับรายเดือน (6 เดือนล่าสุด)
                                    </h3>

                                    <div className="h-40 flex items-end justify-between gap-3 px-2">
                                        {overviewData.historicalRevenue.map((data, i) => {
                                            const maxAmount = Math.max(...overviewData.historicalRevenue.map(h => h.amount), 1);
                                            const height = (data.amount / maxAmount) * 100;
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                                                    {/* Tooltip */}
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                        ฿{data.amount.toLocaleString()}
                                                    </div>
                                                    <div className="w-full relative flex items-end justify-center h-full">
                                                        <div
                                                            className={`w-full rounded-t-lg transition-all duration-700 ${i === 5 ? 'bg-green-500' : 'bg-gray-100 group-hover:bg-green-200'}`}
                                                            style={{ height: `${Math.max(height, 5)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[10px] font-black ${i === 5 ? 'text-green-600' : 'text-gray-400'}`}>
                                                        {data.month}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* ── Status & Utilities Grid ── */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 rounded-2xl p-4 border-2 border-blue-100">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                                <UsersIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[11px] font-black text-blue-900 uppercase">อัตราพัก</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-2xl font-black text-blue-600">{overviewData.occupancyRate}%</span>
                                            <span className="text-[10px] font-bold text-blue-400 pb-1">Occupied</span>
                                        </div>
                                    </div>
                                    <div className="bg-orange-50 rounded-2xl p-4 border-2 border-orange-100">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                                                <ArrowPathIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[11px] font-black text-orange-900 uppercase">การใช้น้ำ/ไฟ</span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[11px] font-bold text-orange-600">💡 ไฟ: {overviewData.electricityUnits} หน่วย</p>
                                                <p className="text-[10px] font-black text-orange-700">฿{overviewData.electricityAmount.toLocaleString()}</p>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <p className="text-[11px] font-bold text-blue-600">💧 น้ำ: {overviewData.waterUnits} หน่วย</p>
                                                <p className="text-[10px] font-black text-blue-700">฿{overviewData.waterAmount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Bill Status Summary ── */}
                                <div className="bg-white rounded-[1.5rem] p-1.5 border-2 border-gray-50 shadow-sm overflow-hidden">
                                    <div className="p-3 border-b border-gray-50 bg-gray-50/30 rounded-t-[1.3rem]">
                                        <h3 className="text-[13px] font-black text-gray-800 tracking-tight">สถานะบิลเดือนนี้</h3>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        <div 
                                            onClick={() => router.push('/dashboard/billing')}
                                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-700 group-hover:text-green-600 transition-colors">ชำระแล้ว</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-green-600">{overviewData.billStatusCounts.paid} ห้อง</span>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-green-400 transition-colors" />
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => router.push('/dashboard/billing')}
                                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <ClockIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">รอยืนยันสลิป</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-blue-600">{overviewData.billStatusCounts.waiting_verify} ห้อง</span>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-blue-400 transition-colors" />
                                            </div>
                                        </div>
                                        <div 
                                            onClick={() => router.push('/dashboard/billing')}
                                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                                    <BellIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-700 group-hover:text-red-600 transition-colors">ค้างชำระ</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-red-600">{overviewData.billStatusCounts.unpaid} ห้อง</span>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-red-400 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Rooms Tab Content (Premium Redesign) ── */}
                {activeTab === 'rooms' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full px-6 pt-12 pb-32">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                                    <span className="text-4xl">🏢</span> สถานะห้องพัก
                                </h1>
                                <p className="text-black-400 font-bold text-sm mt-1">มีทั้งหมด {rooms.length} ห้อง</p>
                            </div>
                        </div>

                        {rooms.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                <p className="text-gray-400 font-bold">ยังไม่มีข้อมูลห้องพัก</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => (a || '').localeCompare(b || '', undefined, {numeric: true})).map(floor => (
                                    <div key={floor} className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-2 bg-green-500 rounded-full shadow-sm shadow-green-100" />
                                                <h2 className="text-xl font-black text-gray-800 tracking-tight">ชั้น {floor}</h2>
                                            </div>
                                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                                {rooms.filter(r => r.floor === floor).length} ห้อง
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {rooms.filter(r => r.floor === floor).sort((a, b) => a.room_number.localeCompare(b.room_number)).map((room) => {
                                                const isUnpaid = pendingRoomIds.has(room.id);
                                                const isOccupied = room.status === 'occupied';

                                                // Color & Info Logic
                                                let theme = {
                                                    bg: 'bg-white',
                                                    border: 'border-gray-100',
                                                    iconBg: 'bg-green-50 text-green-600',
                                                    badge: 'bg-green-500 text-white',
                                                    status: 'ว่าง',
                                                    icon: KeyIcon,
                                                    shadow: 'shadow-gray-100'
                                                };

                                                if (isUnpaid) {
                                                    theme = {
                                                        bg: 'bg-white',
                                                        border: 'border-red-100',
                                                        iconBg: 'bg-orange-50 text-orange-600',
                                                        badge: 'bg-orange-500 text-white',
                                                        status: 'ค้างชำระ',
                                                        icon: BellIcon,
                                                        shadow: 'shadow-orange-50'
                                                    };
                                                } else if (isOccupied) {
                                                    theme = {
                                                        bg: 'bg-white',
                                                        border: 'border-blue-100',
                                                        iconBg: 'bg-blue-50 text-blue-600',
                                                        badge: 'bg-blue-600 text-white',
                                                        status: 'มีคนพัก',
                                                        icon: BuildingOfficeIcon,
                                                        shadow: 'shadow-blue-50'
                                                    };
                                                }
                                                const activeTenant = room.tenants?.find(t => t.status === 'active');

                                                return (
                                                    <div
                                                        key={room.id}
                                                        className={`group relative overflow-hidden bg-white rounded-[1.5rem] border-2 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${theme.border} ${theme.shadow}`}
                                                    >
                                                        {/* Status Badge */}
                                                        <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest ${theme.badge} z-20`}>
                                                            {theme.status}
                                                        </div>

                                                        {isOccupied && activeTenant?.line_user_id && (
                                                            <div className="absolute top-7 right-0 px-2.5 py-1 bg-green-500 text-white rounded-l-lg shadow-sm z-10 animate-in slide-in-from-right duration-500 border-y border-l border-green-600/20">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                                                                        <CheckIcon className="w-2.5 h-2.5 text-green-600 stroke-[4]" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black leading-none tracking-tight">LINE Verified</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:scale-110 ${theme.iconBg}`}>
                                                                    <theme.icon className="w-5 h-5 stroke-[2.2]" />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">ห้องหมายเลข</p>
                                                                <h3 className="text-xl font-black text-gray-800 tracking-tight leading-none mb-2">{room.room_number}</h3>
                                                                
                                                                {isOccupied && activeTenant && (
                                                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <div className="relative">
                                                                                <UserIcon className="w-4 h-4 text-blue-500 shrink-0 bg-blue-50 rounded-md p-0.5" />
                                                                                {activeTenant.line_user_id && (
                                                                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white flex items-center justify-center">
                                                                                        <CheckIcon className="w-1.5 h-1.5 text-white stroke-[4]" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[12px] font-black text-gray-700 truncate tracking-tight">
                                                                                {activeTenant.name}
                                                                                {activeTenant.line_user_id && <span className="ml-1 text-[8px] text-green-600 font-bold">(ตรงกัน)</span>}
                                                                            </span>
                                                                        </div>
                                                                        {activeTenant.phone && (
                                                                            <div className="flex items-center gap-2">
                                                                                {activeTenant.line_user_id ? (
                                                                                    <div className="w-4 h-4 bg-green-50 rounded-md flex items-center justify-center shrink-0">
                                                                                        <ChatBubbleLeftRightIcon className="w-3 h-3 text-green-600" />
                                                                                    </div>
                                                                                ) : (
                                                                                    <DevicePhoneMobileIcon className="w-4 h-4 text-gray-400 shrink-0 bg-gray-50 rounded-md p-0.5" />
                                                                                )}
                                                                                <span className={`text-[11px] font-bold tracking-tighter ${activeTenant.line_user_id ? 'text-green-700' : 'text-gray-500'}`}>
                                                                                    {activeTenant.phone}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="pt-1.5 flex items-center justify-between">
                                                                <span className="text-[11px] font-bold text-gray-400">
                                                                    ฿{(room.base_price?.toLocaleString() || '0')}
                                                                </span>
                                                                <div className="w-5 h-5 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                                                    <ChevronRightIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                        </div>
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

                                                {/* Toggle Switch */}
                                                <div className="flex flex-col items-end gap-1 px-4 py-2 bg-white rounded-2xl border-2 border-gray-50 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${showLineConfig ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {showLineConfig ? 'พร้อมแก้ไข' : 'ปิดอยู่'}
                                                        </span>
                                                        <button
                                                            onClick={() => setShowLineConfig(!showLineConfig)}
                                                            className={`relative w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${showLineConfig ? 'bg-green-500' : 'bg-gray-200 shadow-inner'}`}
                                                        >
                                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${showLineConfig ? 'translate-x-6' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`grid gap-6 transition-all duration-500 transform ${showLineConfig ? 'opacity-100 translate-y-0 filter-none' : 'opacity-40 translate-y-2 pointer-events-none grayscale-0'}`}>
                                                {/* Overlay message when locked */}
                                                {!showLineConfig && (
                                                    <div className="absolute inset-0 z-50 flex items-center justify-center p-8 text-center bg-white/50 backdrop-blur-[2px] rounded-[2.5rem]">
                                                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                                                            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-2">
                                                                <LockClosedIcon className="w-6 h-6" />
                                                            </div>
                                                            <p className="text-sm font-black text-gray-700">ฟีเจอร์นี้ถูกปิดใช้งานอยู่</p>
                                                            <p className="text-[11px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest">กรุณากดเปิดที่ปุ่มด้านบน<br/>เพื่อความปลอดภัยและป้องกันการกดเล่น</p>
                                                        </div>
                                                    </div>
                                                )}
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
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">Channel Access Token</label>
                                                        <textarea
                                                            value={lineConfig.access_token}
                                                            onChange={(e) => setLineConfig({ ...lineConfig, access_token: e.target.value })}
                                                            className="w-full h-32 bg-white border-2 border-gray-50 rounded-2xl p-5 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm resize-none text-sm break-all"
                                                            placeholder="eyJhbGciOiJIUzI1NiJ9..."
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={handleTestConnection}
                                                        disabled={isTestingConnection || !lineConfig.access_token}
                                                        className="w-full h-14 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl border-2 border-blue-100 font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                                                    >
                                                        {isTestingConnection ? (
                                                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                                        ) : (
                                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                                        )}
                                                        {isTestingConnection ? 'กำลังตรวจสอบ...' : 'ทดสอบการเชื่อมต่อ'}
                                                    </button>

                                                    {testResult && (
                                                        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in duration-300 ${testResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                                            {testResult.success ? <CheckCircleIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
                                                            <span className="text-xs font-black">{testResult.message}</span>
                                                        </div>
                                                    )}
                                                </div>
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

                {activeTab !== 'overview' && activeTab !== 'rooms' && activeTab !== 'stats' && activeTab !== 'settings' && (
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
                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/80 backdrop-blur-xl border-t border-gray-100 px-2 py-4 pb-8 flex justify-around items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] rounded-t-[2.5rem] sm:rounded-b-[3rem]">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        const Icon = isActive ? item.solidIcon : item.outlineIcon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`relative flex flex-col items-center gap-1.5 w-[72px] transition-all duration-300 outline-none group ${isActive ? 'text-green-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <div className="relative flex items-center justify-center">
                                    {isActive && (
                                        <div className="absolute inset-0 bg-green-100 rounded-2xl scale-[1.6] blur-sm animate-in zoom-in duration-300" />
                                    )}
                                    <Icon className={`w-[24px] h-[24px] relative z-10 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                </div>
                                <span className={`text-[10px] font-black tracking-tight relative z-10 ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                                    {item.name}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-2 w-1 h-1 bg-green-600 rounded-full shadow-[0_0_8px_rgba(22,163,74,0.6)]" />
                                )}
                            </button>
                        );
                    })}
                </div>
 
                 {/* ── Change Password Modal ── */}
                 {isChangePasswordOpen && (
                     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                         <div 
                             className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                             onClick={() => !isSubmittingPassword && setIsChangePasswordOpen(false)}
                         />
                         <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                             {/* Header */}
                             <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 text-white relative">
                                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                 <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                     <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                         <LockClosedIcon className="w-6 h-6" />
                                     </div>
                                     เปลี่ยนรหัสผ่าน
                                 </h3>
                                 <p className="text-green-100 font-bold text-sm mt-2 opacity-80">เพื่อความปลอดภัยของข้อมูลบัญชีคุณ</p>
                             </div>
 
                             <form onSubmit={handlePasswordChange} className="p-8 space-y-6">
                                 <div className="space-y-4">
                                     <div className="space-y-1.5">
                                         <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">รหัสผ่านเดิม</label>
                                         <div className="relative group/field">
                                             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/field:text-green-500 transition-colors">
                                                 <KeyIcon className="w-5 h-5" />
                                             </div>
                                             <input
                                                 required
                                                 type="password"
                                                 value={passwordData.oldPassword}
                                                 onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                                 className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-green-500 transition-all outline-none"
                                                 placeholder="••••••••"
                                             />
                                         </div>
                                     </div>
 
                                     <div className="h-px bg-gray-100 mx-4" />
 
                                     <div className="space-y-1.5">
                                         <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">รหัสผ่านใหม่</label>
                                         <div className="relative group/field">
                                             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/field:text-green-500 transition-colors">
                                                 <LockClosedIcon className="w-5 h-5" />
                                             </div>
                                             <input
                                                 required
                                                 minLength={6}
                                                 type="password"
                                                 value={passwordData.newPassword}
                                                 onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                 className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-green-500 transition-all outline-none"
                                                 placeholder="รหัสใหม่ (อย่างน้อย 6 ตัว)"
                                             />
                                         </div>
                                     </div>
 
                                     <div className="space-y-1.5">
                                         <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ยืนยันรหัสผ่านใหม่</label>
                                         <div className="relative group/field">
                                             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/field:text-green-500 transition-colors">
                                                 <CheckCircleIcon className="w-5 h-5" />
                                             </div>
                                             <input
                                                 required
                                                 type="password"
                                                 value={passwordData.confirmPassword}
                                                 onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                 className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-green-500 transition-all outline-none"
                                                 placeholder="ยืนยันรหัสใหม่อีกครั้ง"
                                             />
                                         </div>
                                     </div>
                                 </div>
 
                                 {(passwordError || passwordSuccess) && (
                                     <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${passwordSuccess ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                         {passwordSuccess ? <CheckCircleIcon className="w-5 h-5" /> : <BellIcon className="w-5 h-5" />}
                                         <span className="text-xs font-black">{passwordError || passwordSuccess}</span>
                                     </div>
                                 )}
 
                                 <div className="flex gap-3 pt-2">
                                     <button
                                         type="button"
                                         disabled={isSubmittingPassword}
                                         onClick={() => setIsChangePasswordOpen(false)}
                                         className="flex-1 h-14 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
                                     >
                                         ยกเลิก
                                     </button>
                                     <button
                                         type="submit"
                                         disabled={isSubmittingPassword}
                                         className="flex-[2] h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black shadow-lg shadow-green-100 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                     >
                                         {isSubmittingPassword ? (
                                             <>
                                                 <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                                 กำลังบันทึก...
                                             </>
                                         ) : (
                                             <>บันทึกรหัสผ่านใหม่</>
                                         )}
                                     </button>
                                 </div>
                             </form>
                         </div>
                     </div>
                 )}
             </div>
         </div>
     );
}
