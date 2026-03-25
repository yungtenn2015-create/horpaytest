'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

import {
    ArrowLeftIcon,
    UserCircleIcon,
    PhoneIcon,
    IdentificationIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    TruckIcon,
    DocumentTextIcon,
    CalendarDaysIcon,
    BanknotesIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    UserPlusIcon,
    PlusCircleIcon,
    BriefcaseIcon,
    MapPinIcon,
    PlusIcon
} from '@heroicons/react/24/outline'

interface Room {
    id: string;
    room_number: string;
    floor: number;
    base_price: number;
    status: string;
    room_type?: 'fan' | 'air';
}

interface TenantContract {
    id: string;
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
}

export default function AddTenantClient() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [rooms, setRooms] = useState<Room[]>([])
    const [dormId, setDormId] = useState<string | null>(null)

    // Form inputs
    const [selectedRoomId, setSelectedRoomId] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [tenantName, setTenantName] = useState('')
    const [tenantPhone, setTenantPhone] = useState('')
    const [occupation, setOccupation] = useState('')
    const [address, setAddress] = useState('')
    const [carRegistration, setCarRegistration] = useState('')
    const [motorcycleRegistration, setMotorcycleRegistration] = useState('')
    const [emergencyContact, setEmergencyContact] = useState('')

    // Lease details
    const [depositAmount, setDepositAmount] = useState<number>(0)
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState('')

    const [errorMsg, setErrorMsg] = useState('')
    const [success, setSuccess] = useState(false)

    // Contract Selection States
    const searchParams = useSearchParams()
    const [fromContractId, setFromContractId] = useState<string | null>(searchParams.get('from_contract'))
    const [contracts, setContracts] = useState<TenantContract[]>([])
    const [isContractSelectorOpen, setIsContractSelectorOpen] = useState(false)
    const [fetchingContracts, setFetchingContracts] = useState(false)
    const [contractSearch, setContractSearch] = useState('')
    const [isFromContract, setIsFromContract] = useState(true) // Default to true to lock fields

    useEffect(() => {
        async function fetchAvailableRooms() {
            setLoading(true)
            const supabase = createClient()

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Get Latest Dorm
            const { data: dormsData } = await supabase
                .from('dorms')
                .select('id')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1)

            if (dormsData && dormsData.length > 0) {
                const currentDormId = dormsData[0].id
                setDormId(currentDormId)

                // Get Available Rooms
                const { data: roomsData } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('dorm_id', currentDormId)
                    .eq('status', 'available')
                    .is('deleted_at', null)
                    .order('room_number', { ascending: true })

                if (roomsData) {
                    setRooms(roomsData)
                }

                // Fetch Contracts
                fetchContracts(currentDormId)
            }
            setLoading(false)
        }
        fetchAvailableRooms()
    }, [router])


    const fetchContracts = async (dId: string) => {
        setFetchingContracts(true)
        const supabase = createClient()
        try {
            const { data, error } = await supabase
                .from('tenant_contracts')
                .select('*')
                .eq('dorm_id', dId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
            if (error) throw error
            setContracts(data || [])

            // Auto-fill if from_contract is provided
            if (fromContractId && data) {
                const contract = data.find(c => c.id === fromContractId)
                if (contract) {
                    setIsFromContract(true)
                    applyContract(contract)
                }
            }
        } catch (err) {
            console.error('Fetch contracts error:', err)
        } finally {
            setFetchingContracts(false)
        }
    }

    const applyContract = (contract: TenantContract) => {
        setTenantName(contract.name)
        setTenantPhone(contract.phone)
        setOccupation(contract.occupation || '')
        setAddress(contract.address || '')
        setCarRegistration(contract.car_registration || '')
        setMotorcycleRegistration(contract.motorcycle_registration || '')
        setEmergencyContact(contract.emergency_contact || '')
        // Ensure deposit is a number
        setDepositAmount(Number(contract.deposit_amount) || 0)
        setStartDate(contract.start_date)
        setEndDate(contract.end_date || '')
        setFromContractId(contract.id)
        setIsFromContract(true)
        setIsContractSelectorOpen(false)
    }

    // Helper to format date to Thai Buddhist Era (พ.ศ.)
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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setErrorMsg('')

        if (!selectedRoomId) {
            setErrorMsg('กรุณาเลือกห้องพัก')
            return
        }
        if (!tenantName.trim()) {
            setErrorMsg('กรุณากรอกชื่อ-นามสกุลผู้เช่า')
            return
        }
        if (!tenantPhone.trim()) {
            setErrorMsg('กรุณากรอกเบอร์โทรศัพท์ติดต่อ')
            return
        }
        if (depositAmount <= 0) {
            setErrorMsg('กรุณาระบุเงินมัดจำ/เงินประกัน')
            return
        }

        setSubmitting(true)
        const supabase = createClient()
        const selectedRoom = rooms.find(r => r.id === selectedRoomId)

        try {
            // Use explicit end date from state
            const finalEndDate = endDate || null;

            const { error } = await supabase.rpc('add_tenant', {
                p_room_id: selectedRoomId,
                p_name: tenantName.trim(),
                p_phone: tenantPhone.trim() || null,
                p_id_card_number: null,
                p_car_registration: carRegistration.trim() || null,
                p_motorcycle_registration: motorcycleRegistration.trim() || null,
                p_emergency_contact: emergencyContact.trim() || null,
                p_rent_price: selectedRoom?.base_price || 0,
                p_deposit_amount: depositAmount || 0,
                p_start_date: startDate,
                p_end_date: finalEndDate,
                p_occupation: occupation.trim() || null,
                p_address: address.trim() || null,
                p_contract_id: fromContractId || null
            })

            if (error) {
                console.error("RPC Error:", error)
                throw new Error(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
            }

            // Update Contract Status if pulled from contract
            if (fromContractId) {
                await supabase
                    .from('tenant_contracts')
                    .update({ status: 'moved_in' })
                    .eq('id', fromContractId)
            }

            setSuccess(true)
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setTenantName('')
        setTenantPhone('')
        setOccupation('')
        setAddress('')
        setCarRegistration('')
        setMotorcycleRegistration('')
        setEmergencyContact('')
        setDepositAmount(0)
        setStartDate(new Date().toISOString().split('T')[0])
        setEndDate('')
        // Removed setIsFromContract(false) to maintain lock
    }

    const renderContractSelectorModal = () => {
        if (!isContractSelectorOpen) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setIsContractSelectorOpen(false)}
                />
                <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
                    <div className="bg-gradient-to-br from-primary to-emerald-600 p-8 text-white relative shrink-0">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <DocumentTextIcon className="w-8 h-8 opacity-50" />
                            เลือกระเบียนสัญญา
                        </h3>
                        <p className="text-emerald-100 font-bold text-[11px] mt-2 uppercase tracking-widest opacity-80">ค้นหาตาม ชื่อ หรือ เบอร์โทรศัพท์</p>

                        {/* Modal Search Input */}
                        <div className="mt-6 relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-emerald-300" />
                            </div>
                            <input
                                type="text"
                                value={contractSearch}
                                onChange={(e) => setContractSearch(e.target.value)}
                                className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-emerald-100 outline-none focus:bg-white/20 transition-all shadow-inner"
                                placeholder="พิมพ์ชื่อ หรือ เบอร์โทร..."
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {fetchingContracts ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                <div className="w-10 h-10 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                            </div>
                        ) : (() => {
                            const filtered = contracts.filter(c => {
                                const search = contractSearch.trim().toLowerCase();
                                if (!search) return false;
                                return (
                                    c.name.toLowerCase().includes(search) ||
                                    c.phone.includes(search)
                                );
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="py-12 flex flex-col items-center text-center px-4">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                                            {contractSearch.trim() ? <DocumentTextIcon className="w-8 h-8" /> : <MagnifyingGlassIcon className="w-8 h-8" />}
                                        </div>
                                        <p className="text-gray-400 font-bold text-sm italic">
                                            {!contractSearch.trim() ? 'พิมพ์ชื่อ หรือ เบอร์โทร เพื่อค้นหา...' : 'ไม่พบข้อมูลบันทึกสัญญาที่ตรงกับเงื่อนไข'}
                                        </p>
                                    </div>
                                );
                            }

                            return filtered.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => applyContract(c)}
                                    className="w-full p-5 bg-gray-50 hover:bg-green-50 border-2 border-transparent hover:border-green-200 rounded-3xl flex flex-col gap-1 transition-all text-left group animate-in fade-in slide-in-from-bottom-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-gray-900 group-hover:text-green-700 text-lg tracking-tight">{c.name}</span>
                                        <span className="text-[11px] bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-black text-gray-400 group-hover:text-green-600 group-hover:border-green-100 transition-all">{c.phone}</span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-black uppercase">
                                        <div className="flex items-center gap-2 text-gray-500 bg-white p-2 rounded-xl border border-gray-100">
                                            <CalendarDaysIcon className="w-4 h-4 text-green-600 shrink-0" />
                                            <span className="truncate">{c.start_date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-500 bg-white p-2 rounded-xl border border-gray-100">
                                            <BanknotesIcon className="w-4 h-4 text-green-600 shrink-0" />
                                            <span>฿{c.deposit_amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </button>
                            ));
                        })()}
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsContractSelectorOpen(false)}
                            className="w-full py-4 text-gray-400 font-black text-xs uppercase tracking-[0.2em] hover:text-gray-600 transition-colors"
                        >
                            ปิดหน้าต่างค้นหา
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white min-h-[640px] rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-xl">
                    <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-gray-800">
                <div className="w-full max-w-lg bg-white min-h-[640px] rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                    <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 relative z-10 animate-in zoom-in duration-500">
                        <CheckCircleIcon className="w-14 h-14 stroke-[2]" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-800 mb-3 relative z-10">เพิ่มผู้เช่าสำเร็จ!</h2>
                    <p className="text-gray-500 mb-10 relative z-10">ระบบได้บันทึกข้อมูลผู้เช่าและเปลี่ยนสถานะห้องเป็น "มีผู้เช่าแล้ว" เรียบร้อย</p>

                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-green-200"
                    >
                        กลับไปหน้าหลัก
                    </button>
                    <button
                        onClick={() => {
                            setSuccess(false)
                            setTenantName('')
                            setTenantPhone('')
                            setSelectedRoomId('')
                            // filter out the room that was just rented
                            setRooms(rooms.filter(r => r.id !== selectedRoomId))
                        }}
                        className="w-full mt-3 bg-white border-2 border-gray-100 hover:bg-gray-50 text-gray-500 font-bold py-4 rounded-2xl transition-all active:scale-95"
                    >
                        เพิ่มผู้เช่าห้องอื่นต่อ
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

                {/* ── Header ── */}
                <header className="bg-gradient-to-br from-primary to-emerald-600 pt-12 pb-10 px-6 rounded-b-[2.5rem] relative shadow-lg shadow-primary/20 shrink-0">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-[1rem] flex items-center justify-center text-white transition-all active:scale-95 border border-white/20"
                            >
                                <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">เพิ่มผู้เช่าใหม่</h1>
                                <p className="text-emerald-100 text-xs font-bold mt-0.5">เพิ่มข้อมูลผู้เช่าเข้าสู่ห้องว่าง</p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/dashboard?tab=tenants')}
                            className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2.5 rounded-[1.2rem] border border-white/20 flex items-center gap-2 text-white transition-all active:scale-95 group"
                        >
                            <DocumentTextIcon className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                            <span className="hidden sm:inline text-[11px] font-black uppercase tracking-[0.1em]">ไปยังหน้าบันทึกสัญญา</span>
                        </button>
                    </div>
                </header>

                {/* ── Form Content ── */}
                <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32">
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 1. เลือกห้อง */}
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-900 uppercase tracking-widest ml-1">เลือกห้องพัก (ห้องว่าง) <span className="text-red-500">*</span></label>
                            <div className="relative">
                                {/* Trigger Button */}
                                <button
                                    type="button"
                                    onClick={() => !rooms.length ? null : setIsDropdownOpen(!isDropdownOpen)}
                                    disabled={rooms.length === 0}
                                    className="w-full pl-11 pr-10 py-5 text-left border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary sm:text-sm rounded-[1.2rem] bg-white hover:bg-gray-50 transition-all font-black text-gray-900 disabled:opacity-50 flex items-center justify-between shadow-sm"
                                >
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <BuildingOfficeIcon className="h-5 w-5 text-primary" />
                                    </div>
                                    <span className="truncate">
                                        {selectedRoomId
                                            ? (() => {
                                                const r = rooms.find(r => r.id === selectedRoomId);
                                                return r ? (
                                                    <div className="flex items-center gap-2">
                                                        <span>ห้อง {r.room_number} (ชั้น {r.floor})</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${r.room_type === 'air' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>
                                                            {r.room_type === 'air' ? 'แอร์' : 'พัดลม'}
                                                        </span>
                                                        <span className="text-gray-400 mx-1">•</span>
                                                        <span>฿{r.base_price.toLocaleString()}/เดือน</span>
                                                    </div>
                                                ) : '--- เลือกห้องพัก ---';
                                            })()
                                            : '--- เลือกห้องพัก ---'}
                                    </span>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                        <svg className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </button>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                                        <div className="absolute z-20 mt-2 w-full bg-white border border-gray-100 rounded-[1.2rem] shadow-xl max-h-60 overflow-y-auto py-2 animate-in fade-in slide-in-from-top-2">
                                            {rooms.map(room => (
                                                <button
                                                    key={room.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedRoomId(room.id);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-5 py-3 hover:bg-green-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 ${selectedRoomId === room.id ? 'bg-green-50/50' : ''}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-black tracking-tight ${selectedRoomId === room.id ? 'text-green-700' : 'text-gray-900'}`}>
                                                                ห้อง {room.room_number}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">ชั้น {room.floor}</span>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${room.room_type === 'air' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {room.room_type === 'air' ? 'แอร์' : 'พัดลม'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 pr-2">
                                                        <span className="font-black text-gray-900">฿{room.base_price.toLocaleString()}<span className="text-xs text-gray-500 font-bold">/เดือน</span></span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            {rooms.length === 0 && (
                                <p className="text-xs text-orange-500 font-bold ml-1 mt-1">ไม่มีห้องว่างในขณะนี้ กรุณาเพิ่มห้องหรือเช็คเอาท์ผู้เช่าเดิมออกก่อน</p>
                            )}
                        </div>

                        <div className="pt-2">
                            <div className="flex gap-2 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setIsContractSelectorOpen(true)}
                                    className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm transition-all active:scale-95 group 
                                        ${tenantName
                                            ? 'bg-yellow-50/80 text-yellow-700 border-2 border-yellow-100'
                                            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-2 border-yellow-200'
                                        }`}
                                >
                                    {tenantName ? (
                                        <><CheckCircleIcon className="w-5 h-5" /> เปลี่ยนข้อมูลสัญญาที่ดึงมา</>
                                    ) : (
                                        <><MagnifyingGlassIcon className="w-5 h-5 group-hover:scale-110 transition-transform" /> ดึงข้อมูลจาก "บันทึกสัญญา"</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* 3. ชื่อผู้เช่า */}
                        <div className="space-y-4 px-2">
                            <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ชื่อ-นามสกุลผู้เช่า <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <UserCircleIcon className="h-5 w-5 text-emerald-600" />
                                </div>
                                <input
                                    type="text"
                                    value={tenantName}
                                    onChange={(e) => setTenantName(e.target.value)}
                                    readOnly={isFromContract}
                                    className={`block w-full pl-11 pr-4 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold 
                                        ${isFromContract
                                            ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                            : 'bg-white border-gray-200 focus:ring-emerald-500/10 focus:border-emerald-600 text-gray-900'
                                        }`}
                                    required
                                    placeholder="กรอกชื่อ-นามสกุล..."
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-4 px-2">
                            <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">เบอร์โทรศัพท์ติดต่อ <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <PhoneIcon className="h-5 w-5 text-emerald-600" />
                                </div>
                                <input
                                    type="tel"
                                    value={tenantPhone}
                                    onChange={(e) => setTenantPhone(e.target.value.replace(/\D/g, ''))}
                                    readOnly={isFromContract}
                                    className={`block w-full pl-11 pr-4 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold tracking-wide
                                        ${isFromContract
                                            ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                            : 'bg-white border-gray-200 focus:ring-emerald-500/10 focus:border-emerald-600 text-gray-900'
                                        }`}
                                    placeholder="0xxxxxxxxx"
                                />
                            </div>
                        </div>

                        {/* Occupation & Address */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-1 pt-2">
                            <div className="space-y-4 px-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">อาชีพ</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <BriefcaseIcon className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <input
                                        type="text"
                                        value={occupation}
                                        onChange={(e) => setOccupation(e.target.value)}
                                        readOnly={isFromContract}
                                        className={`block w-full pl-11 pr-4 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold
                                            ${isFromContract
                                                ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'bg-white border-gray-200 focus:ring-emerald-500/10 focus:border-emerald-600 text-gray-900'
                                            }`}
                                        placeholder="ระบุอาชีพ..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 px-2">
                                <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ที่อยู่ตามบัตรประชาชน</label>
                                <div className="relative">
                                    <div className="absolute top-4 left-0 pl-4 flex items-center pointer-events-none">
                                        <MapPinIcon className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <textarea
                                        rows={2}
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        readOnly={isFromContract}
                                        className={`block w-full pl-11 pr-4 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold resize-none
                                            ${isFromContract
                                                ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'bg-white border-gray-200 focus:ring-emerald-500/10 focus:border-emerald-600 text-gray-900'
                                            }`}
                                        placeholder="ใส่ที่อยู่ตามบัตร..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── ส่วนที่ 3: ข้อมูลยานพาหนะและการติดต่อฉุกเฉิน ── */}
                        <div className="pt-6 border-t border-gray-100 mt-10">
                            <h3 className="text-[11px] font-black text-blue-600 mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                                <TruckIcon className="w-4 h-4" /> ข้อมูลยานพาหนะและการติดต่อฉุกเฉิน
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-4">
                                    <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ทะเบียนรถยนต์</label>
                                    <input
                                        type="text"
                                        value={carRegistration}
                                        onChange={(e) => setCarRegistration(e.target.value)}
                                        readOnly={isFromContract}
                                        className={`block w-full px-5 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold 
                                            ${isFromContract
                                                ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'bg-white border-gray-100 focus:border-emerald-600 focus:ring-emerald-500/5 text-gray-900'
                                            }`}
                                        placeholder="เช่น กข 1234 กทม."
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ทะเบียนมอเตอร์ไซค์</label>
                                    <input
                                        type="text"
                                        value={motorcycleRegistration}
                                        onChange={(e) => setMotorcycleRegistration(e.target.value)}
                                        readOnly={isFromContract}
                                        className={`block w-full px-5 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold 
                                            ${isFromContract
                                                ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'bg-white border-gray-100 focus:border-emerald-600 focus:ring-emerald-500/5 text-gray-900'
                                            }`}
                                        placeholder="เช่น 1กข 1234..."
                                    />
                                </div>

                                <div className="space-y-4 sm:col-span-2">
                                    <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">ผู้ติดต่อฉุกเฉิน</label>
                                    <input
                                        type="text"
                                        value={emergencyContact}
                                        onChange={(e) => setEmergencyContact(e.target.value)}
                                        readOnly={isFromContract}
                                        className={`block w-full px-5 py-4 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold 
                                            ${isFromContract
                                                ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'bg-white border-gray-200 focus:border-emerald-600 focus:ring-emerald-500/5 text-gray-900'
                                            }`}
                                        placeholder="ระบุชื่อและเบอร์โทรศัพท์..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Section 4: Lease Details ── */}
                        <div className="pt-6 border-t border-gray-100 mt-10">
                            <h3 className="text-[11px] font-black text-emerald-600 mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                                <DocumentTextIcon className="w-4 h-4" /> รายละเอียดสัญญาเช่า
                            </h3>

                            <div className="grid grid-cols-1 gap-6 px-2">
                                <div className="space-y-4">
                                    <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">วันที่เริ่มสัญญา <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <CalendarDaysIcon className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <input
                                            type="text"
                                            readOnly
                                            value={startDate ? formatThaiDate(startDate) : ''}
                                            className="block w-full pl-11 pr-4 py-4 border-2 border-gray-100 bg-gray-50/80 text-gray-500 cursor-not-allowed sm:text-sm rounded-[1.2rem] transition-all font-bold"
                                            placeholder="วว/ดด/พ.ศ."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">วันที่สิ้นสุดสัญญา <span className="text-red-500">*</span></label>

                                    {/* Calculated Duration Display */}
                                    {startDate && endDate && calculateDuration(startDate, endDate) && (
                                        <div className="flex items-center gap-2 mb-2 ml-1">
                                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-black rounded-[0.8rem] border border-emerald-100 uppercase tracking-widest shadow-sm">
                                                ระยะเวลาสัญญา: {calculateDuration(startDate, endDate)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <CalendarDaysIcon className="h-5 w-5 text-red-500" />
                                        </div>
                                        <input
                                            type="text"
                                            readOnly
                                            value={endDate ? formatThaiDate(endDate) : ''}
                                            className="block w-full pl-11 pr-4 py-4 border-2 border-gray-100 bg-gray-50/80 text-gray-500 cursor-not-allowed sm:text-sm rounded-[1.2rem] transition-all font-bold"
                                            placeholder="วว/ดด/พ.ศ."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[14px] font-bold text-gray-900 uppercase tracking-wide ml-1">เงินมัดจำ/ประกัน <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">฿</div>
                                        <input
                                            type="text"
                                            value={depositAmount.toLocaleString()}
                                            readOnly={isFromContract}
                                            className={`block w-full pl-10 pr-4 h-14 border-2 focus:ring-4 sm:text-sm rounded-[1.2rem] transition-all font-bold 
                                                ${isFromContract
                                                    ? 'bg-gray-50/80 border-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'bg-white border-gray-200 focus:border-emerald-600 focus:ring-emerald-500/5 text-gray-900'
                                                }`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* ── Bottom Fixed Button ── */}
                <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-6 z-50 rounded-b-[2.5rem]">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || rooms.length === 0}
                        className={`w-full py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-green-100/50 transition-all flex items-center justify-center gap-3
                            ${submitting || rooms.length === 0
                                ? 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
                            }`}
                    >
                        {submitting ? (
                            <>
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="animate-pulse">กำลังบันทึกข้อมูล...</span>
                            </>
                        ) : (
                            <><PlusIcon className="w-6 h-6 stroke-[3]" /> บันทึกข้อมูลผู้เช่า</>
                        )}
                    </button>
                </div>
            </div>
            {renderContractSelectorModal()}
        </div>
    )
}
