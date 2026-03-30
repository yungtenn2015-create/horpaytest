'use client'

import {
    PlusIcon,
    MagnifyingGlassIcon,
    UsersIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    UserIcon,
    DevicePhoneMobileIcon,
    PencilSquareIcon,
    TrashIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline'
import { TenantContract } from '../DashboardClient'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

interface TenantsTabProps {
    contracts: TenantContract[];
    fetchingContracts: boolean;
    contractTab: 'pending' | 'active' | 'old';
    setContractTab: (tab: 'pending' | 'active' | 'old') => void;
    contractSearchQuery: string;
    setContractSearchQuery: (query: string) => void;
    contractError: string;
    formatThaiDate: (dateStr: string | null | undefined) => string;
    openEditContract: (contract: TenantContract) => void;
    handleDeleteContract: (id: string, status?: string) => Promise<void>;
    setIsContractFormOpen: (open: boolean) => void;
    setEditingContract: (contract: TenantContract | null) => void;
    setContractFormData: (data: any) => void;
    router: AppRouterInstance;
    dorm: { name: string } | null;
    userName: string;
}

export default function TenantsTab({
    contracts,
    fetchingContracts,
    contractTab,
    setContractTab,
    contractSearchQuery,
    setContractSearchQuery,
    contractError,
    formatThaiDate,
    openEditContract,
    handleDeleteContract,
    setIsContractFormOpen,
    setEditingContract,
    setContractFormData,
    router,
    dorm,
    userName
}: TenantsTabProps) {
    return (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Header — โครงเดียวกับหน้าสถานะห้อง (RoomsTab) */}
                <div className="relative min-h-[210px] shrink-0">
                    {/* พื้นเขียว + มุมมน — คลาสเดียวกับ RoomsTab */}
                    <div className="absolute inset-0 bg-primary rounded-b-[2.5rem] sm:rounded-t-[2.5rem] shadow-lg overflow-hidden z-0">
                        <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse duration-[4000ms]" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-56 h-56 bg-white/5 rounded-full blur-2xl" />
                    </div>

                    {/* แถบหัวข้อ: โค้ดชุดเดียวกับ RoomsTab (แถวเดียว icon + หัวข้อ + บรรทัดรอง) */}
                    <div className="relative z-50 pt-8 pb-10 px-6 sm:px-10">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-[20px] rounded-[1.8rem] sm:rounded-[2.2rem] flex items-center justify-center text-white border border-white/30 shadow-2xl animate-in zoom-in duration-700">
                                <UsersIcon className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-md" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tight text-white leading-tight underline decoration-white/20 underline-offset-8">
                                    บันทึกสัญญา
                                </h1>
                                <p className="text-sm sm:text-base text-white/95 font-bold tracking-tight mt-2">
                                    จัดการข้อมูลผู้เช่าและสัญญา
                                </p>
                            </div>
                        </div>

                        {/* ปุ่มเฉพาะหน้านี้: ไม่แย่งแถวกับหัวข้อ — มือถือแถวล่างเต็มความกว้าง, sm+ มุมขวาบน */}
                        <button
                            type="button"
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
                            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-primary shadow-xl shadow-green-900/20 transition-all active:scale-95 group sm:absolute sm:right-10 sm:top-8 sm:mt-0 sm:h-12 sm:w-auto sm:px-6 sm:text-base"
                        >
                            <PlusIcon className="w-4 h-4 stroke-[3]" />
                            เพิ่มสัญญา
                        </button>
                    </div>
                </div>

                <div className="relative z-20 -mt-6 flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-8">
                    {/* Search Bar */}
                    <div className="shrink-0 space-y-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-emerald-600/70 group-focus-within:text-primary transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={contractSearchQuery}
                                onChange={(e) => setContractSearchQuery(e.target.value)}
                                className="w-full h-12 rounded-xl border-2 border-emerald-200 bg-white pl-12 pr-4 text-sm font-bold text-gray-900 shadow-md shadow-emerald-900/10 outline-none transition-all placeholder:text-gray-500 focus:border-primary focus:shadow-lg focus:shadow-emerald-900/15 focus:ring-2 focus:ring-primary/20"
                                placeholder="ค้นหาตาม ชื่อ, เบอร์โทรศัพท์ หรือ ห้อง..."
                            />
                        </div>

                        {/* Category Tabs — โทนเขียวเดียวกับหัวหน้า ไม่ใช้สีน้ำเงินตอน active */}
                        <div className="rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm shadow-emerald-900/5">
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setContractTab('active')}
                                    className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 text-center font-black transition-all duration-200 sm:flex-row sm:gap-1.5 sm:py-3 sm:text-[13px] ${contractTab === 'active'
                                        ? 'bg-primary text-white shadow-md shadow-emerald-900/25'
                                        : 'text-emerald-800/55 hover:bg-emerald-50/90 hover:text-emerald-900'
                                        }`}
                                >
                                    <UsersIcon className={`h-4 w-4 shrink-0 stroke-[2.5] ${contractTab === 'active' ? 'text-white' : ''}`} />
                                    <span className="max-w-[5.5rem] text-[11px] leading-tight sm:max-w-none">กำลังเข้าพัก</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setContractTab('pending')}
                                    className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 text-center font-black transition-all duration-200 sm:flex-row sm:gap-1.5 sm:py-3 sm:text-[13px] ${contractTab === 'pending'
                                        ? 'bg-primary text-white shadow-md shadow-emerald-900/25'
                                        : 'text-emerald-800/55 hover:bg-emerald-50/90 hover:text-emerald-900'
                                        }`}
                                >
                                    <PlusIcon className={`h-4 w-4 shrink-0 stroke-[2.5] ${contractTab === 'pending' ? 'text-white' : ''}`} />
                                    <span className="max-w-[5.5rem] text-[11px] leading-tight sm:max-w-none">สัญญาใหม่</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setContractTab('old')}
                                    className={`flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 text-center font-black transition-all duration-200 sm:flex-row sm:gap-1.5 sm:py-3 sm:text-[13px] ${contractTab === 'old'
                                        ? 'bg-primary text-white shadow-md shadow-emerald-900/25'
                                        : 'text-emerald-800/55 hover:bg-emerald-50/90 hover:text-emerald-900'
                                        }`}
                                >
                                    <ClockIcon className={`h-4 w-4 shrink-0 stroke-[2.5] ${contractTab === 'old' ? 'text-white' : ''}`} />
                                    <span className="max-w-[5.5rem] text-[11px] leading-tight sm:max-w-none">สัญญาเก่า</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* List Area */}
                    <div className="relative z-0 min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto overscroll-y-contain pb-dashboard-nav pt-3 custom-scrollbar">
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
                                            className={`bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${contract.status === 'moved_in' ? 'hover:border-emerald-100' : 'hover:border-green-100'}`}
                                        >
                                            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${contract.status === 'moved_in' ? 'bg-emerald-50/60' : 'bg-green-50/50'}`} />


                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors duration-300 ${contract.status === 'moved_in'
                                                        ? 'bg-emerald-50 text-primary border-emerald-100 group-hover:bg-primary'
                                                        : 'bg-green-50 text-green-600 border-green-100 group-hover:bg-green-600'
                                                        } group-hover:text-white`}>
                                                        <UserIcon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center flex-wrap gap-2">
                                                            <h3 className={`text-lg font-black text-gray-800 tracking-tight transition-colors ${contract.status === 'moved_in' ? 'group-hover:text-primary' : 'group-hover:text-green-700'}`}>{contract.name}</h3>
                                                            {(contract as any).tenants?.[0]?.rooms?.room_number && (
                                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-widest ${contract.status === 'moved_in'
                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                                                    : 'bg-green-100 text-green-700 border-green-200'
                                                                    }`}>
                                                                    ห้อง {(contract as any).tenants[0].rooms.room_number}
                                                                </span>
                                                            )}
                                                            {contract.status === 'moved_in' && (
                                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md text-[10px] font-black border border-blue-100 uppercase tracking-widest">
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
                                                            ? `text-gray-400 ${contract.status === 'moved_in' ? 'hover:bg-emerald-50 hover:text-primary' : 'hover:bg-green-50 hover:text-green-600'}`
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
                                                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 ${contract.status === 'moved_in' ? 'bg-emerald-50 text-primary' : 'bg-green-50 text-green-700'}`}>
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
                </div>
            </div>
        </div>
    );
}
