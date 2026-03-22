'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import {
    ArrowLeftIcon,
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
    BanknotesIcon
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
    rooms: {
        room_number: string;
        floor: string;
        base_price: number;
    };
    lease_contracts?: {
        deposit_amount: number;
        rent_price: number;
        start_date: string;
        end_date: string | null;
    }[];
}

export default function TenantsPage() {
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
                        base_price
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

    const filteredTenants = tenants.filter(t => {
        const query = searchQuery.toLowerCase()
        return (
            t.name.toLowerCase().includes(query) ||
            t.rooms.room_number.toLowerCase().includes(query) ||
            (t.car_registration?.toLowerCase() || '').includes(query) ||
            (t.motorcycle_registration?.toLowerCase() || '').includes(query)
        )
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">
                
                {/* ── Fixed Header ── */}
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
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">รายชื่อที่กำลังพักอยู่</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-blue-700 uppercase">จำนวน {tenants.length} ห้อง</span>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className={`h-5 w-5 transition-colors duration-300 ${searchQuery ? 'text-blue-500' : 'text-gray-400'}`} />
                            </div>
                            <input
                                type="text"
                                placeholder="ค้นหา ชื่อ หรือ เลขห้อง..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-2xl transition-all font-bold text-sm outline-none shadow-sm hover:bg-gray-100/50"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                                        <XMarkIcon className="h-4 w-4 stroke-[3]" />
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 pb-20">
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-3xl text-red-600 text-xs font-bold font-sans">
                            {errorMsg}
                        </div>
                    )}

                    {filteredTenants.length > 0 ? (
                        filteredTenants.map((tenant) => (
                            <button 
                                key={tenant.id}
                                onClick={() => setSelectedTenant(tenant)}
                                className="bg-white p-4 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-gray-50 flex items-center justify-between group hover:border-blue-100 hover:shadow-xl hover:shadow-blue-50/50 transition-all duration-300 w-full text-left"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Room Number Icon */}
                                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex flex-col items-center justify-center border border-gray-100 shadow-sm group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors shrink-0">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">ห้อง</span>
                                        <span className="text-lg font-black text-gray-800 leading-none group-hover:text-blue-600 transition-colors">{tenant.rooms.room_number}</span>
                                    </div>

                                    <div className="space-y-0.5">
                                        <h3 className="text-sm font-black text-gray-800 tracking-tight leading-tight">{tenant.name}</h3>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 text-gray-400">
                                                <PhoneIcon className="w-3 h-3" />
                                                <span className="text-[11px] font-bold tracking-wide">{tenant.phone || 'ไม่ระบุ'}</span>
                                            </div>
                                            {(tenant.car_registration || tenant.motorcycle_registration) && (
                                                <div className="flex items-center gap-1.5 text-blue-500/70">
                                                    <TruckIcon className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold">มีข้อมูลรถ</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center justify-center shrink-0">
                                    <ChevronRightIcon className="w-5 h-5 stroke-[3]" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-700">
                            <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center border border-dashed border-gray-200">
                                <MagnifyingGlassIcon className="w-10 h-10 text-gray-200" />
                            </div>
                            <div>
                                <p className="text-gray-400 font-black">ไม่พบข้อมูลผู้เช่า</p>
                                <p className="text-gray-300 text-[10px] font-bold">ลองพิมพ์ชื่อตัวย่อ หรือเลขห้องดูนะครับ</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Detail Modal ── */}
                {selectedTenant && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTenant(null)} />
                        
                        <div className="relative w-full sm:max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[800px] animate-in slide-in-from-bottom duration-500">
                            {/* Modal Header */}
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-8 pt-10 pb-12 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                <button 
                                    onClick={() => setSelectedTenant(null)}
                                    className="absolute top-4 right-4 w-12 h-12 sm:w-14 sm:h-14 bg-white/10 hover:bg-white/20 active:scale-95 rounded-2xl flex items-center justify-center text-white transition-all z-20"
                                >
                                    <XMarkIcon className="w-8 h-8 stroke-[3]" />
                                </button>

                                <div className="flex items-center gap-5 relative z-10">
                                    <div className="w-20 h-20 bg-white/10 rounded-3xl flex flex-col items-center justify-center border border-white/20 backdrop-blur-md">
                                        <span className="text-[11px] font-black text-white/50 uppercase mb-1">ห้อง</span>
                                        <span className="text-3xl font-black text-white">{selectedTenant.rooms.room_number}</span>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white leading-tight">{selectedTenant.name}</h2>
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500 text-white rounded-full text-[10px] font-black uppercase mt-2 shadow-lg shadow-blue-500/20">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                            กำลังเข้าพัก
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 bg-white -mt-6 rounded-t-[2.5rem] relative z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                                <PhoneIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">เบอร์โทรศัพท์</p>
                                                <p className="text-lg font-black text-gray-800 tracking-tight">{selectedTenant.phone || 'ไม่ระบุ'}</p>
                                            </div>
                                        </div>
                                        {selectedTenant.phone && (
                                            <button 
                                                onClick={() => handleCopyPhone(selectedTenant.phone!)}
                                                className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"
                                            >
                                                <PhoneIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                            <CalendarDaysIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">วันที่เริ่มเข้าพัก</p>
                                            <p className="text-lg font-black text-gray-800 tracking-tight">
                                                {new Date(selectedTenant.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Vehicle Info */}
                                <div className="pt-6 border-t border-gray-100 space-y-4">
                                    <h3 className="text-xs font-black text-blue-600 flex items-center gap-2 uppercase tracking-widest">
                                        <TruckIcon className="w-4 h-4" /> ข้อมูลยานพาหนะ
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">รถยนต์</p>
                                            <p className="font-black text-gray-800">{selectedTenant.car_registration || 'ไม่มี'}</p>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">มอเตอร์ไซค์</p>
                                            <p className="font-black text-gray-800">{selectedTenant.motorcycle_registration || 'ไม่มี'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Info */}
                                <div className="pt-6 border-t border-gray-100 space-y-4">
                                    <h3 className="text-xs font-black text-red-600 flex items-center gap-2 uppercase tracking-widest">
                                        <ExclamationTriangleIcon className="w-4 h-4" /> ผู้ติดต่อฉุกเฉิน
                                    </h3>
                                    <div className="p-5 bg-red-50/50 rounded-2xl border border-red-100">
                                        <p className="text-[10px] font-black text-red-400 uppercase mb-1">ชื่อและเบอร์โทร</p>
                                        <p className="font-black text-gray-800">{selectedTenant.emergency_contact || 'ไม่ระบุ'}</p>
                                    </div>
                                </div>

                                {/* Financial Info */}
                                <div className="pt-6 border-t border-gray-100 space-y-4">
                                    <h3 className="text-xs font-black text-blue-600 flex items-center gap-2 uppercase tracking-widest">
                                        <BanknotesIcon className="w-4 h-4" /> ประกันและมัดจำ
                                    </h3>
                                    <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600/50 uppercase mb-1">เงินมัดจำ/ประกัน</p>
                                            <p className="text-2xl font-black text-gray-800">
                                                ฿{selectedTenant.lease_contracts?.[0]?.deposit_amount?.toLocaleString() || '0'}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-blue-100 flex items-center justify-center">
                                            <BanknotesIcon className="w-6 h-6 text-blue-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                                <button 
                                    onClick={() => router.push(`/dashboard/tenants/edit/${selectedTenant.id}`)}
                                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                                >
                                    <PencilSquareIcon className="w-5 h-5" />
                                    แก้ไขข้อมูล
                                </button>
                                <button 
                                    onClick={() => setSelectedTenant(null)}
                                    className="flex-[0.4] py-4 bg-gray-100 hover:bg-gray-200 text-gray-500 font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center"
                                >
                                    ปิด
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
