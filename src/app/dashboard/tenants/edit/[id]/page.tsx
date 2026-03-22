'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { 
    ArrowLeftIcon, 
    UserCircleIcon, 
    PhoneIcon, 
    TruckIcon, 
    ExclamationTriangleIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline'

export default function EditTenantPage() {
    const router = useRouter()
    const { id } = useParams()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Form states
    const [tenantName, setTenantName] = useState('')
    const [tenantPhone, setTenantPhone] = useState('')
    const [carRegistration, setCarRegistration] = useState('')
    const [motorcycleRegistration, setMotorcycleRegistration] = useState('')
    const [emergencyContact, setEmergencyContact] = useState('')
    const [roomInfo, setRoomInfo] = useState('')

    useEffect(() => {
        fetchTenantData()
    }, [id])

    const fetchTenantData = async () => {
        setLoading(true)
        const supabase = createClient()
        
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*, rooms(room_number)')
                .eq('id', id)
                .single()

            if (error) throw error
            if (data) {
                setTenantName(data.name)
                setTenantPhone(data.phone || '')
                setCarRegistration(data.car_registration || '')
                setMotorcycleRegistration(data.motorcycle_registration || '')
                setEmergencyContact(data.emergency_contact || '')
                setRoomInfo(data.rooms?.room_number || '')
            }
        } catch (err: any) {
            setErrorMsg('ไม่พบข้อมูลผู้เช่า')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = async () => {
        if (!tenantName.trim()) {
            setErrorMsg('กรุณากรอกชื่อ-นามสกุล')
            return
        }
        if (!tenantPhone.trim()) {
            setErrorMsg('กรุณากรอกเบอร์โทรศัพท์')
            return
        }

        setSubmitting(true)
        setErrorMsg('')
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    name: tenantName,
                    phone: tenantPhone,
                    car_registration: carRegistration,
                    motorcycle_registration: motorcycleRegistration,
                    emergency_contact: emergencyContact
                })
                .eq('id', id)

            if (error) throw error
            setSuccess(true)
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-2xl">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                        <CheckCircleIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-800 mb-2">บันทึกเรียบร้อย!</h2>
                    <p className="text-gray-500 mb-8">ข้อมูลผู้เช่าได้รับการอัปเดตแล้ว</p>
                    <button 
                        onClick={() => router.push('/dashboard/tenants')}
                        className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-95"
                    >
                        กลับไปหน้าโครงการ
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">
                
                {/* Header */}
                <header className="bg-gradient-to-br from-gray-800 to-gray-900 pt-12 pb-10 px-6 rounded-b-[2.5rem] relative shadow-lg shrink-0">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                    <div className="flex items-center gap-4 relative z-10">
                        <button 
                            onClick={() => router.back()}
                            className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-[1rem] flex items-center justify-center text-white border border-white/20"
                        >
                            <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">แก้ไขข้อมูลผู้เช่า</h1>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">ห้อง {roomInfo}</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-600 text-xs font-bold leading-relaxed">
                            {errorMsg}
                        </div>
                    )}

                    {/* Section 1: Basic */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider ml-1">ชื่อ-นามสกุลผู้เช่า</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-green-600">
                                    <UserCircleIcon className="h-5 w-5" />
                                </div>
                                <input
                                    type="text"
                                    value={tenantName}
                                    onChange={(e) => setTenantName(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 border-2 border-gray-100 focus:border-green-600 rounded-2xl bg-white font-bold text-gray-900 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider ml-1">เบอร์โทรศัพท์ติดต่อ</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-green-600">
                                    <PhoneIcon className="h-5 w-5" />
                                </div>
                                <input
                                    type="tel"
                                    value={tenantPhone}
                                    onChange={(e) => setTenantPhone(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 border-2 border-gray-100 focus:border-green-600 rounded-2xl bg-white font-bold text-gray-900 transition-all"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Vehicles */}
                    <div className="pt-6 border-t-2 border-gray-50 space-y-4">
                        <h3 className="text-xs font-black text-blue-600 flex items-center gap-2 uppercase tracking-widest">
                            <TruckIcon className="w-4 h-4" /> ข้อมูลยานพาหนะ
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">ทะเบียนรถยนต์</label>
                                <input
                                    type="text"
                                    value={carRegistration}
                                    onChange={(e) => setCarRegistration(e.target.value)}
                                    className="block w-full px-4 py-3 border-2 border-gray-100 focus:border-blue-600 rounded-xl bg-white font-bold text-gray-900"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">ทะเบียนมอเตอร์ไซค์</label>
                                <input
                                    type="text"
                                    value={motorcycleRegistration}
                                    onChange={(e) => setMotorcycleRegistration(e.target.value)}
                                    className="block w-full px-4 py-3 border-2 border-gray-100 focus:border-blue-600 rounded-xl bg-white font-bold text-gray-900"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Emergency */}
                    <div className="pt-6 border-t-2 border-gray-50 space-y-4">
                        <h3 className="text-xs font-black text-red-600 flex items-center gap-2 uppercase tracking-widest">
                            <ExclamationTriangleIcon className="w-4 h-4" /> ผู้ติดต่อฉุกเฉิน
                        </h3>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">ชื่อและเบอร์โทร</label>
                            <input
                                type="text"
                                value={emergencyContact}
                                onChange={(e) => setEmergencyContact(e.target.value)}
                                className="block w-full px-4 py-4 border-2 border-gray-100 focus:border-red-600 rounded-2xl bg-white font-bold text-gray-900"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-6 border-t border-gray-100 bg-gray-50">
                    <button 
                        onClick={handleUpdate}
                        disabled={submitting}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                    <button 
                        onClick={() => router.back()}
                        className="w-full mt-3 bg-white border-2 border-gray-200 text-gray-400 font-bold py-3 rounded-2xl hover:bg-gray-100 transition-all"
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>
    )
}
