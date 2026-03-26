'use client'

import {
    BuildingOfficeIcon,
    KeyIcon,
    ArrowRightOnRectangleIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    UserIcon,
    ChevronRightIcon,
    CheckIcon,
    ChatBubbleLeftRightIcon,
    DevicePhoneMobileIcon,
    CalendarDaysIcon
} from '@heroicons/react/24/outline'

// Helper function for Thai date formatting
const formatThaiDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
};

interface Room {
    id: string;
    room_number: string;
    status: 'available' | 'occupied' | 'maintenance';
    floor: string;
    base_price: number;
    tenants?: {
        name: string;
        phone: string | null;
        line_user_id: string | null;
        status: string;
        planned_move_out_date?: string | null;
    }[];
}

interface RoomsTabProps {
    rooms: Room[];
    selectedFloor: string;
    selectedStatus: string;
    setSelectedFloor: (floor: string) => void;
    setSelectedStatus: (status: string) => void;
    waitingVerifyRoomIds: Set<string>;
    unpaidRoomIds: Set<string>;
    overdueRoomIds: Set<string>;
    movingOutRoomIds: Set<string>;
    router: any;
}

export default function RoomsTab({
    rooms,
    selectedFloor,
    selectedStatus,
    setSelectedFloor,
    setSelectedStatus,
    waitingVerifyRoomIds,
    unpaidRoomIds,
    overdueRoomIds,
    movingOutRoomIds,
    router
}: RoomsTabProps) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative z-10 bg-emerald-50/30">
            {/* Premium Header (Green Theme) */}
            <div className="relative min-h-[210px]">
                {/* Background with clipping */}
                <div className="absolute inset-0 bg-primary rounded-b-[2.5rem] sm:rounded-t-[2.5rem] shadow-lg overflow-hidden z-0">
                    <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse duration-[4000ms]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-56 h-56 bg-white/5 rounded-full blur-2xl" />
                </div>

                <div className="relative z-50 pt-8 pb-10 px-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-[20px] rounded-[2.2rem] flex items-center justify-center text-white border border-white/30 shadow-2xl animate-in zoom-in duration-700">
                            <BuildingOfficeIcon className="w-8 h-8 drop-shadow-md" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tight text-white leading-tight underline decoration-white/20 underline-offset-8">
                                สถานะห้องพัก
                            </h1>
                            <p className="text-sm sm:text-[18px] text-white/99 font-bold tracking-tight mt-2">
                                ห้องพักทั้งหมด {rooms.length} ห้อง
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-5 -mt-6 relative z-20 space-y-6 pb-8">
                {/* Filters UI */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-gray-50 space-y-6">
                    {/* Floor Filter */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-4 bg-green-500 rounded-full" />
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">เลือกชั้น</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setSelectedFloor('all')}
                                className={`px-6 py-3 rounded-2xl font-black text-[12px] transition-all whitespace-nowrap border-2 ${selectedFloor === 'all' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100/50' : 'bg-gray-50 border-transparent text-slate-500 hover:bg-white hover:border-gray-200'}`}
                            >
                                ทุกชั้น
                            </button>
                            {Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => (a || '').localeCompare(b || '', undefined, { numeric: true })).map(floor => (
                                <button
                                    key={floor}
                                    onClick={() => setSelectedFloor(floor)}
                                    className={`px-6 py-3 rounded-2xl font-black text-[12px] transition-all whitespace-nowrap border-2 ${selectedFloor === floor ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100/50' : 'bg-gray-50 border-transparent text-slate-400 hover:bg-white hover:border-gray-200'}`}
                                >
                                    ชั้น {floor}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">สถานะห้อง</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {[
                                { id: 'all', label: 'ทั้งหมด', color: 'bg-emerald-600 border-emerald-600 shadow-emerald-100/50' },
                                { id: 'available', label: 'ว่าง', color: 'bg-green-500 border-green-500 shadow-green-100/50' },
                                { id: 'occupied', label: 'มีคนพัก', color: 'bg-blue-600 border-blue-600 shadow-blue-100/50' },
                                { id: 'waiting', label: 'รอชำระ', color: 'bg-sky-500 border-sky-500 shadow-sky-100/50' },
                                { id: 'overdue', label: 'ค้างชำระ', color: 'bg-orange-500 border-orange-500 shadow-orange-100/50' },
                                { id: 'moving_out', label: 'แจ้งออก', color: 'bg-amber-500 border-amber-500 shadow-amber-100/50' }
                            ].map(status => (
                                <button
                                    key={status.id}
                                    onClick={() => setSelectedStatus(status.id)}
                                    className={`px-5 py-3 rounded-2xl font-black text-[12px] transition-all whitespace-nowrap border-2 ${selectedStatus === status.id ? `${status.color} text-white shadow-lg` : 'bg-gray-50 border-transparent text-slate-500 hover:bg-white hover:border-gray-200'}`}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-32 custom-scrollbar min-h-[400px]">
                    {rooms.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                            <p className="text-gray-400 font-bold">ยังไม่มีข้อมูลห้องพัก</p>
                        </div>
                    ) : (() => {
                        const filteredRooms = rooms.filter(room => {
                            const matchesFloor = selectedFloor === 'all' || room.floor === selectedFloor;
                            let matchesStatus = true;
                            if (selectedStatus !== 'all') {
                                const isWaitingVerify = waitingVerifyRoomIds.has(room.id);
                                const isUnpaid = unpaidRoomIds.has(room.id);
                                const isOccupied = room.status === 'occupied';
                                const isAvailable = room.status === 'available';

                                if (selectedStatus === 'available') matchesStatus = isAvailable && !isWaitingVerify && !isUnpaid && !overdueRoomIds.has(room.id);
                                if (selectedStatus === 'occupied') matchesStatus = isOccupied;
                                if (selectedStatus === 'waiting') matchesStatus = isUnpaid || isWaitingVerify;
                                if (selectedStatus === 'overdue') matchesStatus = overdueRoomIds.has(room.id);
                                if (selectedStatus === 'moving_out') matchesStatus = movingOutRoomIds.has(room.id);
                            }
                            return matchesFloor && matchesStatus;
                        });

                        if (filteredRooms.length === 0) {
                            return (
                                <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                    <p className="text-gray-400 font-bold">ไม่พบห้องพักที่ตรงตามเงื่อนไข</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-12">
                                {Array.from(new Set(filteredRooms.map(r => r.floor))).sort((a, b) => (a || '').localeCompare(b || '', undefined, { numeric: true })).map(floor => (
                                    <div key={floor} className="space-y-5">
                                        <div className="flex items-center justify-between px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-2 bg-green-500 rounded-full shadow-sm shadow-green-100" />
                                                <h2 className="text-xl font-black text-gray-800 tracking-tight">ชั้น {floor}</h2>
                                            </div>
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                                {filteredRooms.filter(r => r.floor === floor).length} ห้อง
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {filteredRooms.filter(r => r.floor === floor).sort((a, b) => a.room_number.localeCompare(b.room_number)).map((room) => {
                                                const isWaitingVerify = waitingVerifyRoomIds.has(room.id);
                                                const isUnpaid = unpaidRoomIds.has(room.id);
                                                const isOccupied = room.status === 'occupied';
                                                const isMovingOut = movingOutRoomIds.has(room.id);
                                                const isReallyOverdue = overdueRoomIds.has(room.id);

                                                let theme = { border: 'border-gray-100', iconBg: 'bg-green-50 text-green-600', badge: 'bg-green-500 text-white', status: 'ว่าง', icon: KeyIcon, shadow: 'shadow-green-50/10' };
                                                if (isMovingOut) theme = { border: 'border-amber-100', iconBg: 'bg-amber-50 text-amber-600', badge: 'bg-amber-500 text-white', status: 'แจ้งออก', icon: ArrowRightOnRectangleIcon, shadow: 'shadow-amber-50/10' };
                                                else if (isReallyOverdue) theme = { border: 'border-orange-100', iconBg: 'bg-orange-50 text-orange-600', badge: 'bg-orange-500 text-white', status: 'ค้างชำระ', icon: ExclamationTriangleIcon, shadow: 'shadow-orange-50/10' };
                                                else if (isWaitingVerify || isUnpaid) theme = { border: 'border-sky-100', iconBg: 'bg-sky-50 text-sky-600', badge: 'bg-sky-500 text-white', status: 'รอชำระ', icon: ClockIcon, shadow: 'shadow-sky-50/10' };
                                                else if (isOccupied) theme = { border: 'border-blue-100', iconBg: 'bg-blue-50 text-blue-600', badge: 'bg-blue-600 text-white', status: 'มีคนพัก', icon: BuildingOfficeIcon, shadow: 'shadow-blue-50/10' };

                                                const activeTenant = room.tenants?.find(t => t.status === 'active');

                                                return (
                                                    <div
                                                        key={room.id}
                                                        onClick={() => router.push(`/dashboard/billing?roomId=${room.id}`)}
                                                        className={`group relative overflow-hidden bg-white rounded-[1.8rem] border-2 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer ${theme.border} ${theme.shadow}`}
                                                    >
                                                        <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest ${theme.badge} z-10`}>
                                                            {theme.status}
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-sm transition-transform group-hover:scale-110 ${theme.iconBg}`}>
                                                                <theme.icon className="w-5 h-5 stroke-[2.2]" />
                                                            </div>

                                                            {isOccupied && activeTenant?.line_user_id && (
                                                                <div className="absolute top-7 right-0 px-2.5 py-1 bg-green-500 text-white rounded-l-lg shadow-sm z-10 animate-in slide-in-from-right duration-500 border-y border-l border-green-600/20">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                                                                            <CheckIcon className="w-2.5 h-2.5 text-green-600 stroke-[4]" />
                                                                        </div>
                                                                        <span className="text-[10px] font-black leading-none tracking-tight">LINE Verified</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1.5">UNIT</p>
                                                                <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                                                    {room.room_number}
                                                                    {isOccupied && activeTenant?.line_user_id && (
                                                                        <span className="ml-2 text-sm text-green-600 font-bold">(ตรงกัน)</span>
                                                                    )}
                                                                </h3>
                                                                {isOccupied && activeTenant && (
                                                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <div className="relative">
                                                                                <UserIcon className="w-4 h-4 text-blue-500 shrink-0 bg-blue-50 rounded-md p-0.5" />
                                                                                {activeTenant.line_user_id && (
                                                                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white flex items-center justify-center">
                                                                                        <CheckIcon className="w-1.5 h-1.5 text-white stroke-[4]" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[12px] font-black text-gray-900 truncate tracking-tight">
                                                                                {activeTenant.name}
                                                                            </span>
                                                                        </div>
                                                                        {activeTenant.phone && (
                                                                            <div className="flex items-center gap-2">
                                                                                {activeTenant.line_user_id ? (
                                                                                    <div className="w-4 h-4 bg-green-50 rounded-md flex items-center justify-center shrink-0">
                                                                                        <ChatBubbleLeftRightIcon className="w-3 h-3 text-green-600" />
                                                                                    </div>
                                                                                ) : (
                                                                                    <DevicePhoneMobileIcon className="w-4 h-4 text-gray-400 shrink-0 bg-gray-50 rounded-md p-0.5" />
                                                                                )}
                                                                                <span className={`text-[11px] font-bold tracking-tighter ${activeTenant.line_user_id ? 'text-green-700' : 'text-slate-700'}`}>
                                                                                    {activeTenant.phone}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {activeTenant.planned_move_out_date && (
                                                                            <div className="flex items-center gap-2 px-1.5 py-1 bg-amber-50 rounded-lg border border-amber-100/50 w-fit">
                                                                                <CalendarDaysIcon className="w-3 h-3 text-amber-600" />
                                                                                <span className="text-[10px] font-black text-amber-700">
                                                                                    ย้ายออก: {formatThaiDate(activeTenant.planned_move_out_date)}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="pt-2 flex items-center justify-between border-t border-gray-50/80">
                                                                <span className="text-sm font-black text-slate-700">฿{(room.base_price?.toLocaleString() || '0')}</span>
                                                                <div className="w-6 h-6 bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                                                    <ChevronRightIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
