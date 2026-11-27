import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Public browser key only. The service-role key remains inside the Edge Function.
const SUPABASE_URL = 'https://nvmnbrsvybtviqwgmikc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bD5fNZ-Km0GF4ktAbd1LDg_nS1FSh3L';
const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/office-orders-read`;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (selector) => document.querySelector(selector);
const statusEl = $('#integrationStatus');
const loginPanel = $('#officeLoginPanel');
const ordersPanel = $('#officeOrdersPanel');
const ordersList = $('#officeOrdersList');
const loginForm = $('#officeLoginForm');
const refreshBtn = $('#refreshOfficeOrders');
const logoutBtn = $('#officeLogout');
const POLL_INTERVAL_MS = 30000;
let pollTimer = null;
let loadingOrders = false;

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.dataset.state = type;
}
function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function showOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = '<div class="office-order-empty">Belum ada pesanan.</div>';
    return;
  }
  ordersList.innerHTML = orders.map((order) => `
    <article class="office-order-card">
      <div class="office-order-head"><strong>${safe(order.produk)}</strong><span>${safe(order.status || 'Tanpa status')}</span></div>
      <div class="office-order-meta">ID: ${safe(order.id)}</div>
      <div class="office-order-meta">Tujuan: ${safe(order.tujuan)}</div>
      <div class="office-order-foot"><span>${safe(order.harga)}</span><small>${safe(order.created_at ? new Date(order.created_at).toLocaleString('id-ID') : '-')}</small></div>
    </article>`).join('');
}
async function loadOrders() {
  if (loadingOrders) return;
  loadingOrders = true;
  refreshBtn.disabled = true;
  setStatus('Mengambil pesanan dari website SakaPay…');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error('Sesi login tidak ditemukan. Login admin terlebih dahulu.');
    const response = await fetch(GATEWAY_URL, {
      method: 'GET',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error('Sesi tidak valid atau sudah kedaluwarsa. Login ulang.');
      if (response.status === 403) throw new Error('Akun ini belum terdaftar sebagai admin SakaPay.');
      throw new Error(result.error || `Gateway gagal (${response.status}).`);
    }
    const orders = Array.isArray(result.data) ? result.data : [];
    showOrders(orders);
    const taskSync = window.SakaOfficeTasks?.syncWebsiteOrders?.(orders) || { created: 0, updated: 0 };
    const coordination = window.SakaOfficeTasks?.runAldiCoordination?.({ silent: true }) || { created: 0, skipped: 0, checked: 0 };
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setStatus(`${result.meta?.count ?? orders.length} pesanan dimuat · ${taskSync.created} tugas PUTRA · ${coordination.created} tugas ALDI baru · sinkron ${time}. Otomatis aktif; mode baca-saja.`, 'success');
  } catch (error) {
    setStatus(error.message || 'Gagal mengambil pesanan.', 'error');
  } finally {
    loadingOrders = false;
    refreshBtn.disabled = false;
  }
}
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!document.hidden) loadOrders();
  }, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
async function syncSession() {
  const { data: { session } } = await supabase.auth.getSession();
  loginPanel.hidden = !!session;
  ordersPanel.hidden = !session;
  if (session) {
    setStatus(`Login sebagai ${session.user.email}.`);
    await loadOrders();
    startPolling();
  } else {
    stopPolling();
    setStatus('Belum login. Gunakan akun admin website SakaPay.');
  }
}
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#officeEmail').value.trim();
  const password = $('#officePassword').value;
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus('Memeriksa akun…');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $('#officePassword').value = '';
  submit.disabled = false;
  if (error) return setStatus(error.message, 'error');
  await syncSession();
});
refreshBtn.addEventListener('click', loadOrders);
logoutBtn.addEventListener('click', async () => {
  stopPolling();
  await supabase.auth.signOut();
  ordersList.innerHTML = '';
  await syncSession();
});
supabase.auth.onAuthStateChange(() => { syncSession(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pollTimer) loadOrders();
});
syncSession();
