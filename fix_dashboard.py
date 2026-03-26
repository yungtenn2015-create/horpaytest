import sys
import os

path = r'c:\Users\KSM\Desktop\horpay\horpaytest\src\app\dashboard\DashboardClient.tsx'

if not os.path.exists(path):
    print(f"File not found: {path}")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_marker = "/* ── Rooms Tab Content (Premium Redesign) ── */"
end_marker = "/* ── Settings Tab Content (NEW - Consolidated Single Page) ── */"

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i
    if end_marker in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    print(f"Found markers at {start_idx + 1} and {end_idx + 1}")
    
    # We replace from start_marker until just before end_marker.
    # The start_marker line itself should be replaced.
    
    new_content = [
        "                {/* ── Rooms Tab Content (Modular) ── */}\n",
        "                {activeTab === 'rooms' && (\n",
        "                    <RoomsTab\n",
        "                        rooms={rooms}\n",
        "                        selectedFloor={selectedFloor}\n",
        "                        selectedStatus={selectedStatus}\n",
        "                        setSelectedFloor={setSelectedFloor}\n",
        "                        setSelectedStatus={setSelectedStatus}\n",
        "                        waitingVerifyRoomIds={waitingVerifyRoomIds}\n",
        "                        unpaidRoomIds={unpaidRoomIds}\n",
        "                        overdueRoomIds={overdueRoomIds}\n",
        "                        movingOutRoomIds={movingOutRoomIds}\n",
        "                        router={router}\n",
        "                    />\n",
        "                )}\n",
        "\n"
    ]
    
    lines[start_idx:end_idx] = new_content
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully updated DashboardClient.tsx")
else:
    print(f"Markers not found. Start: {start_idx}, End: {end_idx}")
    sys.exit(1)
