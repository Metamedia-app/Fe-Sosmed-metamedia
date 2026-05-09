import { io } from 'socket.io-client';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZGIzNTQ4ZmYzMDZjZGVkMTg0MTIxMiIsIm5pbSI6IjIyNTUyMDIxMTAwMyIsIm5hbWEiOiJGYWphciBLdXJuaWEgUHV0cmEiLCJwcm9ncmFtX3N0dWRpIjoiUzEgSW5mb3JtYXRpa2EiLCJzdGF0dXNfbWFoYXNpc3dhIjoiQUtUSUYiLCJpYXQiOjE3NzYwNjcwNzUsImV4cCI6MTc3ODY1OTA3NX0.rDO4KLCd_UyTa-OcCiNHIuRMHaU8_xQPvbG3KtuiBiE";
const BASE = 'https://besosmed-production.up.railway.app';
const API_BASE = `${BASE}/api/v1`;

async function testRealtime() {
  console.log("🔌 Connecting to Socket.io...");
  const socket = io(BASE, {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on("connect", async () => {
    console.log("✅ Socket connected:", socket.id);
    
    // 1. Fetch group list
    console.log("\n📦 Fetching groups...");
    const resGroups = await fetch(`${API_BASE}/chat-matkul/my-groups`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const groupsData = await resGroups.json();
    const groupId = groupsData?.data?.[0]?._id;
    
    if (!groupId) {
      console.log("❌ No groups found to test.");
      setTimeout(() => process.exit(0), 1000);
      return;
    }
    console.log("✅ Found group:", groupId);

    // 2. Send a message to the group
    console.log(`\n💬 Sending test message to group ${groupId}...`);
    
    // Simulate FormData upload for text
    const formData = new FormData();
    formData.append('conversationId', groupId);
    formData.append('body', `Test socket realtime ${Date.now()}`);

    try {
      const resSend = await fetch(`${API_BASE}/chat-matkul/messages`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      console.log("📦 Send response status:", resSend.status);
    } catch (e) {
      console.error("❌ Send error:", e);
    }
  });

  // Listen to all events
  socket.onAny((eventName, ...args) => {
    console.log(`\n[SOCKET EVENT RECEIVED] ${eventName}:`, JSON.stringify(args, null, 2));
  });

  setTimeout(() => {
    console.log("\n⏱️ Finished listening (15s timeout). Exiting.");
    process.exit(0);
  }, 15000);
}

testRealtime();
