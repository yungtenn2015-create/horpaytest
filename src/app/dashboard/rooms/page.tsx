'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import {
    ArrowLeftIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    HomeIcon,
    BuildingOfficeIcon,
    Squares2X2Icon,
    CheckIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ArrowsRightLeftIcon
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

export default function ManageRoomsPage() {
    const router = useRouter()
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

    const handleEdit = (room: Room) => {
        setEditingRoomId(room.id)
        setEditData({ ...room })
    }

    const handleSaveEdit = async () => {
        if (!editingRoomId || saving) return
        setSaving(true)
        setErrorMsg('')
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('rooms')
                .update({
                    room_number: editData.room_number,
                    base_price: editData.base_price,
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
        setShowRestoreModal(true)
    }

    const confirmRestore = async () => {
        if (!roomToRestore) return
        
        setSaving(true)
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
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการกู้คืน')
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
        if (!newData.room_number || newData.room_number.trim() === '') {
            setErrorMsg('กรุณาระบุเลขห้อง')
            return
        }

        const trimmedRoomNumber = newData.room_number.trim()
        
        // 1. Check if room exists and is NOT deleted
        if (rooms.some(r => r.room_number === trimmedRoomNumber && r.deleted_at === null)) {
            setErrorMsg('เลขห้องนี้มีอยู่แล้วในระบบ')
            return
        }

        // 2. Check if room exists but IS deleted (Recycle Bin)
        const deletedRoom = rooms.find(r => r.room_number === trimmedRoomNumber && r.deleted_at !== null)

        setSaving(true)
        const supabase = createClient()
        try {
            if (deletedRoom) {
                // RESTORE existing deleted room instead of inserting new
                const { error } = await supabase
                    .from('rooms')
                    .update({
                        deleted_at: null,
                        floor: newData.floor,
                        room_type: newData.room_type,
                        base_price: newData.base_price,
                        status: 'available'
                    })
                    .eq('id', deletedRoom.id)
                
                if (error) throw error
                setSuccessMsg(`กู้คืนห้อง ${trimmedRoomNumber} จากถังขยะเรียบร้อยแล้ว`)
            } else {
                // INSERT new room
                const { error } = await supabase
                    .from('rooms')
                    .insert({
                        dorm_id: dormId,
                        room_number: trimmedRoomNumber,
                        floor: newData.floor,
                        room_type: newData.room_type,
                        base_price: newData.base_price,
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
            // 1. Get the current active tenant in the movingRoom
            const { data: tenantData, error: tenantFetchError } = await supabase
                .from('tenants')
                .select('id')
                .eq('room_id', movingRoom.id)
                .eq('status', 'active')
                .maybeSingle()

            if (tenantFetchError) throw tenantFetchError
            if (!tenantData) throw new Error('ไม่พบข้อมูลผู้เช่าในห้องนี้')

            // 2. Perform updates in a sequence (simplified transaction simulation)
            // Ideally use RPC for atomicity, but let's try sequence with rollback logic if needed.
            
            // Step A: Update Tenant to new Room
            const { error: tUpdateError } = await supabase
                .from('tenants')
                .update({ room_id: targetRoomId })
                .eq('id', tenantData.id)
            if (tUpdateError) throw tUpdateError

            // Step B: Update Active Lease Contract
            await supabase
                .from('lease_contracts')
                .update({ room_id: targetRoomId })
                .eq('tenant_id', tenantData.id)
                .eq('status', 'active')

            // Step C: Update Source Room to available
            const { error: srcUpdateError } = await supabase
                .from('rooms')
                .update({ status: 'available' })
                .eq('id', movingRoom.id)
            if (srcUpdateError) throw srcUpdateError

            // Step D: Update Target Room to occupied
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
            }, 10000) // Keep it longer to let user click the button
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
                    <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
                    <p className="text-green-600 font-bold animate-pulse text-sm">กำลังโหลดข้อมูลห้องพัก...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:py-8 font-sans text-gray-800">
            <div className="w-full sm:max-w-lg bg-white min-h-screen sm:min-h-[850px] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

                {/* ── Header ── */}
                <header className="bg-gradient-to-br from-green-500 to-green-600 pt-12 pb-10 px-6 rounded-b-[2.5rem] relative shrink-0 shadow-lg shadow-green-100">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95"
                        >
                            <ArrowLeftIcon className="w-5 h-5 stroke-[3]" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">จัดการห้องพัก</h1>
                            <p className="text-green-50 text-xs font-bold mt-1">ตั้งค่าราคาและข้อมูลห้อง</p>
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
                            <div className="bg-green-50 border-2 border-green-500 text-green-600 text-[11px] font-black p-4 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <CheckIcon className="w-4 h-4 shrink-0" />
                                    {successMsg}
                                </div>
                                {postMoveRoomId && (
                                    <button
                                        onClick={() => router.push(`/dashboard/meter?roomId=${postMoveRoomId}`)}
                                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-black w-fit hover:bg-green-700 transition-all shadow-md shadow-green-100"
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
                                    onClick={() => openAddModal('1')}
                                    className="px-6 py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-all flex items-center gap-2 mx-auto"
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
                                                <div className="w-1.5 h-6 bg-green-500 rounded-full" />
                                                <h3 className="font-black text-gray-800 text-lg tracking-tight">ชั้น {floorNum}</h3>
                                            </div>
                                            <button 
                                                onClick={() => openAddModal(floorNum)}
                                                className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-all active:scale-95 flex items-center gap-1"
                                            >
                                                <PlusIcon className="w-3 h-3 stroke-[3]" /> เพิ่มห้อง
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {activeRooms.filter(r => r.floor === floorNum).map(room => (
                                                <div 
                                                    key={room.id}
                                                    className={`bg-white p-5 rounded-3xl border transition-all duration-300 group
                                                        ${editingRoomId === room.id ? 'border-green-500 ring-4 ring-green-100 shadow-xl' : 'border-gray-100 hover:border-green-200 shadow-sm'}
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
                                                                        onChange={e => setEditData({...editData, room_number: e.target.value})}
                                                                        className="w-full h-11 bg-gray-50 border-2 border-green-100 rounded-xl px-4 outline-none focus:border-green-500 text-gray-800 font-black"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">ราคา/เดือน</label>
                                                                    <input 
                                                                        type="number"
                                                                        value={editData.base_price || 0}
                                                                        onChange={e => setEditData({...editData, base_price: parseInt(e.target.value)})}
                                                                        className="w-full h-11 bg-gray-50 border-2 border-green-100 rounded-xl px-4 outline-none focus:border-green-500 text-gray-800 font-black"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex bg-gray-100 p-1 rounded-xl">
                                                                <button 
                                                                    onClick={() => setEditData({...editData, room_type: 'fan'})}
                                                                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${editData.room_type === 'fan' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}
                                                                >พัดลม</button>
                                                                <button 
                                                                    onClick={() => setEditData({...editData, room_type: 'air'})}
                                                                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${editData.room_type === 'air' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}
                                                                >แอร์</button>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={handleSaveEdit}
                                                                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl hover:bg-green-700 transition-all flex items-center justify-center gap-2"
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
                                                                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 font-black text-lg border border-green-100">
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
                                                                {room.status === 'occupied' && (
                                                                    <button 
                                                                        onClick={() => openMoveModal(room)}
                                                                        className="w-10 h-10 bg-gray-50 hover:bg-green-50 text-gray-400 hover:text-green-600 rounded-xl transition-all flex items-center justify-center border border-transparent hover:border-green-100"
                                                                        title="ย้ายห้อง"
                                                                    >
                                                                        <ArrowsRightLeftIcon className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    onClick={() => handleEdit(room)}
                                                                    className="w-10 h-10 bg-gray-50 hover:bg-green-50 text-gray-400 hover:text-green-600 rounded-xl transition-all flex items-center justify-center border border-transparent hover:border-green-100"
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

                                {/* Deleted Rooms Section */}
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
                                                            className="px-4 py-2 bg-white border border-green-200 text-green-600 font-bold text-xs rounded-xl hover:bg-green-50 transition-all flex items-center gap-2 shadow-sm"
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

                {/* ── Add Room Modal ── */}
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div 
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowAddModal(false)}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-green-600 p-8 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-white">เพิ่มห้องใหม่</h2>
                                    <p className="text-green-50 text-[10px] font-bold">ชั้น {newData.floor}</p>
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
                                            onChange={e => setNewData({...newData, room_number: e.target.value})}
                                            className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 outline-none focus:border-green-500 font-black text-gray-800 transition-all text-lg"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">ราคาต่อเดือน</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                value={newData.base_price || ''}
                                                onChange={e => setNewData({...newData, base_price: parseInt(e.target.value) || 0})}
                                                className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 pr-12 outline-none focus:border-green-500 font-black text-gray-800 transition-all text-lg"
                                            />
                                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">ประเภทห้อง</label>
                                        <div className="flex bg-gray-50 p-1.5 rounded-2xl border-2 border-gray-100">
                                            <button 
                                                onClick={() => setNewData({...newData, room_type: 'fan'})}
                                                className={`flex-1 py-3 text-xs font-black rounded-[0.9rem] transition-all flex items-center justify-center gap-2 ${newData.room_type === 'fan' ? 'bg-white text-green-600 shadow-sm border border-green-100' : 'text-gray-400'}`}
                                            >พัดลม</button>
                                            <button 
                                                onClick={() => setNewData({...newData, room_type: 'air'})}
                                                className={`flex-1 py-3 text-xs font-black rounded-[0.9rem] transition-all flex items-center justify-center gap-2 ${newData.room_type === 'air' ? 'bg-white text-green-600 shadow-sm border border-green-100' : 'text-gray-400'}`}
                                            >แอร์</button>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleConfirmAdd}
                                    disabled={saving}
                                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-xl shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก...' : 'บันทึกห้องใหม่'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Move Room Modal ── */}
                {showMoveModal && movingRoom && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div 
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowMoveModal(false)}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white p-8 flex items-center justify-between border-b border-gray-50">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 tracking-tight text-green-600">ย้ายห้องพัก</h2>
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
                                                            ? 'border-green-500 bg-green-50/50 ring-4 ring-green-50' 
                                                            : 'border-gray-50 bg-gray-50/30 hover:border-green-100 hover:bg-green-50/20'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${targetRoomId === targetRoom.id ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-gray-800 shadow-sm border border-gray-100'}`}>
                                                            {targetRoom.room_number}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-bold text-gray-400">ชั้น {targetRoom.floor}</p>
                                                            <p className="text-[11px] font-black text-gray-800">฿{targetRoom.base_price.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    {targetRoomId === targetRoom.id && (
                                                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg transform scale-110">
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
                                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-xl shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังดำเนินการ...' : 'ยืนยันการย้ายห้องนี้'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Delete Confirmation Modal ── */}
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
                                <p className="text-gray-400 text-xs font-bold mt-2 px-6">คุณกำลังจะลบห้องหมายเลข {roomToDelete.room_number} <br/> ข้อมูลจะถูกย้ายไปเก็บไว้ในถังขยะ</p>
                            </div>
                            
                            <div className="p-8 space-y-4">
                                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                    <p className="text-[11px] text-red-600 font-black leading-relaxed">
                                        * ข้อมูลห้องนี้จะถูกย้ายไปอยู่ที่ "ห้องที่ถูกลบ" (ถังขยะ) โดยคุณสามารถกู้คืนกลับมาได้ในภายหลัง
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
                                        disabled={saving}
                                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                                    >
                                        {saving ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Restore Confirmation Modal ── */}
                {showRestoreModal && roomToRestore && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
                        <div 
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowRestoreModal(false)}
                        />
                        <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white px-8 pt-10 pb-6 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                                    <ArrowPathIcon className="w-10 h-10 text-green-500" />
                                </div>
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">กู้คืนห้องพัก?</h2>
                                <p className="text-gray-400 text-xs font-bold mt-2 px-6">ต้องการนำห้องหมายเลข {roomToRestore.room_number} <br/> กลับมาเปิดให้เช่าอีกครั้งใช่หรือไม่?</p>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setShowRestoreModal(false)}
                                        className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-500 font-black rounded-2xl transition-all active:scale-95"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button 
                                        onClick={confirmRestore}
                                        disabled={saving}
                                        className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                                    >
                                        {saving ? 'กำลังกู้คืน...' : 'กู้คืนทันที'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="absolute bottom-10 left-6 right-6 z-20">
                    <button 
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-4 bg-white border border-gray-100 shadow-xl rounded-2xl font-black text-gray-500 hover:text-green-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Squares2X2Icon className="w-5 h-5" /> กลับไปหน้าหลัก
                    </button>
                </div>
            </div>
        </div>
    )
}
