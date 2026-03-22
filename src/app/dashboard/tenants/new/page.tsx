'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
    BanknotesIcon
} from '@heroicons/react/24/outline'

interface Room {
    id: string;
    room_number: string;
    floor: number;
    base_price: number;
    status: string;
    room_type?: 'fan' | 'air';
}

export default function AddTenantPage() {
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
    const [carRegistration, setCarRegistration] = useState('')
    const [motorcycleRegistration, setMotorcycleRegistration] = useState('')
    const [emergencyContact, setEmergencyContact] = useState('')

    // Lease details
    const [depositAmount, setDepositAmount] = useState<number>(0)
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [durationMonths, setDurationMonths] = useState<number>(0) // 0 = ไม่มีกำหนด (รายเดือน)

    const [errorMsg, setErrorMsg] = useState('')
    const [success, setSuccess] = useState(false)

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
            }
            setLoading(false)
        }
        fetchAvailableRooms()
    }, [router])

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
            // Calculate end date if duration is set
            let endDate = null
            if (durationMonths > 0) {
                const date = new Date(startDate)
                date.setMonth(date.getMonth() + durationMonths)
                endDate = date.toISOString().split('T')[0]
            }

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
                p_end_date: endDate
            })

            if (error) {
                console.error("RPC Error:", error)
                throw new Error(error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
            }

            setSuccess(true)
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
        } finally {
            setSubmitting(false)
        }
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
                <header className="bg-gradient-to-br from-green-500 to-green-600 pt-12 pb-10 px-6 rounded-b-[2.5rem] relative shadow-lg shadow-green-200 shrink-0">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                    <div className="relative z-10 flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-[1rem] flex items-center justify-center text-white transition-all active:scale-95 border border-white/20"
                        >
                            <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">เพิ่มผู้เช่าใหม่</h1>
                            <p className="text-green-100 text-xs font-bold mt-0.5">เพิ่มข้อมูลผู้เช่าเข้าสู่ห้องว่าง</p>
                        </div>
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
                            <label className="text-sm font-black text-gray-800 ml-1">เลือกห้องพัก (ห้องว่าง)</label>
                            <div className="relative">
                                {/* Trigger Button */}
                                <button
                                    type="button"
                                    onClick={() => !rooms.length ? null : setIsDropdownOpen(!isDropdownOpen)}
                                    disabled={rooms.length === 0}
                                    className="w-full pl-11 pr-10 py-5 text-left border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-600 sm:text-sm rounded-[1.2rem] bg-white hover:bg-gray-50 transition-all font-black text-gray-900 disabled:opacity-50 flex items-center justify-between shadow-sm"
                                >
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <BuildingOfficeIcon className="h-5 w-5 text-green-500" />
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
                                                        <span>฿{r.base_price.toLocaleString()}/ด.</span>
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
                                                        <span className="font-black text-gray-900">฿{room.base_price.toLocaleString()}<span className="text-xs text-gray-500 font-bold">/ด.</span></span>
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

                        {/* 2. ชื่อผู้เช่า */}
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-900 ml-1">ชื่อ-นามสกุลผู้เช่า<span className="text-red-600 ml-1">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <UserCircleIcon className="h-5 w-5 text-green-600" />
                                </div>
                                <input
                                    type="text"
                                    value={tenantName}
                                    maxLength={30}
                                    onChange={(e) => setTenantName(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 border-2 border-gray-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-600 sm:text-sm rounded-[1.2rem] bg-white transition-all font-bold text-gray-900"
                                    required
                                />
                            </div>
                        </div>

                        {/* 3. เบอร์โทร */}
                        <div className="space-y-2">
                            <label className="text-sm font-black text-gray-900 ml-1">เบอร์โทรศัพท์ติดต่อ<span className="text-red-600 ml-1">*</span></label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <PhoneIcon className="h-5 w-5 text-green-600" />
                                </div>
                                <input
                                    type="tel"
                                    value={tenantPhone}
                                    maxLength={10}
                                    onChange={(e) => setTenantPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="block w-full pl-11 pr-4 py-4 border-2 border-gray-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-600 sm:text-sm rounded-[1.2rem] bg-white transition-all font-bold text-gray-900 tracking-wide"
                                    required
                                />
                            </div>
                        </div>

                        {/* ── ส่วนที่ 3: ข้อมูลยานพาหนะและการติดต่อฉุกเฉิน ── */}
                        <div className="pt-6 border-t-2 border-gray-100 mt-10">
                            <h3 className="text-xs font-black text-blue-600 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <TruckIcon className="w-4 h-4" /> ข้อมูลยานพาหนะและการติดต่อฉุกเฉิน
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[13px] font-black text-gray-900 ml-1 uppercase tracking-wider underline decoration-blue-500/30 underline-offset-4">ทะเบียนรถยนต์</label>
                                    <input
                                        type="text"
                                        value={carRegistration}
                                        onChange={(e) => setCarRegistration(e.target.value)}
                                        className="block w-full px-4 py-3 border-2 border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-base rounded-xl bg-white transition-all font-bold text-gray-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[13px] font-black text-gray-900 ml-1 uppercase tracking-wider underline decoration-blue-500/30 underline-offset-4">ทะเบียนมอเตอร์ไซค์</label>
                                    <input
                                        type="text"
                                        value={motorcycleRegistration}
                                        onChange={(e) => setMotorcycleRegistration(e.target.value)}
                                        className="block w-full px-4 py-3 border-2 border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-base rounded-xl bg-white transition-all font-bold text-gray-900"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <label className="text-[13px] font-black text-gray-900 ml-1 uppercase tracking-wider underline decoration-blue-500/30 underline-offset-4">ผู้ติดต่อฉุกเฉิน (ชื่อ-เบอร์โทร)</label>
                                <input
                                    type="text"
                                    value={emergencyContact}
                                    onChange={(e) => setEmergencyContact(e.target.value)}
                                    className="block w-full px-4 py-4 border-2 border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-base rounded-[1.2rem] bg-white transition-all font-bold text-gray-900"
                                />
                            </div>
                        </div>

                        {/* ── ส่วนที่ 4: รายละเอียดสัญญาเช่า ── */}
                        <div className="pt-6 border-t-2 border-gray-100 mt-10">
                            <h3 className="text-xs font-black text-green-600 mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <DocumentTextIcon className="w-4 h-4" /> รายละเอียดสัญญาเช่า
                            </h3>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-800 ml-1 uppercase tracking-wider">ระยะเวลาสัญญา</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'ไม่มีกำหนด', value: 0 },
                                            { label: '6 เดือน', value: 6 },
                                            { label: '1 ปี', value: 12 },
                                            { label: '2 ปี', value: 24 }
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setDurationMonths(opt.value)}
                                                className={`py-3 text-[10px] font-black rounded-xl border-2 transition-all ${durationMonths === opt.value ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-100 scale-105' : 'bg-white text-gray-400 border-gray-50'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-gray-800 ml-1 uppercase tracking-wider">เงินมัดจำ/เงินประกัน<span className="text-red-600 ml-1">*</span></label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 font-bold text-sm">฿</div>
                                            <input
                                                type="number"
                                                value={depositAmount}
                                                onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                                                className="block w-full pl-8 pr-4 py-3 border-2 border-gray-100 focus:border-green-600 focus:ring-4 focus:ring-green-500/5 text-sm rounded-xl bg-white transition-all font-black text-gray-900"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-gray-800 ml-1 uppercase tracking-wider">วันที่เริ่มสัญญา</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="block w-full px-3 py-3 border-2 border-gray-200 focus:border-green-600 focus:ring-4 focus:ring-green-500/5 text-sm rounded-xl bg-white transition-all font-black text-gray-900"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* ── Bottom Fixed Button ── */}
                <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-6 z-50 rounded-b-[3rem]">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || rooms.length === 0}
                        className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                            ${submitting || rooms.length === 0
                                ? 'bg-gray-300 shadow-none cursor-not-allowed'
                                : 'bg-green-500 hover:bg-green-600 shadow-green-200 active:scale-95'
                            }`}
                    >
                        {submitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                กำลังบันทึกข้อมูล...
                            </>
                        ) : (
                            'บันทึก'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
