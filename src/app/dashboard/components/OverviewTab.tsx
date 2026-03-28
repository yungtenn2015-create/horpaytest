'use client'

import React from 'react'
import { differenceInCalendarDays } from 'date-fns'
import {
    BellIcon,
    ExclamationTriangleIcon,
    ArrowRightOnRectangleIcon,
    ChevronRightIcon,
    ClockIcon,
    BuildingOfficeIcon,
    Squares2X2Icon,
    ChatBubbleLeftRightIcon,
    LockClosedIcon,
    HomeIcon,
    UsersIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline'
import {
    BanknotesIcon as BanknotesSolid
} from '@heroicons/react/24/solid'

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
}

interface OverviewTabProps {
    dorm: { name: string; created_at?: string } | null;
    userPlan: { plan_type: string; trial_expires_at: string } | null;
    userName: string;
    stats: {
        total: number;
        vacant: number;
        occupied: number;
        maintenance: number;
    };
    overviewData: {
        monthlyRevenue: number;
        collectedRevenue: number;
        pendingRevenue: number;
        pendingNotOverdueAmount?: number;
        occupancyRate: number;
        waterUnits: number;
        waterAmount: number;
        electricityUnits: number;
        electricityAmount: number;
        billStatusCounts: {
            paid: number;
            waiting_verify: number;
            unpaid: number;
            overdue?: number;
            movingOut?: number;
            overdueAmount?: number;
        };
    };
    rooms: Room[];
    pendingRoomIds: Set<string>;
    waitingVerifyRoomIds: Set<string>;
    overdueRoomIds: Set<string>;
    movingOutRoomIds: Set<string>;
    formatThaiDate: (date: string | null | undefined) => string;
    router: any;
    setActiveTab: (tab: string) => void;
    isNotificationsOpen: boolean;
    setIsNotificationsOpen: (open: boolean) => void;
    isMenuOpen: boolean;
    setIsMenuOpen: (open: boolean) => void;
    handleLogout: () => Promise<void>;
    setIsChangePasswordOpen: (open: boolean) => void;
    setActiveSettingsTab: (tab: string) => void;
    setSelectedStatus: (status: string) => void;
    dbError: string | null;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
    dorm,
    userPlan,
    userName,
    stats,
    overviewData,
    rooms,
    pendingRoomIds,
    waitingVerifyRoomIds,
    overdueRoomIds,
    movingOutRoomIds,
    formatThaiDate,
    router,
    setActiveTab,
    isNotificationsOpen,
    setIsNotificationsOpen,
    isMenuOpen,
    setIsMenuOpen,
    handleLogout,
    setIsChangePasswordOpen,
    setActiveSettingsTab,
    setSelectedStatus,
    dbError
}) => {
    const [trialNow, setTrialNow] = React.useState(() => new Date());
    const notifTriggerRef = React.useRef<HTMLButtonElement>(null);
    const notifPanelRef = React.useRef<HTMLDivElement>(null);
    const menuTriggerRef = React.useRef<HTMLDivElement>(null);
    const menuPanelRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const id = setInterval(() => setTrialNow(new Date()), 60 * 60 * 1000);
        return () => clearInterval(id);
    }, []);

    React.useEffect(() => {
        if (!isNotificationsOpen && !isMenuOpen) return;

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (isNotificationsOpen) {
                const inTrigger = notifTriggerRef.current?.contains(target);
                const inPanel = notifPanelRef.current?.contains(target);
                if (!inTrigger && !inPanel) setIsNotificationsOpen(false);
            }
            if (isMenuOpen) {
                const inTrigger = menuTriggerRef.current?.contains(target);
                const inPanel = menuPanelRef.current?.contains(target);
                if (!inTrigger && !inPanel) setIsMenuOpen(false);
            }
        };

        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [isNotificationsOpen, isMenuOpen, setIsNotificationsOpen, setIsMenuOpen]);

    const getTrialDaysLeft = () => {
        if (!userPlan?.trial_expires_at) return 0;
        const end = new Date(userPlan.trial_expires_at);
        const n = Math.max(0, differenceInCalendarDays(end, trialNow));
        return n;
    };

    const isPro = userPlan?.plan_type === 'pro';

    const getPendingNotificationsCount = () => {
        let count = 0;
        const today = new Date();

        rooms.forEach((room) => {
            if (waitingVerifyRoomIds.has(room.id)) count++;
            if (overdueRoomIds.has(room.id)) count++;
            if (movingOutRoomIds.has(room.id)) count++;

            const activeTenant = room.tenants?.find((t) => t.status === 'active');
            if (activeTenant?.planned_move_out_date) {
                const moveOutDate = new Date(activeTenant.planned_move_out_date);
                const diffTime = moveOutDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7 && diffDays >= 0) count++;
            }
        });

        return count;
    };

    const renderNotificationsPopover = () => {
        if (!isNotificationsOpen) return null;

        const notifications: { id: string; type: 'verify' | 'overdue' | 'move_out' | 'move_out_bill'; title: string; description: string; roomId: string; date?: string }[] = [];

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
            if (movingOutRoomIds.has(room.id)) {
                notifications.push({
                    id: `move-out-bill-${room.id}`,
                    type: 'move_out_bill',
                    title: `ห้อง ${room.room_number} • มีบิลย้ายออกค้าง`,
                    description: 'กรุณาไปยืนยันสรุปยอด/จัดการบิลย้ายออกที่ประวัติบิล',
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
                    className="fixed inset-0 z-[105] bg-black/10 touch-manipulation"
                    aria-hidden
                    onClick={() => setIsNotificationsOpen(false)}
                />
                <div
                    ref={notifPanelRef}
                    className="absolute right-[-1.5rem] top-full mt-4 w-72 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right"
                >
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
                                            if (notif.type === 'move_out_bill' || notif.type === 'move_out') {
                                                router.push(`/dashboard/move-out?roomId=${notif.roomId}`);
                                                return;
                                            }
                                            router.push(`/dashboard/billing?roomId=${notif.roomId}`);
                                        }}
                                        className="w-full text-left p-4 rounded-2xl hover:bg-gray-50 transition-all group flex gap-4"
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${notif.type === 'verify' ? 'bg-sky-50 text-sky-500' :
                                            notif.type === 'overdue' ? 'bg-orange-50 text-orange-500' :
                                                notif.type === 'move_out_bill' ? 'bg-purple-50 text-purple-500' : 'bg-amber-50 text-amber-500'
                                            }`}>
                                            {notif.type === 'verify' && <ClockIcon className="w-5 h-5 stroke-[2.5]" />}
                                            {notif.type === 'overdue' && <ExclamationTriangleIcon className="w-5 h-5 stroke-[2.5]" />}
                                            {notif.type === 'move_out' && <ArrowRightOnRectangleIcon className="w-5 h-5 stroke-[2.5]" />}
                                            {notif.type === 'move_out_bill' && <DocumentTextIcon className="w-5 h-5 stroke-[2.5]" />}
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
    };

    return (
        <div className="bg-emerald-50/30 font-body text-slate-800 antialiased min-h-screen pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto h-full">
            {/* Hero Section */}
            <div className="relative min-h-[210px]">
                {/* Background with clipping */}
                <div className="absolute inset-0 bg-primary rounded-b-[2.5rem] sm:rounded-t-[2.5rem] shadow-lg overflow-hidden z-0">
                    <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse duration-[4000ms]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-56 h-56 bg-white/5 rounded-full blur-2xl" />
                </div>

                {/* Header Content */}
                <div className="relative z-50 pt-8 pb-10 px-10">
                    {/* Header */}
                    <div className="relative z-20 flex justify-between items-center mb-6 px-1">
                        <div className="flex items-center gap-3">
                            {!isPro && (
                                <div className="absolute top-[-1.5rem] left-[-0.5rem] bg-white/10 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-sm animate-in fade-in slide-in-from-left-4 duration-700 pointer-events-none">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                    <span className="text-[10px] font-bold text-white/90 uppercase tracking-tight">
                                        ทดลองใช้ฟรี {getTrialDaysLeft()} วัน
                                    </span>
                                </div>
                            )}
                            <span className="text-xl sm:text-4xl font-black tracking-tight text-white">HORPAY</span>
                            {isPro && (
                                <div className="bg-amber-400/20 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-amber-400/30 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-left-4 duration-700">
                                    <span className="material-symbols-outlined text-[14px] text-amber-400 font-bold">workspace_premium</span>
                                    <span className="text-[10px] font-black text-amber-100 uppercase tracking-widest">
                                        PRO ACCOUNT
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="relative">
                                <button
                                    ref={notifTriggerRef}
                                    type="button"
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsNotificationsOpen(!isNotificationsOpen);
                                    }}
                                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 border shadow-sm backdrop-blur-md ${isNotificationsOpen
                                        ? 'bg-white text-primary border-white'
                                        : 'bg-white/20 hover:bg-white/30 text-white border-white/20'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[26px]">notifications</span>
                                    {getPendingNotificationsCount() > 0 && !isNotificationsOpen && (
                                        <div className="absolute top-1 right-1 w-[12px] h-[12px] bg-red-500 rounded-full border-2 border-white shadow-sm" />
                                    )}
                                </button>
                                {renderNotificationsPopover()}
                            </div>
                            <div className="relative">
                                <div
                                    ref={menuTriggerRef}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        setIsNotificationsOpen(false);
                                        setIsMenuOpen(!isMenuOpen);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setIsNotificationsOpen(false);
                                            setIsMenuOpen(!isMenuOpen);
                                        }
                                    }}
                                    className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 border-2 border-white/20 overflow-hidden"
                                >
                                    <span className="material-symbols-outlined text-[26px]">person</span>
                                </div>

                                {/* Dropdown Menu */}
                                {isMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-[105] bg-black/10"
                                            aria-hidden
                                            onClick={() => setIsMenuOpen(false)}
                                        />
                                        <div
                                            ref={menuPanelRef}
                                            className="absolute right-0 top-full mt-4 w-[260px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right"
                                        >
                                            <div className="px-6 py-6 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100">
                                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">แจ้งปัญหาติดต่อ</p>
                                                <p className="text-[14px] font-black text-gray-800 tracking-tight leading-none truncate">Line : yungtenn2015</p>
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

            <main className="px-5 -mt-6 relative z-20 space-y-6 pb-8">
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
                        { icon: 'payments', label: 'ค้างชำระ', value: overviewData.billStatusCounts?.overdue || 0, color: 'bg-orange-50 text-orange-500' },

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
                        {rooms.filter(r => pendingRoomIds.has(r.id) || movingOutRoomIds.has(r.id)).length > 0 ? (
                            rooms.filter(r => pendingRoomIds.has(r.id) || movingOutRoomIds.has(r.id)).slice(0, 5).map((room) => (
                                <div
                                    key={room.id}
                                    onClick={() => {
                                        if (movingOutRoomIds.has(room.id)) {
                                            router.push(`/dashboard/move-out?roomId=${room.id}`)
                                            return
                                        }
                                        router.push('/dashboard/billing')
                                    }}
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
                                        {movingOutRoomIds.has(room.id) ? (
                                            <div className="h-8 px-3 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                                                <span className="text-[10px] font-black uppercase text-rose-600">รอยืนยันย้ายออก</span>
                                            </div>
                                        ) : waitingVerifyRoomIds.has(room.id) ? (
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
    );
};

export default OverviewTab;
