'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import {
    ArrowLeftIcon,
    BoltIcon,
    CalendarDaysIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

interface Room {
    id: string;
    room_number: string;
    floor: string;
    status: string;
    room_type: string;
}

type ViewMode = 'all' | 'floor' | 'single';

export default function MeterClient() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const [dormId, setDormId] = useState('')
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const queryMonth = searchParams.get('month')
        if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) {
            return queryMonth
        }
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
    const [prevReadings, setPrevReadings] = useState<Record<string, { water: string, electric: string, isInitial: boolean }>>({})
    const [roomsWithBills, setRoomsWithBills] = useState<Record<string, boolean>>({})
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

    const roomIdFromUrl = searchParams.get('roomId')

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- รีโหลดเมื่อเปลี่ยนเดือนหรือ ?roomId (fetchData อ่าน searchParams ภายใน)
    }, [selectedMonth, roomIdFromUrl])

    async function fetchData() {
        setLoading(true)
        setErrorMsg('')
        const supabase = createClient()

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

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

            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select(`
                    *,
                    tenants(id, name, status)
                `)
                .eq('dorm_id', currentDormId)
                .eq('status', 'occupied')
                .is('deleted_at', null)
                .order('floor', { ascending: true })
                .order('room_number', { ascending: true })

            if (roomsError) throw roomsError

            if (roomsData) {
                setRooms(roomsData)
                if (roomsData.length === 0) {
                    setPrevReadings({})
                    setMeterInputs({})
                    setRoomsWithBills({})
                    setSelectedRoomId('')
                    setSelectedFloor('')
                } else {
                    const queryRoomId = searchParams.get('roomId')
                    const roomExists = roomsData.some(r => r.id === queryRoomId)

                    if (queryRoomId && roomExists) {
                        setSelectedRoomId(queryRoomId)
                        setViewMode('single')
                        const r = roomsData.find(x => x.id === queryRoomId)
                        if (r) setSelectedFloor(r.floor)
                    } else {
                        setSelectedFloor(roomsData[0].floor)
                        setSelectedRoomId(roomsData[0].id)
                    }

                    const roomIds = roomsData.map((r: Room) => r.id)

                    if (roomIds.length > 0) {
                        const { data: utilsData, error: utilsError } = await supabase
                            .from('utilities')
                            .select('room_id, tenant_id, curr_water_meter, curr_electric_meter, prev_water_meter, prev_electric_meter, meter_date')
                            .in('room_id', roomIds)
                            .order('meter_date', { ascending: false })

                        if (utilsError) throw utilsError

                        const { data: billsData } = await supabase
                            .from('bills')
                            .select('room_id, tenant_id')
                            .in('room_id', roomIds)
                            .eq('billing_month', `${selectedMonth}-01`)

                        const billedMap: Record<string, boolean> = {}
                        roomsData.forEach((r: any) => {
                            const activeTenant = (r.tenants as any[])?.find(t => t.status === 'active')
                            const hasBill = billsData?.some(b => b.room_id === r.id && b.tenant_id === activeTenant?.id)
                            if (hasBill) {
                                billedMap[r.id] = true
                            }
                        })
                        setRoomsWithBills(billedMap)

                        const latestPrev: Record<string, { water: string, electric: string, isInitial: boolean }> = {}
                        const existingInputs: Record<string, { currWater: string, currElectric: string }> = {}

                        roomsData.forEach((r: any) => {
                            const activeTenant = (r.tenants as any[])?.find(t => t.status === 'active')
                            const roomUtils = utilsData?.filter(u => u.room_id === r.id) || []

                            // Find current and previous records specifically for THIS tenant
                            const currRec = roomUtils.find((u: any) => u.meter_date.startsWith(selectedMonth) && u.tenant_id === activeTenant?.id)

                            const [yearNum, monthNum] = selectedMonth.split('-').map(Number)
                            const prevDate = new Date(yearNum, monthNum - 2, 1)
                            const prevMonthTarget = format(prevDate, 'yyyy-MM')
                            const pRec = roomUtils.find((u: any) => u.meter_date.startsWith(prevMonthTarget) && u.tenant_id === activeTenant?.id)
                            const hasPrecedingRecord = !!pRec

                            let prevWater = '0'
                            let prevElec = '0'
                            const isInitial = !hasPrecedingRecord || roomUtils.length === 0

                            if (currRec) {
                                // Prioritize actual reading from previous month if it exists (Sync)
                                prevWater = hasPrecedingRecord ? pRec.curr_water_meter.toString() : currRec.prev_water_meter.toString()
                                prevElec = hasPrecedingRecord ? pRec.curr_electric_meter.toString() : currRec.prev_electric_meter.toString()
                                existingInputs[r.id] = {
                                    currWater: currRec.curr_water_meter.toString() || '',
                                    currElectric: currRec.curr_electric_meter.toString() || ''
                                }
                            } else if (hasPrecedingRecord) {
                                prevWater = pRec.curr_water_meter.toString()
                                prevElec = pRec.curr_electric_meter.toString()
                                existingInputs[r.id] = { currWater: '', currElectric: '' }
                            } else {
                                // If no reading for this tenant yet, check if there's any reading at all for this room
                                // that we can use as a "starting point" (though ideally we use tenant check-in meter)
                                const priorRecsForTenant = roomUtils.filter((u: any) => u.meter_date < `${selectedMonth}-01` && u.tenant_id === activeTenant?.id)
                                if (priorRecsForTenant.length > 0) {
                                    prevWater = priorRecsForTenant[0].curr_water_meter.toString()
                                    prevElec = priorRecsForTenant[0].curr_electric_meter.toString()
                                } else {
                                    prevWater = ''
                                    prevElec = ''
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
    const displayedRooms = rooms.filter((r: Room) => {
        if (viewMode === 'all') return true
        if (viewMode === 'floor') return r.floor === selectedFloor
        if (viewMode === 'single') return r.id === selectedRoomId
        return true
    })

    const handleInput = (roomId: string, type: 'water' | 'electric', value: string) => {
        if (roomsWithBills[roomId]) return
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
        if (roomsWithBills[roomId]) return
        const cleanVal = value.replace(/[^0-9]/g, '')
        setPrevReadings(prev => ({
            ...prev,
            [roomId]: {
                ...prev[roomId],
                [type === 'water' ? 'water' : 'electric']: cleanVal
            }
        }))
    }

    const isSaveDisabled = (() => {
        if (saving || displayedRooms.length === 0) return true
        let missing = false
        displayedRooms.forEach(r => {
            if (roomsWithBills[r.id]) return
            const inf = meterInputs[r.id] || { currElectric: '', currWater: '' }
            const prev = prevReadings[r.id] || { electric: '', water: '' }

            if (utilityFilter === 'all' || utilityFilter === 'electric') {
                if (inf.currElectric === '' || prev.electric === '') missing = true
            }
            if (utilityFilter === 'all' || utilityFilter === 'water') {
                if (inf.currWater === '' || (waterBillingType !== 'flat_rate' && prev.water === '')) missing = true
            }
        })
        return missing
    })()

    const handleSave = async () => {
        if (isSaveDisabled) return

        const toSave = displayedRooms
            .filter(r => !roomsWithBills[r.id])
            .map(r => {
                const inf = meterInputs[r.id]
                const p = prevReadings[r.id]
                const pElecNum = parseInt(p.electric || '0')
                const pWaterNum = parseInt(p.water || '0')

                // ONLY update if it's in the current filter OR it was already entered/exists in the field
                const hasInputElectric = inf.currElectric !== ''
                const hasInputWater = inf.currWater !== ''

                const shouldUpdateElectric = (utilityFilter === 'all' || utilityFilter === 'electric') && hasInputElectric
                const shouldUpdateWater = (utilityFilter === 'all' || utilityFilter === 'water') && hasInputWater

                // If we shouldn't update, we use the EXISTING value (if any) or null?
                // Actually, if we use upsert, we MUST provide the primary keys.
                // To avoid 'auto-filling' with prev values when not intended, we check if there's an actual change.

                const currElecVal = hasInputElectric ? parseInt(inf.currElectric) : pElecNum
                const currWaterVal = hasInputWater ? parseInt(inf.currWater) : pWaterNum

                // If both are null and we are upserting, it might be an empty record.
                // But isSaveDisabled ensures at least the filtered ones are NOT empty.

                const electric_unit = currElecVal !== null ? currElecVal - pElecNum : 0
                const water_unit = currWaterVal !== null ? currWaterVal - pWaterNum : 0

                const currentElectricPrice = electric_unit * electricRate
                const currentWaterPrice = waterBillingType === 'flat_rate' ? waterFlatRate : (water_unit * waterRate)

                const activeTenant = (r as any).tenants?.find((t: any) => t.status === 'active')

                return {
                    room_id: r.id,
                    tenant_id: activeTenant?.id,
                    meter_date: `${selectedMonth}-01`,
                    prev_electric_meter: pElecNum,
                    curr_electric_meter: currElecVal,
                    electric_unit: electric_unit,
                    electric_price: currentElectricPrice,
                    prev_water_meter: pWaterNum,
                    curr_water_meter: currWaterVal,
                    water_unit: water_unit,
                    water_price: currentWaterPrice
                }
            })
            .filter(item => item.tenant_id)

        if (toSave.length === 0) {
            setErrorMsg('ไม่มีข้อมูลใหม่ให้บันทึก (ห้องที่ออกบิลแล้วไม่สามารถแก้ไขมิเตอร์ได้)')
            return
        }

        const negatives = toSave.filter(x => x.electric_unit < 0 || x.water_unit < 0)
        if (negatives.length > 0) {
            setErrorMsg('พบมิเตอร์ที่พิมพ์ค่าน้อยกว่าเดือนก่อน (ติดลบ) กรุณาตรวจสอบอีกครั้ง')
            return
        }

        setSaving(true)
        setErrorMsg('')
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('utilities')
                .upsert(toSave, { onConflict: 'room_id, meter_date, tenant_id' })

            if (error) throw error

            setInlineSuccess(true)
            setTimeout(() => setInlineSuccess(false), 3000)
            fetchData()
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
        <div className="min-h-screen bg-[#fcfdfd] sm:flex sm:items-center sm:justify-center sm:py-8 font-body text-slate-800 antialiased">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-visible flex flex-col relative border-gray-100 sm:border">

                <div className="relative z-30">
                    <div className="absolute inset-0 bg-emerald-600 rounded-b-[2.5rem] shadow-lg shadow-emerald-100 overflow-hidden -z-10">
                        <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse duration-[4000ms]" />
                        <div className="absolute bottom-[-10%] left-[-10%] w-56 h-56 bg-white/5 rounded-full blur-2xl" />
                    </div>

                    <header className="pt-6 pb-6 px-6 relative z-10 font-body">
                        <div className="flex items-center justify-between mb-8">
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95 border border-white/20 shadow-sm"
                            >
                                <ArrowLeftIcon className="w-5 h-5 stroke-[3]" />
                            </button>

                            <button
                                onClick={() => router.push(`/dashboard/billing?month=${selectedMonth}`)}
                                className="h-10 px-3 rounded-xl bg-emerald-50 flex items-center justify-center gap-1.5 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shadow-sm border border-emerald-100"
                            >
                                <BanknotesIcon className="w-4 h-4 stroke-[2.5]" />
                                <span className="text-[10px] font-black uppercase tracking-tight">ออกบิล</span>
                            </button>
                        </div>

                        <div>
                            <h1 className="text-3xl font-headline font-black text-white tracking-tight drop-shadow-sm">จดมิเตอร์น้ำ-ไฟ</h1>
                            <p className="text-emerald-50/80 text-xs font-bold mt-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                                บันทึกข้อมูลมิเตอร์ประจำเดือน {formatDisplayMonth(selectedMonth)}
                            </p>
                        </div>
                    </header>
                </div>

                <div className="flex-1 overflow-y-auto pb-32">
                    <div className="p-6 space-y-6">

                        <div className="bg-white border border-emerald-100 p-4 rounded-[2rem] flex items-center justify-between shadow-sm relative z-30">
                            <span className="text-sm font-black text-gray-400">งวดประจำเดือน:</span>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        setIsMonthPickerOpen(!isMonthPickerOpen);
                                        setPickerYear(parseInt(selectedMonth.split('-')[0]));
                                    }}
                                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 font-black px-4 py-2.5 rounded-2xl hover:bg-emerald-100 transition-all border border-emerald-100 active:scale-95 shadow-sm"
                                >
                                    <CalendarDaysIcon className="w-5 h-5 text-emerald-500/70" />
                                    {formatDisplayMonth(selectedMonth)}
                                </button>

                                {isMonthPickerOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsMonthPickerOpen(false)} />
                                        <div className="absolute right-0 mt-3 w-72 bg-white border border-gray-100 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-5 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
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

                                            <div className="grid grid-cols-3 gap-2">
                                                {monthsTH.map((mth, idx) => {
                                                    const currentM = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
                                                    const isSelected = selectedMonth === currentM;
                                                    const now = new Date();
                                                    const isFuture = new Date(pickerYear, idx, 1) > new Date(now.getFullYear(), now.getMonth(), 1);

                                                    return (
                                                        <button
                                                            key={mth}
                                                            disabled={isFuture}
                                                            onClick={() => {
                                                                setSelectedMonth(currentM);
                                                                setIsMonthPickerOpen(false);
                                                            }}
                                                            className={`py-3 rounded-2xl text-sm font-bold transition-all
                                                                ${isSelected
                                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-105'
                                                                    : isFuture
                                                                        ? 'text-gray-300 cursor-not-allowed opacity-50'
                                                                        : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
                                                                }`}
                                                        >
                                                            {mth}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            <div className="mt-5 pt-4 border-t border-gray-50 flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const d = new Date();
                                                        const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                        setSelectedMonth(now);
                                                        setIsMonthPickerOpen(false);
                                                    }}
                                                    className="flex-1 py-2 text-xs font-black text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
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

                        <div className="flex bg-emerald-50/50 p-1.5 rounded-[1.5rem] border border-emerald-100">
                            <button
                                onClick={() => setViewMode('single')}
                                className={`flex-1 py-3 text-[12px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5
                                    ${viewMode === 'single' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' : 'text-emerald-600 hover:bg-emerald-100'}`}
                            >
                                ทีละห้อง
                            </button>
                            <button
                                onClick={() => setViewMode('floor')}
                                className={`flex-1 py-3 text-[12px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5
                                    ${viewMode === 'floor' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' : 'text-emerald-600 hover:bg-emerald-100'}`}
                            >
                                ทีละชั้น
                            </button>
                            <button
                                onClick={() => setViewMode('all')}
                                className={`flex-1 py-3 text-[12px] font-black rounded-xl transition-all flex items-center justify-center gap-1.5
                                    ${viewMode === 'all' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' : 'text-emerald-600 hover:bg-emerald-100'}`}
                            >
                                ทุกห้อง
                            </button>
                        </div>

                        <div className="flex gap-2 bg-emerald-50/50 p-1.5 rounded-[1.5rem] border border-emerald-100">
                            {[
                                { id: 'all', label: 'จดทั้งหมด' },
                                { id: 'electric', label: 'เฉพาะไฟ' },
                                { id: 'water', label: 'เฉพาะน้ำ' }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setUtilityFilter(item.id as UtilityFilter)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[12px] font-black transition-all
                                        ${utilityFilter === item.id
                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                            : 'text-emerald-600 hover:bg-emerald-100'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {viewMode === 'single' && (
                            <div className="relative z-20">
                                <button
                                    type="button"
                                    onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                                    className="w-full bg-white border border-gray-200 py-4 px-5 rounded-[1.2rem] text-left focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 shadow-sm flex items-center justify-between group hover:border-green-300 transition-colors"
                                >
                                    <span className="text-slate-800 font-black flex items-center gap-2">
                                        {selectedRoomId ? (() => {
                                            const r = rooms.find(x => x.id === selectedRoomId);
                                            return r ? `ห้อง ${r.room_number}` : 'เลือกห้อง...';
                                        })() : 'เลือกห้อง...'}
                                        {selectedRoomId && (
                                            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                                ชั้น {rooms.find(x => x.id === selectedRoomId)?.floor}
                                            </span>
                                        )}
                                    </span>
                                    <svg className={`h-5 w-5 text-slate-300 transition-transform duration-300 group-hover:text-emerald-500 ${isRoomDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
                                                    <span className={`font-black ${selectedRoomId === r.id ? 'text-emerald-600' : 'text-slate-700'}`}>ห้อง {r.room_number}</span>
                                                    <span className="text-[11px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">ชั้น {r.floor}</span>
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
                                            ${selectedFloor === f ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
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

                        <div className="space-y-4">
                            {displayedRooms.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm font-bold bg-white border border-dashed border-gray-200 rounded-3xl">
                                    ไม่พบรายชื่อห้อง
                                </div>
                            ) : (
                                displayedRooms.map(room => {
                                    const p = prevReadings[room.id] || { water: '0', electric: '0', isInitial: false }
                                    const c = meterInputs[room.id] || { currWater: '', currElectric: '' }

                                    const cwNum = c.currWater !== '' ? parseInt(c.currWater) : null;
                                    const ceNum = c.currElectric !== '' ? parseInt(c.currElectric) : null;

                                    const wDiff = cwNum !== null ? cwNum - parseInt(p.water || '0') : 0;
                                    const eDiff = ceNum !== null ? ceNum - parseInt(p.electric || '0') : 0;

                                    return (
                                        <div key={room.id} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-5">
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-lg font-black text-gray-800">ห้อง {room.room_number}</span>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-bold shrink-0">ชั้น {room.floor}</span>
                                                            <span className="text-[11px] font-black text-emerald-600 truncate max-w-[120px]">
                                                                {(room as any).tenants?.find((t: any) => t.status === 'active')?.name || 'ไม่พบรายชื่อ'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {roomsWithBills[room.id] && (
                                                    <span className="text-[10px] font-black text-white bg-blue-500 px-3 py-1 rounded-full shadow-sm shadow-blue-100 flex items-center gap-1">
                                                        <CheckCircleIcon className="w-3 h-3" /> ออกบิลแล้ว
                                                    </span>
                                                )}
                                            </div>

                                            <div className={`grid gap-6 ${utilityFilter === 'all' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                {(utilityFilter === 'all' || utilityFilter === 'electric') && (
                                                    <div>
                                                        <div className="flex items-center justify-between h-6 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-5 h-5 flex items-center justify-center">
                                                                    <BoltIcon className="w-4 h-4 text-orange-400" />
                                                                </div>
                                                                <span className="text-xs font-bold text-black-600">มิเตอร์ไฟ (หน่วย)</span>
                                                            </div>
                                                            <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                                                                {electricRate.toLocaleString()}.-/หน่วย
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center text-[10px] text-black-400 font-bold px-1">
                                                                <span>เลขเดือนก่อน:</span>
                                                                <div className={`w-[85px] flex items-center justify-between bg-gray-50 rounded-lg px-2 py-0.5 border ${p.isInitial ? 'border-dashed border-gray-300' : 'border-gray-200'}`}>
                                                                    <input
                                                                        type="tel"
                                                                        value={p.electric}
                                                                        disabled={roomsWithBills[room.id]}
                                                                        onChange={(e) => handlePrevInput(room.id, 'electric', e.target.value)}
                                                                        className="w-full bg-transparent text-gray-700 font-black focus:outline-none text-right text-xs"
                                                                        placeholder="0"
                                                                    />
                                                                    {p.isInitial && <span className="text-[8px] text-green-600 font-black ml-1 shrink-0"></span>}
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="tel"
                                                                placeholder="เลขมิเตอร์ใหม่"
                                                                value={c.currElectric}
                                                                disabled={roomsWithBills[room.id]}
                                                                onChange={(e) => handleInput(room.id, 'electric', e.target.value)}
                                                                className={`w-full bg-orange-50/30 border-2 rounded-xl px-3 py-2 text-sm font-black text-gray-800 focus:outline-none transition-all text-center
                                                                    ${roomsWithBills[room.id] ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' : eDiff < 0 ? 'border-red-400 focus:border-red-500' : ceNum !== null ? 'border-orange-400' : 'border-gray-100 focus:border-orange-400'}
                                                                `}
                                                            />
                                                            {ceNum !== null && (
                                                                <div className={`text-[10px] font-black text-right pr-1 ${eDiff < 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                                                    ใช้ไฟ {eDiff} ยูนิต ({(Math.max(0, eDiff) * electricRate).toLocaleString()}.-)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {(utilityFilter === 'all' || utilityFilter === 'water') && (
                                                    <div>
                                                        <div className="flex items-center justify-between h-6 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-5 h-5 flex items-center justify-center">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-blue-500">
                                                                        <path fillRule="evenodd" d="M12 21.625s-8.5-4.686-8.5-8.5c0-4.694 3.806-8.5 8.5-12.75 4.694 4.25 8.5 8.056 8.5 12.75 0 3.814-8.5 8.5-8.5 8.5z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                                <span className="text-xs font-bold text-black-600">มิเตอร์น้ำ (หน่วย)</span>
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
                                                            <div className="flex justify-between items-center text-[10px] text-black-400 font-bold px-1">
                                                                <span>เลขเดือนก่อน:</span>
                                                                <div className={`w-[85px] flex items-center justify-between bg-gray-50 rounded-lg px-2 py-0.5 border ${p.isInitial ? 'border-dashed border-gray-300' : 'border-gray-200'}`}>
                                                                    <input
                                                                        type="tel"
                                                                        value={p.water}
                                                                        disabled={roomsWithBills[room.id]}
                                                                        onChange={(e) => handlePrevInput(room.id, 'water', e.target.value)}
                                                                        className="w-full bg-transparent text-gray-700 font-black focus:outline-none text-right text-xs"
                                                                        placeholder="0"
                                                                    />
                                                                    {p.isInitial && <span className="text-[8px] text-green-600 font-black ml-1 shrink-0"></span>}
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="tel"
                                                                placeholder="เลขมิเตอร์ใหม่"
                                                                value={c.currWater}
                                                                disabled={roomsWithBills[room.id]}
                                                                onChange={(e) => handleInput(room.id, 'water', e.target.value)}
                                                                className={`w-full bg-blue-50/30 border-2 rounded-xl px-3 py-2 text-sm font-black text-gray-800 focus:outline-none transition-all text-center
                                                                    ${roomsWithBills[room.id] ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' : wDiff < 0 ? 'border-red-400 focus:border-red-500' : cwNum !== null ? 'border-blue-400' : 'border-gray-100 focus:border-blue-400'}
                                                                `}
                                                            />
                                                            {cwNum !== null && (
                                                                <div className={`text-[10px] font-black text-right pr-1 ${wDiff < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                    ใช้{waterBillingType === 'flat_rate' ? 'น้ำ' : `น้ำ ${wDiff} ยูนิต`} ({(waterBillingType === 'flat_rate' ? waterFlatRate : (Math.max(0, wDiff) * waterRate)).toLocaleString()}.-)
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

                <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-6 z-50 rounded-b-[2.5rem]">
                    <button
                        onClick={handleSave}
                        disabled={isSaveDisabled}
                        className={`w-full py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-2
                            ${isSaveDisabled
                                ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 active:scale-95'
                            }`}
                    >
                        {saving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                กำลังบันทึกข้อมูล...
                            </>
                        ) : (
                            <span>บันทึกข้อมูล <span className="opacity-70 text-[10px] ml-1 uppercase tracking-wider font-black">({displayedRooms.length} ห้อง)</span></span>
                        )}
                    </button>
                </div>

                {inlineSuccess && (
                    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
                        <div className="bg-emerald-600/95 backdrop-blur-md text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 font-black ring-8 ring-emerald-500/10">
                            <span className="material-symbols-outlined text-emerald-200">check_circle</span>
                            <span className="text-sm">บันทึกข้อมูลเรียบร้อยแล้ว!</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
