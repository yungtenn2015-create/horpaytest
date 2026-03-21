'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { format, subMonths } from 'date-fns'
import { th } from 'date-fns/locale'
import {
    ArrowLeftIcon,
    BoltIcon,
    HomeIcon,
    BuildingOfficeIcon,
    ViewColumnsIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline'

// Icons from heroicons solid
import { CheckCircleIcon } from '@heroicons/react/24/solid'

interface Room {
    id: string;
    room_number: string;
    floor: string;
    status: string;
    room_type: string;
}

interface UtilityReading {
    id: string;
    room_id: string;
    meter_date: string;
    curr_water_meter: number;
    curr_electric_meter: number;
}

interface MeterInput {
    prevWater: number;
    prevElectric: number;
    currWater: string;
    currElectric: string;
}

type ViewMode = 'all' | 'floor' | 'single';

export default function MeterReadingPage() {
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [successMode, setSuccessMode] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const [dormId, setDormId] = useState('')
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false)
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
    const [pickerYear, setPickerYear] = useState(() => parseInt(selectedMonth.split('-')[0]))

    const monthsTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const fullMonthsTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

    const formatDisplayMonth = (yyyyMM: string) => {
        const [y, m] = yyyyMM.split('-');
        const monthName = fullMonthsTH[parseInt(m, 10) - 1];
        return `${monthName} ${parseInt(y, 10) + 543}`;
    }

    const [rooms, setRooms] = useState<Room[]>([])
    // prevReadings[roomId] = { water, electric, isInitial }
    const [prevReadings, setPrevReadings] = useState<Record<string, { water: number, electric: number, isInitial: boolean }>>({})

    // meterInputs[roomId] = { currWater, currElectric }
    const [meterInputs, setMeterInputs] = useState<Record<string, { currWater: string, currElectric: string }>>({})
    
    type UtilityFilter = 'all' | 'electric' | 'water'
    const [utilityFilter, setUtilityFilter] = useState<UtilityFilter>('all')

    const [viewMode, setViewMode] = useState<ViewMode>('all')
    const [selectedFloor, setSelectedFloor] = useState<string>('')
    const [selectedRoomId, setSelectedRoomId] = useState<string>('')
    const [inlineSuccess, setInlineSuccess] = useState<boolean>(false)
    
    // Rates from settings
    const [electricRate, setElectricRate] = useState<number>(0)
    const [waterRate, setWaterRate] = useState<number>(0)
    const [waterBillingType, setWaterBillingType] = useState<string>('per_unit')
    const [waterFlatRate, setWaterFlatRate] = useState<number>(0)

    useEffect(() => {
        fetchData()
    }, [selectedMonth])

    async function fetchData() {
        setLoading(true)
        setErrorMsg('')
        setSuccessMode(false)
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // 1. Get Active Dorm
            const { data: dormsData } = await supabase
                .from('dorms')
                .select('id')
                .eq('owner_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1)

            if (!dormsData || dormsData.length === 0) {
                router.push('/setup-dorm')
                return
            }

            const currentDormId = dormsData[0].id
            setDormId(currentDormId)

            // 1.1 Get Dorm Settings (for rates)
            const { data: settingsData } = await supabase
                .from('dorm_settings')
                .select('electric_rate_per_unit, water_rate_per_unit, water_billing_type, water_flat_rate')
                .eq('dorm_id', currentDormId)
                .single()

            if (settingsData) {
                setElectricRate(settingsData.electric_rate_per_unit || 0)
                setWaterRate(settingsData.water_rate_per_unit || 0)
                setWaterBillingType(settingsData.water_billing_type || 'per_unit')
                setWaterFlatRate(settingsData.water_flat_rate || 0)
            }

            // 2. Get Rooms
            // To simplify meter reading, usually we only read meters for occupied rooms,
            // but sometimes users want to read all. We'll fetch all active rooms.
            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('*')
                .eq('dorm_id', currentDormId)
                .eq('status', 'occupied')
                .is('deleted_at', null)
                .order('floor', { ascending: true })
                .order('room_number', { ascending: true })

            if (roomsError) throw roomsError

            if (roomsData) {
                setRooms(roomsData)
                if (roomsData.length > 0) {
                    setSelectedFloor(roomsData[0].floor)
                    setSelectedRoomId(roomsData[0].id)

                    // 3. Fetch previous month readings (we just get the LATEST reading per room)
                    // We can do this efficiently by getting all utilities for these rooms, ordered by date desc, 
                    // and taking the first one for each room.
                    const roomIds = roomsData.map((r: Room) => r.id)

                    if (roomIds.length > 0) {
                        const { data: utilsData, error: utilsError } = await supabase
                            .from('utilities')
                            .select('room_id, curr_water_meter, curr_electric_meter, prev_water_meter, prev_electric_meter, meter_date')
                            .in('room_id', roomIds)
                            .order('meter_date', { ascending: false })

                        if (utilsError) throw utilsError

                        // 4. Map readings robustly
                        const latestPrev: Record<string, { water: number, electric: number, isInitial: boolean }> = {}
                        const existingInputs: Record<string, { currWater: string, currElectric: string }> = {}

                        roomsData.forEach((r: Room) => {
                            const roomUtils = utilsData?.filter(u => u.room_id === r.id) || []
                            
                            // 4.1 Check for CURRENT month's record (any day in current selected month)
                            const currentTargetMonth = selectedMonth // "YYYY-MM"
                            const currRec = roomUtils.find((u: any) => u.meter_date.startsWith(currentTargetMonth))
                            
                            // 4.2 Check for IMMEDIATELY PRECEDING month (any day in that month)
                            const [yearNum, monthNum] = selectedMonth.split('-').map(Number)
                            const prevDate = new Date(yearNum, monthNum - 2, 1)
                            const prevMonthTarget = format(prevDate, 'yyyy-MM')
                            const pRec = roomUtils.find((u: any) => u.meter_date.startsWith(prevMonthTarget))
                            const hasPrecedingRecord = !!pRec
                            
                            // 4.3 Determine "Previous Meter" and "Initial" status
                            let prevWater = 0
                            let prevElec = 0
                            let isInitial = !hasPrecedingRecord || roomUtils.length === 0

                            if (currRec) {
                                // If I already saved part of this month, use the 'prev' values I saved
                                prevWater = currRec.prev_water_meter
                                prevElec = currRec.prev_electric_meter
                                existingInputs[r.id] = {
                                    currWater: currRec.curr_water_meter.toString() || '',
                                    currElectric: currRec.curr_electric_meter.toString() || ''
                                }
                            } else if (hasPrecedingRecord) {
                                // Ideal case: use the directly preceding month's current reading
                                prevWater = pRec.curr_water_meter
                                prevElec = pRec.curr_electric_meter
                                existingInputs[r.id] = { currWater: '', currElectric: '' }
                            } else {
                                // Fallback: try latest history EVER before this month
                                const priorRecs = roomUtils.filter((u: any) => u.meter_date < `${currentTargetMonth}-01`)
                                if (priorRecs.length > 0) {
                                    prevWater = priorRecs[0].curr_water_meter
                                    prevElec = priorRecs[0].curr_electric_meter
                                }
                                existingInputs[r.id] = { currWater: '', currElectric: '' }
                            }

                            latestPrev[r.id] = { water: prevWater, electric: prevElec, isInitial }
                        })

                        setPrevReadings(latestPrev)
                        setMeterInputs(existingInputs)
                    }
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        } finally {
            setLoading(false)
        }
    }

    const uniqueFloors = Array.from(new Set(rooms.map((r: Room) => r.floor))).sort()

    // Filtered rooms to render based on View Mode
    const displayedRooms = rooms.filter((r: Room) => {
        if (viewMode === 'all') return true
        if (viewMode === 'floor') return r.floor === selectedFloor
        if (viewMode === 'single') return r.id === selectedRoomId
        return true
    })

    const handleInput = (roomId: string, type: 'water' | 'electric', value: string) => {
        // Allow only numbers
        const cleanVal = value.replace(/[^0-9]/g, '')
        setMeterInputs(prev => ({
            ...prev,
            [roomId]: {
                ...prev[roomId],
                [type === 'water' ? 'currWater' : 'currElectric']: cleanVal
            }
        }))
    }

    const handlePrevInput = (roomId: string, type: 'water' | 'electric', value: string) => {
        const cleanVal = value.replace(/[^0-9]/g, '')
        const numVal = cleanVal === '' ? 0 : parseInt(cleanVal)
        setPrevReadings(prev => ({
            ...prev,
            [roomId]: {
                ...prev[roomId],
                [type === 'water' ? 'water' : 'electric']: numVal
            }
        }))
    }

    const handleSave = async () => {
        // Validate missing inputs based on what's displayed
        let hasMissing = false
        displayedRooms.forEach(r => {
            const inf = meterInputs[r.id]
            if (utilityFilter === 'all' || utilityFilter === 'electric') {
                if (inf.currElectric === '') hasMissing = true
            }
            if (utilityFilter === 'all' || utilityFilter === 'water') {
                if (inf.currWater === '') hasMissing = true
            }
        })

        if (hasMissing) {
            setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วน ถึงจะทำการบันทึกข้อมูลได้')
            return
        }

        // Collect data to insert
        // Only insert rooms where AT LEAST ONE of the meters was filled
        const toSave = displayedRooms.map(r => {
            const inf = meterInputs[r.id]
            const p = prevReadings[r.id]
            const currWaterVal = (utilityFilter === 'all' || utilityFilter === 'water') ? parseInt(inf.currWater) : p.water
            const currElecVal = (utilityFilter === 'all' || utilityFilter === 'electric') ? parseInt(inf.currElectric) : p.electric
            
            return {
                room_id: r.id,
                meter_date: `${selectedMonth}-01`, // Default to 1st of the month
                prev_electric_meter: p.electric,
                curr_electric_meter: currElecVal,
                electric_unit: currElecVal - p.electric,
                prev_water_meter: p.water,
                curr_water_meter: currWaterVal,
                water_unit: currWaterVal - p.water
            }
        })

        if (toSave.length === 0) {
            setErrorMsg('กรุณากรอกข้อมูลอย่างน้อย 1 ห้อง')
            return
        }

        // Validate negatives
        const negatives = toSave.filter(x => x.electric_unit < 0 || x.water_unit < 0)
        if (negatives.length > 0) {
            setErrorMsg('พบมิเตอร์ที่พิมพ์ค่าน้อยกว่าเดือนก่อน (ติดลบ) กรุณาตรวจสอบอีกครั้ง')
            return
        }

        setSaving(true)
        setErrorMsg('')
        const supabase = createClient()

        try {
            // Need to handle duplicates for the same month! 
            // In SQL: UNIQUE (room_id, meter_date).
            // So we might use upsert. 
            const { error } = await supabase
                .from('utilities')
                .upsert(toSave, { onConflict: 'room_id, meter_date' })

            if (error) throw error

            setInlineSuccess(true)
            setTimeout(() => setInlineSuccess(false), 3000)
            fetchData() // Refresh but stay on current UI
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white min-h-[640px] rounded-[2.5rem] flex flex-col items-center justify-center gap-4 shadow-xl">
                    <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                    <p className="text-sm font-bold text-green-600 animate-pulse">กำลังดึงข้อมูลมิเตอร์เก่า...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

                {/* ── Header ── */}
                <header className="bg-gradient-to-br from-green-500 to-green-600 pt-12 pb-10 px-6 rounded-b-[2.5rem] relative shadow-lg shadow-green-200 shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95"
                        >
                            <ArrowLeftIcon className="w-5 h-5 stroke-[3]" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">จดมิเตอร์น้ำ-ไฟ</h1>
                            <p className="text-green-100 text-xs font-bold mt-1">บันทึกข้อมูลมิเตอร์ประจำเดือน</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pb-32">
                    <div className="p-6 space-y-6">

                        {/* Month Selector (Custom) */}
                        <div className="bg-white border-2 border-green-100 p-4 rounded-3xl flex items-center justify-between shadow-sm relative z-30">
                            <span className="text-sm font-black text-gray-400">งวดประจำเดือน:</span>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setIsMonthPickerOpen(!isMonthPickerOpen);
                                        setPickerYear(parseInt(selectedMonth.split('-')[0]));
                                    }}
                                    className="flex items-center gap-2 bg-green-50 text-green-700 font-black px-4 py-2.5 rounded-2xl hover:bg-green-100 transition-all border border-green-100 active:scale-95 shadow-sm"
                                >
                                    <CalendarDaysIcon className="w-5 h-5" />
                                    {formatDisplayMonth(selectedMonth)}
                                </button>

                                {isMonthPickerOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsMonthPickerOpen(false)} />
                                        <div className="absolute right-0 mt-3 w-72 bg-white border border-gray-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-5 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                            {/* Header: Year Switcher */}
                                            <div className="flex items-center justify-between mb-6 px-1">
                                                <button
                                                    onClick={() => setPickerYear(prev => prev - 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <ChevronLeftIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                                <span className="text-lg font-black text-gray-800">พ.ศ. {pickerYear + 543}</span>
                                                <button
                                                    onClick={() => setPickerYear(prev => prev + 1)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                            </div>

                                            {/* Grid: Months */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {monthsTH.map((mth, idx) => {
                                                    const currentM = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
                                                    const isSelected = selectedMonth === currentM;
                                                    return (
                                                        <button
                                                            key={mth}
                                                            onClick={() => {
                                                                setSelectedMonth(currentM);
                                                                setIsMonthPickerOpen(false);
                                                            }}
                                                            className={`py-3 rounded-2xl text-sm font-bold transition-all
                                                                ${isSelected
                                                                    ? 'bg-green-500 text-white shadow-lg shadow-green-200 scale-105'
                                                                    : 'text-gray-600 hover:bg-green-50 hover:text-green-600'
                                                                }`}
                                                        >
                                                            {mth}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Footer */}
                                            <div className="mt-5 pt-4 border-t border-gray-50 flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const d = new Date();
                                                        const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                        setSelectedMonth(now);
                                                        setIsMonthPickerOpen(false);
                                                    }}
                                                    className="flex-1 py-2 text-xs font-black text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
                                                >
                                                    เดือนนี้
                                                </button>
                                                <button
                                                    onClick={() => setIsMonthPickerOpen(false)}
                                                    className="flex-1 py-2 text-xs font-black text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                                >
                                                    ปิด
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* View Modes */}
                        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
                            <button
                                onClick={() => setViewMode('single')}
                                className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5
                                    ${viewMode === 'single' ? 'bg-white text-green-600 shadow-[0_2px_8px_rgb(0,0,0,0.06)]' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <HomeIcon className="w-4 h-4 stroke-[2.5]" />
                                ทีละห้อง
                            </button>
                            <button
                                onClick={() => setViewMode('floor')}
                                className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5
                                    ${viewMode === 'floor' ? 'bg-white text-green-600 shadow-[0_2px_8px_rgb(0,0,0,0.06)]' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <BuildingOfficeIcon className="w-4 h-4 stroke-[2.5]" />
                                ทีละชั้น
                            </button>
                            <button
                                onClick={() => setViewMode('all')}
                                className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5
                                    ${viewMode === 'all' ? 'bg-white text-green-600 shadow-[0_2px_8px_rgb(0,0,0,0.06)]' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <ViewColumnsIcon className="w-4 h-4 stroke-[2.5]" />
                                ทุกห้อง
                            </button>
                        </div>

                        {/* Utility Type Filter */}
                        <div className="flex gap-2 bg-green-50/50 p-1.5 rounded-[1.5rem] border border-green-100">
                            {[
                                { id: 'all', label: 'ทั้งหมด', icon: '✨' },
                                { id: 'electric', label: 'เฉพาะไฟ', icon: '⚡' },
                                { id: 'water', label: 'เฉพาะน้ำ', icon: '💧' }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setUtilityFilter(item.id as UtilityFilter)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black transition-all
                                        ${utilityFilter === item.id 
                                            ? 'bg-green-500 text-white shadow-md shadow-green-100' 
                                            : 'text-green-600 hover:bg-green-100'}`}
                                >
                                    <span>{item.icon}</span>
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {/* Room Selection (Single Mode Only) */}
                        {viewMode === 'single' && (
                            <div className="relative z-20">
                                <button
                                    type="button"
                                    onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                                    className="w-full bg-white border border-gray-200 py-4 px-5 rounded-[1.2rem] text-left focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 shadow-sm flex items-center justify-between group hover:border-green-300 transition-colors"
                                >
                                    <span className="text-gray-800 font-black flex items-center gap-2">
                                        {selectedRoomId ? (() => {
                                            const r = rooms.find(x => x.id === selectedRoomId);
                                            return r ? `ห้อง ${r.room_number}` : 'เลือกห้อง...';
                                        })() : 'เลือกห้อง...'}
                                        {selectedRoomId && (
                                            <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                                ชั้น {rooms.find(x => x.id === selectedRoomId)?.floor}
                                            </span>
                                        )}
                                    </span>
                                    <svg className={`h-5 w-5 text-gray-400 transition-transform duration-300 group-hover:text-green-500 ${isRoomDropdownOpen ? 'rotate-180 text-green-500' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                {isRoomDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsRoomDropdownOpen(false)} />
                                        <div className="absolute z-20 mt-2 w-full bg-white border border-gray-100 rounded-[1.2rem] shadow-[0_10px_40px_rgb(0,0,0,0.08)] max-h-64 overflow-y-auto py-2 animate-in fade-in slide-in-from-top-2">
                                            {rooms.map(r => (
                                                <button
                                                    key={r.id}
                                                    onClick={() => {
                                                        setSelectedRoomId(r.id);
                                                        setIsRoomDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-5 py-3 hover:bg-green-50 transition-colors flex items-center justify-between ${selectedRoomId === r.id ? 'bg-green-50/50' : ''}`}
                                                >
                                                    <span className={`font-black ${selectedRoomId === r.id ? 'text-green-600' : 'text-gray-700'}`}>ห้อง {r.room_number}</span>
                                                    <span className="text-[11px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md">ชั้น {r.floor}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {viewMode === 'floor' && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {uniqueFloors.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setSelectedFloor(f)}
                                        className={`shrink-0 px-5 py-2 rounded-xl text-sm font-bold transition-all border
                                            ${selectedFloor === f ? 'bg-green-50 border-green-200 text-green-700 shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        ชั้น {f}
                                    </button>
                                ))}
                            </div>
                        )}

                        {errorMsg && (
                            <div className="bg-red-50 border-2 border-red-500 text-red-600 text-xs font-bold p-4 rounded-2xl shadow-sm">
                                {errorMsg}
                            </div>
                        )}

                        {/* Rooms List */}
                        <div className="space-y-4">
                            {displayedRooms.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm font-bold bg-white border border-dashed border-gray-200 rounded-3xl">
                                    ไม่พบรายชื่อห้อง
                                </div>
                            ) : (
                                displayedRooms.map(room => {
                                    const p = prevReadings[room.id]
                                    const c = meterInputs[room.id]

                                    const cwNum = c.currWater !== '' ? parseInt(c.currWater) : null;
                                    const ceNum = c.currElectric !== '' ? parseInt(c.currElectric) : null;

                                    const wDiff = cwNum !== null ? cwNum - p.water : 0;
                                    const eDiff = ceNum !== null ? ceNum - p.electric : 0;

                                    return (
                                        <div key={room.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-5">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-black text-gray-800">ห้อง {room.room_number}</span>
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-bold">ชั้น {room.floor}</span>
                                                </div>
                                            </div>

                                            <div className={`grid gap-6 ${utilityFilter === 'all' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                {/* ไฟฟ้า */}
                                                {(utilityFilter === 'all' || utilityFilter === 'electric') && (
                                                    <div>
                                                        <div className="flex items-center justify-between h-6 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-5 h-5 flex items-center justify-center">
                                                                    <BoltIcon className="w-4 h-4 text-orange-400" />
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-600">มิเตอร์ไฟ (หน่วย)</span>
                                                            </div>
                                                            <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                                                                {electricRate.toLocaleString()}.-/หน่วย
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold px-1">
                                                                <span>เลขเดือนก่อน:</span>
                                                                {p.isInitial ? (
                                                                    <div className="w-[105px] flex items-center justify-between bg-gray-100 rounded-lg px-2 py-0.5 border border-dashed border-gray-300">
                                                                        <input
                                                                            type="tel"
                                                                            value={p.electric}
                                                                            onChange={(e) => handlePrevInput(room.id, 'electric', e.target.value)}
                                                                            className="w-10 bg-transparent text-gray-700 font-black focus:outline-none text-right text-xs"
                                                                            placeholder="0"
                                                                        />
                                                                        <span className="text-[9px] text-green-600 font-black shrink-0">เริ่มต้น</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-600 font-black text-xs">{p.electric}</span>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="tel"
                                                                placeholder="เลขมิเตอร์ใหม่"
                                                                value={c.currElectric}
                                                                onChange={(e) => handleInput(room.id, 'electric', e.target.value)}
                                                                className={`w-full bg-orange-50/30 border-2 rounded-xl px-3 py-2 text-sm font-black text-gray-800 focus:outline-none transition-all text-center
                                                                    ${eDiff < 0 ? 'border-red-400 focus:border-red-500' : ceNum !== null ? 'border-orange-400' : 'border-gray-100 focus:border-orange-400'}
                                                                `}
                                                            />
                                                            {ceNum !== null && (
                                                                <div className={`text-[10px] font-black text-right pr-1 ${eDiff < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                                                    ใช้ไฟ {eDiff} ยูนิต ({ (Math.max(0, eDiff) * electricRate).toLocaleString() }.-)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* น้ำประปา */}
                                                {(utilityFilter === 'all' || utilityFilter === 'water') && (
                                                    <div>
                                                        <div className="flex items-center justify-between h-6 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-5 h-5 flex items-center justify-center">
                                                                    <span className="text-sm leading-none pt-0.5">💧</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-600">มิเตอร์น้ำ (หน่วย)</span>
                                                            </div>
                                                            {waterBillingType === 'flat_rate' ? (
                                                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                                    เหมา {waterFlatRate.toLocaleString()}.-
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                                    {waterRate.toLocaleString()}.-/หน่วย
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold px-1">
                                                                <span>เลขเดือนก่อน:</span>
                                                                {p.isInitial ? (
                                                                    <div className="w-[105px] flex items-center justify-between bg-gray-100 rounded-lg px-2 py-0.5 border border-dashed border-gray-300">
                                                                        <input
                                                                            type="tel"
                                                                            value={p.water}
                                                                            onChange={(e) => handlePrevInput(room.id, 'water', e.target.value)}
                                                                            className="w-10 bg-transparent text-gray-700 font-black focus:outline-none text-right text-xs"
                                                                            placeholder="0"
                                                                        />
                                                                        <span className="text-[9px] text-green-600 font-black shrink-0">เริ่มต้น</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-600 font-black text-xs">{p.water}</span>
                                                                )}
                                                            </div>
                                                            <input
                                                                type="tel"
                                                                placeholder="เลขมิเตอร์ใหม่"
                                                                value={c.currWater}
                                                                onChange={(e) => handleInput(room.id, 'water', e.target.value)}
                                                                className={`w-full bg-blue-50/30 border-2 rounded-xl px-3 py-2 text-sm font-black text-gray-800 focus:outline-none transition-all text-center
                                                                    ${wDiff < 0 ? 'border-red-400 focus:border-red-500' : cwNum !== null ? 'border-blue-400' : 'border-gray-100 focus:border-blue-400'}
                                                                `}
                                                            />
                                                            {cwNum !== null && (
                                                                <div className={`text-[10px] font-black text-right pr-1 ${wDiff < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                    ใช้{waterBillingType === 'flat_rate' ? 'น้ำ' : `น้ำ ${wDiff} ยูนิต`} ({ (waterBillingType === 'flat_rate' ? waterFlatRate : (Math.max(0, wDiff) * waterRate)).toLocaleString() }.-)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Bottom Fixed Button ── */}
                <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-6 z-50 rounded-b-[2.5rem]">
                    <button
                        onClick={handleSave}
                        disabled={saving || displayedRooms.length === 0}
                        className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                            ${saving || displayedRooms.length === 0
                                ? 'bg-gray-300 shadow-none cursor-not-allowed'
                                : 'bg-green-500 hover:bg-green-600 shadow-green-200 active:scale-95'
                            }`}
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                กำลังบันทึกข้อมูล...
                            </>
                        ) : (
                            <span>บันทึกข้อมูล <span className="opacity-80 text-xs ml-1">({displayedRooms.length} ห้อง)</span></span>
                        )}
                    </button>
                </div>
                
                {inlineSuccess && (
                    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <div className="bg-green-600/95 backdrop-blur-md text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 font-black ring-4 ring-green-100/50">
                            <CheckCircleIcon className="w-6 h-6 text-green-200" />
                            <span className="text-sm">บันทึกข้อมูลเรียบร้อยแล้ว!</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
