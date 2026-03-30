'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { HorpayHouseMark } from '@/src/components/HorpayHouseMark'
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    CheckIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    Squares2X2Icon
} from '@heroicons/react/24/outline'

interface Room {
    id: string;
    room_number: string;
    floor: string;
    status: 'available' | 'occupied';
    room_type: 'fan' | 'air';
    base_price: number;
    deleted_at: string | null;
}

/** จำกัดจำนวนห้องที่ยังไม่ถูกลบ (soft delete) ต่อหอ — สอดคล้อง setup-dorm */
const MAX_ACTIVE_ROOMS = 50

export default function RoomsClient() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const roomIdParam = searchParams.get('roomId')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [rooms, setRooms] = useState<Room[]>([])
    const [dormId, setDormId] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [successMsg, setSuccessMsg] = useState('')
    const [showDeleted, setShowDeleted] = useState(false)

    // Editing State
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
    const [editData, setEditData] = useState<Partial<Room>>({})

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false)
    const [newData, setNewData] = useState<Partial<Room>>({
        room_number: '',
        base_price: 0,
        room_type: 'fan',
        floor: '1'
    })

    // Move Modal State
    const [showMoveModal, setShowMoveModal] = useState(false)
    const [movingRoom, setMovingRoom] = useState<Room | null>(null)
    const [targetRoomId, setTargetRoomId] = useState('')

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [roomToDelete, setRoomToDelete] = useState<Room | null>(null)

    // Restore Modal State
    const [showRestoreModal, setShowRestoreModal] = useState(false)
    const [roomToRestore, setRoomToRestore] = useState<Room | null>(null)
    const [restoreError, setRestoreError] = useState('')
    const [postMoveRoomId, setPostMoveRoomId] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
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

            const { data: roomsData, error: roomsError } = await supabase
                .from('rooms')
                .select('*')
                .eq('dorm_id', currentDormId)
                .order('floor', { ascending: true })
                .order('room_number', { ascending: true })

            if (roomsError) throw roomsError
            setRooms(roomsData || [])
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!loading && roomIdParam && rooms.length > 0) {
            const room = rooms.find(r => r.id === roomIdParam)
            if (room && room.status === 'occupied') {
                openMoveModal(room)
                const newPath = window.location.pathname
                window.history.replaceState(null, '', newPath)
            }
        }
    }, [loading, roomIdParam, rooms])

    const handleEdit = (room: Room) => {
        setEditingRoomId(room.id)
        setEditData({ ...room })
    }

    const handleSaveEdit = async () => {
        if (!editingRoomId || saving) return
        const trimmed = (editData.room_number || '').trim()
        if (!trimmed) {
            setErrorMsg('กรุณาระบุเลขห้อง')
            setTimeout(() => setErrorMsg(''), 4000)
            return
        }
        const priceNum = Number(editData.base_price)
        if (!Number.isFinite(priceNum) || priceNum < 0) {
            setErrorMsg('กรุณาระบุราคาที่ถูกต้อง')
            setTimeout(() => setErrorMsg(''), 4000)
            return
        }
        /* UNIQUE(dorm_id, room_number) นับรวมแถวที่ลบแล้ว — ห้ามซ้ำกับแถวอื่นใดๆ */
        const dup = rooms.some(
            r => r.id !== editingRoomId && r.room_number.trim() === trimmed
        )
        if (dup) {
            setErrorMsg('เลขห้องนี้ถูกใช้แล้ว (รวมห้องในถังขยะ) — ใช้เลขอื่นหรือกู้คืน/ลบห้องเดิมก่อน')
            setTimeout(() => setErrorMsg(''), 4000)
            return
        }

        setSaving(true)
        setErrorMsg('')
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('rooms')
                .update({
                    room_number: trimmed,
                    base_price: priceNum,
                    room_type: editData.room_type,
                    floor: editData.floor
                })
                .eq('id', editingRoomId)

            if (error) throw error

            setSuccessMsg('บันทึกข้อมูลเรียบร้อยแล้ว')
            setEditingRoomId(null)
            fetchData()
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = (room: Room) => {
        if (room.status === 'occupied') {
            setErrorMsg('ไม่สามารถลบห้องที่มีคนพักอยู่ได้! กรุณาย้ายคนพักออกก่อน')
            setTimeout(() => setErrorMsg(''), 4000)
            return
        }

        setRoomToDelete(room)
        setShowDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!roomToDelete) return

        setSaving(true)
        setErrorMsg('')
        const supabase = createClient()
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', roomToDelete.id)

            if (error) throw error

            setSuccessMsg(`ลบห้อง ${roomToDelete.room_number} เรียบร้อยแล้ว`)
            setShowDeleteModal(false)
            setRoomToDelete(null)
            fetchData()
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการลบ')
        } finally {
            setSaving(false)
        }
    }

    const handleRestore = (room: Room) => {
        setRoomToRestore(room)
        setRestoreError('')
        setShowRestoreModal(true)
    }

    const confirmRestore = async () => {
        if (!roomToRestore) return

        const activeRoomsCount = rooms.filter(r => r.deleted_at === null).length
        if (activeRoomsCount >= MAX_ACTIVE_ROOMS) {
            setRestoreError(`มีห้องที่ใช้งานครบ ${MAX_ACTIVE_ROOMS} ห้องแล้ว ไม่สามารถกู้คืนเพิ่มได้`)
            return
        }

        setSaving(true)
        setRestoreError('')
        setErrorMsg('')
        const supabase = createClient()
        try {
            const { error } = await supabase
                .from('rooms')
                .update({ deleted_at: null })
                .eq('id', roomToRestore.id)

            if (error) throw error

            setSuccessMsg(`กู้คืนห้อง ${roomToRestore.room_number} เรียบร้อยแล้ว`)
            setShowRestoreModal(false)
            setRoomToRestore(null)
            fetchData()
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
            setRestoreError(err.message || 'เกิดข้อผิดพลาดในการกู้คืน')
        } finally {
            setSaving(false)
        }
    }

    const openAddModal = (floorNum: string) => {
        setNewData({
            room_number: '',
            base_price: 0,
            room_type: 'fan',
            floor: floorNum
        })
        setShowAddModal(true)
        setErrorMsg('')
    }

    const handleConfirmAdd = async () => {
        const activeRoomsCount = rooms.filter(r => r.deleted_at === null).length

        if (!newData.room_number || newData.room_number.trim() === '') {
            setErrorMsg('กรุณาระบุเลขห้อง')
            return
        }

        const trimmedRoomNumber = newData.room_number.trim()
        const isNewRoom = !rooms.some(r => r.room_number.trim() === trimmedRoomNumber)

        if (isNewRoom && activeRoomsCount >= MAX_ACTIVE_ROOMS) {
            setErrorMsg(`ขออภัย ระบบรองรับห้องที่ใช้งานได้สูงสุด ${MAX_ACTIVE_ROOMS} ห้องเท่านั้นครับ`)
            return
        }

        if (rooms.some(r => r.room_number.trim() === trimmedRoomNumber && r.deleted_at === null)) {
            setErrorMsg('เลขห้องนี้มีอยู่แล้วในระบบ')
            return
        }

        const deletedRoom = rooms.find(r => r.room_number.trim() === trimmedRoomNumber && r.deleted_at !== null)

        if (deletedRoom && activeRoomsCount >= MAX_ACTIVE_ROOMS) {
            setErrorMsg(`มีห้องที่ใช้งานครบ ${MAX_ACTIVE_ROOMS} ห้องแล้ว ไม่สามารถกู้คืนห้องนี้เพิ่มได้ — ลบห้องที่ไม่ใช้ออกก่อน`)
            return
        }

        const addPrice = Number(newData.base_price)
        if (!Number.isFinite(addPrice) || addPrice < 0) {
            setErrorMsg('กรุณาระบุราคาที่ถูกต้อง')
            return
        }

        setSaving(true)
        const supabase = createClient()
        try {
            if (deletedRoom) {
                const { error } = await supabase
                    .from('rooms')
                    .update({
                        deleted_at: null,
                        floor: newData.floor,
                        room_type: newData.room_type,
                        base_price: addPrice,
                        status: 'available'
                    })
                    .eq('id', deletedRoom.id)

                if (error) throw error
                setSuccessMsg(`กู้คืนห้อง ${trimmedRoomNumber} จากถังขยะเรียบร้อยแล้ว`)
            } else {
                const { error } = await supabase
                    .from('rooms')
                    .insert({
                        dorm_id: dormId,
                        room_number: trimmedRoomNumber,
                        floor: newData.floor,
                        room_type: newData.room_type,
                        base_price: addPrice,
                        status: 'available'
                    })

                if (error) throw error
                setSuccessMsg('เพิ่มห้องเรียบร้อยแล้ว')
            }

            setShowAddModal(false)
            fetchData()
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
            setErrorMsg(err.message || 'ดำเนินการไม่สำเร็จ')
        } finally {
            setSaving(false)
        }
    }

    const openMoveModal = (room: Room) => {
        setMovingRoom(room)
        setTargetRoomId('')
        setShowMoveModal(true)
        setErrorMsg('')
    }

    const handleConfirmMove = async () => {
        if (!targetRoomId || !movingRoom) return

        setSaving(true)
        const supabase = createClient()
        try {
            const { data: tenantData, error: tenantFetchError } = await supabase
                .from('tenants')
                .select('id')
                .eq('room_id', movingRoom.id)
                .eq('status', 'active')
                .maybeSingle()

            if (tenantFetchError) throw tenantFetchError
            if (!tenantData) throw new Error('ไม่พบข้อมูลผู้เช่าในห้องนี้')

            const { error: tUpdateError } = await supabase
                .from('tenants')
                .update({ room_id: targetRoomId })
                .eq('id', tenantData.id)
            if (tUpdateError) throw tUpdateError

            await supabase
                .from('lease_contracts')
                .update({ room_id: targetRoomId })
                .eq('tenant_id', tenantData.id)
                .eq('status', 'active')

            const { error: srcUpdateError } = await supabase
                .from('rooms')
                .update({ status: 'available' })
                .eq('id', movingRoom.id)
            if (srcUpdateError) throw srcUpdateError

            const { error: tgtUpdateError } = await supabase
                .from('rooms')
                .update({ status: 'occupied' })
                .eq('id', targetRoomId)
            if (tgtUpdateError) throw tgtUpdateError

            setSuccessMsg(`ย้ายผู้เช่าจากห้อง ${movingRoom.room_number} ไปห้องอื่นเรียบร้อยแล้ว`)
            setPostMoveRoomId(targetRoomId)
            setShowMoveModal(false)
            fetchData()
            setTimeout(() => {
                setSuccessMsg('')
                setPostMoveRoomId(null)
            }, 10000) 
        } catch (err: any) {
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการย้ายห้อง')
        } finally {
            setSaving(false)
        }
    }

    const activeRooms = rooms.filter(r => r.deleted_at === null)
    const deletedRooms = rooms.filter(r => r.deleted_at !== null)
    const floors = Array.from(new Set(activeRooms.map(r => r.floor))).sort()

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-full max-w-lg bg-white min-h-[640px] rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-primary font-bold animate-pulse text-sm">กำลังโหลดข้อมูลห้องพัก...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gray-50 sm:max-w-lg sm:min-h-[850px] sm:rounded-[2.5rem] sm:shadow-2xl">

                <header className="relative isolate shrink-0 overflow-hidden rounded-b-[2.5rem] bg-primary shadow-lg shadow-green-100">
                    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-b-[2.5rem]">
                        <div className="absolute top-[-20%] right-[-10%] h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                        <div className="absolute bottom-[-10%] left-[-10%] h-56 w-56 rounded-full bg-white/5 blur-2xl" />
                    </div>
                    <div className="relative z-10 px-6 pb-8 pt-8">
                        <div className="mb-5 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => router.push('/dashboard')}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/20 text-white shadow-sm backdrop-blur-md transition-all hover:bg-white/30 active:scale-95"
                                    aria-label="กลับ"
                                >
                                    <ArrowLeftIcon className="h-5 w-5 stroke-[3]" />
                                </button>
                                <div className="flex min-w-0 items-center gap-2">
                                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                                        <HorpayHouseMark className="h-full w-full" />
                                    </div>
                                    <div className="min-w-0 leading-tight">
                                        <p className="truncate text-base font-bold tracking-tight text-white">HORPAY</p>
                                        <p className="truncate text-[9px] font-medium text-white/70">ระบบจัดการหอพัก</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-headline text-2xl font-black tracking-tight text-white drop-shadow-sm sm:text-3xl">
                                จัดการห้องพัก
                            </h1>
                            <p className="mt-1.5 text-xs font-bold text-white/85">ตั้งค่าราคาและข้อมูลห้อง</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pb-40">
                    <div className="p-6 space-y-8">

                        {errorMsg && !showAddModal && (
                            <div className="bg-red-50 border-2 border-red-500 text-red-600 text-[11px] font-black p-4 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        {successMsg && (
                            <div className="bg-primary/10 border-2 border-primary/30 text-primary text-[11px] font-black p-4 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <CheckIcon className="w-4 h-4 shrink-0" />
                                    {successMsg}
                                </div>
                                {postMoveRoomId && (
                                    <button
                                        onClick={() => router.push(`/dashboard/meter?roomId=${postMoveRoomId}`)}
                                        className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black w-fit hover:bg-primary/90 transition-all shadow-md shadow-green-100"
                                    >
                                        ไปจดมิเตอร์ห้องใหม่ทันที
                                    </button>
                                )}
                            </div>
                        )}

                        {floors.length === 0 && deletedRooms.length === 0 ? (
                            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold mb-4">ยังไม่มีข้อมูลห้องพัก</p>
                                <button
                                    type="button"
                                    disabled={activeRooms.length >= MAX_ACTIVE_ROOMS}
                                    onClick={() => openAddModal('1')}
                                    className={`px-6 py-3 font-bold rounded-2xl transition-all flex items-center gap-2 mx-auto ${
                                        activeRooms.length >= MAX_ACTIVE_ROOMS
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-primary text-white hover:bg-primary/90'
                                    }`}
                                >
                                    <PlusIcon className="w-5 h-5" /> สร้างห้องแรก
                                </button>
                            </div>
                        ) : (
                            <>
                                {floors.map(floorNum => (
                                    <div key={floorNum} className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-6 bg-primary rounded-full" />
                                                <h3 className="font-black text-gray-800 text-lg tracking-tight">ชั้น {floorNum}</h3>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={activeRooms.length >= MAX_ACTIVE_ROOMS}
                                                title={activeRooms.length >= MAX_ACTIVE_ROOMS ? `สร้างห้องได้สูงสุด ${MAX_ACTIVE_ROOMS} ห้อง` : undefined}
                                                onClick={() => openAddModal(floorNum)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                                                    activeRooms.length >= MAX_ACTIVE_ROOMS
                                                        ? 'text-gray-300 bg-gray-100 cursor-not-allowed'
                                                        : 'text-primary bg-primary/10 hover:bg-primary/20 active:scale-95'
                                                }`}
                                            >
                                                <PlusIcon className="w-3 h-3 stroke-[3]" /> เพิ่มห้อง
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {activeRooms.filter(r => r.floor === floorNum).map(room => (
                                                <div
                                                    key={room.id}
                                                    className={`bg-white p-5 rounded-3xl border transition-all duration-300 group
                                                        ${editingRoomId === room.id ? 'border-primary ring-4 ring-primary/20 shadow-xl' : 'border-gray-100 hover:border-primary/20 shadow-sm'}
                                                    `}
                                                >
                                                    {editingRoomId === room.id ? (
                                                        <div className="space-y-4">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">เลขห้อง</label>
                                                                    <input
                                                                        type="text"
                                                                        value={editData.room_number || ''}
                                                                        onChange={e => setEditData({ ...editData, room_number: e.target.value })}
                                                                        className="w-full h-11 bg-gray-50 border-2 border-primary/20 rounded-xl px-4 outline-none focus:border-primary text-gray-800 font-black"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">ราคา/เดือน</label>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        step="0.01"
                                                                        value={editData.base_price ?? ''}
                                                                        onChange={e => {
                                                                            const v = e.target.value
                                                                            setEditData({
                                                                                ...editData,
                                                                                base_price: v === '' ? 0 : parseFloat(v) || 0,
                                                                            })
                                                                        }}
                                                                        className="w-full h-11 bg-gray-50 border-2 border-primary/20 rounded-xl px-4 outline-none focus:border-primary text-gray-800 font-black"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                                                <button
                                                                    onClick={() => setEditData({ ...editData, room_type: 'fan' })}
                                                                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${editData.room_type === 'fan' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
                                                                >พัดลม</button>
                                                                <button
                                                                    onClick={() => setEditData({ ...editData, room_type: 'air' })}
                                                                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${editData.room_type === 'air' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
                                                                >แอร์</button>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={handleSaveEdit}
                                                                    className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <CheckIcon className="w-5 h-5" /> บันทึก
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingRoomId(null)}
                                                                    className="bg-gray-100 text-gray-500 font-bold px-6 rounded-2xl hover:bg-gray-200 transition-all"
                                                                >
                                                                    ยกเลิก
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-lg border border-primary/20">
                                                                    {room.room_number}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${room.room_type === 'air' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                                            {room.room_type === 'air' ? 'ห้องแอร์' : 'ห้องพัดลม'}
                                                                        </span>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${room.status === 'occupied' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                                                                            {room.status === 'occupied' ? 'มีผู้เช่า' : 'ห้องว่าง'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="font-black text-gray-800 tracking-tight">฿{room.base_price.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleEdit(room)}
                                                                    className="w-10 h-10 bg-gray-50 hover:bg-primary/10 text-gray-400 hover:text-primary rounded-xl transition-all flex items-center justify-center border border-transparent hover:border-primary/20"
                                                                >
                                                                    <PencilSquareIcon className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(room)}
                                                                    disabled={room.status === 'occupied'}
                                                                    className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border border-transparent
                                                                        ${room.status === 'occupied'
                                                                            ? 'bg-gray-50 text-gray-200 cursor-not-allowed'
                                                                            : 'bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 hover:border-red-100'}
                                                                    `}
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {deletedRooms.length > 0 && (
                                    <div className="mt-12 pt-8 border-t border-gray-100">
                                        <button
                                            onClick={() => setShowDeleted(!showDeleted)}
                                            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-all mx-auto"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            <span className="text-xs font-bold underline decoration-dotted">
                                                {showDeleted ? 'ซ่อนห้องที่ลบทิ้งแล้ว' : `ดูห้องที่ลบทิ้งแล้ว (${deletedRooms.length} ห้อง)`}
                                            </span>
                                        </button>

                                        {showDeleted && (
                                            <div className="mt-4 grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-2">
                                                {deletedRooms.map(room => (
                                                    <div key={room.id} className="bg-gray-50/50 p-4 rounded-3xl border border-dashed border-gray-200 flex items-center justify-between grayscale opacity-60">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-bold">
                                                                {room.room_number}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-gray-400">ชั้น {room.floor}</p>
                                                                <p className="text-xs font-bold text-gray-400">ลบเมื่อ: {new Date(room.deleted_at!).toLocaleDateString('th-TH')}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRestore(room)}
                                                            className="px-4 py-2 bg-white border border-primary/20 text-primary font-bold text-xs rounded-xl hover:bg-primary/10 transition-all flex items-center gap-2 shadow-sm"
                                                        >
                                                            <ArrowPathIcon className="w-3 h-3 stroke-[2.5]" /> กู้คืน
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowAddModal(false)}
                        />
                        <div className="relative w-full max-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 mx-auto max-w-sm">
                            <div className="bg-primary p-8 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-white">เพิ่มห้องใหม่</h2>
                                    <p className="text-white/80 text-[10px] font-bold">ชั้น {newData.floor}</p>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-2xl flex items-center justify-center transition-all"
                                >
                                    <XMarkIcon className="w-6 h-6 stroke-[3]" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {errorMsg && (
                                    <div className="bg-red-50 text-red-600 text-[11px] font-black p-4 rounded-xl flex items-center gap-2 border border-red-100">
                                        <ExclamationTriangleIcon className="w-4 h-4" />
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">เลขห้อง</label>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newData.room_number}
                                            onChange={e => setNewData({ ...newData, room_number: e.target.value })}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 outline-none focus:border-primary font-black text-gray-800 transition-all text-lg"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">ราคาต่อเดือน</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={newData.base_price === undefined || newData.base_price === null ? '' : newData.base_price}
                                                onChange={e => {
                                                    const v = e.target.value
                                                    setNewData({ ...newData, base_price: v === '' ? 0 : parseFloat(v) || 0 })
                                                }}
                                                className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 pr-12 outline-none focus:border-primary font-black text-gray-800 transition-all text-lg"
                                            />
                                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">ประเภทห้อง</label>
                                        <div className="flex bg-gray-50 p-1.5 rounded-2xl border-2 border-gray-100">
                                            <button
                                                onClick={() => setNewData({ ...newData, room_type: 'fan' })}
                                                className={`flex-1 py-3 text-xs font-black rounded-[0.9rem] transition-all flex items-center justify-center gap-2 ${newData.room_type === 'fan' ? 'bg-white text-primary shadow-sm border border-primary/20' : 'text-gray-400'}`}
                                            >พัดลม</button>
                                            <button
                                                onClick={() => setNewData({ ...newData, room_type: 'air' })}
                                                className={`flex-1 py-3 text-xs font-black rounded-[0.9rem] transition-all flex items-center justify-center gap-2 ${newData.room_type === 'air' ? 'bg-white text-primary shadow-sm border border-primary/20' : 'text-gray-400'}`}
                                            >แอร์</button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleConfirmAdd}
                                    disabled={saving}
                                    className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'บันทึกห้องใหม่'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showMoveModal && movingRoom && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowMoveModal(false)}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white p-8 flex items-center justify-between border-b border-gray-50">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 tracking-tight text-primary">ย้ายห้องพัก</h2>
                                    <p className="text-gray-400 text-[10px] font-bold">จากห้อง: {movingRoom.room_number}</p>
                                </div>
                                <button
                                    onClick={() => setShowMoveModal(false)}
                                    className="w-10 h-10 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center transition-all"
                                >
                                    <XMarkIcon className="w-6 h-6 stroke-[3]" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {errorMsg && (
                                    <div className="bg-red-50 text-red-600 text-[11px] font-black p-4 rounded-xl flex items-center gap-2 border border-red-100">
                                        <ExclamationTriangleIcon className="w-4 h-4" />
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 tracking-widest">เลือกห้องเป้าหมาย (ห้องว่างเท่านั้น)</label>
                                    <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                        {activeRooms
                                            .filter(r => r.status === 'available' && r.id !== movingRoom.id)
                                            .map(targetRoom => (
                                                <button
                                                    key={targetRoom.id}
                                                    onClick={() => setTargetRoomId(targetRoom.id)}
                                                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between
                                                        ${targetRoomId === targetRoom.id
                                                                        ? 'border-primary bg-primary/50 ring-4 ring-primary/10'
                                                                        : 'border-gray-50 bg-gray-50/30 hover:border-primary/20 hover:bg-primary/10'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${targetRoomId === targetRoom.id ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-800 shadow-sm border border-gray-100'}`}>
                                                            {targetRoom.room_number}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-bold text-gray-400">ชั้น {targetRoom.floor}</p>
                                                            <p className="text-[11px] font-black text-gray-800">฿{targetRoom.base_price.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    {targetRoomId === targetRoom.id && (
                                                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg transform scale-110">
                                                            <CheckIcon className="w-4 h-4 text-white stroke-[3]" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))
                                        }
                                        {activeRooms.filter(r => r.status === 'available' && r.id !== movingRoom.id).length === 0 && (
                                            <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                                <p className="text-gray-400 text-xs font-bold">ไม่มีห้องว่างให้ย้ายไปในขณะนี้</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleConfirmMove}
                                    disabled={saving || !targetRoomId}
                                    className="w-full py-4 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังดำเนินการ...' : 'ยืนยันการย้ายห้องนี้'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showDeleteModal && roomToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowDeleteModal(false)}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white px-8 pt-10 pb-6 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                                    <TrashIcon className="w-10 h-10 text-red-500" />
                                </div>
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">ยืนยันการลบ?</h2>
                                <p className="text-gray-400 text-xs font-bold mt-2 px-6">คุณกำลังจะลบห้องหมายเลข {roomToDelete.room_number} <br /> ข้อมูลจะถูกย้ายไปเก็บไว้ในถังขยะ</p>
                            </div>

                            <div className="p-8 space-y-4">
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                    <p className="text-[11px] text-red-600 font-black leading-relaxed">
                                        * ข้อมูลห้องนี้จะถูกย้ายไปอยู่ที่ &ldquo;ห้องที่ถูกลบ&rdquo; (ถังขยะ) โดยคุณสามารถกู้คืนกลับมาได้ในภายหลัง
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 font-black rounded-2xl transition-all active:scale-95"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95"
                                    >
                                        ลบทิ้ง
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showRestoreModal && roomToRestore && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => {
                                setShowRestoreModal(false)
                                setRestoreError('')
                            }}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white px-8 pt-10 pb-6 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                    <ArrowPathIcon className="w-10 h-10 text-primary" />
                                </div>
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">กู้คืนห้องพัก?</h2>
                                <p className="text-gray-400 text-xs font-bold mt-2 px-6">คุณต้องการกู้คืนห้องหมายเลข {roomToRestore.room_number} <br /> กลับเข้าสู่ระบบหลักใช่หรือไม่?</p>
                            </div>

                            {restoreError && (
                                <div className="px-8 -mt-2 pb-2">
                                    <div className="bg-red-50 text-red-600 text-[11px] font-black p-4 rounded-xl border border-red-100 flex items-center gap-2">
                                        <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                                        {restoreError}
                                    </div>
                                </div>
                            )}

                            <div className="p-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRestoreModal(false)
                                        setRestoreError('')
                                    }}
                                    className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 font-black rounded-2xl transition-all active:scale-95"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={confirmRestore}
                                    className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังดำเนินการ...' : 'กู้คืนข้อมูล'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 p-6 z-[60] rounded-b-[2.5rem] flex gap-3">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex-1 py-4 bg-white border border-gray-100 shadow-xl rounded-2xl font-black text-gray-500 hover:text-primary transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Squares2X2Icon className="w-5 h-5" /> กลับไปหน้าหลัก
                    </button>
                </div>
            </div>
        </div>
    )
}
