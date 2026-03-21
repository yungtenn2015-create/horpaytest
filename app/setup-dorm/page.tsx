'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Service = {
    id: string
    name: string
    price: number
}

type RoomConfig = {
    number: string
    active: boolean
    roomType: 'fan' | 'air'
    price: string
}

type FloorConfig = {
    floorNumber: number
    roomCount: number
    rooms: RoomConfig[]
}

type ModalConfig = {
    isOpen: boolean
    title: string
    description: string
    type: 'alert' | 'prompt'
    inputValue?: string
    onConfirm: (value?: string) => void
    onCancel?: () => void
}

export default function SetupDormPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    // Step 2: Dorm Info
    const [dormName, setDormName] = useState('')
    const [dormAddress, setDormAddress] = useState('')
    const [dormPhone, setDormPhone] = useState('')
    const [ownerName, setOwnerName] = useState('')
    const [ownerPhone, setOwnerPhone] = useState('')

    // Step 8: Bank Info
    const [bankName, setBankName] = useState('')
    const [bankAccountNo, setBankAccountNo] = useState('')
    const [bankAccountName, setBankAccountName] = useState('')

    const [modalConfig, setModalConfig] = useState<ModalConfig>({
        isOpen: false,
        title: '',
        description: '',
        type: 'alert',
        onConfirm: () => { },
    })

    // Step 2: Utilities
    const [waterType, setWaterType] = useState<'unit' | 'fixed'>('unit')
    const [waterRate, setWaterRate] = useState<string>('')
    const [electricRate, setElectricRate] = useState<string>('')

    // Step 3: Additional Services
    const [services, setServices] = useState<Service[]>([])
    const [newServiceName, setNewServiceName] = useState('')
    const [newServicePrice, setNewServicePrice] = useState('')

    // Step 4: Floor Management
    const [floorCount, setFloorCount] = useState<number>(3)
    const [floors, setFloors] = useState<FloorConfig[]>([
        { floorNumber: 1, roomCount: 5, rooms: [] },
        { floorNumber: 2, roomCount: 5, rooms: [] },
        { floorNumber: 3, roomCount: 5, rooms: [] },
    ])

    // Helper functions
    const nextStep = () => setStep(s => s + 1)
    const prevStep = () => setStep(s => s - 1)

    useEffect(() => {
        async function fetchUser() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setOwnerName(user.user_metadata?.name || '')
                setOwnerPhone(user.user_metadata?.phone || '')
            }
        }
        fetchUser()
    }, [])

    const showModal = (config: Omit<ModalConfig, 'isOpen'>) => {
        setModalConfig({ ...config, isOpen: true })
    }

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false, inputValue: '' }))
    }

    const addService = () => {
        if (!newServiceName || !newServicePrice) return
        const service: Service = {
            id: Math.random().toString(36).substr(2, 9),
            name: newServiceName,
            price: parseFloat(newServicePrice) || 0
        }
        setServices([...services, service])
        setNewServiceName('')
        setNewServicePrice('')
    }

    const removeService = (id: string) => {
        setServices(services.filter(s => s.id !== id))
    }

    const updateFloorCount = (count: number) => {
        setFloorCount(count)
        const newFloors = Array.from({ length: count }, (_, i) => {
            const existing = floors.find(f => f.floorNumber === i + 1)
            return existing || { floorNumber: i + 1, roomCount: 5, rooms: [] }
        })
        setFloors(newFloors)
    }

    const updateRoomCount = (floorNum: number, count: number) => {
        setFloors(floors.map(f => f.floorNumber === floorNum ? { ...f, roomCount: count } : f))
    }

    // Step 6 Logic: Generate rooms if empty
    if (step === 6) {
        floors.forEach(f => {
            if (f.rooms.length === 0) {
                f.rooms = Array.from({ length: f.roomCount }, (_, i) => ({
                    number: '', // Don't pre-fill
                    active: true,
                    roomType: 'fan',
                    price: ''
                }))
            }
        })
    }

    const toggleRoom = (floorNum: number, roomIndex: number) => {
        setFloors(floors.map(f => {
            if (f.floorNumber === floorNum) {
                const newRooms = [...f.rooms]
                newRooms[roomIndex].active = !newRooms[roomIndex].active
                return { ...f, rooms: newRooms }
            }
            return f
        }))
    }

    const updateRoomNumber = (floorNumber: number, roomIndex: number, newNumber: string) => {
        if (newNumber.length > 10) return;
        setFloors(floors.map(f => {
            if (f.floorNumber === floorNumber) {
                const newRooms = [...f.rooms]
                newRooms[roomIndex].number = newNumber
                return { ...f, rooms: newRooms }
            }
            return f
        }))
    }

    const updateRoomType = (floorNumber: number, roomIndex: number, type: 'fan' | 'air') => {
        setFloors(floors.map(f => {
            if (f.floorNumber === floorNumber) {
                const newRooms = [...f.rooms]
                newRooms[roomIndex].roomType = type
                return { ...f, rooms: newRooms }
            }
            return f
        }))
    }

    const updateRoomPrice = (floorNumber: number, roomIndex: number, price: string) => {
        if (price.length > 6) return;
        setFloors(floors.map(f => {
            if (f.floorNumber === floorNumber) {
                const newRooms = [...f.rooms]
                newRooms[roomIndex].price = price
                return { ...f, rooms: newRooms }
            }
            return f
        }))
    }

    const applyToFloor = (floorNumber: number, type: 'fan' | 'air', price: string) => {
        setFloors(floors.map(f => {
            if (f.floorNumber === floorNumber) {
                const newRooms = f.rooms.map(r => ({
                    ...r,
                    roomType: type,
                    price: price
                }))
                return { ...f, rooms: newRooms }
            }
            return f
        }))
    }

    const activeRooms = floors.flatMap(f => f.rooms.filter(r => r.active));
    const roomNums = activeRooms.map(r => r.number.trim());
    const duplicateRooms = roomNums.filter((item, index) => roomNums.indexOf(item) !== index && item !== '');
    const hasDuplicates = duplicateRooms.length > 0;
    const hasEmptyActiveRooms = activeRooms.some(r => r.number.trim() === '');
    const isStep5Invalid = hasDuplicates || hasEmptyActiveRooms;

    const handleFinish = async () => {
        setLoading(true)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not found')

            // 1. Update User info if changed
            await supabase.from('users').update({
                name: ownerName,
                phone: ownerPhone
            }).eq('id', user.id)

            // 2. Create Dorm
            const { data: dorm, error: dormError } = await supabase
                .from('dorms')
                .insert({
                    owner_id: user.id,
                    name: dormName,
                    address: dormAddress,
                    contact_number: dormPhone || ownerPhone
                })
                .select()
                .single()

            if (dormError) throw dormError

            // 3. Create Dorm Settings
            const totalCommonFee = services.reduce((acc, s) => acc + s.price, 0)
            const dbWaterType = waterType === 'fixed' ? 'flat_rate' : 'per_unit'
            const parsedWaterRate = parseFloat(waterRate) || 0

            const { error: settingsError } = await supabase
                .from('dorm_settings')
                .insert({
                    dorm_id: dorm.id,
                    water_rate_per_unit: dbWaterType === 'per_unit' ? parsedWaterRate : 0,
                    water_billing_type: dbWaterType,
                    water_flat_rate: dbWaterType === 'flat_rate' ? parsedWaterRate : 0,
                    electric_rate_per_unit: parseFloat(electricRate) || 0,
                    common_fee: totalCommonFee,
                    bank_name: bankName,
                    bank_account_no: bankAccountNo,
                    bank_account_name: bankAccountName,
                    billing_day: 1 // Default
                })

            if (settingsError) throw settingsError

            // 3.5 Create Dorm Services (Itemized)
            if (services.length > 0) {
                const servicesToInsert = services.map(s => ({
                    dorm_id: dorm.id,
                    name: s.name,
                    price: s.price
                }))
                const { error: servicesError } = await supabase
                    .from('dorm_services')
                    .insert(servicesToInsert)

                if (servicesError) throw servicesError
            }

            // 4. Create Rooms
            const roomsToInsert = floors.flatMap(f =>
                f.rooms.filter(r => r.active).map(r => ({
                    dorm_id: dorm.id,
                    room_number: r.number,
                    floor: f.floorNumber.toString(),
                    room_type: r.roomType,
                    base_price: parseFloat(r.price) || 0,
                    status: 'available'
                }))
            )

            if (roomsToInsert.length > 0) {
                const { error: roomsError } = await supabase
                    .from('rooms')
                    .insert(roomsToInsert)
                if (roomsError) throw roomsError
            }

            setLoading(false)
            showModal({
                title: 'สำเร็จ! 🎉',
                description: 'บันทึกข้อมูลหอพักและห้องพักทั้งหมดเรียบร้อยแล้ว ระบบพร้อมใช้งานครับ',
                type: 'alert',
                onConfirm: () => {
                    closeModal()
                    router.push('/dashboard')
                }
            })

        } catch (error: any) {
            setLoading(false)
            showModal({
                title: 'เกิดข้อผิดพลาด ❌',
                description: error.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                type: 'alert',
                onConfirm: closeModal
            })
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white min-h-[640px] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in duration-500">

                {/* ── Progress Header ── */}
                <div className="relative pt-10 pb-12 px-8 bg-gradient-to-br from-green-800 to-green-500 text-white overflow-hidden">
                    <div className="absolute w-48 h-48 rounded-full bg-white/5 -top-16 -right-10" />
                    <div className="absolute w-28 h-28 rounded-full bg-white/5 bottom-4 -left-8" />

                    <div className="relative mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Step {step} of 8</span>
                            <span className="text-sm font-black">{Math.round((step / 8) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-500 ease-out"
                                style={{ width: `${(step / 8) * 100}%` }}
                            />
                        </div>
                    </div>

                    <h1 className="relative text-2xl font-bold tracking-tight">
                        {step === 1 && 'ยินดีต้อนรับเข้าพัก HORPAY'}
                        {step === 2 && 'ข้อมูลหอพักและเจ้าของ'}
                        {step === 3 && 'ตั้งค่าค่าน้ำ-ค่าไฟ'}
                        {step === 4 && 'ตั้งค่าบริการเพิ่มเติม'}
                        {step === 5 && 'จัดการจำนวนชั้นและห้อง'}
                        {step === 6 && 'ระบุเลขห้องพัก'}
                        {step === 7 && 'ตั้งค่าประเภทและราคาห้องพัก'}
                        {step === 8 && 'ตั้งค่าบัญชีธนาคาร'}
                    </h1>
                    {step === 4 && <p className="relative text-xs text-white/70 mt-1">(หากไม่มีค่าบริการเพิ่มเติม สามารถกดถัดไปได้เลยครับ)</p>}
                </div>

                {/* ── Progress Indicators ── */}
                <div className="relative px-8 pt-6 pb-6 bg-white border-b border-gray-100 hidden sm:flex justify-between">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <div key={s} className="flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${step >= s ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                                {s}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Content Area ── */}
                <div className="flex-1 flex flex-col p-6 sm:p-8 font-sans overflow-y-auto">

                    {/* STEP 1: WELCOME */}
                    {step === 1 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in slide-in-from-bottom-4 duration-500">
                            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#166534" className="w-10 h-10">
                                    <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                                    <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.719c-1.035 0-1.875-.84-1.875-1.875v-6.198c.03-.028.06-.056.091-.086L12 5.432z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">คุณยังไม่มีข้อมูลหอพักในระบบ</h2>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed max-w-xs">
                                เริ่มต้นสร้างหอพักของคุณเพื่อจัดการบิล ผู้เช่า และค่าน้ำไฟที่ง่ายกว่าที่เคยครับ
                            </p>
                            <button
                                onClick={nextStep}
                                className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-100"
                            >
                                เริ่มต้นสร้างหอพัก
                            </button>
                        </div>
                    )}

                    {/* STEP 2: DORM INFO */}
                    {step === 2 && (
                        <div className="flex-1 flex flex-col space-y-5 animate-in slide-in-from-right-4 duration-500 overflow-y-auto pr-1">
                            {/* Owner Info Group */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                                    <h3 className="font-bold text-gray-800 uppercase tracking-tight text-xs">ข้อมูลเจ้าของหอ</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">ชื่อ-นามสกุล</label>
                                        <input
                                            type="text"
                                            value={ownerName}
                                            onChange={(e) => setOwnerName(e.target.value)}
                                            className="w-full h-11 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">เบอร์โทรศัพท์</label>
                                        <input
                                            type="tel"
                                            value={ownerPhone}
                                            onChange={(e) => setOwnerPhone(e.target.value)}
                                            className="w-full h-11 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Dorm Info Group */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                    <h3 className="font-bold text-gray-800 uppercase tracking-tight text-xs">รายละเอียดหอพัก</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">ชื่อหอพัก / อพาร์ตเมนต์ <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"

                                            value={dormName}
                                            onChange={(e) => setDormName(e.target.value)}
                                            className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">ที่อยู่หอพัก <span className="text-red-500">*</span></label>
                                        <textarea
                                            rows={2}

                                            value={dormAddress}
                                            onChange={(e) => setDormAddress(e.target.value)}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-green-500 transition-all text-gray-800 text-sm resize-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">เบอร์ออฟฟิศ / สำหรับติดต่อลูกค้า</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"

                                                value={dormPhone}
                                                onChange={(e) => setDormPhone(e.target.value)}
                                                className="flex-1 h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 text-sm"
                                            />
                                            <button
                                                onClick={() => setDormPhone(ownerPhone)}
                                                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-[12px] font-bold transition-all"
                                            >เบอร์เดียวกัน</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-6 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={!dormName || !dormAddress || !ownerName || !ownerPhone}
                                    onClick={nextStep}
                                    className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-green-100"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: UTILITIES */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
                                            <path d="M12 2.25c-4.142 0-7.5 3.358-7.5 7.5 0 3.75 3.75 9 7.5 12.75l.44.444a.75.75 0 001.06 0l.44-.444c3.75-3.75 7.5-9 7.5-12.75 0-4.142-3.358-7.5-7.5-7.5z" />
                                        </svg>
                                    </div>
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">ค่าน้ำประปา</label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setWaterType('unit')}
                                        className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold text-sm ${waterType === 'unit' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        คิดตามหน่วย
                                    </button>
                                    <button
                                        onClick={() => setWaterType('fixed')}
                                        className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold text-sm ${waterType === 'fixed' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        ราคาเหมาจ่าย
                                    </button>
                                </div>
                                <div className="relative mt-2">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={waterRate}
                                        onChange={(e) => {
                                            if (e.target.value.length > 6) return;
                                            setWaterRate(e.target.value);
                                        }}
                                        className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 placeholder:text-gray-400"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">บาท / {waterType === 'unit' ? 'หน่วย' : 'เดือน'}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                            <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                        </svg>
                                    </div>
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">ค่าไฟฟ้า</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={electricRate}
                                        onChange={(e) => {
                                            if (e.target.value.length > 6) return;
                                            setElectricRate(e.target.value);
                                        }}
                                        className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 placeholder:text-gray-400"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">บาท / หน่วย</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={!waterRate || !electricRate || parseFloat(waterRate) <= 0 || parseFloat(electricRate) <= 0}
                                    onClick={nextStep}
                                    className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-green-100"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: ADDITIONAL SERVICES */}
                    {step === 4 && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4 mb-6">
                                <label className="block text-sm font-bold text-gray-700">เพิ่มค่าบริการเพิ่มเติม เช่น ค่าส่วนกลาง ค่าที่จอดรถ ค่าฟิตเนส <span className="text-gray-700 font-bold">(ไม่บังคับ)</span></label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        placeholder="ชื่อบริการ (เช่น ค่าส่วนกลาง)"
                                        value={newServiceName}
                                        onChange={(e) => setNewServiceName(e.target.value)}
                                        className="h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 placeholder:text-gray-400"
                                    />
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                placeholder="ราคา"
                                                value={newServicePrice}
                                                onChange={(e) => {
                                                    if (e.target.value.length > 6) return;
                                                    setNewServicePrice(e.target.value);
                                                }}
                                                className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 placeholder:text-gray-400"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">บ./ด.</span>
                                        </div>
                                        <button
                                            onClick={addService}
                                            className="px-6 h-12 bg-green-600 text-white font-bold rounded-xl flex items-center justify-center hover:bg-green-700 active:scale-95 transition-all shadow-md"
                                        >
                                            เพิ่ม
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                                {services.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl p-8">
                                        <p className="text-sm">ยังไม่มีรายการค่าบริการ</p>
                                    </div>
                                ) : (
                                    services.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 animate-in fade-in zoom-in-95">
                                            <div>
                                                <p className="font-bold text-gray-800">{s.name}</p>
                                                <p className="text-sm text-green-600 font-bold">{s.price.toLocaleString()} บาท/เดือน</p>
                                            </div>
                                            <button onClick={() => removeService(s.id)} className="w-8 h-8 flex items-center justify-center text-red-500 border border-red-100 bg-red-50 rounded-lg hover:bg-red-100 transition-all">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button onClick={nextStep} className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-100">ถัดไป</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: FLOOR MGMT */}
                    {step === 5 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-gray-700">จำนวนชั้นของหอพัก (1-8 ชั้น)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1" max="8"
                                        value={floorCount}
                                        onChange={(e) => updateFloorCount(parseInt(e.target.value))}
                                        className="flex-1 accent-green-600 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="w-12 h-12 flex items-center justify-center bg-green-50 text-green-700 font-bold rounded-xl border-2 border-green-100">{floorCount}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm font-bold text-gray-700">ระบุจำนวนห้องในแต่ละชั้น</label>
                                <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {floors.map(f => (
                                        <div key={f.floorNumber} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <span className="font-bold text-gray-600">ชั้น {f.floorNumber}</span>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => updateRoomCount(f.floorNumber, Math.max(1, f.roomCount - 1))}
                                                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
                                                >-</button>
                                                <span className="w-8 text-center font-bold text-gray-800">{f.roomCount}</span>
                                                <button
                                                    onClick={() => updateRoomCount(f.floorNumber, f.roomCount + 1)}
                                                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
                                                >+</button>
                                                <span className="text-xs text-gray-400 ml-1">ห้อง</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button onClick={nextStep} className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-100">ถัดไป</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: ROOM LAYOUT */}
                    {step === 6 && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500">
                            <p className="text-gray-500 text-sm mb-6">ระบุเลขห้องพักตามความต้องการ และติ๊กเพื่อปิดใช้งานห้องกรณีปิดปรับปรุง</p>

                            {hasDuplicates && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-bold">พบเลขห้องซ้ำกัน: {Array.from(new Set(duplicateRooms)).join(', ')}</span>
                                </div>
                            )}

                            {hasEmptyActiveRooms && !hasDuplicates && (
                                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl flex items-center gap-2 text-yellow-700 text-sm animate-in fade-in slide-in-from-top-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-bold">กรุณาระบุเลขห้องให้ครบทุกห้องที่เปิดใช้งาน</span>
                                </div>
                            )}

                            <div className="flex-1 space-y-8 overflow-y-auto pr-2">
                                {floors.map(f => (
                                    <div key={f.floorNumber} className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                                            <h3 className="font-bold text-gray-800">ชั้น {f.floorNumber}</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {f.rooms.map((room, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex flex-col gap-2 p-3 rounded-2xl border-2 transition-all ${room.active ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Room {idx + 1}</label>
                                                        <input
                                                            type="checkbox"
                                                            checked={room.active}
                                                            onChange={() => toggleRoom(f.floorNumber, idx)}
                                                            className="w-4 h-4 accent-green-600"
                                                        />
                                                    </div>
                                                    <input
                                                        disabled={!room.active}
                                                        placeholder="ระบุเลขห้อง"
                                                        value={room.number}
                                                        onChange={(e) => updateRoomNumber(f.floorNumber, idx, e.target.value)}
                                                        className={`font-bold text-lg outline-none rounded-lg px-2 py-1 transition-all ${room.active ? 'bg-gray-50 border-2 border-green-100 text-gray-800 focus:border-green-500 focus:bg-white' : 'bg-transparent text-gray-400'}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={isStep5Invalid}
                                    onClick={nextStep}
                                    className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-green-100"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 7: ROOM PRICE & TYPE */}
                    {step === 7 && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500">
                            <p className="text-gray-500 text-sm mb-6">ระบุประเภทห้องและราคาเช่าต่อเดือนครับ สามารถใช้ปุ่ม "ตั้งค่าทั้งชั้น" เพื่อความรวดเร็ว</p>

                            <div className="flex-1 space-y-8 overflow-y-auto pr-2">
                                {floors.map(f => (
                                    <div key={f.floorNumber} className="space-y-4 p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                                                <h3 className="font-bold text-gray-800">ชั้น {f.floorNumber}</h3>
                                            </div>

                                            {/* Floor Bulk Action */}
                                            <div className="flex items-center gap-2 p-2 bg-white rounded-2xl shadow-sm border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase ml-2">ตั้งค่าทั้งชั้น:</span>
                                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                                    <button
                                                        onClick={() => {
                                                            showModal({
                                                                title: 'ระบุราคา (พัดลม)',
                                                                description: `ระบุราคาสำหรับห้องพัดลมทั้งชั้น ${f.floorNumber} (บาท/เดือน)`,
                                                                type: 'prompt',
                                                                inputValue: '',
                                                                onConfirm: (val) => {
                                                                    if (val) applyToFloor(f.floorNumber, 'fan', val)
                                                                    closeModal()
                                                                },
                                                                onCancel: closeModal
                                                            })
                                                        }}
                                                        className="px-3 py-1 text-[10px] font-bold text-gray-600 hover:bg-white rounded-lg transition-all"
                                                    >พัดลม</button>
                                                    <button
                                                        onClick={() => {
                                                            showModal({
                                                                title: 'ระบุราคา (แอร์)',
                                                                description: `ระบุราคาสำหรับห้องแอร์ทั้งชั้น ${f.floorNumber} (บาท/เดือน)`,
                                                                type: 'prompt',
                                                                inputValue: '',
                                                                onConfirm: (val) => {
                                                                    if (val) applyToFloor(f.floorNumber, 'air', val)
                                                                    closeModal()
                                                                },
                                                                onCancel: closeModal
                                                            })
                                                        }}
                                                        className="px-3 py-1 text-[10px] font-bold text-gray-600 hover:bg-white rounded-lg transition-all"
                                                    >แอร์</button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {f.rooms.filter(r => r.active).map((room, idx) => (
                                                <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-black text-gray-800 tracking-tight">ห้อง {room.number || '???'}</span>
                                                        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                                                            <button
                                                                onClick={() => updateRoomType(f.floorNumber, idx, 'fan')}
                                                                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${room.roomType === 'fan' ? 'bg-white shadow-sm text-green-600' : 'text-gray-400'}`}
                                                            >พัดลม</button>
                                                            <button
                                                                onClick={() => updateRoomType(f.floorNumber, idx, 'air')}
                                                                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${room.roomType === 'air' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                                            >แอร์</button>
                                                        </div>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={room.price}
                                                            onChange={(e) => updateRoomPrice(f.floorNumber, idx, e.target.value)}
                                                            className="w-full h-10 bg-gray-50 border border-gray-100 rounded-xl px-3 outline-none focus:border-green-500 transition-all text-gray-800 font-bold placeholder:text-gray-300"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">บาท/เดือน</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-auto pt-6">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={floors.some(f => f.rooms.filter(r => r.active).some(r => !r.price || parseFloat(r.price) <= 0))}
                                    onClick={nextStep}
                                    className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-green-100"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 8: BANK SETTINGS */}
                    {step === 8 && (
                        <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <p className="text-gray-500 text-sm">ระบุข้อมูลบัญชีธนาคารสำหรับรับชำระเงินจากผู้เช่าครับ</p>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">เลือกธนาคาร <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'kbank', name: 'กสิกร', color: '#138B2E', logo: 'K' },
                                        { id: 'scb', name: 'ไทยพาณิชย์', color: '#4E2E7F', logo: 'S' },
                                        { id: 'bbl', name: 'กรุงเทพ', color: '#1E4598', logo: 'B' },
                                        { id: 'ktb', name: 'กรุงไทย', color: '#00AEEF', logo: 'K' },
                                        { id: 'bay', name: 'กรุงศรี', color: '#FFD700', logo: 'A' },
                                        { id: 'ttb', name: 'ทีทีบี', color: '#004A99', logo: 'T' },
                                        { id: 'gsb', name: 'ออมสิน', color: '#EB1483', logo: 'G' },
                                        { id: 'promptpay', name: 'PromptPay', color: '#113566', logo: 'P' },
                                    ].map((bank) => (
                                        <button
                                            key={bank.id}
                                            onClick={() => setBankName(bank.name)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 ${bankName === bank.name ? 'border-green-500 bg-green-50 shadow-md scale-[1.05]' : 'border-gray-50 bg-gray-50 hover:border-gray-200'}`}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-inner shadow-black/10"
                                                style={{ backgroundColor: bank.color }}
                                            >
                                                {bank.logo}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-600 truncate w-full text-center">{bank.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">ชื่อบัญชี <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="ระบุชื่อเจ้าของบัญชี"
                                        value={bankAccountName}
                                        onChange={(e) => setBankAccountName(e.target.value)}
                                        className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">เลขบัญชีธนาคาร <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="000-0-00000-0"
                                        value={bankAccountNo}
                                        onChange={(e) => setBankAccountNo(e.target.value.replace(/[^0-9-]/g, ''))}
                                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-green-500 transition-all text-gray-800 text-xl font-black font-sans tracking-widest"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-auto pt-6">
                                <button disabled={loading} onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={!bankName || !bankAccountNo || !bankAccountName || loading}
                                    onClick={handleFinish}
                                    className="py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>กำลังบันทึก...</span>
                                        </>
                                    ) : (
                                        'เสร็จสิ้น'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <p className="text-center text-[10px] text-gray-400 py-6 border-t border-gray-50">
                    © 2025 HORPAY — ระบบจัดการหอพักอัจฉริยะ
                </p>
            </div>

            {/* ── Custom Modal ── */}
            {modalConfig.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={modalConfig.onCancel || closeModal} />
                    <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="pt-8 pb-6 px-8 text-center">
                            <h3 className="text-xl font-black text-gray-800 mb-2">{modalConfig.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{modalConfig.description}</p>

                            {modalConfig.type === 'prompt' && (
                                <div className="mt-6 relative">
                                    <input
                                        autoFocus
                                        type="number"
                                        value={modalConfig.inputValue}
                                        onChange={(e) => setModalConfig(prev => ({ ...prev, inputValue: e.target.value }))}
                                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 outline-none focus:border-green-500 transition-all text-center text-xl font-black text-gray-800"
                                    />
                                    <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                                        <span className="text-xs font-bold text-gray-400">บาท</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50/50 flex gap-3">
                            {modalConfig.type === 'prompt' && (
                                <button
                                    onClick={modalConfig.onCancel || closeModal}
                                    className="flex-1 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            )}
                            <button
                                onClick={() => modalConfig.onConfirm(modalConfig.inputValue)}
                                className="flex-[2] py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 active:scale-[0.98] transition-all"
                            >
                                {modalConfig.type === 'prompt' ? 'ตกลง' : 'รับทราบ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
