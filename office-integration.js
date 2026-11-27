
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Public browser key only. Service role tetap di server.
const SUPABASE_URL = 'https://nvmnbrsvybtviqwgmikc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bD5fNZ-Km0GF4ktAbd1LDg_nS1FSh3L';

const GATEWAY_URL = `${SUPABASE_URL}/functions/v1/office-orders-read`;
const PPOB_GATEWAY_URL = `${SUPABASE_URL}/functions/v1/ppob-gateway`;

let currentSession = null;

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
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function showOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML =
      '<div class="office-order-empty">Belum ada pesanan.</div>';
    return;
  }

  ordersList.innerHTML = orders.map((order) => `
    <article class="office-order-card">
      <div class="office-order-head">
        <strong>${safe(order.produk)}</strong>
        <span>${safe(order.status || 'Tanpa status')}</span>
      </div>
      <div class="office-order-meta">ID: ${safe(order.id)}</div>
      <div class="office-order-meta">Tujuan: ${safe(order.tujuan)}</div>
      <div class="office-order-foot">
        <span>${safe(order.harga)}</span>
        <small>${safe(order.created_at
          ? new Date(order.created_at).toLocaleString('id-ID')
          : '-')}</small>
      </div>
    </article>
  `).join('');
}

async function loadOrders() {
  if (loadingOrders) return;

  loadingOrders = true;
  refreshBtn.disabled = true;
  setStatus('Mengambil pesanan dari website SakaPay…');

  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error || !session) {
      throw new Error(
        'Sesi login tidak ditemukan. Login admin terlebih dahulu.'
      );
    }

    const response = await fetch(GATEWAY_URL, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`
      }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Sesi tidak valid. Login ulang.');
      }

      if (response.status === 403) {
        throw new Error('Akun ini belum terdaftar sebagai admin SakaPay.');
      }

      throw new Error(result.error || `Gateway gagal (${response.status}).`);
    }

    const orders = Array.isArray(result.data) ? result.data : [];

    showOrders(orders);

    const taskSync =
      await (window.SakaOfficeTasks?.syncWebsiteOrders?.(orders) ||
      Promise.resolve({ created: 0, updated: 0 }));

    const coordination =
      await (window.SakaOfficeTasks?.runAldiCoordination?.({
        silent: true
      }) || Promise.resolve({
        created: 0,
        skipped: 0,
        checked: 0
      }));

    const time = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });

    setStatus(
      `${result.meta?.count ?? orders.length} pesanan dimuat · ` +
      `${taskSync.created} tugas PUTRA · ` +
      `${coordination.created} tugas ALDI baru · ` +
      `sinkron ${time}. Mode baca-saja.`,
      'success'
    );

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

// ==============================
// YEGI PPOB INTEGRATION
// ==============================

const yegiStatus = $('#yegiStatus');
const yegiSummary = $('#yegiSummary');
const yegiResults = $('#yegiResults');

function setYegiStatus(message, type = '') {
  if (!yegiStatus) return;

  yegiStatus.textContent = message;
  yegiStatus.dataset.state = type;
}

async function callPpobGateway(action, extra = {}) {
  if (!currentSession) {
    throw new Error('Login admin terlebih dahulu.');
  }

  const response = await fetch(PPOB_GATEWAY_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${currentSession.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, ...extra })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.error || `PPOB Gateway gagal (${response.status}).`
    );
  }

  return result;
}

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

// RINGKASAN KEUANGAN
async function yegiLoadSummary() {
  setYegiStatus('YEGI sedang membaca ringkasan PPOB…');
  yegiResults.innerHTML = '';

  try {
    const result = await callPpobGateway('summary');
    const d = result.data;

    yegiSummary.innerHTML = `
      <article class="yegi-metric">
        <small>TOTAL TRANSAKSI</small>
        <strong>${Number(d.total_transactions || 0).toLocaleString('id-ID')}</strong>
      </article>

      <article class="yegi-metric">
        <small>OMZET</small>
        <strong>${rupiah(d.omzet)}</strong>
      </article>

      <article class="yegi-metric">
        <small>PROFIT</small>
        <strong>${rupiah(d.profit)}</strong>
      </article>

      <article class="yegi-metric">
        <small>BERHASIL</small>
        <strong>${Number(d.status?.completed || 0).toLocaleString('id-ID')}</strong>
      </article>

      <article class="yegi-metric">
        <small>GAGAL</small>
        <strong>${Number(d.status?.failed || 0).toLocaleString('id-ID')}</strong>
      </article>

      <article class="yegi-metric">
        <small>REFUND</small>
        <strong>${Number(d.status?.refunded || 0).toLocaleString('id-ID')}</strong>
      </article>
    `;

    const period = d.period
      ? `${d.period.start_date} sampai ${d.period.end_date}`
      : 'Periode tidak tersedia';

    setYegiStatus(
      `Data berhasil dibaca · ${period}` +
      `${d.capped_at ? ` · batas ${d.capped_at.toLocaleString('id-ID')} baris` : ''}.`,
      'success'
    );

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

// TRANSAKSI TERBARU
async function yegiLoadTransactions() {
  setYegiStatus('Mengambil transaksi terbaru…');
  yegiResults.innerHTML = '';

  try {
    const result = await callPpobGateway('transactions', {
      limit: 30
    });

    if (!result.data?.length) {
      yegiResults.innerHTML =
        '<div class="office-order-empty">Belum ada transaksi.</div>';
    } else {
      yegiResults.innerHTML = result.data.map(row => `
        <article class="office-order-card">
          <div class="office-order-head">
            <strong>${safe(row.invoice_code || row.id)}</strong>
            <span>${safe(row.status || '-')}</span>
          </div>

          <div class="office-order-meta">
            ${safe(row.customer_name_snapshot || 'Pelanggan')}
            · ${safe(row.product_name_snapshot || row.game_name_snapshot || '-')}
          </div>

          <div class="office-order-meta">
            Tujuan: ${safe(row.target_user_id || '-')}
            ${row.target_zone_id
              ? `(${safe(row.target_zone_id)})`
              : ''}
          </div>

          <div class="office-order-foot">
            <span>${rupiah(row.sell_price_snapshot)}</span>
            <small>${safe(row.created_at
              ? new Date(row.created_at).toLocaleString('id-ID')
              : '-')}</small>
          </div>
        </article>
      `).join('');
    }

    setYegiStatus(
      `${result.count ?? result.data?.length ?? 0} transaksi dimuat.`,
      'success'
    );

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

// PRODUK DAN GAME
async function yegiLoadCatalog(action, label) {
  setYegiStatus(`Mengambil ${label.toLowerCase()}…`);
  yegiResults.innerHTML = '';

  try {
    const result = await callPpobGateway(action);

    yegiResults.innerHTML = result.data?.length
      ? result.data.map(row => `
          <article class="office-order-card">
            <div class="office-order-head">
              <strong>${safe(row.name)}</strong>
              <span>${row.is_active ? 'Aktif' : 'Nonaktif'}</span>
            </div>

            ${row.nominal_label
              ? `<div class="office-order-meta">${safe(row.nominal_label)}</div>`
              : ''}

            ${row.sell_price != null
              ? `<div class="office-order-foot">
                  <span>Harga jual ${rupiah(row.sell_price)}</span>
                  <small>Profit ${rupiah(row.profit)}</small>
                </div>`
              : ''}
          </article>
        `).join('')
      : '<div class="office-order-empty">Data kosong.</div>';

    setYegiStatus(
      `${result.count ?? result.data?.length ?? 0} ${label.toLowerCase()} dimuat.`,
      'success'
    );

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

$('#yegiLoadSummary')?.addEventListener('click', yegiLoadSummary);

$('#yegiLoadTransactions')?.addEventListener(
  'click',
  yegiLoadTransactions
);

$('#yegiLoadProducts')?.addEventListener(
  'click',
  () => yegiLoadCatalog('products', 'Produk')
);

$('#yegiLoadGames')?.addEventListener(
  'click',
  () => yegiLoadCatalog('games', 'Game')
);

// ==============================
// LOGIN ADMIN
// ==============================

async function syncSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  currentSession = session;

  console.log('OFFICE LOGIN UID:', session?.user?.id);
  if (session) alert('UID LOGIN: ' + session.user.id);

  loginPanel.hidden = !!session;
  ordersPanel.hidden = !session;

  if (session) {
    setStatus(
  session.user.id === '12c32d56-f060-4295-898a-5c130444aa07'
    ? 'UID ADMIN COCOK ✓'
    : 'UID ADMIN TIDAK COCOK ✗'
);
    await loadOrders();
    startPolling();
  } else {
    stopPolling();
    setStatus('Belum login. Gunakan akun admin SakaPay.');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = $('#officeEmail').value.trim();
  const password = $('#officePassword').value;

  const submit = loginForm.querySelector('button[type="submit"]');

  submit.disabled = true;
  setStatus('Memeriksa akun…');

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  $('#officePassword').value = '';
  submit.disabled = false;

  if (error) {
    return setStatus(error.message, 'error');
  }

  await syncSession();

  window.dispatchEvent(
    new Event('sakapay-office-session-changed')
  );
});

refreshBtn.addEventListener('click', loadOrders);

logoutBtn.addEventListener('click', async () => {
  stopPolling();

  await supabase.auth.signOut();

  ordersList.innerHTML = '';

  await syncSession();

  window.dispatchEvent(
    new Event('sakapay-office-session-changed')
  );
});

supabase.auth.onAuthStateChange(() => {
  syncSession();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pollTimer) loadOrders();
});

syncSession();
