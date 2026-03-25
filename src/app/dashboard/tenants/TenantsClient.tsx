'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import {
    ArrowLeftIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    UserCircleIcon,
    PhoneIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    ChevronRightIcon,
    XMarkIcon,
    TruckIcon,
    UserIcon,
    ExclamationTriangleIcon,
    PencilSquareIcon,
    BanknotesIcon,
    ArrowRightOnRectangleIcon,
    ArrowsRightLeftIcon,
    ClockIcon,
    BriefcaseIcon,
    MapPinIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline'

interface Tenant {
    id: string;
    name: string;
    phone: string | null;
    status: string;
    created_at: string;
    room_id: string;
    car_registration: string | null;
    motorcycle_registration: string | null;
    emergency_contact: string | null;
    id_card_number: string | null;
    occupation: string | null;
    address: string | null;
    rooms: {
        room_number: string;
        floor: string;
        base_price: number;
        room_type?: string;
    };
    lease_contracts?: {
        deposit_amount: number;
        rent_price: number;
        start_date: string;
        end_date: string | null;
    }[];
    planned_move_out_date?: string | null;
}

export default function TenantsClient() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [copyToast, setCopyToast] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Fetch tenants with room info
            const { data, error } = await supabase
                .from('tenants')
                .select(`
                    *,
                    rooms (
                        room_number,
                        floor,
                        base_price,
                        room_type
                    ),
                    lease_contracts (
                        deposit_amount,
                        rent_price,
                        start_date,
                        end_date
                    )
                `)
                .eq('status', 'active')
                .order('created_at', { ascending: false })

            if (error) throw error
            setTenants(data as any[] || [])
        } catch (err: any) {
            setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลผู้เช่าได้')
        } finally {
            setLoading(false)
        }
    }

    const handleCopyPhone = (phone: string) => {
        if (!phone) return
        navigator.clipboard.writeText(phone)
        setCopyToast(true)
        setTimeout(() => setCopyToast(false), 3000)
    }

    // Helper to format date to Thai Buddhist Era (พ.ศ.)
    const formatThaiDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            const thaiYear = date.getFullYear() + 543;
            // day numeric, month long, year numeric
            return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long' }) + ` ${thaiYear}`;
        } catch (e) {
            return '';
        }
    };

    // Helper to calculate months/years between dates
    const calculateDuration = (start: string, end: string) => {
        if (!start || !end) return '';
        try {
            const d1 = new Date(start);
            const d2 = new Date(end);
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '';

            let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
            if (months <= 0) return '';

            if (months >= 12) {
                const years = Math.floor(months / 12);
                const remainingMonths = months % 12;
                if (remainingMonths === 0) return `${years} ปี`;
                return `${years} ปี ${remainingMonths} เดือน`;
            }
            return `${months} เดือน`;
        } catch (e) {
            return '';
        }
    };

    const filteredTenants = tenants.filter(t => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) return true;

        return (
            t.name.toLowerCase().includes(query) ||
            t.rooms.room_number.toLowerCase().includes(query) ||
            (t.phone && t.phone.includes(query)) ||
            (t.car_registration && t.car_registration.toLowerCase().includes(query)) ||
            (t.motorcycle_registration && t.motorcycle_registration.toLowerCase().includes(query))
        )
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

                {/* ── Header ── */}
                <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
                    <div className="px-6 py-4 sm:py-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="w-10 h-10 bg-gray-50 hover:bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 transition-all active:scale-95"
                                >
                                    <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
                                </button>
                                <div>
                                    <h1 className="text-xl font-black text-gray-800 tracking-tight">ข้อมูลผู้เช่า</h1>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">จัดการข้อมูลพื้นฐานและการติดต่อ</p>
                                </div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className={`h-5 w-5 transition-colors duration-300 ${searchQuery ? 'text-blue-500' : 'text-gray-400'}`} />
                            </div>
                            <input
                                type="text"
                                placeholder="ค้นหาเลขห้อง ชื่อ หรือทะเบียนรถ..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 rounded-2xl transition-all font-bold text-base outline-none shadow-sm hover:bg-gray-100/50"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center">
                                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-300 transition-colors">
                                        <XMarkIcon className="h-4 w-4 stroke-[3]" />
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Tenant List ── */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3 pb-24">
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600 text-xs font-bold mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                            {errorMsg}
                        </div>
                    )}

                    {filteredTenants.length > 0 ? (
                        filteredTenants.map((tenant) => (
                            <button
                                key={tenant.id}
                                onClick={() => setSelectedTenant(tenant)}
                                className="w-full bg-white p-4 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex flex-col items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:border-blue-600 transition-colors duration-300">
                                        <span className="text-[10px] font-black text-blue-400 group-hover:text-blue-100 leading-none mb-1">ห้อง</span>
                                        <span className="text-xl font-black text-blue-700 group-hover:text-white leading-none tracking-tight">{tenant.rooms.room_number}</span>
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-base font-black text-gray-800 tracking-tight group-hover:text-blue-700 transition-colors">{tenant.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${tenant.planned_move_out_date ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em]">
                                                {tenant.planned_move_out_date ? 'แจ้งออก' : 'กำลังเข้าพัก'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                                    <ChevronRightIcon className="w-5 h-5 stroke-[2.5]" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center border border-dashed border-gray-200">
                                <UserIcon className="w-10 h-10 text-gray-200" />
                            </div>
                            <div>
                                <p className="text-gray-400 font-black text-sm uppercase tracking-wider">ไม่พบข้อมูลรายชื่อ</p>
                                <p className="text-gray-300 text-[10px] font-bold">ลองพิมพ์ชื่อตัวย่อ หรือเลขห้องดูนะครับ</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Detail Modal ── */}
                {selectedTenant && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedTenant(null)} />

                        <div className="relative w-full sm:max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[850px] animate-in slide-in-from-bottom duration-500 ring-1 ring-black/5">
                            {/* Modal Header - Match AddTenant Style but BLUE */}
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 pt-12 pb-10 relative overflow-hidden shrink-0">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <button
                                    onClick={() => setSelectedTenant(null)}
                                    className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 active:scale-95 rounded-2xl flex items-center justify-center text-white transition-all z-20 border border-white/10"
                                >
                                    <XMarkIcon className="w-8 h-8 stroke-[3]" />
                                </button>

                                <div className="flex items-center gap-5 relative z-10">
                                    <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex flex-col items-center justify-center border border-white/20 backdrop-blur-md shadow-lg shadow-black/10">
                                        <span className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-0.5 leading-none">ห้อง</span>
                                        <span className="text-3xl font-black text-white leading-none">{selectedTenant.rooms.room_number}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-2xl font-black text-white leading-tight truncate drop-shadow-sm">{selectedTenant.name}</h2>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${selectedTenant.planned_move_out_date ? 'bg-amber-500' : 'bg-blue-400'} text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-colors`}>
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                {selectedTenant.planned_move_out_date ? 'แจ้งออก' : 'กำลังเข้าพัก'}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                                                ชั้น {selectedTenant.rooms.floor}
                                            </span>
                                            {selectedTenant.rooms.room_type && (
                                                <span className={`inline-flex items-center gap-1 px-3 py-1.5 ${selectedTenant.rooms.room_type === 'air' ? 'bg-sky-400' : 'bg-orange-500'} text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md`}>
                                                    {selectedTenant.rooms.room_type === 'air' ? 'แอร์' : 'พัดลม'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Content - Scrollable */}
                            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 bg-white relative z-20 custom-scrollbar">
                                {/* 1. ข้อมูลพื้นฐาน (Basic Info) */}
                                <div className="space-y-6">
                                    <h3 className="text-[11px] font-black text-blue-600 flex items-center gap-2 uppercase tracking-[0.2em] opacity-80">
                                        <UserCircleIcon className="w-4 h-4" /> ข้อมูลพื้นฐาน
                                    </h3>

                                    <div className="grid grid-cols-1 gap-6">
                                        {/* Room Number - Explicitly requested */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                                                <HomeIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-black uppercase tracking-widest mb-1">หมายเลขห้องพัก</p>
                                                <p className="text-2xl font-black text-black tracking-tight">ห้อง {selectedTenant.rooms.room_number}</p>
                                            </div>
                                        </div>

                                        {/* Phone */}
                                        <div className="flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                                                    <PhoneIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-black uppercase tracking-widest mb-1">เบอร์โทรศัพท์</p>
                                                    <p className="text-xl font-black text-black tracking-tight">{selectedTenant.phone || 'ไม่ระบุ'}</p>
                                                </div>
                                            </div>
                                            {selectedTenant.phone && (
                                                <button
                                                    onClick={() => handleCopyPhone(selectedTenant.phone!)}
                                                    className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 active:scale-90"
                                                >
                                                    <PhoneIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Occupation */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                                                <BriefcaseIcon className="w-6 h-6 stroke-2" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-black uppercase tracking-widest mb-1">อาชีพ</p>
                                                <p className="text-xl font-black text-black tracking-tight">{selectedTenant.occupation || 'ไม่ระบุ'}</p>
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm shrink-0">
                                                <MapPinIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-black uppercase tracking-widest mb-2 mt-1">ที่อยู่ตามบัตรประชาชน</p>
                                                <p className="text-base font-black text-black leading-relaxed max-w-[280px]">
                                                    {selectedTenant.address || 'ไม่ระบุข้อมูล'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. ข้อมูลยานพาหนะและการติดต่อฉุกเฉิน (Vehicles & Emergency) */}
                                <div className="space-y-6 pt-2">
                                    <h3 className="text-[11px] font-black text-blue-600 flex items-center gap-2 uppercase tracking-[0.2em] opacity-80">
                                        <TruckIcon className="w-4 h-4" /> ยานพาหนะและติดต่อฉุกเฉิน
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-5 bg-gray-50/80 rounded-3xl border border-gray-100 shadow-inner">
                                            <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1.5">รถยนต์</p>
                                            <p className="font-black text-black text-base leading-tight lg:text-lg">{selectedTenant.car_registration || 'ไม่มี'}</p>
                                        </div>
                                        <div className="p-5 bg-gray-50/80 rounded-3xl border border-gray-100 shadow-inner">
                                            <p className="text-[10px] font-black text-black uppercase tracking-widest mb-1.5">มอเตอร์ไซค์</p>
                                            <p className="font-black text-black text-base leading-tight lg:text-lg">{selectedTenant.motorcycle_registration || 'ไม่มี'}</p>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-red-50/50 rounded-3xl border border-red-100/50">
                                        <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <ExclamationTriangleIcon className="w-3 h-3" /> ผู้ติดต่อฉุกเฉิน
                                        </p>
                                        <p className="text-xl font-black text-black tracking-tight">{selectedTenant.emergency_contact || 'ไม่ระบุ'}</p>
                                    </div>
                                </div>

                                {/* 3. รายละเอียดสัญญาเช่า (Lease Details) */}
                                <div className="space-y-6 pt-2">
                                    <h3 className="text-[11px] font-black text-blue-600 flex items-center gap-2 uppercase tracking-[0.2em] opacity-80">
                                        <DocumentTextIcon className="w-4 h-4" /> รายละเอียดสัญญาเช่า
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-black text-black uppercase tracking-widest ml-1">วันที่เริ่มสัญญา</p>
                                                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                                                    <CalendarDaysIcon className="w-5 h-5 text-blue-500 shrink-0" />
                                                    <span className="text-base font-black text-black">{formatThaiDate(selectedTenant.lease_contracts?.[0]?.start_date || selectedTenant.created_at)}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-black text-black uppercase tracking-widest ml-1">วันที่สิ้นสุด</p>
                                                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-inner">
                                                    <CalendarDaysIcon className="w-5 h-5 text-red-400 shrink-0" />
                                                    <span className="text-base font-black text-black">{selectedTenant.lease_contracts?.[0]?.end_date ? formatThaiDate(selectedTenant.lease_contracts[0].end_date) : '-'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedTenant.lease_contracts?.[0]?.start_date && selectedTenant.lease_contracts?.[0]?.end_date && (
                                            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 text-xs font-black rounded-xl border border-blue-100 uppercase tracking-widest shadow-sm self-start inline-flex">
                                                ระยะเวลาสัญญา: {calculateDuration(selectedTenant.lease_contracts[0].start_date, selectedTenant.lease_contracts[0].end_date)}
                                            </div>
                                        )}

                                        {/* Financial Summary */}
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
                                                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">ค่าเช่าหลัก</p>
                                                <p className="text-2xl font-black text-black">
                                                    ฿{(selectedTenant.lease_contracts?.[0]?.rent_price || selectedTenant.rooms.base_price).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                                                <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">เงินมัดจำ</p>
                                                <p className="text-2xl font-black text-black">
                                                    ฿{(selectedTenant.lease_contracts?.[0]?.deposit_amount || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 shrink-0 flex flex-col gap-3">
                                <button
                                    onClick={() => setSelectedTenant(null)}
                                    className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-500/20 text-lg"
                                >
                                    ปิดหน้าต่าง
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Copy Toast ── */}
                {copyToast && (
                    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-blue-400">
                            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                                <PhoneIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-black text-sm font-noto">คัดลอกเบอร์โทรแล้ว!</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
