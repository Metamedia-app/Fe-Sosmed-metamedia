/**
 * ws-test-io.mjs - Test Socket.io real-time backend Metamedia
 */
import { io } from 'socket.io-client';

const BASE = 'https://besosmed-production.up.railway.app';
const API_BASE = `${BASE}/api/v1`;

const [, , NIM, PASSWORD] = process.argv;

if (!NIM || !PASSWORD) {
  console.error('\n❌  Usage: node ws-test-io.mjs <NIM> <PASSWORD>\n');
  process.exit(1);
}

const tag = (label) => `[${new Date().toLocaleTimeString('id-ID')}] ${label}`;

console.log(tag('🔐 Login...'));
let token, firstPostId;

try {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nim: NIM, password: PASSWORD }),
  });
  const data = await res.json();

  if (!res.ok) {
    console.error(tag('❌ Login gagal:'), data.message);
    process.exit(1);
  }

  token = data.data?.token || data.data?.access_token || data.token;
  console.log(tag('✅ Login Success. Token obtained.'));
} catch (e) {
  console.error(tag('❌ Login error:'), e.message);
  process.exit(1);
}

// Get post for testing
try {
  const res = await fetch(`${API_BASE}/posts`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = await res.json();
  firstPostId = data.data?.posts?.[0]?._id;
  console.log(tag(`📄 Post ID: ${firstPostId}`));
} catch (e) {}

console.log(tag('\n🔌 Connecting Socket.io...'));
const socket = io(BASE, {
  auth: { token },
  transports: ['websocket']
});

socket.on('connect', async () => {
  console.log(tag('✅ Socket.io CONNECTED! ID: ' + socket.id));

  // Wait 2s then comment
  await new Promise(r => setTimeout(r, 2000));
  
  if (firstPostId) {
    console.log(tag('\n💬 Posting test comment...'));
    try {
      const res = await fetch(`${API_BASE}/posts/${firstPostId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ body: `Test Socket.io comment ${Date.now()}` }),
      });
      console.log(tag('📦 API Response status:'), res.status);
    } catch (e) {
      console.error(tag('❌ Comment API error:'), e.message);
    }
  }
});

const events = ['new_comment', 'like_update', 'new_post'];
events.forEach(ev => {
  socket.on(ev, (data) => {
    console.log(tag(`🎉 EVENT RECEIVED [${ev}]:`), JSON.stringify(data).substring(0, 500));
  });
});

socket.on('connect_error', (err) => {
  console.error(tag('❌ Connection Error:'), err.message);
});

socket.on('disconnect', (reason) => {
  console.log(tag('🔌 Disconnected. Reason: ' + reason));
});

// Timeout
setTimeout(() => {
  console.log(tag('\n⏱️  Test finished (30s timeout). Exiting.'));
  process.exit(0);
}, 30000);
