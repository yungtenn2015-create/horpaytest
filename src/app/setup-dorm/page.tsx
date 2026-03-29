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
    const [billingDay, setBillingDay] = useState<number | ''>('')
    const [paymentDueDay, setPaymentDueDay] = useState<number | ''>('')

    // Step 8: Bank Info
    const [bankName, setBankName] = useState('')
    const [otherBankName, setOtherBankName] = useState('')
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
    const [serviceFormError, setServiceFormError] = useState('')

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
    useEffect(() => {
        if (step !== 6) return;

        setFloors(prev =>
            prev.map((f) => {
                let currentRooms = [...f.rooms];

                // ถ้ายังไม่มีห้องเลย ให้เริ่มสร้างใหม่พร้อมเลขห้องตั้งต้น
                if (currentRooms.length === 0) {
                    currentRooms = Array.from({ length: f.roomCount }, (_, i) => ({
                        number: `${f.floorNumber}${(i + 1).toString().padStart(2, '0')}`,
                        roomType: 'fan' as const,
                        price: ''
                    }));
                }
                // ถ้าจำนวนห้องไม่ตรงกับที่ตั้งไว้ (กรณีกลับไปแก้ Step 5) ให้ปรับจำนวณ
                else if (currentRooms.length !== f.roomCount) {
                    if (currentRooms.length < f.roomCount) {
                        const additional = Array.from({ length: f.roomCount - currentRooms.length }, (_, i) => ({
                            number: `${f.floorNumber}${(currentRooms.length + i + 1).toString().padStart(2, '0')}`,
                            roomType: 'fan' as const,
                            price: ''
                        }));
                        currentRooms = [...currentRooms, ...additional];
                    } else {
                        currentRooms = currentRooms.slice(0, f.roomCount);
                    }
                }
                // ห้องที่ยังไม่มีเลข ให้เติมตั้งต้นโดยไม่ทับของเดิม
                else {
                    currentRooms = currentRooms.map((room, i) => ({
                        ...room,
                        number: room.number || `${f.floorNumber}${(i + 1).toString().padStart(2, '0')}`
                    }));
                }

                return { ...f, rooms: currentRooms };
            })
        );
    }, [step]);

    const showModal = (config: Omit<ModalConfig, 'isOpen'>) => {
        setModalConfig({ ...config, isOpen: true })
    }

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false, inputValue: '' }))
    }

    const addService = () => {
        const name = newServiceName.trim()
        const priceRaw = newServicePrice.trim()
        const priceNum = parseFloat(priceRaw)

        if (!name && !priceRaw) {
            setServiceFormError('')
            return
        }

        if (!name) {
            setServiceFormError('โปรดระบุชื่อบริการ')
            return
        }
        if (!priceRaw || Number.isNaN(priceNum) || priceNum <= 0) {
            setServiceFormError('โปรดระบุจำนวนเงิน')
            return
        }

        const service: Service = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            price: priceNum,
        }
        setServices([...services, service])
        setNewServiceName('')
        setNewServicePrice('')
        setServiceFormError('')
    }

    const removeService = (id: string) => {
        setServices(services.filter(s => s.id !== id))
    }

    const updateFloorCount = (count: number) => {
        if (count > floorCount) {
            // Adding a floor (default 5 rooms)
            if (totalRooms + 5 > 50) {
                showModal({
                    title: 'ขีดจำกัดห้องพัก',
                    description: 'ขออภัย ระบบรองรับการสร้างห้องพักได้สูงสุด 50 ห้องเท่านั้นครับ',
                    type: 'alert',
                    onConfirm: closeModal
                });
                return;
            }
        }
        setFloorCount(count)
        const newFloors = Array.from({ length: count }, (_, i) => {
            const existing = floors.find(f => f.floorNumber === i + 1)
            return existing || { floorNumber: i + 1, roomCount: 5, rooms: [] }
        })
        setFloors(newFloors)
    }

    const updateRoomCount = (floorNum: number, count: number) => {
        const currentFloor = floors.find(f => f.floorNumber === floorNum);
        if (currentFloor && count > currentFloor.roomCount) {
            if (totalRooms + 1 > 50) {
                showModal({
                    title: 'ขีดจำกัดห้องพัก',
                    description: 'ขออภัย ระบบรองรับการสร้างห้องพักได้สูงสุด 50 ห้องเท่านั้นครับ',
                    type: 'alert',
                    onConfirm: closeModal
                });
                return;
            }
        }
        setFloors(floors.map(f => f.floorNumber === floorNum ? { ...f, roomCount: count } : f))
    }


    const totalRooms = floors.reduce((acc, f) => acc + f.roomCount, 0);

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

    const allRoomSlots = floors.flatMap(f => f.rooms);
    const roomNums = allRoomSlots.map(r => r.number.trim());
    const duplicateRooms = roomNums.filter((item, index) => roomNums.indexOf(item) !== index && item !== '');
    const hasDuplicates = duplicateRooms.length > 0;
    const hasEmptyRoomNumbers = allRoomSlots.some(r => r.number.trim() === '');
    /** ใช้ปิดปุ่มถัดไปในขั้นตอน 6 (เลขห้อง) — ชื่อเดิม isStep5Invalid คลาดเคลื่อนกับเลขขั้น */
    const isStep6RoomLayoutInvalid = hasDuplicates || hasEmptyRoomNumbers;

    const handleFinish = async () => {
        const bd =
            typeof billingDay === 'number' && billingDay >= 1 && billingDay <= 31 ? billingDay : null
        const pd =
            typeof paymentDueDay === 'number' && paymentDueDay >= 1 && paymentDueDay <= 31
                ? paymentDueDay
                : null
        if (bd === null || pd === null) {
            showModal({
                title: 'ข้อมูลไม่ครบ',
                description: 'กรุณากรอกวันจดมิเตอร์/ตัดรอบบิล และวันครบกำหนดชำระ (1–31) ให้ครบถ้วน',
                type: 'alert',
                onConfirm: closeModal,
            })
            return
        }

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
                    bank_name: bankName === 'อื่น ๆ' ? otherBankName : bankName,
                    bank_account_no: bankAccountNo,
                    bank_account_name: bankAccountName,
                    billing_day: bd,
                    payment_due_day: pd,
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
                f.rooms.map(r => ({
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
                description: 'บันทึกข้อมูลหอพักและห้องพักทั้งหมดเรียบร้อยแล้ว',
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
                <div className="relative pt-10 pb-12 px-8 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 text-white overflow-hidden">
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
                        {step === 1 && 'ยินดีต้อนรับเข้าสู่ HORPAY'}
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
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${step >= s ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
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
                            <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#166534" className="w-10 h-10">
                                    <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                                    <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.719c-1.035 0-1.875-.84-1.875-1.875v-6.198c.03-.028.06-.056.091-.086L12 5.432z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">คุณยังไม่มีข้อมูลหอพักในระบบ</h2>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed max-w-xs">
                                เริ่มต้นสร้างหอพักของคุณเพื่อจัดการบิล
                                <br />
                                ส่งแจ้งเตือนผ่าน Line แค่คลิกเดียว
                            </p>
                            <button
                                onClick={nextStep}
                                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200/50"
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
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                    <h3 className="font-bold text-gray-800 uppercase tracking-tight text-xs">ข้อมูลเจ้าของหอ</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={ownerName}
                                            onChange={(e) => setOwnerName(e.target.value)}
                                            className="w-full h-11 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                                        <input
                                            type="tel"
                                            value={ownerPhone}
                                            onChange={(e) => setOwnerPhone(e.target.value)}
                                            className="w-full h-11 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 text-sm"
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
                                            className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">ที่อยู่หอพัก <span className="text-red-500">*</span></label>
                                        <textarea
                                            rows={2}

                                            value={dormAddress}
                                            onChange={(e) => setDormAddress(e.target.value)}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-gray-800 text-sm resize-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-400 uppercase tracking-wider ml-1">เบอร์ออฟฟิศ / สำหรับติดต่อลูกค้า</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="tel"

                                                value={dormPhone}
                                                onChange={(e) => setDormPhone(e.target.value)}
                                                className="flex-1 h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 text-sm"
                                            />
                                            <button
                                                onClick={() => setDormPhone(ownerPhone)}
                                                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-[12px] font-bold transition-all"
                                            >เบอร์เดียวกัน</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Billing Cycle Setting Group */}
                            <div className="space-y-4 pt-6 mt-4 border-t border-gray-100/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-500">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                                    </svg>
                                    <h3 className="font-bold text-gray-700 tracking-tight text-[13px]">ตั้งค่ารอบบิล</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-gray-500 font-bold ml-1">
                                            วันจดมิเตอร์ / ตัดรอบบิล <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            inputMode="numeric"
                                            placeholder="1–31"
                                            value={billingDay === '' ? '' : billingDay}
                                            onChange={(e) => {
                                                const raw = e.target.value
                                                if (raw === '') {
                                                    setBillingDay('')
                                                    return
                                                }
                                                let val = parseInt(raw, 10)
                                                if (Number.isNaN(val)) return
                                                if (val > 31) val = 31
                                                if (val < 1) val = 1
                                                setBillingDay(val)
                                            }}
                                            onBlur={() => {
                                                if (billingDay === '') return
                                                if (typeof billingDay === 'number') {
                                                    if (billingDay < 1) setBillingDay(1)
                                                    else if (billingDay > 31) setBillingDay(31)
                                                }
                                            }}
                                            className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 font-bold placeholder:text-gray-400 placeholder:font-semibold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] text-gray-500 font-bold ml-1">
                                            วันครบกำหนดชำระ <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            inputMode="numeric"
                                            placeholder="1–31"
                                            value={paymentDueDay === '' ? '' : paymentDueDay}
                                            onChange={(e) => {
                                                const raw = e.target.value
                                                if (raw === '') {
                                                    setPaymentDueDay('')
                                                    return
                                                }
                                                let val = parseInt(raw, 10)
                                                if (Number.isNaN(val)) return
                                                if (val > 31) val = 31
                                                if (val < 1) val = 1
                                                setPaymentDueDay(val)
                                            }}
                                            onBlur={() => {
                                                if (paymentDueDay === '') return
                                                if (typeof paymentDueDay === 'number') {
                                                    if (paymentDueDay < 1) setPaymentDueDay(1)
                                                    else if (paymentDueDay > 31) setPaymentDueDay(31)
                                                }
                                            }}
                                            className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 font-bold placeholder:text-gray-400 placeholder:font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-6 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={
                                        !dormName ||
                                        !dormAddress ||
                                        !ownerName ||
                                        !ownerPhone ||
                                        typeof billingDay !== 'number' ||
                                        billingDay < 1 ||
                                        billingDay > 31 ||
                                        typeof paymentDueDay !== 'number' ||
                                        paymentDueDay < 1 ||
                                        paymentDueDay > 31
                                    }
                                    onClick={nextStep}
                                    className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-emerald-200/50"
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
                                            <path fillRule="evenodd" d="M12 21.625s-8.5-4.686-8.5-8.5c0-4.694 3.806-8.5 8.5-12.75 4.694 4.25 8.5 8.056 8.5 12.75 0 3.814-8.5 8.5-8.5 8.5z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <label className="text-sm font-bold text-gray-700 uppercase tracking-tight">ค่าน้ำประปา</label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setWaterType('unit')}
                                        className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold text-sm ${waterType === 'unit' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400'}`}
                                    >
                                        คิดตามหน่วย
                                    </button>
                                    <button
                                        onClick={() => setWaterType('fixed')}
                                        className={`py-3 px-4 rounded-xl border-2 transition-all font-semibold text-sm ${waterType === 'fixed' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400'}`}
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
                                        className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 placeholder:text-gray-400"
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
                                        className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 placeholder:text-gray-400"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">บาท / หน่วย</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={!waterRate || !electricRate || parseFloat(waterRate) <= 0 || parseFloat(electricRate) <= 0}
                                    onClick={nextStep}
                                    className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-emerald-200/50"
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
                                        onChange={(e) => {
                                            setNewServiceName(e.target.value)
                                            setServiceFormError('')
                                        }}
                                        className="h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 placeholder:text-gray-400"
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="relative flex-1 min-w-[120px]">
                                            <input
                                                type="number"
                                                placeholder="ราคา"
                                                value={newServicePrice}
                                                onChange={(e) => {
                                                    if (e.target.value.length > 6) return
                                                    setNewServicePrice(e.target.value)
                                                    setServiceFormError('')
                                                }}
                                                className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 placeholder:text-gray-400"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">บาท/เดือน</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addService}
                                            className="px-6 h-12 shrink-0 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold rounded-xl flex items-center justify-center hover:from-emerald-700 hover:to-teal-600 active:scale-95 transition-all shadow-md shadow-emerald-100"
                                        >
                                            เพิ่ม
                                        </button>
                                        {serviceFormError && (
                                            <span className="text-[11px] leading-tight text-red-600 font-semibold w-full sm:w-auto sm:max-w-[9rem]">
                                                {serviceFormError}
                                            </span>
                                        )}
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
                                                <p className="text-sm text-emerald-600 font-bold">{s.price.toLocaleString()} บาท/เดือน</p>
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
                                <button onClick={nextStep} className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-200/50">ถัดไป</button>
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
                                        className="flex-1 accent-emerald-600 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="w-12 h-12 flex items-center justify-center bg-emerald-50 text-emerald-700 font-bold rounded-xl border-2 border-emerald-100">{floorCount}</span>
                                </div>
                                {totalRooms >= 50 && (
                                    <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1 animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        ครบจำนวนห้องสูงสุด 50 ห้องแล้วครับ
                                    </p>
                                )}
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
                                                    disabled={totalRooms >= 50}
                                                    className={`w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center transition-colors ${totalRooms >= 50 ? 'bg-gray-50 text-gray-200 cursor-not-allowed border-gray-100' : 'text-gray-400 hover:bg-gray-200'}`}
                                                >+</button>
                                                <span className="text-xs text-gray-400 ml-1">ห้อง</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button onClick={nextStep} className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-200/50">ถัดไป</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: ROOM LAYOUT */}
                    {step === 6 && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500">
                            <p className="text-gray-500 text-sm mb-6">
                                ถ้าต้องการลดหรือเพิ่มจำนวนห้องให้กดย้อนกลับไปตั้งค่าจำนวนห้องต่อชั้นใหม่อีกครั้งครับ
                                <span className="block mt-1">แก้ไขเลขห้องให้ตรงกับหอพักของท่าน</span>
                            </p>

                            {hasDuplicates && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-bold">พบเลขห้องซ้ำกัน: {Array.from(new Set(duplicateRooms)).join(', ')}</span>
                                </div>
                            )}

                            {hasEmptyRoomNumbers && !hasDuplicates && (
                                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl flex items-center gap-2 text-yellow-700 text-sm animate-in fade-in slide-in-from-top-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-bold">กรุณาระบุเลขห้องให้ครบทุกห้อง</span>
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
                                            {f.rooms.map((room, idx) => {
                                                return (
                                                    <div
                                                        key={idx}
                                                        className="flex flex-col gap-2 p-3 rounded-2xl border-2 border-gray-100 bg-white shadow-sm transition-all"
                                                    >
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Room {idx + 1}</label>
                                                        <input
                                                            placeholder="ระบุเลขห้อง"
                                                            value={room.number}
                                                            onChange={(e) => updateRoomNumber(f.floorNumber, idx, e.target.value)}
                                                            className="font-bold text-lg outline-none rounded-lg px-2 py-1 bg-gray-50 border-2 border-emerald-100 text-gray-800 focus:border-emerald-500 focus:bg-white transition-all"
                                                        />
                                                    </div>
                                                )
                                            }
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-10 mt-auto">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={isStep6RoomLayoutInvalid}
                                    onClick={nextStep}
                                    className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-emerald-200/50"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 7: ROOM PRICE & TYPE */}
                    {step === 7 && (
                        <div className="flex-1 flex flex-col animate-in slide-in-from-right-4 duration-500">
                            <p className="text-gray-700 text-[15px] leading-relaxed font-medium mb-6">
                                เลือกประเภทห้องและใส่ค่าเช่าต่อเดือน · ใช้ <span className="font-bold text-gray-900">ตั้งค่าทั้งชั้น</span> ได้ถ้าต้องการให้ทุกห้องในชั้นนั้นราคาเดียวกัน
                            </p>

                            <div className="flex-1 space-y-8 overflow-y-auto pr-2">
                                {floors.map(f => (
                                    <div key={f.floorNumber} className="space-y-4 p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                                <h3 className="text-lg font-bold text-gray-900 tracking-tight">ชั้น {f.floorNumber}</h3>
                                            </div>

                                            {/* Floor Bulk Action */}
                                            <div className="flex items-center gap-2 p-2.5 bg-white rounded-2xl shadow-sm border border-gray-100">
                                                <span className="text-xs font-bold text-gray-600 shrink-0 ml-1">ตั้งค่าทั้งชั้น</span>
                                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                                    <button
                                                        type="button"
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
                                                        className="px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-white rounded-lg transition-all min-h-[2.25rem]"
                                                    >พัดลม</button>
                                                    <button
                                                        type="button"
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
                                                        className="px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-white rounded-lg transition-all min-h-[2.25rem]"
                                                    >แอร์</button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {f.rooms.map((room, roomIndex) => {
                                                return (
                                                    <div key={roomIndex} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="text-base font-bold text-gray-900 tracking-tight">ห้อง {room.number || '???'}</span>
                                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRoomType(f.floorNumber, roomIndex, 'fan')}
                                                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-w-[3.25rem] ${room.roomType === 'fan' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}
                                                                >พัดลม</button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateRoomType(f.floorNumber, roomIndex, 'air')}
                                                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all min-w-[3.25rem] ${room.roomType === 'air' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}
                                                                >แอร์</button>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                placeholder="0.00"
                                                                value={room.price}
                                                                onChange={(e) => updateRoomPrice(f.floorNumber, roomIndex, e.target.value)}
                                                                className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl pl-3 pr-[5.5rem] outline-none focus:border-emerald-500 transition-all text-gray-900 text-base font-bold tabular-nums placeholder:text-gray-400"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600 pointer-events-none">บาท/เดือน</span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-auto pt-6">
                                <button onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={floors.some(f => f.rooms.some(r => !r.price || parseFloat(r.price) <= 0))}
                                    onClick={nextStep}
                                    className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-emerald-200/50"
                                >
                                    ถัดไป
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 8: BANK SETTINGS */}
                    {step === 8 && (
                        <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <p className="text-gray-500 text-sm">ระบุข้อมูลบัญชีธนาคารสำหรับรับชำระเงินจากผู้เช่า</p>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">เลือกธนาคาร <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'kbank', name: 'กสิกรไทย', color: '#138B2E', logo: 'K' },
                                        { id: 'scb', name: 'ไทยพาณิชย์', color: '#4E2E7F', logo: 'S' },
                                        { id: 'bbl', name: 'กรุงเทพ', color: '#1E4598', logo: 'B' },
                                        { id: 'ktb', name: 'กรุงไทย', color: '#00AEEF', logo: 'K' },
                                        { id: 'bay', name: 'กรุงศรี', color: '#FFD700', logo: 'A' },
                                        { id: 'gsb', name: 'ออมสิน', color: '#EB1483', logo: 'G' },
                                        { id: 'promptpay', name: 'พร้อมเพย์', color: '#113566', logo: 'P' },
                                        { id: 'other', name: 'อื่น ๆ', color: '#94a3b8', logo: '?' },
                                    ].map((bank) => (
                                        <button
                                            key={bank.id}
                                            onClick={() => setBankName(bank.name)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 ${bankName === bank.name ? 'border-emerald-500 bg-emerald-50 shadow-md scale-[1.05]' : 'border-gray-50 bg-gray-50 hover:border-gray-200'}`}
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

                                {bankName === 'อื่น ๆ' && (
                                    <div className="space-y-1 mt-4 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">ระบุชื่อธนาคาร <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            placeholder="ชื่อ ธนาคาร..."
                                            value={otherBankName}
                                            onChange={(e) => setOtherBankName(e.target.value)}
                                            className="w-full h-11 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 text-sm font-bold"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">ชื่อบัญชี <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="ระบุชื่อเจ้าของบัญชี"
                                        value={bankAccountName}
                                        onChange={(e) => setBankAccountName(e.target.value)}
                                        className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">เลขบัญชีธนาคาร <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="000-0-00000-0"
                                        value={bankAccountNo}
                                        onChange={(e) => setBankAccountNo(e.target.value.replace(/[^0-9-]/g, ''))}
                                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 outline-none focus:border-emerald-500 transition-all text-gray-800 text-xl font-black font-sans tracking-widest"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-auto pt-6">
                                <button disabled={loading} onClick={prevStep} className="py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">ย้อนกลับ</button>
                                <button
                                    disabled={!bankName || (bankName === 'อื่น ๆ' && !otherBankName) || !bankAccountNo || !bankAccountName || loading}
                                    onClick={handleFinish}
                                    className="py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-all shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-2"
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
                    © 2026 HORPAY — ระบบจัดการหอพัก
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
                                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 outline-none focus:border-emerald-500 transition-all text-center text-xl font-black text-gray-800"
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
                                className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200/50 active:scale-[0.98] transition-all"
                            >
                                {modalConfig.type === 'prompt' ? 'ตกลง' : 'ตกลง'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
