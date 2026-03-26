const fs = require('fs');
const path = require('path');

const filePath = 'src/app/dashboard/DashboardClient.tsx';
if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Relaxed markers to avoid indentation issues
const startMarker = "Rooms Tab Content (Premium Redesign)";
const endMarker = "Settings Tab Content (NEW - Consolidated Single Page)";

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startMarker)) startIdx = i;
    if (lines[i].includes(endMarker)) {
        endIdx = i;
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    console.log(`Found markers at lines ${startIdx + 1} and ${endIdx + 1}`);
    
    const newContent = [
        "                {/* ── Rooms Tab Content (Modular) ── */}",
        "                {activeTab === 'rooms' && (",
        "                    <RoomsTab",
        "                        rooms={rooms}",
        "                        selectedFloor={selectedFloor}",
        "                        selectedStatus={selectedStatus}",
        "                        setSelectedFloor={setSelectedFloor}",
        "                        setSelectedStatus={setSelectedStatus}",
        "                        waitingVerifyRoomIds={waitingVerifyRoomIds}",
        "                        unpaidRoomIds={unpaidRoomIds}",
        "                        overdueRoomIds={overdueRoomIds}",
        "                        movingOutRoomIds={movingOutRoomIds}",
        "                        router={router}",
        "                    />",
        "                )}",
        ""
    ];
    
    // Replace from startIdx until endIdx (exclusive of endIdx)
    lines.splice(startIdx, endIdx - startIdx, ...newContent);
    
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log("Successfully updated DashboardClient.tsx");
} else {
    console.error(`Markers not found. Start: ${startIdx}, End: ${endIdx}`);
    process.exit(1);
}
