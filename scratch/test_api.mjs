import { io } from 'socket.io-client';

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZGIzNTQ4ZmYzMDZjZGVkMTg0MTIxMiIsIm5pbSI6IjIyNTUyMDIxMTAwMyIsIm5hbWEiOiJGYWphciBLdXJuaWEgUHV0cmEiLCJwcm9ncmFtX3N0dWRpIjoiUzEgSW5mb3JtYXRpa2EiLCJzdGF0dXNfbWFoYXNpc3dhIjoiQUtUSUYiLCJpYXQiOjE3NzYwNjcwNzUsImV4cCI6MTc3ODY1OTA3NX0.rDO4KLCd_UyTa-OcCiNHIuRMHaU8_xQPvbG3KtuiBiE";

async function checkApi() {
  console.log("Fetching /api/v1/chat/unread-summary...");
  try {
    const response = await fetch("https://besosmed-production.up.railway.app/api/v1/chat/unread-summary", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    const result = await response.json();
    console.log("Unread Summary Response:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Error fetching unread summary:", e);
  }
}

function listenSocket() {
  console.log("Connecting to Socket.io...");
  const socket = io("https://besosmed-production.up.railway.app", {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  // Listen to all events
  socket.onAny((eventName, ...args) => {
    console.log(`[SOCKET EVENT] ${eventName}:`, JSON.stringify(args, null, 2));
  });

  setTimeout(() => {
    console.log("Closing connection.");
    socket.disconnect();
  }, 15000); // listen for 15 seconds
}

checkApi().then(listenSocket);
