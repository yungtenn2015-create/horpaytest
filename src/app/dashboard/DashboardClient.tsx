'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import RoomsTab from './components/RoomsTab'
import OverviewTab from './components/OverviewTab'
import TenantsTab from './components/TenantsTab'
import StatsTab from './components/StatsTab'
import SettingsTab from './components/SettingsTab'

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
    UsersIcon,
    UserIcon,
    ArrowRightOnRectangleIcon,
    ChevronRightIcon,
    ClockIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ChartBarIcon,
    KeyIcon,
    LockClosedIcon,
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
    UserCircleIcon as UserCircleSolid,
    ChartBarIcon as ChartBarIconSolid
} from '@heroicons/react/24/solid'

// Define types for better readability and type safety
export interface Dorm {
    id: string;
    name: string;
    owner_id: string;
    created_at?: string;
}

export interface Room {
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

export interface Service {
    id: string;
    name: string;
    price: number;
}

export interface TenantContract {
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

/** วันในปฏิทิน (ตัดรอบบิล / ครบกำหนดชำระ) — บังคับ 1–31 เสมอ */
function normalizeBillingDay(value: unknown, fallback: number): number {
    const fb = Math.min(31, Math.max(1, Math.floor(Number(fallback)) || 1))
    if (value === null || value === undefined) return fb
    const n = Math.floor(Number(value))
    if (!Number.isFinite(n) || n < 1) return fb
    return Math.min(31, n)
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
    const refreshRequestIdRef = useRef(0)
    /** คิวโหลดทีละงาน — กันหลาย getUser/refresh token พร้อมกัน (ข้อผิดพลาด lock ... stole it ของ Supabase) */
    const refreshQueueRef = useRef(Promise.resolve())
    const prevOverviewTabRef = useRef<string | null>(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false) // for user dropdown
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false) // for notifications dropdown
    const [pendingRoomIds, setPendingRoomIds] = useState<Set<string>>(new Set())
    const [waitingVerifyRoomIds, setWaitingVerifyRoomIds] = useState<Set<string>>(new Set())
    const [unpaidRoomIds, setUnpaidRoomIds] = useState<Set<string>>(new Set())
    const [overdueRoomIds, setOverdueRoomIds] = useState<Set<string>>(new Set())
    const [movingOutRoomIds, setMovingOutRoomIds] = useState<Set<string>>(new Set())
    /** มีบิลประเภท move_out ที่ยังไม่จบเท่านั้น — ไม่รวมแค่แจ้งวันย้ายล่วงหน้า */
    const [pendingMoveOutBillRoomIds, setPendingMoveOutBillRoomIds] = useState<Set<string>>(new Set())
    const [selectedFloor, setSelectedFloor] = useState<string>('all')
    const [selectedStatus, setSelectedStatus] = useState<string>('all')
    const [stats, setStats] = useState({
        total: 0,
        occupied: 0,
        vacant: 0,
        maintenance: 0,
        pendingPayments: 0,
        movingOut: 0
    })
    const [userPlan, setUserPlan] = useState<{ plan_type: string; trial_expires_at: string } | null>(null)

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
    const formatThaiDate = (dateStr: string | null | undefined) => {
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
        /** ยอดที่ยังไม่ชำระและไม่นับเป็น "เกินกำหนด" (รวมบิลผู้เช่าเก่า/เครดิต); ใช้แยกจาก overdueAmount */
        pendingNotOverdueAmount: 0,
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
        historicalUtilities: [] as { month: string, electricity: number, water: number, electricityAmount: number, waterAmount: number }[]
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

            if (!editingContract) {
                setContractTab('pending')
                router.replace('/dashboard?tab=tenants')
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
    const [isResettingOwnerLine, setIsResettingOwnerLine] = useState(false)
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

    const handleResetOwnerLine = async () => {
        if (!dorm?.id) return
        if (!confirm('คุณต้องการรีเซ็ตเจ้าของ LINE ใช่หรือไม่? หลังจากนี้เจ้าของต้องแอด OA ใหม่เพื่อผูกบัญชีอีกครั้ง')) return

        setIsResettingOwnerLine(true)
        const supabase = createClient()
        try {
            const { error } = await supabase
                .from('line_oa_configs')
                .update({ owner_line_user_id: null })
                .eq('dorm_id', dorm.id)

            if (error) throw error

            setLineConfig(prev => ({ ...prev, owner_line_user_id: '' }))
            setTestResult({ success: true, message: 'รีเซ็ตเจ้าของ LINE เรียบร้อยแล้ว กรุณาให้เจ้าของแอด OA ใหม่เพื่อผูกบัญชี' })
        } catch (err: any) {
            setTestResult({ success: false, message: err.message || 'ไม่สามารถรีเซ็ตเจ้าของ LINE ได้' })
        } finally {
            setIsResettingOwnerLine(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const refreshDashboard = useCallback((isInitial = false) => {
        const requestId = ++refreshRequestIdRef.current

        const runRefresh = async () => {
        if (isInitial) setLoading(true);
        else setFetchingOverview(true);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            if (requestId === refreshRequestIdRef.current) {
                setLoading(false);
                setFetchingOverview(false);
            }
            return;
        }

        const name = user.user_metadata?.name || user.email?.split('@')[0] || 'Owner';
        setUserName(name);
        setUserInitial(name.charAt(0).toUpperCase());

        try {
            setDbError('')
            console.log("Refreshing Dashboard Data...");
            // 0. Get User Plan to check trial status
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('plan_type, trial_expires_at')
                .eq('id', user.id)
                .single();

            if (!userError && userData) {
                setUserPlan(userData);
            }

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
                .select('total_amount, billing_month, utilities(curr_water_meter, prev_water_meter, curr_electric_meter, prev_electric_meter, water_price, electric_price)')
                .in('room_id', activeRooms.map(r => r.id))
                .neq('status', 'cancelled')
                .gte('billing_month', historyDateStr);

            // Process Current Month Stats - Unified Room-Centric Logic
            let collected = 0;
            let pending = 0;
            let pendingNotOverdueAmount = 0;
            let water = 0;
            let waterAmt = 0;
            let electric = 0;
            let electricAmt = 0;
            const counts: { paid: number, waiting_verify: number, unpaid: number, overdue: number, movingOut: number, overdueAmount: number } = { paid: 0, waiting_verify: 0, unpaid: 0, overdue: 0, movingOut: 0, overdueAmount: 0 };
            const pendingIdsSet = new Set<string>();
            const waitingVerifyIdsSet = new Set<string>();
            const unpaidIdsSet = new Set<string>();
            const overdueIdsSet = new Set<string>();
            const movingOutIdsSet = new Set<string>();
            const pendingMoveOutBillIdsSet = new Set<string>();

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

                // Split pending ฿ for overview (do not use pending − overdueAmount: negative/credit line items break it)
                if (s !== 'paid' && s !== 'cancelled') {
                    let dueForSplit = b.due_date ? new Date(b.due_date) : null;
                    if (b.billing_month === '2026-03-01' && b.due_date === '2026-03-05') {
                        dueForSplit = new Date('2026-04-05');
                    }
                    const overdueForSplit =
                        Boolean(dueForSplit && dueForSplit < now && s !== 'paid' && s !== 'waiting_verify');
                    const inOverdueMoneySlice =
                        Boolean(isCurrentTenantBill && (overdueForSplit || s === 'overdue'));
                    if (!inOverdueMoneySlice) {
                        pendingNotOverdueAmount += totalAmt;
                    }
                }

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

            // 3.1 Check for Moving Out Status
            // - Notice already given (planned_move_out_date)
            // - OR move-out bill exists and still waiting for settlement confirmation
            activeRooms.forEach(room => {
                const activeTenant = (room.tenants as any[])?.find(t => t.status === 'active');
                if (activeTenant?.planned_move_out_date) {
                    movingOutIdsSet.add(room.id);
                }

                const hasPendingMoveOutBill = (monthBills || []).some((b: any) =>
                    b.room_id === room.id &&
                    b.tenant_id === activeTenant?.id &&
                    String(b.bill_type || '') === 'move_out' &&
                    ['unpaid', 'overdue', 'waiting_verify'].includes(String(b.status || '').toLowerCase())
                );
                if (hasPendingMoveOutBill) {
                    movingOutIdsSet.add(room.id);
                    pendingMoveOutBillIdsSet.add(room.id);
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
            setPendingMoveOutBillRoomIds(pendingMoveOutBillIdsSet);

            setStats({
                total: activeRooms.length,
                occupied: activeRooms.filter(r => r.status === 'occupied').length,
                vacant: activeRooms.filter(r => r.status === 'available').length,
                maintenance: activeRooms.filter(r => r.status === 'maintenance').length,
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
                const u = utilityHistoryMap.get(m) || { electricity: 0, water: 0, electricityAmount: 0, waterAmount: 0 };
                const utils = Array.isArray(b.utilities) ? b.utilities[0] : b.utilities;
                if (utils) {
                    u.electricity += (Number(utils.curr_electric_meter) - Number(utils.prev_electric_meter)) || 0;
                    u.water += (Number(utils.curr_water_meter) - Number(utils.prev_water_meter)) || 0;
                    u.electricityAmount += Number(utils.electric_price) || 0;
                    u.waterAmount += Number(utils.water_price) || 0;
                }
                utilityHistoryMap.set(m, u);
            });

            const historicalRevenue = [];
            const historicalUtilities = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const m = d.toLocaleDateString('th-TH', { month: 'short' });

                historicalRevenue.push({ month: m, amount: historyMap.get(m) || 0 });

                const uVals = utilityHistoryMap.get(m) || { electricity: 0, water: 0, electricityAmount: 0, waterAmount: 0 };
                historicalUtilities.push({ month: m, ...uVals });
            }

            setOverviewData({
                monthlyRevenue: collected + pending,
                collectedRevenue: collected,
                pendingRevenue: pending,
                pendingNotOverdueAmount,
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
                        billing_day: normalizeBillingDay(settings.billing_day, 30),
                        payment_due_day: normalizeBillingDay(settings.payment_due_day, 5),
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
            if (requestId !== refreshRequestIdRef.current) return
            const detail =
                err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err !== null && 'message' in err
                      ? String((err as { message: unknown }).message)
                      : String(err)
            setDbError(detail.trim() || 'ไม่สามารถโหลดข้อมูลได้')
        } finally {
            if (requestId === refreshRequestIdRef.current) {
                setLoading(false);
                setFetchingOverview(false);
            }
        }
        }

        refreshQueueRef.current = refreshQueueRef.current.catch(() => {}).then(runRefresh)
        return refreshQueueRef.current
    }, [router]);

    useEffect(() => {
        void refreshDashboard(true);
    }, [refreshDashboard]);

    // Re-fetch when switching to a data tab (not on first paint — initial effect already loads)
    useEffect(() => {
        const isDataTab = activeTab === 'overview' || activeTab === 'stats' || activeTab === 'rooms'
        const prev = prevOverviewTabRef.current
        prevOverviewTabRef.current = activeTab
        if (!isDataTab) return
        if (prev === null) return
        if (prev === activeTab) return
        void refreshDashboard(false)
    }, [activeTab, refreshDashboard]);

    // Close any floating overlays when switching tabs so they don't block clicks.
    useEffect(() => {
        if (activeTab !== 'overview') {
            setIsNotificationsOpen(false)
            setIsMenuOpen(false)
        }
    }, [activeTab])

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
                billing_day: normalizeBillingDay(settingsData.billing_day, 30),
                payment_due_day: normalizeBillingDay(settingsData.payment_due_day, 5),
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
            setSettingsData(prev => ({
                ...prev,
                billing_day: normalizeBillingDay(prev.billing_day, 30),
                payment_due_day: normalizeBillingDay(prev.payment_due_day, 5),
            }))
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



    const renderContractFormModal = () => {
        if (!isContractFormOpen) return null;
        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => !isSubmittingContract && setIsContractFormOpen(false)}
                />
                <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-primary to-emerald-600 p-5 sm:p-6 text-white relative">
                        <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <button
                            type="button"
                            onClick={() => setIsContractFormOpen(false)}
                            className="absolute top-4 right-4 w-9 h-9 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg flex items-center justify-center text-white transition-all active:scale-95 border border-white/20 z-10"
                        >
                            <XMarkIcon className="w-5 h-5 stroke-[2.5]" />
                        </button>

                        <h3 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2.5 leading-snug pr-10">
                            <div className="w-8 h-8 shrink-0 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                                <DocumentPlusIcon className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" />
                            </div>
                            {editingContract
                                ? ((editingContract.status === 'expired' || editingContract.status === 'cancelled') ? 'ดูข้อมูลสัญญา' : 'แก้ไขข้อมูลสัญญา')
                                : 'บันทึกข้อมูลสัญญาใหม่'
                            }
                        </h3>
                        <p className="text-emerald-100 font-bold text-xs sm:text-sm mt-1.5 opacity-80 leading-relaxed">
                            {(editingContract?.status === 'expired' || editingContract?.status === 'cancelled')
                                ? 'ข้อมูลสัญญาที่สิ้นสุดแล้ว (อ่านอย่างเดียว)'
                                : 'กรอกข้อมูลผู้เช่าเพื่อเตรียมทำสัญญาเช่า'}
                        </p>
                    </div>

                    <form onSubmit={handleSaveContract} className="flex-1 overflow-y-auto p-5 sm:p-6 pb-28 space-y-5 custom-scrollbar bg-white">
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Full Name */}
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.name}
                                    onChange={(e) => setContractFormData({ ...contractFormData, name: e.target.value })}
                                    className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl px-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="ใส่ชื่อผู้เช่า..."
                                />
                            </div>

                            {/* Phone */}
                            <div className="space-y-2">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    maxLength={10}
                                    value={contractFormData.phone}
                                    onChange={(e) => setContractFormData({ ...contractFormData, phone: e.target.value.replace(/\D/g, '') })}
                                    className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl px-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="08XXXXXXXX"
                                />
                            </div>

                            {/* Occupation */}
                            <div className="space-y-2">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">อาชีพ</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.occupation}
                                    onChange={(e) => setContractFormData({ ...contractFormData, occupation: e.target.value })}
                                    className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl px-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="ระบุอาชีพ..."
                                />
                            </div>

                            {/* Address */}
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">ที่อยู่ตามบัตรประชาชน</label>
                                <textarea
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    rows={2}
                                    value={contractFormData.address}
                                    onChange={(e) => setContractFormData({ ...contractFormData, address: e.target.value })}
                                    className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none resize-none"
                                    placeholder="ใส่ที่อยู่ตามบัตร..."
                                />
                            </div>

                            {/* Car Reg */}
                            <div className="space-y-2">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">ทะเบียนรถยนต์</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.car_registration}
                                    onChange={(e) => setContractFormData({ ...contractFormData, car_registration: e.target.value })}
                                    className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl px-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="เช่น กข 1234 กทม."
                                />
                            </div>

                            {/* Motor Reg */}
                            <div className="space-y-2">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">ทะเบียนมอเตอร์ไซค์</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.motorcycle_registration}
                                    onChange={(e) => setContractFormData({ ...contractFormData, motorcycle_registration: e.target.value })}
                                    className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl px-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="เช่น 1กข 1234..."
                                />
                            </div>

                            {/* Emergency */}
                            <div className="sm:col-span-2 space-y-2">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">ผู้ติดต่อฉุกเฉิน</label>
                                <input
                                    readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                    type="text"
                                    value={contractFormData.emergency_contact}
                                    onChange={(e) => setContractFormData({ ...contractFormData, emergency_contact: e.target.value })}
                                    className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl px-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                    placeholder="ชื่อและเบอร์โทร..."
                                />
                            </div>

                            <div className="sm:col-span-2 h-px bg-gray-100 my-2" />

                            {/* Premium Date Pickers */}
                            <div className="space-y-2 group/date1">
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">วันที่เริ่มสัญญา <span className="text-red-500">*</span></label>
                                <div
                                    className={`relative h-12 transition-all ${!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') ? 'cursor-pointer' : 'cursor-default'}`}
                                    onClick={() => {
                                        if (!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled')) {
                                            openCustomCalendar('start_date', contractFormData.start_date);
                                        }
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gray-50 border-2 border-transparent rounded-xl group-focus-within/date1:bg-white group-focus-within/date1:border-primary/30 group-focus-within/date1:shadow-lg group-focus-within/date1:shadow-primary/5 transition-all" />
                                    <div className="absolute inset-0 px-4 flex items-center justify-between pointer-events-none">
                                        <div className="flex items-center gap-2">
                                            <CalendarDaysIcon className="w-4 h-4 text-primary shrink-0" />
                                            <span className={`font-bold text-xs sm:text-sm ${contractFormData.start_date ? 'text-gray-900' : 'text-gray-400'}`}>
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
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">วันที่สิ้นสุดสัญญา <span className="text-red-500">*</span></label>

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
                                    className={`relative h-12 transition-all ${!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') ? 'cursor-pointer' : 'cursor-default'}`}
                                    onClick={() => {
                                        if (!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled')) {
                                            openCustomCalendar('end_date', contractFormData.end_date);
                                        }
                                    }}
                                >
                                    <div className="absolute inset-0 bg-gray-50 border-2 border-transparent rounded-xl group-focus-within/date2:bg-white group-focus-within/date2:border-primary/30 group-focus-within/date2:shadow-lg group-focus-within/date2:shadow-primary/5 transition-all" />
                                    <div className="absolute inset-0 px-4 flex items-center justify-between pointer-events-none">
                                        <div className="flex items-center gap-2">
                                            <CalendarDaysIcon className="w-4 h-4 text-red-500 shrink-0" />
                                            <span className={`font-bold text-xs sm:text-sm ${contractFormData.end_date ? 'text-gray-900' : 'text-gray-400'}`}>
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
                                <label className="text-[12px] sm:text-[13px] font-bold text-gray-900 uppercase tracking-wide ml-1">เงินมัดจำ/ประกัน <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-gray-400">฿</div>
                                    <input
                                        required
                                        readOnly={editingContract?.status === 'expired' || editingContract?.status === 'cancelled'}
                                        type="number"
                                        value={contractFormData.deposit_amount}
                                        onChange={(e) => setContractFormData({ ...contractFormData, deposit_amount: e.target.value })}
                                        className="w-full h-12 bg-gray-50 border-2 border-transparent rounded-xl pl-9 pr-4 font-bold text-sm text-gray-900 focus:bg-white focus:border-primary/30 focus:shadow-lg focus:shadow-primary/5 transition-all outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-3">
                            {!(editingContract?.status === 'expired' || editingContract?.status === 'cancelled') ? (
                                <button
                                    type="submit"
                                    disabled={isSubmittingContract}
                                    className="w-full h-12 bg-gradient-to-br from-primary to-emerald-600 text-white rounded-xl font-black text-sm sm:text-base shadow-lg shadow-primary/25 hover:from-emerald-600 hover:to-emerald-700 active:from-emerald-700 active:to-emerald-800 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmittingContract ? (
                                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>{editingContract ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลสัญญา'}</>
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsContractFormOpen(false)}
                                    className="w-full h-12 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all"
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
            <div className="w-full sm:max-w-lg bg-emerald-50/30 min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden flex flex-col relative pb-24 border-gray-100 sm:border">

                {renderCustomCalendar()}
                {renderContractFormModal()}
                {/* ── Dynamic Main Content ── */}
                {activeTab === 'overview' && (
                    <OverviewTab
                        dorm={dorm}
                        userPlan={userPlan}
                        userName={userName}
                        stats={stats}
                        overviewData={overviewData}
                        rooms={rooms}
                        pendingRoomIds={pendingRoomIds}
                        waitingVerifyRoomIds={waitingVerifyRoomIds}
                        overdueRoomIds={overdueRoomIds}
                        movingOutRoomIds={movingOutRoomIds}
                        pendingMoveOutBillRoomIds={pendingMoveOutBillRoomIds}
                        formatThaiDate={formatThaiDate}
                        router={router}
                        setActiveTab={setActiveTab}
                        isNotificationsOpen={isNotificationsOpen}
                        setIsNotificationsOpen={setIsNotificationsOpen}
                        isMenuOpen={isMenuOpen}
                        setIsMenuOpen={setIsMenuOpen}
                        handleLogout={handleLogout}
                        setIsChangePasswordOpen={setIsChangePasswordOpen}
                        setActiveSettingsTab={setActiveSettingsTab}
                        setSelectedStatus={setSelectedStatus}
                        dbError={dbError}
                    />
                )}

                {/* ── Stats Tab Content ── */}
                {activeTab === 'stats' && (
                    <StatsTab
                        fetchingOverview={fetchingOverview}
                        overviewData={overviewData}
                        router={router}
                        setActiveTab={setActiveTab}
                        setSelectedStatus={setSelectedStatus}
                        dorm={dorm}
                        userName={userName}
                    />
                )}

                {/* ── Rooms Tab Content (Premium Redesign) ── */}
                {activeTab === 'rooms' && (
                    <RoomsTab
                        rooms={rooms}
                        selectedFloor={selectedFloor}
                        selectedStatus={selectedStatus}
                        setSelectedFloor={setSelectedFloor}
                        setSelectedStatus={setSelectedStatus}
                        waitingVerifyRoomIds={waitingVerifyRoomIds}
                        unpaidRoomIds={unpaidRoomIds}
                        overdueRoomIds={overdueRoomIds}
                        movingOutRoomIds={movingOutRoomIds}
                        router={router}
                    />
                )}

                {/* ── Settings Tab Content ── */}
                {activeTab === 'settings' && (
                    <SettingsTab
                        onCloseSettings={() => setActiveTab('overview')}
                        activeSettingsTab={activeSettingsTab}
                        setActiveSettingsTab={setActiveSettingsTab}
                        dormId={dorm?.id || ''}
                        dormData={dormData}
                        setDormData={setDormData}
                        settingsData={settingsData}
                        setSettingsData={setSettingsData}
                        newServiceName={newServiceName}
                        setNewServiceName={setNewServiceName}
                        newServicePrice={newServicePrice}
                        setNewServicePrice={setNewServicePrice}
                        addService={addService}
                        services={services}
                        removeService={removeService}
                        showLineConfig={showLineConfig}
                        setShowLineConfig={setShowLineConfig}
                        lineConfig={lineConfig}
                        setLineConfig={setLineConfig}
                        copyToClipboard={copyToClipboard}
                        copied={copied}
                        handleTestConnection={handleTestConnection}
                        handleResetOwnerLine={handleResetOwnerLine}
                        isResettingOwnerLine={isResettingOwnerLine}
                        isTestingConnection={isTestingConnection}
                        testResult={testResult}
                        handleSaveSettings={handleSaveSettings}
                        savingSettings={savingSettings}
                        settingsMessage={settingsMessage}
                    />
                )}

                {/* ── Contract (Tenants) Tab Content ── */}
                {activeTab === 'tenants' && (
                    <TenantsTab
                        contracts={contracts}
                        fetchingContracts={fetchingContracts}
                        contractTab={contractTab}
                        setContractTab={setContractTab}
                        contractSearchQuery={contractSearchQuery}
                        setContractSearchQuery={setContractSearchQuery}
                        contractError={contractError}
                        formatThaiDate={formatThaiDate}
                        openEditContract={openEditContract}
                        handleDeleteContract={handleDeleteContract}
                        setIsContractFormOpen={setIsContractFormOpen}
                        setEditingContract={setEditingContract}
                        setContractFormData={setContractFormData}
                        router={router}
                        dorm={dorm}
                        userName={userName}
                    />
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
                            <div className="bg-primary p-8 text-white relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                                        <LockClosedIcon className="w-6 h-6" />
                                    </div>
                                    เปลี่ยนรหัสผ่าน
                                </h3>
                                <p className="text-white/80 font-bold text-sm mt-2">เพื่อความปลอดภัยของข้อมูลบัญชีคุณ</p>
                            </div>

                            <form onSubmit={handlePasswordChange} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">รหัสผ่านเดิม</label>
                                        <div className="relative group/field">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/field:text-primary transition-colors">
                                                <KeyIcon className="w-5 h-5" />
                                            </div>
                                            <input
                                                required
                                                type="password"
                                                value={passwordData.oldPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                                                className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-primary transition-all outline-none"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-100 mx-4" />

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">รหัสผ่านใหม่</label>
                                        <div className="relative group/field">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/field:text-primary transition-colors">
                                                <LockClosedIcon className="w-5 h-5" />
                                            </div>
                                            <input
                                                required
                                                minLength={6}
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-primary transition-all outline-none"
                                                placeholder="รหัสใหม่ (อย่างน้อย 6 ตัว)"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">ยืนยันรหัสผ่านใหม่</label>
                                        <div className="relative group/field">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within/field:text-primary transition-colors">
                                                <CheckCircleIcon className="w-5 h-5" />
                                            </div>
                                            <input
                                                required
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                className="w-full h-14 bg-gray-50 border-2 border-gray-50 rounded-2xl pl-12 pr-4 font-bold text-gray-800 focus:bg-white focus:border-primary transition-all outline-none"
                                                placeholder="ยืนยันรหัสใหม่อีกครั้ง"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {(passwordError || passwordSuccess) && (
                                    <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${passwordSuccess ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-red-50 text-red-700 border border-red-100'}`}>
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
                                        className="flex-[2] h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black shadow-lg shadow-green-100 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
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
