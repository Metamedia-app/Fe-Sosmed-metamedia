/**
 * ws-test.mjs - Test WebSocket real-time backend Metamedia
 * 
 * Cara pakai: node ws-test.mjs <NIM> <PASSWORD>
 * Contoh:     node ws-test.mjs 2024001234 password123
 */

const BASE = 'https://besosmed-production.up.railway.app/api/v1';
const WS_URL = 'wss://besosmed-production.up.railway.app/api/v1/ws';

const [, , NIM, PASSWORD] = process.argv;

if (!NIM || !PASSWORD) {
  console.error('\n❌  Usage: node ws-test.mjs <NIM> <PASSWORD>\n');
  process.exit(1);
}

const tag = (label) => `[${new Date().toLocaleTimeString('id-ID')}] ${label}`;

// ── 1. Login ──────────────────────────────────────────────────────────────────
console.log(tag('🔐 Login...'));
let token, firstPostId;

try {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nim: NIM, password: PASSWORD }),
  });
  const data = await res.json();

  console.log(tag('📦 Login response:'), JSON.stringify(data).substring(0, 400));

  if (!res.ok) {
    console.error(tag('❌ Login gagal:'), data.message || 'Unknown');
    process.exit(1);
  }

  token = data.data?.token || data.data?.access_token || data.token;
  if (!token) {
    console.error(tag('❌ Token tidak ditemukan! Keys di data:'), Object.keys(data.data || data));
    process.exit(1);
  }
  console.log(tag('✅ Token OK:'), token.substring(0, 30) + '...');
} catch (e) {
  console.error(tag('❌ Fetch login error:'), e.message);
  process.exit(1);
}

// ── 2. Ambil post pertama ──────────────────────────────────────────────────────
console.log(tag('\n📄 Ambil daftar post...'));
try {
  const res = await fetch(`${BASE}/posts`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = await res.json();
  firstPostId = data.data?.posts?.[0]?._id;
  if (firstPostId) {
    console.log(tag(`✅ Post ID: ${firstPostId}`));
  } else {
    console.warn(tag('⚠️  Tidak ada post ditemukan.'));
  }
} catch (e) {
  console.error(tag('❌ Fetch posts error:'), e.message);
}

// ── 3. Connect WebSocket ───────────────────────────────────────────────────────
console.log(tag('\n🔌 Connecting WebSocket...'));

// Node.js 18+ punya native WebSocket, tapi perlu flag --experimental-websocket
// Fallback ke tanpa WebSocket (cek dulu)
let ws;
try {
  ws = new WebSocket(`${WS_URL}?token=${token}`);
} catch (e) {
  console.error(tag('❌ WebSocket tidak tersedia di Node.js ini.'));
  console.error('   Jalankan dengan: node --experimental-websocket ws-test.mjs <nim> <pass>');
  console.error('   ATAU pakai Node.js 22+');
  process.exit(1);
}

let wsConnected = false;
let eventsReceived = [];

ws.addEventListener('open', async () => {
  wsConnected = true;
  console.log(tag('✅ WebSocket CONNECTED!'));

  // Kirim ping
  ws.send(JSON.stringify({ type: 'ping' }));
  console.log(tag('→ Sent ping'));

  // Tunggu 2 detik lalu posting komentar
  await new Promise((r) => setTimeout(r, 2000));

  if (firstPostId) {
    console.log(tag('\n💬 Kirim komentar test ke post ' + firstPostId));
    try {
      const res = await fetch(`${BASE}/posts/${firstPostId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ body: `Test WS comment ${Date.now()}` }),
      });
      const data = await res.json();
      console.log(tag('📦 POST /comments response:'), JSON.stringify(data).substring(0, 500));
      console.log(tag('   result.data._id:'), data.data?._id || '❌ undefined');
      console.log(tag('   result.data.comment:'), JSON.stringify(data.data?.comment || 'tidak ada'));
      console.log(tag('\n⏳ Menunggu WS event selama 5 detik...'));
    } catch (e) {
      console.error(tag('❌ Error kirim komentar:'), e.message);
    }
  }

  // Tunggu 5 detik lagi untuk tangkap event
  await new Promise((r) => setTimeout(r, 5000));

  console.log(tag('\n📊 HASIL:'));
  if (eventsReceived.length === 0) {
    console.log(tag('❌ TIDAK ADA event WebSocket yang diterima!'));
    console.log(tag('   Kemungkinan penyebab:'));
    console.log(tag('   1. Backend tidak mengirim event setelah komentar di-POST'));
    console.log(tag('   2. WebSocket endpoint berbeda / event type berbeda'));
    console.log(tag('   3. Backend perlu 2 koneksi WS (satu kirim, satu terima)'));
  } else {
    console.log(tag(`✅ ${eventsReceived.length} event diterima:`));
    eventsReceived.forEach((e, i) => console.log(`   [${i + 1}]`, e));
  }

  ws.close();
  process.exit(0);
});

ws.addEventListener('message', (e) => {
  const raw = typeof e.data === 'string' ? e.data : e.data.toString();
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === 'pong') {
      console.log(tag('🏓 Pong diterima → WebSocket HIDUP & bisa tukar pesan'));
      return;
    }
    eventsReceived.push(raw);
    console.log(tag('🎉 EVENT DITERIMA:'), raw.substring(0, 500));
  } catch (_) {
    eventsReceived.push(raw);
    console.log(tag('📨 Message (raw):'), raw);
  }
});

ws.addEventListener('error', (e) => {
  console.error(tag('❌ WebSocket ERROR:'), e.message || e.type || 'Unknown');
});

ws.addEventListener('close', (e) => {
  console.log(tag(`🔌 WebSocket CLOSED. Code: ${e.code} | Reason: "${e.reason || '-'}"`));
  if (e.code === 1006) {
    console.log(tag('   Code 1006 = Koneksi ditutup paksa. Kemungkinan token salah OR endpoint WS tidak ada.'));
  }
  if (!wsConnected) {
    console.log(tag('❌ WebSocket tidak pernah terhubung! Backend mungkin tidak support WS di URL ini.'));
    process.exit(1);
  }
});

// Timeout global
setTimeout(() => {
  console.error(tag('\n⏱️  TIMEOUT 30 detik. Program selesai.'));
  process.exit(1);
}, 30000);
