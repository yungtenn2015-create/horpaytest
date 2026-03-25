'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    ExclamationTriangleIcon,
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
    LockClosedIcon,
    BoltIcon,
    TrashIcon,
    PencilSquareIcon,
    MagnifyingGlassIcon,
    UserPlusIcon,
    XMarkIcon
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
        planned_move_out_date?: string | null;
    }[];
    dorm_id: string;
    deleted_at: string | null;
}

interface Service {
    id: string;
    name: string;
    price: number;
}

interface TenantContract {
    id: string;
    dorm_id: string;
    name: string;
    phone: string;
    emergency_contact: string | null;
    occupation: string | null;
    car_registration: string | null;
    motorcycle_registration: string | null;
    address: string | null;
    start_date: string;
    end_date: string;
    deposit_amount: number;
    status: 'pending' | 'moved_in' | 'cancelled' | 'expired';
    created_at: string;
    tenants?: {
        room_id: string;
        rooms: {
            room_number: string;
        };
    }[];
}

export default function DashboardClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeTab = searchParams.get('tab') || 'overview'

    // Helper to change tab via URL
    const setActiveTab = (tab: string) => {
        router.push(`/dashboard?tab=${tab}`)
    }

    const [loading, setLoading] = useState(true)
    const [dorm, setDorm] = useState<Dorm | null>(null)
    const [rooms, setRooms] = useState<Room[]>([])
    const [userInitial, setUserInitial] = useState('O')
    const [userName, setUserName] = useState('')
    const [dbError, setDbError] = useState('') // added error state
    const [isMenuOpen, setIsMenuOpen] = useState(false) // for user dropdown
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false) // for notifications dropdown
    const [pendingRoomIds, setPendingRoomIds] = useState<Set<string>>(new Set())
    const [waitingVerifyRoomIds, setWaitingVerifyRoomIds] = useState<Set<string>>(new Set())
    const [unpaidRoomIds, setUnpaidRoomIds] = useState<Set<string>>(new Set())
    const [overdueRoomIds, setOverdueRoomIds] = useState<Set<string>>(new Set())
    const [movingOutRoomIds, setMovingOutRoomIds] = useState<Set<string>>(new Set())
    const [selectedFloor, setSelectedFloor] = useState<string>('all')
    const [selectedStatus, setSelectedStatus] = useState<string>('all')
    const [stats, setStats] = useState({
        total: 0,
        occupied: 0,
        vacant: 0,
        pendingPayments: 0,
        movingOut: 0
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
        payment_due_day: 5,
        electric_rate_per_unit: 0,
        water_rate_per_unit: 0,
        water_billing_type: 'per_unit' as 'per_unit' | 'flat_rate',
        water_flat_rate: 0
    })

    const [contractTab, setContractTab] = useState<'pending' | 'active' | 'old'>('active');

    // Label formatting for Buddhist Era
    const formatThaiDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            const thaiYear = date.getFullYear() + 543;
            return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${thaiYear}`;
        } catch (e) {
            return '';
        }
    };

    // --- Custom Calendar State ---
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [calendarValue, setCalendarValue] = useState('');
    const [calendarFieldName, setCalendarFieldName] = useState<'start_date' | 'end_date' | null>(null);
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());

    const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    const openCustomCalendar = (fieldName: 'start_date' | 'end_date', currentValue: string) => {
        setCalendarFieldName(fieldName);
        setCalendarValue(currentValue);
        setCalendarViewDate(currentValue ? new Date(currentValue) : new Date());
        setIsCalendarOpen(true);
    };

    const handleSelectDate = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        setContractFormData(prev => ({ ...prev, [calendarFieldName!]: dateStr }));
        setIsCalendarOpen(false);
    };

    const renderCustomCalendar = () => {
        if (!isCalendarOpen) return null;

        const year = calendarViewDate.getFullYear();
        const month = calendarViewDate.getMonth();

        // Days calculation
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const grid = [];
        // Prev month days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            grid.push({ day: daysInPrevMonth - i, month: 'prev', date: new Date(year, month - 1, daysInPrevMonth - i) });
        }
        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            grid.push({ day: d, month: 'current', date: new Date(year, month, d) });
        }
        // Next month days
        const remaining = 42 - grid.length;
        for (let d = 1; d <= remaining; d++) {
            grid.push({ day: d, month: 'next', date: new Date(year, month + 1, d) });
        }

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsCalendarOpen(false)} />
                <div className="relative w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-primary p-6 text-white text-center relative">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setCalendarViewDate(new Date(year, month - 1, 1))}
                                className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="text-center">
                                <p className="text-[11px] font-black uppercase tracking-widest opacity-80 mb-0.5">{THAI_MONTHS[month]}</p>
                                <h4 className="text-xl font-black">{year + 543}</h4>
                            </div>
                            <button
                                onClick={() => setCalendarViewDate(new Date(year, month + 1, 1))}
                                className="w-10 h-10 flex items-center justify-center hover:bg-white/20 rounded-xl transition-all"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {THAI_DAYS_SHORT.map(d => (
                                <div key={d} className="text-center text-[11px] font-black text-gray-400 uppercase tracking-widest py-2">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {grid.map((item, idx) => {
                                const isToday = new Date().toDateString() === item.date.toDateString();
                                const isSelected = calendarValue === `${item.date.getFullYear()}-${(item.date.getMonth() + 1).toString().padStart(2, '0')}-${item.date.getDate().toString().padStart(2, '0')}`;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectDate(item.date)}
                                        className={`h-11 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center
                                            ${item.month === 'current' ? 'text-gray-900 hover:bg-primary/10' : 'text-gray-300'}
                                            ${isToday ? 'bg-emerald-50 text-primary border border-primary/20' : ''}
                                            ${isSelected ? '!bg-primary !text-white !shadow-lg !shadow-primary/30 active:scale-90 scale-105 z-10' : ''}
                                        `}
                                    >
                                        {item.day}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => handleSelectDate(new Date())}
                                className="flex-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl font-black text-[12px] transition-all uppercase tracking-widest"
                            >
                                วันนี้
                            </button>
                            <button
                                onClick={() => setIsCalendarOpen(false)}
                                className="flex-1 py-3.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl font-black text-[12px] transition-all uppercase tracking-widest"
                            >
                                ตกลง
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    const [services, setServices] = useState<Service[]>([])
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
            unpaid: 0,
            overdue: 0
        },
        historicalRevenue: [] as { month: string, amount: number }[],
        historicalUtilities: [] as { month: string, electricity: number, water: number }[]
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

    // --- Contract Recording States (NEW) ---
    const [contracts, setContracts] = useState<TenantContract[]>([])
    const [fetchingContracts, setFetchingContracts] = useState(false)
    const [isContractFormOpen, setIsContractFormOpen] = useState(false)
    const [isSubmittingContract, setIsSubmittingContract] = useState(false)
    const [editingContract, setEditingContract] = useState<TenantContract | null>(null)
    const [contractSuccess, setContractSuccess] = useState('')
    const [contractError, setContractError] = useState('')
    const [contractFormData, setContractFormData] = useState({
        name: '',
        phone: '',
        emergency_contact: '',
        occupation: '',
        car_registration: '',
        motorcycle_registration: '',
        address: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        deposit_amount: ''
    })
    const [contractSearchQuery, setContractSearchQuery] = useState('')

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

    // --- Contract Management Logic (NEW) ---
    const fetchContracts = useCallback(async () => {
        if (!dorm?.id) return
        setFetchingContracts(true)
        setContractError('')
        const supabase = createClient()
        try {
            const { data, error } = await supabase
                .from('tenant_contracts')
                .select('*, tenants(room_id, rooms(room_number))')
                .eq('dorm_id', dorm.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setContracts(data || [])
        } catch (err: any) {
            console.error('Error fetching contracts:', err.message || err.code || err, err)
            setContractError(err.message?.includes('relation') ? 'กรุณารัน SQL Migration เพื่อสร้างตารางบันทึกสัญญา' : 'ไม่สามารถโหลดข้อมูลสัญญาได้')
        } finally {
            setFetchingContracts(false)
        }
    }, [dorm?.id])

    useEffect(() => {
        if (activeTab === 'tenants') {
            fetchContracts()
        }
    }, [activeTab, fetchContracts])

    const handleSaveContract = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!dorm?.id) return

        setIsSubmittingContract(true)
        setContractError('')
        setContractSuccess('')

        const supabase = createClient()
        try {
            const payload = {
                dorm_id: dorm.id,
                name: contractFormData.name,
                phone: contractFormData.phone,
                emergency_contact: contractFormData.emergency_contact || null,
                occupation: contractFormData.occupation || null,
                car_registration: contractFormData.car_registration || null,
                motorcycle_registration: contractFormData.motorcycle_registration || null,
                address: contractFormData.address || null,
                start_date: contractFormData.start_date,
                end_date: contractFormData.end_date,
                deposit_amount: Number(contractFormData.deposit_amount) || 0,
                status: editingContract ? editingContract.status : 'pending'
            }

            if (editingContract) {
                const { error } = await supabase
                    .from('tenant_contracts')
                    .update(payload)
                    .eq('id', editingContract.id)
                if (error) throw error

                // NEW: Also update active tenant data that links to this contract
                const tenantSyncPayload = {
                    name: contractFormData.name,
                    phone: contractFormData.phone,
                    emergency_contact: contractFormData.emergency_contact || null,
                    occupation: contractFormData.occupation || null,
                    car_registration: contractFormData.car_registration || null,
                    motorcycle_registration: contractFormData.motorcycle_registration || null,
                    address: contractFormData.address || null
                }

                const { data: updatedTenants } = await supabase
                    .from('tenants')
                    .update(tenantSyncPayload)
                    .eq('tenant_contract_id', editingContract.id)
                    .eq('status', 'active')
                    .select('id')

                // Sync to lease_contracts as well
                if (updatedTenants && updatedTenants.length > 0) {
                    const activeTenantIds = updatedTenants.map(t => t.id)
                    await supabase
                        .from('lease_contracts')
                        .update({
                            start_date: contractFormData.start_date,
                            end_date: contractFormData.end_date,
                            deposit_amount: Number(contractFormData.deposit_amount) || 0
                        })
                        .in('tenant_id', activeTenantIds)
                        .eq('status', 'active')
                }
            } else {
                const { error } = await supabase
                    .from('tenant_contracts')
                    .insert([payload])
                if (error) throw error
            }

            setContractSuccess(editingContract ? 'แก้ไขสัญญาสำเร็จ' : 'บันทึกสัญญาสำเร็จ')
            setTimeout(() => {
                setIsContractFormOpen(false)
                setEditingContract(null)
                setContractFormData({
                    name: '',
                    phone: '',
                    emergency_contact: '',
                    occupation: '',
                    car_registration: '',
                    motorcycle_registration: '',
                    address: '',
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: '',
                    deposit_amount: ''
                })
                setContractSuccess('')
            }, 1500)
            fetchContracts()
        } catch (err: any) {
            setContractError(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setIsSubmittingContract(false)
        }
    }

    const handleDeleteContract = async (id: string, status?: string) => {
        if (status === 'moved_in') {
            alert('ไม่สามารถลบสัญญานี้ได้ เนื่องจากผู้เช่ายังพักอยู่จริง กรุณาทำรายการย้ายออกก่อน')
            return
        }

        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกสัญญานี้?')) return

        const supabase = createClient()
        try {
            // Check for any truly active tenant in the database just in case UI status is old
            const { data: activeTenants } = await supabase
                .from('tenants')
                .select('id')
                .eq('tenant_contract_id', id)
                .eq('status', 'active')

            if (activeTenants && activeTenants.length > 0) {
                alert('ไม่สามารถลบสัญญานี้ได้ เนื่องจากมีผู้เช่าที่เข้าพักอยู่จริงในระบบ')
                return
            }

            // Unlink tenants to satisfy foreign key constraint
            await supabase
                .from('tenants')
                .update({ tenant_contract_id: null })
                .eq('tenant_contract_id', id)

            const { error } = await supabase
                .from('tenant_contracts')
                .delete()
                .eq('id', id)
            if (error) throw error
            fetchContracts()
        } catch (err: any) {
            alert('ไม่สามารถลบข้อมูลได้: ' + err.message)
        }
    }

    const openEditContract = (contract: TenantContract) => {
        setEditingContract(contract)
        setContractFormData({
            name: contract.name,
            phone: contract.phone,
            emergency_contact: contract.emergency_contact || '',
            occupation: contract.occupation || '',
            car_registration: contract.car_registration || '',
            motorcycle_registration: contract.motorcycle_registration || '',
            address: contract.address || '',
            start_date: contract.start_date,
            end_date: contract.end_date,
            deposit_amount: String(contract.deposit_amount)
        })
        setIsContractFormOpen(true)
    }


    // LINE Settings Helpers
    const [showLineConfig, setShowLineConfig] = useState(false)
    const [isTestingConnection, setIsTestingConnection] = useState(false)
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
    const [copied, setCopied] = useState(false)
    const [newServiceName, setNewServiceName] = useState('')
    const [newServicePrice, setNewServicePrice] = useState('')

    const addService = () => {
        if (!newServiceName || !newServicePrice) return
        const newService: Service = {
            id: Math.random().toString(36).substr(2, 9),
            name: newServiceName,
            price: parseFloat(newServicePrice) || 0
        }
        setServices([...services, newService])
        setNewServiceName('')
        setNewServicePrice('')
    }

    const removeService = (id: string) => {
        setServices(services.filter(s => s.id !== id))
    }

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

    const refreshDashboard = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        else setFetchingOverview(true);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            return;
        }

        const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Owner';
        setUserName(name);
        setUserInitial(name.charAt(0).toUpperCase());

        try {
            console.log("Refreshing Dashboard Data...");
            // 1. Get Latest Dorm
            const { data: dormsData, error: dormError } = await supabase
                .from('dorms')
                .select('*')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1);

            if (dormError) throw dormError;
            if (!dormsData || dormsData.length === 0) {
                router.push('/setup-dorm');
                return;
            }

            const currentDorm = dormsData[0];
            setDorm(currentDorm);

            // 2. Get Rooms & Tenants
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('*, tenants(id, name, phone, line_user_id, status, planned_move_out_date)')
                .eq('dorm_id', currentDorm.id)
                .is('deleted_at', null)
                .order('room_number', { ascending: true });

            if (roomsError) throw roomsError;
            if (!roomsData) return;
            const activeRooms = roomsData;
            setRooms(activeRooms);

            // Get IDs of active tenants
            const activeTenantIds = activeRooms
                .flatMap(r => r.tenants || [])
                .filter(t => t.status === 'active')
                .map(t => t.id);

            console.log("Active Tenants:", activeTenantIds.length);

            // 3. Fetch Detailed Overview Stats
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const sixMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            const historyDateStr = `${sixMonthsAgoDate.getFullYear()}-${String(sixMonthsAgoDate.getMonth() + 1).padStart(2, '0')}-01`;

            console.log("Fetching bills for month >= ", dateStr);

            // Current Month Bills
            const { data: monthBills, error: billsErr } = await supabase
                .from('bills')
                .select('*, utilities(*)')
                .in('room_id', activeRooms.map(r => r.id))
                .neq('status', 'cancelled')
                .gte('billing_month', dateStr);

            if (billsErr) throw billsErr;

            // Historical Data (Revenue & Utilities)
            const { data: historyBills } = await supabase
                .from('bills')
                .select('total_amount, billing_month, utilities(curr_water_meter, prev_water_meter, curr_electric_meter, prev_electric_meter)')
                .in('room_id', activeRooms.map(r => r.id))
                .neq('status', 'cancelled')
                .gte('billing_month', historyDateStr);

            // Process Current Month Stats - Unified Room-Centric Logic
            let collected = 0;
            let pending = 0;
            let water = 0;
            let waterAmt = 0;
            let electric = 0;
            let electricAmt = 0;
            let counts: { paid: number, waiting_verify: number, unpaid: number, overdue: number, movingOut: number, overdueAmount: number } = { paid: 0, waiting_verify: 0, unpaid: 0, overdue: 0, movingOut: 0, overdueAmount: 0 };
            const pendingIdsSet = new Set<string>();
            const waitingVerifyIdsSet = new Set<string>();
            const unpaidIdsSet = new Set<string>();
            const overdueIdsSet = new Set<string>();
            const movingOutIdsSet = new Set<string>();

            // Map to track the "Best" status for each room this month
            // Priority: paid > waiting_verify > overdue > unpaid
            const roomBestStatus = new Map<string, string>();

            monthBills?.forEach(b => {
                const room = activeRooms.find(r => r.id === b.room_id);
                if (!room) return;

                const totalAmt = Number(b.total_amount) || 0;
                const s = String(b.status || '').toLowerCase().trim();

                // 1. Accumulate REVENUE for the entire dorm (including moved-out tenants)
                if (s === 'paid') {
                    collected += totalAmt;
                } else if (s !== 'cancelled') {
                    pending += totalAmt;
                }

                // 2. Accumulate UTILITIES for the entire dorm
                if (b.utilities) {
                    water += (b.utilities.curr_water_meter - b.utilities.prev_water_meter) || 0;
                    electric += (b.utilities.curr_electric_meter - b.utilities.prev_electric_meter) || 0;
                    waterAmt += Number(b.utilities.water_price) || 0;
                    electricAmt += Number(b.utilities.electric_price) || 0;
                }

                // 3. Update ROOM STATUS & COUNTS (ONLY for current active tenants)
                // This fix ensures the "Pending" list and "Counts" match actual occupancy.
                const activeTenant = (room.tenants as any[])?.find(t => t.status === 'active');
                const isCurrentTenantBill = activeTenant && b.tenant_id === activeTenant.id;

                if (!isCurrentTenantBill) return;

                let dueDate = b.due_date ? new Date(b.due_date) : null;
                // Hot-fix for March 2026: The system accidentally set due_date to 2026-03-05
                // but it should be 2026-04-05 based on the dorm's policy (next month's 5th).
                if (b.billing_month === '2026-03-01' && b.due_date === '2026-03-05') {
                    dueDate = new Date('2026-04-05');
                }

                const isOverdue = dueDate && dueDate < now && s !== 'paid' && s !== 'waiting_verify';
                const currentBest = roomBestStatus.get(b.room_id);

                if (s === 'paid') {
                    roomBestStatus.set(b.room_id, 'paid');
                } else if (s === 'waiting_verify') {
                    if (currentBest !== 'paid') {
                        roomBestStatus.set(b.room_id, 'waiting_verify');
                    }
                } else if (isOverdue || s === 'overdue') {
                    counts.overdueAmount += totalAmt;
                    if (currentBest !== 'paid' && currentBest !== 'waiting_verify') {
                        roomBestStatus.set(b.room_id, 'overdue');
                    }
                } else {
                    // Just Issued / Unpaid
                    if (currentBest !== 'paid' && currentBest !== 'waiting_verify' && currentBest !== 'overdue') {
                        roomBestStatus.set(b.room_id, 'unpaid');
                    }
                }
            });

            // 3.1 Check for Moving Out Status (Notice Given)
            activeRooms.forEach(room => {
                const activeTenant = (room.tenants as any[])?.find(t => t.status === 'active');
                if (activeTenant?.planned_move_out_date) {
                    movingOutIdsSet.add(room.id);
                }
            });

            // Finalize counts and pending IDs based on room status
            roomBestStatus.forEach((status, roomId) => {
                if (status === 'paid') {
                    counts.paid++;
                } else if (status === 'waiting_verify') {
                    counts.waiting_verify++;
                    pendingIdsSet.add(roomId);
                    waitingVerifyIdsSet.add(roomId);
                } else if (status === 'overdue') {
                    counts.overdue++;
                    pendingIdsSet.add(roomId);
                    overdueIdsSet.add(roomId);
                } else {
                    counts.unpaid++;
                    pendingIdsSet.add(roomId);
                    unpaidIdsSet.add(roomId);
                }
            });

            counts.movingOut = movingOutIdsSet.size;

            console.log("Room Stats (Grouped):", counts as any);
            setPendingRoomIds(pendingIdsSet);
            setWaitingVerifyRoomIds(waitingVerifyIdsSet);
            setUnpaidRoomIds(unpaidIdsSet);
            setOverdueRoomIds(overdueIdsSet);
            setMovingOutRoomIds(movingOutIdsSet);

            setStats({
                total: activeRooms.length,
                occupied: activeRooms.filter(r => r.status === 'occupied').length,
                vacant: activeRooms.filter(r => r.status === 'available').length,
                pendingPayments: pendingIdsSet.size,
                movingOut: movingOutIdsSet.size
            });

            // Process Historics
            const historyMap = new Map();
            const utilityHistoryMap = new Map();

            historyBills?.forEach(b => {
                const m = new Date(b.billing_month).toLocaleDateString('th-TH', { month: 'short' });

                // Revenue
                historyMap.set(m, (historyMap.get(m) || 0) + Number(b.total_amount || 0));

                // Utilities
                const u = utilityHistoryMap.get(m) || { electricity: 0, water: 0 };
                const utils = Array.isArray(b.utilities) ? b.utilities[0] : b.utilities;
                if (utils) {
                    u.electricity += (Number(utils.curr_electric_meter) - Number(utils.prev_electric_meter)) || 0;
                    u.water += (Number(utils.curr_water_meter) - Number(utils.prev_water_meter)) || 0;
                }
                utilityHistoryMap.set(m, u);
            });

            const historicalRevenue = [];
            const historicalUtilities = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const m = d.toLocaleDateString('th-TH', { month: 'short' });

                historicalRevenue.push({ month: m, amount: historyMap.get(m) || 0 });

                const uVals = utilityHistoryMap.get(m) || { electricity: 0, water: 0 };
                historicalUtilities.push({ month: m, ...uVals });
            }

            setOverviewData({
                monthlyRevenue: collected + pending,
                collectedRevenue: collected,
                pendingRevenue: pending,
                projectedRevenue: collected + pending,
                occupancyRate: activeRooms.length ? Math.round(activeRooms.filter(r => r.status === 'occupied').length / activeRooms.length * 100) : 0,
                waterUnits: water,
                waterAmount: waterAmt,
                electricityUnits: electric,
                electricityAmount: electricAmt,
                billStatusCounts: counts,
                historicalRevenue,
                historicalUtilities
            });

            // 5. Get Settings & LINE Config (Only once or if needed)
            if (isInitial) {
                const { data: settings } = await supabase
                    .from('dorm_settings')
                    .select('*')
                    .eq('dorm_id', currentDorm.id)
                    .single();

                if (settings) {
                    setSettingsData({
                        bank_name: settings.bank_name || '',
                        bank_account_no: settings.bank_account_no || '',
                        bank_account_name: settings.bank_account_name || '',
                        billing_day: settings.billing_day || 30,
                        payment_due_day: settings.payment_due_day || 5,
                        electric_rate_per_unit: settings.electric_rate_per_unit || 0,
                        water_rate_per_unit: settings.water_rate_per_unit || 0,
                        water_billing_type: settings.water_billing_type || 'per_unit',
                        water_flat_rate: settings.water_flat_rate || 0
                    });
                }

                // Get Itemized Services
                const { data: servicesData } = await supabase
                    .from('dorm_services')
                    .select('*')
                    .eq('dorm_id', currentDorm.id);

                if (servicesData) {
                    setServices(servicesData.map(s => ({
                        id: s.id,
                        name: s.name,
                        price: s.price
                    })));
                }

                try {
                    const { data: lineOa } = await supabase
                        .from('line_oa_configs')
                        .select('*')
                        .eq('dorm_id', currentDorm.id)
                        .maybeSingle();

                    if (lineOa) {
                        setLineConfig({
                            channel_id: lineOa.channel_id || '',
                            channel_secret: lineOa.channel_secret || '',
                            access_token: lineOa.access_token || '',
                            owner_line_user_id: lineOa.owner_line_user_id || ''
                        });
                    }
                } catch (e) { }

                setDormData({
                    name: currentDorm.name || '',
                    address: currentDorm.address || '',
                    contact_number: currentDorm.contact_number || ''
                });
            }

        } catch (err) {
            console.error("Dashboard Refresh Error:", err);
            setDbError(prev => prev + " [Refresh Error]");
        } finally {
            setLoading(false);
            setFetchingOverview(false);
        }
    }, [router]);

    useEffect(() => {
        refreshDashboard(true);
    }, [refreshDashboard]);

    // Re-fetch when switching tabs to ensure freshness
    useEffect(() => {
        if (activeTab === 'overview' || activeTab === 'stats' || activeTab === 'rooms') {
            refreshDashboard(false);
        }
    }, [activeTab, refreshDashboard]);

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
                payment_due_day: settingsData.payment_due_day,
                electric_rate_per_unit: settingsData.electric_rate_per_unit,
                water_rate_per_unit: settingsData.water_rate_per_unit,
                water_billing_type: settingsData.water_billing_type,
                water_flat_rate: settingsData.water_flat_rate
            }).eq('dorm_id', dorm.id)

            // 2.5 Update Services (Delete and Re-insert)
            await supabase.from('dorm_services').delete().eq('dorm_id', dorm.id)
            if (services.length > 0) {
                const servicesToInsert = services.map(s => ({
                    dorm_id: dorm.id,
                    name: s.name,
                    price: s.price
                }))
                await supabase.from('dorm_services').insert(servicesToInsert)
            }

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


    const renderContractsTab = () => {
        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header Section */}
                <div className="px-6 pt-12 mb-6 flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                            <span className="text-2xl">📄</span> บันทึกสัญญา
                        </h1>
                        <p className="text-black-400 font-bold text-sm mt-1">จัดการข้อมูลผู้เช่าและสัญญาเบื้องต้น</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingContract(null);
                            setContractFormData({
                                name: '', phone: '', emergency_contact: '', occupation: '',
                                car_registration: '', motorcycle_registration: '', address: '',
                                start_date: new Date().toISOString().split('T')[0], end_date: '',
                                deposit_amount: ''
                            });
                            setIsContractFormOpen(true);
                        }}
                        className="h-14 px-6 bg-green-600 hover:bg-green-700 text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-100/50 transition-all active:scale-95 group font-black"
                    >
                        <PlusIcon className="w-3 h-3 stroke-[3]" />
                        เพิ่ม
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 mb-4 space-y-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 group-focus-within:text-green-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={contractSearchQuery}
                            onChange={(e) => setContractSearchQuery(e.target.value)}
                            className="w-full h-14 bg-white border-2 border-gray-100 rounded-2xl pl-12 pr-4 font-bold text-gray-900 focus:border-green-500 focus:bg-white transition-all outline-none shadow-sm"
                            placeholder="ค้นหาตาม ชื่อ, เบอร์โทรศัพท์ หรือ ห้อง..."
                        />
                    </div>

                    {/* Category Tabs */}
                    <div className="bg-gray-50 p-1.5 rounded-[2rem] flex gap-1 border border-gray-100/50 shadow-inner">
                        <button
                            onClick={() => setContractTab('active')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] font-black text-[13px] transition-all duration-300 ${contractTab === 'active' ? 'bg-white text-blue-600 shadow-md ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <UsersIcon className="w-4 h-4" />
                            กำลังเข้าพัก
                        </button>
                        <button
                            onClick={() => setContractTab('pending')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] font-black text-[13px] transition-all duration-300 ${contractTab === 'pending' ? 'bg-white text-green-600 shadow-md ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <PlusIcon className="w-4 h-4" />
                            สัญญาใหม่
                        </button>
                        <button
                            onClick={() => setContractTab('old')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] font-black text-[13px] transition-all duration-300 ${contractTab === 'old' ? 'bg-white text-green-600 shadow-md ring-1 ring-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <ClockIcon className="w-4 h-4" />
                            สัญญาเก่า
                        </button>
                    </div>
                </div>

                {/* List Area */}
                <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-4 pt-2">
                    {contractError && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
                            <p>{contractError}</p>
                        </div>
                    )}
                    {fetchingContracts ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                            <p className="text-gray-400 font-bold text-sm">กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : (() => {
                        const filtered = contracts.filter(c => {
                            const query = contractSearchQuery.toLowerCase();
                            const roomNum = (c as any).tenants?.[0]?.rooms?.room_number?.toLowerCase() || '';
                            const matchesSearch = c.name.toLowerCase().includes(query) ||
                                c.phone.includes(query) ||
                                roomNum.includes(query);

                            let matchesTab = false;
                            if (contractTab === 'active') {
                                matchesTab = c.status === 'moved_in';
                            } else if (contractTab === 'pending') {
                                matchesTab = c.status === 'pending';
                            } else if (contractTab === 'old') {
                                matchesTab = c.status === 'cancelled' || c.status === 'expired';
                            }

                            return matchesSearch && matchesTab;
                        });

                        if (filtered.length === 0) {
                            return (
                                <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                                        <MagnifyingGlassIcon className="w-10 h-10" />
                                    </div>
                                    <p className="text-gray-400 font-bold text-sm italic">ไม่พบข้อมูลที่ตรงกับการค้นหา</p>
                                </div>
                            );
                        }

                        return (
                            <>
                                {filtered.map((contract) => (
                                    <div
                                        key={contract.id}
                                        className={`bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${contract.status === 'moved_in' ? 'hover:border-blue-100' : 'hover:border-green-100'}`}
                                    >
                                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${contract.status === 'moved_in' ? 'bg-blue-50/50' : 'bg-green-50/50'}`} />


                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors duration-300 ${contract.status === 'moved_in'
                                                    ? 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600'
                                                    : 'bg-green-50 text-green-600 border-green-100 group-hover:bg-green-600'
                                                    } group-hover:text-white`}>
                                                    <UserIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center flex-wrap gap-2">
                                                        <h3 className={`text-lg font-black text-gray-800 tracking-tight transition-colors ${contract.status === 'moved_in' ? 'group-hover:text-blue-700' : 'group-hover:text-green-700'}`}>{contract.name}</h3>
                                                        {(contract as any).tenants?.[0]?.rooms?.room_number && (
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-widest ${contract.status === 'moved_in'
                                                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                                : 'bg-green-100 text-green-700 border-green-200'
                                                                }`}>
                                                                ห้อง {(contract as any).tenants[0].rooms.room_number}
                                                            </span>
                                                        )}
                                                        {contract.status === 'moved_in' && (
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-black border border-blue-100 uppercase tracking-widest">
                                                                พักอยู่ปัจจุบัน
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                                                        <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
                                                        {contract.phone}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditContract(contract)}
                                                    className={`w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center transition-all active:scale-90 ${(contract.status === 'moved_in' || contract.status === 'pending')
                                                        ? `text-gray-400 ${contract.status === 'moved_in' ? 'hover:bg-blue-50 hover:text-blue-600' : 'hover:bg-green-50 hover:text-green-600'}`
                                                        : `text-green-400 hover:bg-green-50 hover:text-green-600`
                                                        }`}
                                                    title={(contract.status === 'moved_in' || contract.status === 'pending') ? "แก้ไข" : "ดูข้อมูล"}
                                                >
                                                    {(contract.status === 'moved_in' || contract.status === 'pending') ? (
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    ) : (
                                                        <MagnifyingGlassIcon className="w-5 h-5" />
                                                    )}
                                                </button>
                                                {contract.status !== 'moved_in' && (
                                                    <button
                                                        onClick={() => handleDeleteContract(contract.id, contract.status)}
                                                        className="w-10 h-10 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                                        title="ลบ"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-5 relative z-10">
                                            <div className="p-3 bg-gray-50 rounded-2xl flex flex-col gap-0.5">
                                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">เงินประกัน</span>
                                                <span className="text-sm font-black text-gray-900">฿{contract.deposit_amount.toLocaleString()}</span>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-2xl flex flex-col gap-0.5">
                                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">ระยะเวลา</span>
                                                <span className="text-sm font-black text-gray-900">
                                                    {new Date(contract.start_date).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })} - {new Date(contract.end_date).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                {contract.car_registration && (
                                                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 ${contract.status === 'moved_in' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-700'}`}>
                                                        🚗 {contract.car_registration}
                                                    </div>
                                                )}
                                                {contract.motorcycle_registration && (
                                                    <div className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black flex items-center gap-1">
                                                        🛵 {contract.motorcycle_registration}
                                                    </div>
                                                )}
                                            </div>
                                            {contract.status === 'pending' && (
                                                <button
                                                    onClick={() => router.push(`/dashboard/tenants/new?from_contract=${contract.id}`)}
                                                    className="text-[11px] font-black text-green-600 hover:text-green-700 flex items-center gap-1 group/btn"
                                                >
                                                    ย้ายเข้าพักจริง
                                                    <ChevronRightIcon className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </>
                        );
                    })()}
                </div>

                {renderContractFormModal()}
            </div>
        );
    }

    const renderContractFormModal = () => {
        if (!isContractFormOpen) return null;
        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => !isSubmittingContract && setIsContractFormOpen(false)}
                />
                <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-primary to-emerald-600 p-8 text-white relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <button
                            type="button"
                            onClick={() => setIsContractFormOpen(false)}
                            className="absolute top-6 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-white transition-all active:scale-95 border border-white/20 z-10"
                        >
                            <XMarkIcon className="w-6 h-6 stroke-[2.5]" />
                        </button>

                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                <DocumentPlusIcon className="w-6 h-6" />
                            </div>
                            {editingContract
                                ? ((editingContract.status === 'expired' || editingContract.status === 'cancelled') ? 'ดูข้อมูลสัญญา' : 'แก้ไขข้อมูลสัญญา')
                                : 'บันทึกข้อมูลสัญญาใหม่'
                            }
                        </h3>
                        <p className="text-emerald-100 font-bold text-sm mt-2 opacity-80">
                            {(editingContract?.status === 'expired' || editingContract?.status === 'cancelled')
                                ? 'ข้อมูลสัญญาที่สิ้นสุดแล้ว (อ่านอย่างเดียว)'
                                : 'กรอกข้อมูลผู้เช่าเพื่อเตรียมทำสัญญาเช่า'}
                        </p>
                    </div>

                    <form onSubmit={handleSaveContract} className="flex-1 overflow-y-auto p-8 pb-32 space-y-6 custom-scrollbar bg-white">
                        {contractError && (
                            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600 text-[13px] font-bold flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                {contractError}
                            </div>
                        )}
                        {contractSuccess && (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-emerald-600 text-[13px] font-bold flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                {contractSuccess}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Full Name */}
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.name}
                                    onChange={(e) => setContractFormData({ ...contractFormData, name: e.target.value })}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="ใส่ชื่อผู้เช่า..."
                                />
                            </div>

                            {/* Phone */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    maxLength={10}
                                    value={contractFormData.phone}
                                    onChange={(e) => setContractFormData({ ...contractFormData, phone: e.target.value.replace(/\D/g, '') })}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="08XXXXXXXX"
                                />
                            </div>

                            {/* Occupation */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">อาชีพ</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.occupation}
                                    onChange={(e) => setContractFormData({ ...contractFormData, occupation: e.target.value })}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="ระบุอาชีพ..."
                                />
                            </div>

                            {/* Address */}
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ที่อยู่ตามบัตรประชาชน</label>
                                <textarea
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    rows={2}
                                    value={contractFormData.address}
                                    onChange={(e) => setContractFormData({ ...contractFormData, address: e.target.value })}
                                    className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-2xl font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none resize-none"
                                    placeholder="ใส่ที่อยู่ตามบัตร..."
                                />
                            </div>

                            {/* Car Reg */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ทะเบียนรถยนต์</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.car_registration}
                                    onChange={(e) => setContractFormData({ ...contractFormData, car_registration: e.target.value })}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="เช่น กข 1234 กทม."
                                />
                            </div>

                            {/* Motor Reg */}
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ทะเบียนมอเตอร์ไซค์</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.motorcycle_registration}
                                    onChange={(e) => setContractFormData({ ...contractFormData, motorcycle_registration: e.target.value })}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="เช่น 1กข 1234..."
                                />
                            </div>

                            {/* Emergency */}
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ผู้ติดต่อฉุกเฉิน</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.emergency_contact}
                                    onChange={(e) => setContractFormData({ ...contractFormData, emergency_contact: e.target.value })}
                                    className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl px-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="ชื่อและเบอร์โทร..."
                                />
                            </div>

                            <div className="sm:col-span-2 h-px bg-gray-100 my-2" />

                            {/* Premium Date Pickers */}
                            <div className="space-y-2 group/date1">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">วันที่เริ่มสัญญา <span className="text-red-500">*</span></label>
                                <div
                                    className={`relative h-14 transition-all ${!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') ? 'cursor-pointer' : 'cursor-default'}`}
                                    onClick={() => {
                                        if (!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled')) {
                                            openCustomCalendar('start_date', contractFormData.start_date);
                                        }
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gray-50 border-2 border-transparent rounded-2xl group-focus-within/date1:bg-white group-focus-within/date1:border-primary/30 group-focus-within/date1:shadow-lg group-focus-within/date1:shadow-primary/5 transition-all" />
                                    <div className="absolute inset-0 px-5 flex items-center justify-between pointer-events-none">
                                        <div className="flex items-center gap-3">
                                            <CalendarDaysIcon className="w-5 h-5 text-primary" />
                                            <span className={`font-bold text-sm ${contractFormData.start_date ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {contractFormData.start_date ? formatThaiDate(contractFormData.start_date) : 'วว/ดด/พ.ศ.'}
                                            </span>
                                        </div>
                                        {!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') && (
                                            <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                                                <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 group/date2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">วันที่สิ้นสุดสัญญา <span className="text-red-500">*</span></label>

                                {/* Quick Duration Chips */}
                                {!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {[
                                            { label: '1 เดือน', m: 1 },
                                            { label: '3 เดือน', m: 3 },
                                            { label: '6 เดือน', m: 6 },
                                            { label: '1 ปี', m: 12 },
                                            { label: '2 ปี', m: 24 }
                                        ].map((opt) => (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() => {
                                                    if (!contractFormData.start_date) return;
                                                    const d = new Date(contractFormData.start_date);
                                                    d.setMonth(d.getMonth() + opt.m);
                                                    setContractFormData({ ...contractFormData, end_date: d.toISOString().split('T')[0] });
                                                }}
                                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-black rounded-lg border border-emerald-100 transition-all active:scale-95 uppercase tracking-wider"
                                            >
                                                + {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div
                                    className={`relative h-14 transition-all ${!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') ? 'cursor-pointer' : 'cursor-default'}`}
                                    onClick={() => {
                                        if (!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled')) {
                                            openCustomCalendar('end_date', contractFormData.end_date);
                                        }
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gray-50 border-2 border-transparent rounded-2xl group-focus-within/date2:bg-white group-focus-within/date2:border-primary/30 group-focus-within/date2:shadow-lg group-focus-within/date2:shadow-primary/5 transition-all" />
                                    <div className="absolute inset-0 px-5 flex items-center justify-between pointer-events-none">
                                        <div className="flex items-center gap-3">
                                            <CalendarDaysIcon className="w-5 h-5 text-red-500" />
                                            <span className={`font-bold text-sm ${contractFormData.end_date ? 'text-gray-900' : 'text-gray-400'}`}>
                                                {contractFormData.end_date ? formatThaiDate(contractFormData.end_date) : 'วว/ดด/พ.ศ.'}
                                            </span>
                                        </div>
                                        {!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') && (
                                            <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                                                <ChevronRightIcon className="w-4 h-4 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Deposit */}
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">เงินมัดจำ/ประกัน <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400">฿</div>
                                    <input
                                        required
                                        readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                        type="number"
                                        value={contractFormData.deposit_amount}
                                        onChange={(e) => setContractFormData({ ...contractFormData, deposit_amount: e.target.value })}
                                        className="w-full h-14 bg-gray-50 border-2 border-transparent rounded-2xl pl-10 pr-5 font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            {!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') ? (
                                <button
                                    type="submit"
                                    disabled={isSubmittingContract}
                                    className="w-full h-16 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-green-100/50 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmittingContract ? (
                                        <ArrowPathIcon className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>{editingContract ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลสัญญา'}</>
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsContractFormOpen(false)}
                                    className="w-full h-16 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all"
                                >
                                    ปิดหน้าต่าง
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    const renderNotificationsPopover = () => {
        if (!isNotificationsOpen) return null;

        // Derive notifications from existing room states
        const notifications: { id: string; type: 'verify' | 'overdue' | 'move_out'; title: string; description: string; roomId: string; date?: string }[] = [];

        rooms.forEach(room => {
            if (waitingVerifyRoomIds.has(room.id)) {
                notifications.push({
                    id: `verify-${room.id}`,
                    type: 'verify',
                    title: `ห้อง ${room.room_number} • รอยืนยันสลิป`,
                    description: 'ผู้เช่าแจ้งชำระเงินแล้ว กรุณาตรวจสอบความถูกต้อง',
                    roomId: room.id
                });
            }
            if (overdueRoomIds.has(room.id)) {
                notifications.push({
                    id: `overdue-${room.id}`,
                    type: 'overdue',
                    title: `ห้อง ${room.room_number} • ค้างชำระ`,
                    description: 'เกินกำหนดชำระเงินแล้ว กรุณาติดตามการชำระ',
                    roomId: room.id
                });
            }
            const activeTenant = room.tenants?.find(t => t.status === 'active');
            if (activeTenant?.planned_move_out_date) {
                const moveOutDate = new Date(activeTenant.planned_move_out_date);
                const today = new Date();
                const diffTime = moveOutDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 7 && diffDays >= 0) {
                    notifications.push({
                        id: `move-out-${room.id}`,
                        type: 'move_out',
                        title: `ห้อง ${room.room_number} • แจ้งย้ายออก`,
                        description: `จะย้ายออกในวันที่ ${formatThaiDate(activeTenant.planned_move_out_date)} (อีก ${diffDays} วัน)`,
                        roomId: room.id,
                        date: activeTenant.planned_move_out_date
                    });
                }
            }
        });

        return (
            <>
                <div
                    className="fixed inset-0 z-[105] bg-black/5"
                    onClick={() => setIsNotificationsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-4 w-[320px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right">
                    <div className="px-6 py-5 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-[17px] font-black text-gray-800 tracking-tight leading-none">รายการที่ต้องดำเนินการ</h3>
                            <p className="text-[10px] font-black text-gray-400 mt-1.5 uppercase tracking-widest">Action Required</p>
                        </div>
                        {notifications.length > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-4 ring-red-50">
                                {notifications.length}
                            </span>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto px-2 py-2 custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                                    <BellIcon className="w-8 h-8" />
                                </div>
                                <p className="text-sm font-black text-gray-700">ไม่มีรายการค้างในขณะนี้</p>
                                <p className="text-[11px] font-bold text-gray-400 mt-1">ยินดีด้วย! คุณจัดการทุกอย่างเรียบร้อยแล้ว</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {notifications.map((notif) => (
                                    <button
                                        key={notif.id}
                                        onClick={() => {
                                            setIsNotificationsOpen(false);
                                            router.push(`/dashboard/billing?roomId=${notif.roomId}`);
                                        }}
                                        className="w-full text-left p-4 rounded-2xl hover:bg-gray-50 transition-all group flex gap-4"
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${notif.type === 'verify' ? 'bg-sky-50 text-sky-500' :
                                            notif.type === 'overdue' ? 'bg-orange-50 text-orange-500' :
                                                'bg-amber-50 text-amber-500'
                                            }`}>
                                            {notif.type === 'verify' && <ClockIcon className="w-5 h-5 stroke-[2.5]" />}
                                            {notif.type === 'overdue' && <ExclamationTriangleIcon className="w-5 h-5 stroke-[2.5]" />}
                                            {notif.type === 'move_out' && <ArrowRightOnRectangleIcon className="w-5 h-5 stroke-[2.5]" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-gray-800 leading-tight group-hover:text-primary transition-colors">{notif.title}</p>
                                            <p className="text-[11px] font-bold text-gray-400 mt-1 leading-snug">{notif.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 mt-auto">
                        <button
                            onClick={() => { setIsNotificationsOpen(false); router.push('/dashboard/billing'); }}
                            className="w-full h-12 bg-white border-2 border-gray-100 hover:border-primary/30 rounded-xl text-xs font-black text-gray-600 hover:text-primary transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            จัดการบิลทั้งหมด
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </>
        );
    }
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

                {renderCustomCalendar()}
                {/* ── Dynamic Main Content ── */}
                {activeTab === 'overview' && (
                    <div className="bg-[#fcfdfd] font-body text-slate-800 antialiased min-h-screen pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full">
                        {/* Hero Section */}
                        <div className="relative">
                            {/* Background with clipping */}
                            <div className="absolute inset-0 bg-primary rounded-b-[2.5rem] shadow-lg overflow-hidden z-0">
                                <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse duration-[4000ms]" />
                                <div className="absolute bottom-[-10%] left-[-10%] w-56 h-56 bg-white/5 rounded-full blur-2xl" />
                            </div>

                            {/* Header Content */}
                            <div className="relative z-50 pt-10 pb-12 px-5">
                                {/* Header */}
                                <div className="relative z-20 flex justify-between items-center mb-6 px-1">
                                    <span className="text-xl sm:text-2xl font-black tracking-tight text-white">HORPAY</span>
                                    <div className="flex items-center gap-2.5">
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                                                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 border shadow-sm backdrop-blur-md ${isNotificationsOpen
                                                    ? 'bg-white text-primary border-white'
                                                    : 'bg-white/20 hover:bg-white/30 text-white border-white/20'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-[26px]">notifications</span>
                                                {(waitingVerifyRoomIds.size + overdueRoomIds.size + (movingOutRoomIds.size)) > 0 && (
                                                    <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-primary animate-pulse" />
                                                )}
                                            </button>
                                            {renderNotificationsPopover()}
                                        </div>
                                        <div className="relative">
                                            <div
                                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                                className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 border-2 border-white/20 overflow-hidden"
                                            >
                                                <span className="material-symbols-outlined text-[26px]">person</span>
                                            </div>

                                            {/* Dropdown Menu (Existing Logic Kept) */}
                                            {isMenuOpen && (
                                                <>
                                                    <div className="absolute right-0 top-full mt-4 w-[260px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right">
                                                        <div className="px-6 py-6 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100">
                                                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">ยินดีต้อนรับ</p>
                                                            <h3 className="text-[17px] font-black text-gray-800 tracking-tight leading-none truncate">{userName}</h3>
                                                        </div>
                                                        <div className="p-2.5 space-y-1">
                                                            <button onClick={() => { setIsMenuOpen(false); setActiveTab('settings'); setActiveSettingsTab('dorm'); }} className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group">
                                                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm">
                                                                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                                </div>
                                                                แก้ไขข้อมูลหอพัก
                                                            </button>
                                                            <button onClick={() => { setIsMenuOpen(false); router.push('/dashboard/rooms'); }} className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group">
                                                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm">
                                                                    <Squares2X2Icon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                                </div>
                                                                จัดการห้องพัก
                                                            </button>
                                                            <button onClick={() => { setIsMenuOpen(false); setActiveTab('settings'); setActiveSettingsTab('line'); }} className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group">
                                                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm">
                                                                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                                </div>
                                                                ตั้งค่า LINE Notification
                                                            </button>
                                                            <button onClick={() => { setIsMenuOpen(false); setIsChangePasswordOpen(true); }} className="w-full flex items-center gap-4 px-4 py-4 text-left text-gray-700 hover:bg-green-50 rounded-2xl transition-all font-bold text-[14.5px] group">
                                                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm">
                                                                    <LockClosedIcon className="w-5 h-5 text-gray-400 group-hover:text-green-600 stroke-[2.5]" />
                                                                </div>
                                                                เปลี่ยนรหัสผ่าน
                                                            </button>
                                                            <div className="h-px bg-gray-100/60 mx-4 my-2" />
                                                            <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-4 text-left text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-[14.5px] group">
                                                                <div className="w-10 h-10 bg-red-50/50 rounded-xl flex items-center justify-center group-hover:bg-white group-hover:shadow-sm">
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

                                {/* Greeting */}
                                <div className="relative z-0 text-white">
                                    <p className="text-white text-sm font-bold flex items-center gap-2">
                                        สวัสดีคุณ {userName} 👋
                                    </p>
                                    <h1 className="text-4xl font-headline font-extrabold mt-1 tracking-tight truncate max-w-[300px]">
                                        {dorm?.name || 'หอพักของฉัน'}
                                    </h1>
                                </div>
                            </div>
                        </div>

                        <main className="px-5 -mt-8 relative z-20 space-y-6">
                            {/* DB Error Banner */}
                            {dbError && (
                                <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-5 mb-4 shadow-xl shadow-red-100/50">
                                    <h3 className="text-red-600 font-black text-lg mb-1">เกิดข้อผิดพลาดฐานข้อมูล!</h3>
                                    <p className="text-red-500 font-bold text-xs break-words">{dbError}</p>
                                </div>
                            )}

                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { icon: 'grid_view', label: 'ห้องทั้งหมด', value: stats.total, color: 'bg-emerald-50 text-emerald-500' },
                                    { icon: 'home', label: 'ห้องว่าง', value: stats.vacant, color: 'bg-green-50 text-green-500' },
                                    { icon: 'group', label: 'มีคนพัก', value: stats.occupied, color: 'bg-blue-50 text-blue-500' },
                                    { icon: 'payments', label: 'ค้างชำระ', value: (overviewData.billStatusCounts?.unpaid || 0) + (overviewData.billStatusCounts?.waiting_verify || 0), color: 'bg-sky-50 text-sky-500' },

                                ].map((item) => (
                                    <div key={item.label} className="bg-white p-5 rounded-3xl shadow-sm flex items-center gap-4 transform hover:-translate-y-1 transition-all duration-300">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color}`}>
                                            <span className="material-symbols-outlined text-[28px]">{item.icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-[12px] text-slate-800 font-black uppercase tracking-wider">{item.label}</p>
                                            <p className="text-2xl font-headline font-bold text-slate-800">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Management Menu */}
                            <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50">
                                <h2 className="text-center text-slate-800 font-bold mb-6 text-sm uppercase tracking-widest">เมนูใช้งาน</h2>
                                <div className="grid grid-cols-3 gap-y-8">
                                    {[
                                        { icon: 'electric_meter', label: 'จดมิเตอร์', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', path: '/dashboard/meter' },
                                        { icon: 'receipt_long', label: 'ออกบิล', color: 'bg-teal-50 text-teal-600 border-teal-100', path: '/dashboard/billing' },
                                        { icon: 'history', label: 'ประวัติบิล', color: 'bg-purple-50 text-purple-600 border-purple-100', path: '/dashboard/history' },
                                        { icon: 'badge', label: 'ข้อมูลผู้เช่า', color: 'bg-blue-50 text-blue-600 border-blue-100', path: '/dashboard/tenants' },
                                        { icon: 'person_add', label: 'เพิ่มผู้เช่า', color: 'bg-orange-50 text-orange-600 border-orange-100', path: '/dashboard/tenants/new' },
                                        { icon: 'logout', label: 'แจ้งออก/ย้ายออก', color: 'bg-rose-50 text-rose-600 border-rose-100', path: '/dashboard/move-out' },
                                    ].map((item) => (
                                        <button
                                            key={item.label}
                                            onClick={() => router.push(item.path)}
                                            className="flex flex-col items-center gap-3 group active:scale-95 transition-all"
                                        >
                                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center border-2 transition-all ${item.color} group-hover:shadow-md`}>
                                                <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                                            </div>
                                            <span className="text-[13px] font-black text-slate-800 transition-colors group-hover:text-primary">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Billing Status */}
                            <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-slate-800 font-bold text-sm">สถานะบิลล่าสุด</h2>
                                    <button
                                        onClick={() => { setActiveTab('rooms'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                        className="text-primary text-xs font-bold uppercase tracking-widest"
                                    >
                                        ดูทั้งหมด
                                    </button>
                                </div>

                                <div className="grid gap-3">
                                    {rooms.filter(r => pendingRoomIds.has(r.id)).length > 0 ? (
                                        rooms.filter(r => pendingRoomIds.has(r.id)).slice(0, 5).map((room) => (
                                            <div
                                                key={room.id}
                                                onClick={() => router.push('/dashboard/billing')}
                                                className="bg-white px-5 py-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-primary/30 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 overflow-hidden">
                                                        <span className="material-symbols-outlined">home</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1.5">ห้อง {room.room_number}</p>
                                                        <h3 className="text-sm font-black text-gray-800 tracking-tight leading-none">
                                                            {room.tenants?.find(t => t.status === 'active')?.name || 'ไม่พบผู้พัก'}
                                                        </h3>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {waitingVerifyRoomIds.has(room.id) ? (
                                                        <div className="h-8 px-3 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                                                            <span className="text-[10px] font-black uppercase text-sky-600">รอตรวจสอบ</span>
                                                        </div>
                                                    ) : overdueRoomIds.has(room.id) ? (
                                                        <div className="h-8 px-3 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                                                            <span className="text-[10px] font-black uppercase text-orange-600">ค้างชำระ</span>
                                                        </div>
                                                    ) : (
                                                        <div className="h-8 px-3 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                                                            <span className="text-[10px] font-black uppercase text-sky-600">รอชำระ</span>
                                                        </div>
                                                    )}
                                                    <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors text-sm">chevron_right</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                                            <p className="text-slate-400 text-sm font-medium">ไม่มีห้องค้างชำระ</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </main>
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
                                        <div className="space-y-1.5 pt-2 border-t border-green-200/50">
                                            <div className="flex justify-between text-[11px] font-bold text-green-600">
                                                <span>รอชำระ (เดือนนี้)</span>
                                                <span className="text-green-800">฿{(overviewData.pendingRevenue - (overviewData.billStatusCounts as any).overdueAmount || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] font-bold text-orange-600">
                                                <span>ค้างชำระ (เกินกำหนด)</span>
                                                <span className="text-orange-800">฿{(overviewData.billStatusCounts as any).overdueAmount || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Status & Utilities Grid ── */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 rounded-2xl p-4 border-2 border-blue-100">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                                                <UsersIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[11px] font-black text-blue-900 uppercase">อัตราเข้าพัก</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <span className="text-2xl font-black text-emerald-600">{overviewData.occupancyRate}%</span>
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
                                                <p className="text-[11px] font-bold text-teal-600">💧 น้ำ: {overviewData.waterUnits} หน่วย</p>
                                                <p className="text-[10px] font-black text-teal-700">฿{overviewData.waterAmount.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Bill Status Summary ── */}
                                <div className="bg-white rounded-[1.5rem] p-1.5 border-2 border-gray-50 shadow-sm overflow-hidden">
                                    <div className="p-3 border-b border-gray-50 bg-gray-50/30 rounded-t-[1.3rem]">
                                        <h3 className="text-[13px] font-black text-gray-900 tracking-tight">สถานะบิลเดือนนี้</h3>
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
                                                <span className="text-sm font-bold text-gray-900 group-hover:text-green-600 transition-colors">ชำระแล้ว</span>
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
                                                <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                                                    <BellIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 group-hover:text-sky-600 transition-colors">รอชำระ</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-sky-600">{(overviewData.billStatusCounts.unpaid || 0) + (overviewData.billStatusCounts.waiting_verify || 0)} ห้อง</span>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-sky-400 transition-colors" />
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => router.push('/dashboard/billing')}
                                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                                    <ExclamationTriangleIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 group-hover:text-orange-600 transition-colors">ค้างชำระ</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-orange-600">{(overviewData.billStatusCounts as any).overdue || 0} ห้อง</span>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-orange-400 transition-colors" />
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => { setActiveTab('rooms'); setSelectedStatus('moving_out'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 group-hover:text-amber-600 transition-colors">แจ้งออก</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-amber-600">{(overviewData.billStatusCounts as any).movingOut || 0} ห้อง</span>
                                                <ChevronRightIcon className="w-4 h-4 text-gray-200 group-hover:text-amber-400 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Revenue Graph (Full Width) ── */}
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
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                        ฿{data.amount.toLocaleString()}
                                                    </div>
                                                    <div className="w-full relative flex items-end justify-center h-full">
                                                        <div
                                                            className={`w-full rounded-t-lg transition-all duration-700 ${i === 5 ? 'bg-green-500' : 'bg-gray-100 group-hover:bg-green-200'}`}
                                                            style={{ height: `${Math.max(height, 5)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[10px] font-black ${i === 5 ? 'text-green-600' : 'text-slate-600'}`}>
                                                        {data.month}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* ── Electricity Usage History (Full Width) ── */}
                                <div className="bg-white rounded-[1.5rem] p-5 border-2 border-gray-50 shadow-sm">
                                    <h3 className="text-sm font-black text-gray-800 mb-6 flex items-center gap-2">
                                        <BoltIcon className="w-4 h-4 text-orange-500" />
                                        การใช้ไฟฟ้า (หน่วย) (6 เดือนล่าสุด)
                                    </h3>
                                    <div className="h-40 flex items-end justify-between gap-3 px-2">
                                        {overviewData.historicalUtilities.map((data, i) => {
                                            const maxVal = Math.max(...overviewData.historicalUtilities.map(h => h.electricity), 1);
                                            const height = (data.electricity / maxVal) * 100;
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                        {data.electricity.toLocaleString()} หน่วย
                                                    </div>
                                                    <div className="w-full relative flex items-end justify-center h-full">
                                                        <div
                                                            className={`w-full rounded-t-lg transition-all duration-700 ${i === 5 ? 'bg-orange-500' : 'bg-orange-100 group-hover:bg-orange-200'}`}
                                                            style={{ height: `${Math.max(height, 5)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[10px] font-black ${i === 5 ? 'text-orange-600' : 'text-slate-600'}`}>
                                                        {data.month}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* ── Water Usage History (Full Width) ── */}
                                <div className="bg-white rounded-[1.5rem] p-5 border-2 border-gray-50 shadow-sm">
                                    <h3 className="text-sm font-black text-gray-800 mb-6 flex items-center gap-2">
                                        <ArrowPathIcon className="w-4 h-4 text-teal-500" />
                                        การใช้น้ำ (หน่วย) (6 เดือนล่าสุด)
                                    </h3>
                                    <div className="h-40 flex items-end justify-between gap-3 px-2">
                                        {overviewData.historicalUtilities.map((data, i) => {
                                            const maxVal = Math.max(...overviewData.historicalUtilities.map(h => h.water), 1);
                                            const height = (data.water / maxVal) * 100;
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-3 group relative">
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                                        {data.water.toLocaleString()} หน่วย
                                                    </div>
                                                    <div className="w-full relative flex items-end justify-center h-full">
                                                        <div
                                                            className={`w-full rounded-t-lg transition-all duration-700 ${i === 5 ? 'bg-teal-500' : 'bg-teal-100 group-hover:bg-teal-200'}`}
                                                            style={{ height: `${Math.max(height, 5)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[10px] font-black ${i === 5 ? 'text-teal-600' : 'text-slate-600'}`}>
                                                        {data.month}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Rooms Tab Content (Premium Redesign) ── */}
                {activeTab === 'rooms' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full px-6 pt-12 pb-32">
                        <div className="flex flex-col gap-6 mb-8">
                            <div className="flex items-center justify-between">
                                <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                                    <span className="text-2xl">🏢</span> สถานะห้องพัก
                                </h1>
                                <span className="bg-gray-100 text-black-600 font-bold text-[14px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-gray-100">
                                    ทั้งหมด {rooms.length} ห้อง
                                </span>
                            </div>

                            {/* Filters UI */}
                            <div className="space-y-4">
                                {/* Floor Filter */}
                                <div className="flex flex-col gap-2">
                                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-1">เลือกชั้น</p>
                                    <div className="flex items-center gap-2 flex-wrap pb-2">
                                        <button
                                            onClick={() => setSelectedFloor('all')}
                                            className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all whitespace-nowrap border-2 ${selectedFloor === 'all' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-100 text-slate-500 hover:border-green-200'}`}
                                        >
                                            ทุกชั้น
                                        </button>
                                        {Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => (a || '').localeCompare(b || '', undefined, { numeric: true })).map(floor => (
                                            <button
                                                key={floor}
                                                onClick={() => setSelectedFloor(floor)}
                                                className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all whitespace-nowrap border-2 ${selectedFloor === floor ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-100 text-gray-400 hover:border-green-200'}`}
                                            >
                                                ชั้น {floor}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Status Filter */}
                                <div className="flex flex-col gap-2">
                                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-1">สถานะห้อง</p>
                                    <div className="flex items-center gap-2 flex-wrap pb-2">
                                        {[
                                            { id: 'all', label: 'ทั้งหมด', color: 'bg-emerald-600 border-emerald-600 shadow-emerald-100' },
                                            { id: 'available', label: 'ว่าง', color: 'bg-green-500 border-green-500 shadow-green-100' },
                                            { id: 'occupied', label: 'มีคนพัก', color: 'bg-blue-600 border-blue-600 shadow-blue-100' },
                                            { id: 'waiting', label: 'รอชำระ', color: 'bg-sky-500 border-sky-500 shadow-sky-100' },
                                            { id: 'overdue', label: 'ค้างชำระ', color: 'bg-orange-500 border-orange-500 shadow-orange-100' },
                                            { id: 'moving_out', label: 'แจ้งออก', color: 'bg-amber-500 border-amber-500 shadow-amber-100' }
                                        ].map(status => (
                                            <button
                                                key={status.id}
                                                onClick={() => setSelectedStatus(status.id)}
                                                className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all whitespace-nowrap border-2 ${selectedStatus === status.id ? `${status.color} text-white shadow-lg` : 'bg-white border-gray-100 text-slate-500 hover:border-gray-200'}`}
                                            >
                                                {status.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {rooms.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                <p className="text-gray-400 font-bold">ยังไม่มีข้อมูลห้องพัก</p>
                            </div>
                        ) : (() => {
                            const filteredRooms = rooms.filter(room => {
                                const matchesFloor = selectedFloor === 'all' || room.floor === selectedFloor;

                                let matchesStatus = true;
                                if (selectedStatus !== 'all') {
                                    const isWaitingVerify = waitingVerifyRoomIds.has(room.id);
                                    const isUnpaid = unpaidRoomIds.has(room.id);
                                    const isOccupied = room.status === 'occupied';
                                    const isAvailable = room.status === 'available';

                                    if (selectedStatus === 'available') matchesStatus = isAvailable && !isWaitingVerify && !isUnpaid && !overdueRoomIds.has(room.id);
                                    if (selectedStatus === 'occupied') matchesStatus = isOccupied;
                                    if (selectedStatus === 'waiting') matchesStatus = isUnpaid || isWaitingVerify;
                                    if (selectedStatus === 'overdue') matchesStatus = overdueRoomIds.has(room.id);
                                    if (selectedStatus === 'moving_out') matchesStatus = movingOutRoomIds.has(room.id);
                                }

                                return matchesFloor && matchesStatus;
                            });

                            if (filteredRooms.length === 0) {
                                return (
                                    <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                        <p className="text-gray-400 font-bold">ไม่พบห้องพักที่ตรงตามเงื่อนไข</p>

                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-8">
                                    {Array.from(new Set(filteredRooms.map(r => r.floor))).sort((a, b) => (a || '').localeCompare(b || '', undefined, { numeric: true })).map(floor => (
                                        <div key={floor} className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-2 bg-green-500 rounded-full shadow-sm shadow-green-100" />
                                                    <h2 className="text-xl font-black text-gray-800 tracking-tight">ชั้น {floor}</h2>
                                                </div>
                                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                                    {filteredRooms.filter(r => r.floor === floor).length} ห้อง
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                {filteredRooms.filter(r => r.floor === floor).sort((a, b) => a.room_number.localeCompare(b.room_number)).map((room) => {
                                                    const isWaitingVerify = waitingVerifyRoomIds.has(room.id);
                                                    const isUnpaid = unpaidRoomIds.has(room.id);
                                                    const isOccupied = room.status === 'occupied';
                                                    const isMovingOut = movingOutRoomIds.has(room.id);

                                                    // Color & Info Logic
                                                    let theme = {
                                                        bg: 'bg-white',
                                                        border: 'border-gray-100',
                                                        iconBg: 'bg-green-50 text-green-600',
                                                        badge: 'bg-green-500 text-white',
                                                        status: 'ว่าง',
                                                        icon: KeyIcon,
                                                        shadow: 'shadow-green-50'
                                                    };

                                                    if (isMovingOut) {
                                                        theme = {
                                                            bg: 'bg-white',
                                                            border: 'border-amber-100',
                                                            iconBg: 'bg-amber-50 text-amber-600',
                                                            badge: 'bg-amber-500 text-white',
                                                            status: 'แจ้งออก',
                                                            icon: ArrowRightOnRectangleIcon,
                                                            shadow: 'shadow-amber-50'
                                                        };
                                                    } else if (isWaitingVerify || isUnpaid) {
                                                        const isReallyOverdue = overdueRoomIds.has(room.id);
                                                        theme = {
                                                            bg: 'bg-white',
                                                            border: isReallyOverdue ? 'border-orange-100' : 'border-sky-100',
                                                            iconBg: isReallyOverdue ? 'bg-orange-50 text-orange-600' : 'bg-sky-50 text-sky-600',
                                                            badge: isReallyOverdue ? 'bg-orange-500 text-white' : 'bg-sky-500 text-white',
                                                            status: isReallyOverdue ? 'ค้างชำระ' : 'รอชำระ',
                                                            icon: isReallyOverdue ? ExclamationTriangleIcon : (isWaitingVerify ? ClockIcon : BellIcon),
                                                            shadow: isReallyOverdue ? 'shadow-orange-50' : 'shadow-sky-50'
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
                                                                    <p className="text-[11px] font-black text-slate-600 uppercase leading-none mb-1">ห้องหมายเลข</p>
                                                                    <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                                                        {room.room_number}
                                                                        {isOccupied && activeTenant?.line_user_id && (
                                                                            <span className="ml-2 text-sm text-green-600 font-bold">(ตรงกัน)</span>
                                                                        )}
                                                                    </h3>

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
                                                                                <span className="text-[12px] font-black text-gray-900 truncate tracking-tight">
                                                                                    {activeTenant.name}
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
                                                                                    <span className={`text-[11px] font-bold tracking-tighter ${activeTab === 'rooms' && activeTenant.line_user_id ? 'text-green-700' : 'text-slate-700'}`}>
                                                                                        {activeTenant.phone}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {activeTenant.planned_move_out_date && (
                                                                                <div className="flex items-center gap-2 mt-1 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100/50 w-fit">
                                                                                    <ClockIcon className="w-3 h-3 text-amber-600" />
                                                                                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-tight">
                                                                                        ออก: {formatThaiDate(activeTenant.planned_move_out_date)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="pt-1.5 flex items-center justify-between">
                                                                    <span className="text-[13px] font-black text-slate-700">
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
                            );
                        })()}
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
                                                <div className="pt-4 border-t border-gray-100 flex items-center gap-3 mb-2">
                                                    <BoltIcon className="w-5 h-5 text-yellow-500" />
                                                    <span className="text-sm font-black text-gray-700">ตั้งค่าค่าน้ำ-ไฟ</span>
                                                </div>
                                                <div className="space-y-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                                    <div className="space-y-2">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">ค่าไฟฟ้า (บาท / หน่วย)</label>
                                                        <input
                                                            type="number"
                                                            value={settingsData.electric_rate_per_unit}
                                                            onChange={(e) => setSettingsData({ ...settingsData, electric_rate_per_unit: parseFloat(e.target.value) || 0 })}
                                                            className="w-full h-12 bg-white border-2 border-gray-100 rounded-xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div className="h-px bg-gray-200/50" />
                                                    <div className="space-y-3">
                                                        <label className="text-[13px] font-black text-gray-500 ml-1">รูปแบบการเก็บค่าน้ำ</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button
                                                                onClick={() => setSettingsData({
                                                                    ...settingsData,
                                                                    water_billing_type: 'per_unit',
                                                                    water_flat_rate: 0 // Reset other value
                                                                })}
                                                                className={`h-11 rounded-xl text-xs font-black transition-all border-2 ${settingsData.water_billing_type === 'per_unit' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-100 text-gray-400'}`}
                                                            >
                                                                ตามหน่วย
                                                            </button>
                                                            <button
                                                                onClick={() => setSettingsData({
                                                                    ...settingsData,
                                                                    water_billing_type: 'flat_rate',
                                                                    water_rate_per_unit: 0 // Reset other value
                                                                })}
                                                                className={`h-11 rounded-xl text-xs font-black transition-all border-2 ${settingsData.water_billing_type === 'flat_rate' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-100 text-gray-400'}`}
                                                            >
                                                                เหมาจ่าย
                                                            </button>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                key={settingsData.water_billing_type} // Force re-render on type switch
                                                                value={settingsData.water_billing_type === 'per_unit' ? (settingsData.water_rate_per_unit || '') : (settingsData.water_flat_rate || '')}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0
                                                                    if (settingsData.water_billing_type === 'per_unit') {
                                                                        setSettingsData({ ...settingsData, water_rate_per_unit: val })
                                                                    } else {
                                                                        setSettingsData({ ...settingsData, water_flat_rate: val })
                                                                    }
                                                                }}
                                                                className="w-full h-12 bg-white border-2 border-gray-100 rounded-xl px-4 font-bold text-gray-800 focus:border-green-500 transition-all outline-none"
                                                                placeholder={settingsData.water_billing_type === 'per_unit' ? "ระบุราคาต่อหน่วย..." : "ระบุราคาเหมาจ่าย..."}
                                                            />
                                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">
                                                                บาท / {settingsData.water_billing_type === 'per_unit' ? 'หน่วย' : 'เดือน'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-gray-100 flex items-center gap-3 mb-2">
                                                    <PlusIcon className="w-5 h-5 text-purple-500" />
                                                    <span className="text-sm font-black text-gray-700">ค่าบริการเพิ่มเติม (รายเดือน)</span>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="flex gap-2">
                                                        <div className="flex-[2] space-y-1">
                                                            <input
                                                                type="text"
                                                                placeholder="ชื่อบริการ (เช่น ค่าเน็ต)"
                                                                value={newServiceName}
                                                                onChange={(e) => setNewServiceName(e.target.value)}
                                                                className="w-full h-12 bg-white border-2 border-gray-100 rounded-xl px-4 text-sm font-bold text-gray-800 outline-none focus:border-purple-500 transition-all"
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <input
                                                                type="number"
                                                                placeholder="ราคา"
                                                                value={newServicePrice}
                                                                onChange={(e) => setNewServicePrice(e.target.value)}
                                                                className="w-full h-12 bg-white border-2 border-gray-100 rounded-xl px-4 text-sm font-bold text-gray-800 outline-none focus:border-purple-500 transition-all"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={addService}
                                                            className="w-12 h-12 bg-purple-50 text-purple-600 border-2 border-purple-100 rounded-xl flex items-center justify-center hover:bg-purple-100 transition-all active:scale-90"
                                                        >
                                                            <PlusIcon className="w-6 h-6" />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-2 min-h-[40px]">
                                                        {services.map((s) => (
                                                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-2xl animate-in zoom-in-95 duration-200">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black text-gray-700">{s.name}</span>
                                                                    <span className="text-[11px] font-bold text-green-600">{s.price.toLocaleString()} บาท/เดือน</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => removeService(s.id)}
                                                                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <PlusIcon className="w-5 h-5 rotate-45" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {services.length === 0 && (
                                                            <p className="text-center py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest border-2 border-dashed border-gray-100 rounded-2xl">ไม่มีค่าบริการเพิ่มเติม</p>
                                                        )}
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
                                                            <p className="text-[11px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest">กรุณากดเปิดที่ปุ่มด้านบน<br />เพื่อความปลอดภัยและป้องกันการกดเล่น</p>
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
                                                    <label className="text-[13px] font-black text-gray-500 ml-1">Bot User ID (อัตโนมัติ)</label>
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
                                                        <input
                                                            type="password"
                                                            value={lineConfig.access_token}
                                                            onChange={(e) => setLineConfig({ ...lineConfig, access_token: e.target.value })}
                                                            className="w-full h-14 bg-white border-2 border-gray-50 rounded-2xl px-5 font-bold text-gray-800 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
                                                            placeholder="••••••••••••••••"
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

                {/* ── Contract (Tenants) Tab Content ── */}
                {activeTab === 'tenants' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative z-10 bg-white">
                        {renderContractsTab()}
                    </div>
                )}

                {activeTab !== 'overview' && activeTab !== 'rooms' && activeTab !== 'stats' && activeTab !== 'settings' && activeTab !== 'tenants' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 h-full relative z-10 bg-white">
                        <div className="w-24 h-24 bg-gradient-to-br from-green-50 to-green-100 rounded-[2rem] flex items-center justify-center text-green-500 mb-6 transform -rotate-6 shadow-xl shadow-green-100/50">
                            <Squares2X2Icon className="w-12 h-12 stroke-[2]" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight mb-3">
                            ระบบที่เลือก
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
