
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


// ==========================================
// YEGI PPOB CENTER - COMPLETE MODULE
// ==========================================

const yegiStatus = $('#yegiStatus');
const yegiSummary = $('#yegiSummary');
const yegiResults = $('#yegiResults');

let yegiGamesCache = [];
let yegiCatalogCache = [];
let yegiCurrentTab = 'games';

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
      result.error || `Gateway gagal (${response.status}).`
    );
  }

  return result;
}

function yegiRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function yegiDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('id-ID');
}

function yegiValue(row, keys, fallback = null) {
  for (const key of keys) {
    const value = row?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) return value;
  }

  return fallback;
}

function yegiGameName(row) {
  return yegiValue(row, [
    'name',
    'game_name',
    'title',
    'product_name',
    'nama_game',
    'nama'
  ], 'Game tidak diketahui');
}

function yegiProductName(row) {
  return yegiValue(row, [
    'name',
    'product_name',
    'nama_produk',
    'title',
    'label',
    'nominal_label',
    'sku'
  ], 'Produk tanpa nama');
}

function yegiGameLogo(row) {
  const url = yegiValue(row, [
    'logo_url',
    'image_url',
    'icon_url',
    'thumbnail_url',
    'image'
  ]);

  if (
    typeof url === 'string' &&
    /^https?:\/\//i.test(url)
  ) {
    return `
      <img
        class="yegi-game-logo"
        src="${safe(url)}"
        alt="${safe(yegiGameName(row))}"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
      >
      <span class="yegi-logo-fallback" style="display:none">
        ${safe(yegiGameName(row).slice(0, 2).toUpperCase())}
      </span>
    `;
  }

  return `
    <span class="yegi-logo-fallback">
      ${safe(yegiGameName(row).slice(0, 2).toUpperCase())}
    </span>
  `;
}

function yegiPrice(row) {
  return yegiValue(row, [
    'sell_price',
    'selling_price',
    'price',
    'harga_jual',
    'final_price'
  ]);
}

function yegiCost(row) {
  return yegiValue(row, [
    'buy_price',
    'purchase_price',
    'cost_price',
    'modal',
    'harga_modal'
  ]);
}

function yegiProfit(row) {
  const explicit = yegiValue(row, [
    'profit',
    'profit_amount',
    'margin',
    'keuntungan'
  ]);

  if (explicit !== null) return Number(explicit);

  const sell = yegiPrice(row);
  const cost = yegiCost(row);

  if (sell === null || cost === null) return null;

  return Number(sell) - Number(cost);
}

function yegiActive(row) {
  const value = yegiValue(row, [
    'is_active',
    'active',
    'is_enabled'
  ], true);

  return value === true ||
    value === 1 ||
    value === 'true';
}

// ==========================================
// SEARCH DAN FILTER
// ==========================================

function yegiToolbar(tab) {
  return `
    <div class="yegi-toolbar">
      <input
        id="yegiSearch"
        type="search"
        placeholder="Cari ${tab === 'games' ? 'game' : tab === 'products' ? 'produk' : 'transaksi'}..."
        autocomplete="off"
      >

      <select id="yegiFilter">
        <option value="all">Semua data</option>
        <option value="active">Aktif / Berhasil</option>
        <option value="inactive">Nonaktif / Gagal</option>
      </select>
    </div>
  `;
}

function yegiApplyFilter() {
  const search = $('#yegiSearch');
  const filter = $('#yegiFilter');

  const keyword = (search?.value || '').toLowerCase();
  const filterValue = filter?.value || 'all';

  document.querySelectorAll(
    '#yegiResults [data-search]'
  ).forEach(card => {
    const text = card.dataset.search || '';
    const status = card.dataset.status || '';

    const matchText = text.includes(keyword);

    const matchStatus =
      filterValue === 'all' ||
      (filterValue === 'active' &&
        ['active', 'success', 'completed', 'berhasil', 'sukses'].includes(status)) ||
      (filterValue === 'inactive' &&
        ['inactive', 'failed', 'gagal', 'error'].includes(status));

    card.hidden = !(matchText && matchStatus);
  });
}

function yegiBindFilter() {
  $('#yegiSearch')?.addEventListener('input', yegiApplyFilter);
  $('#yegiFilter')?.addEventListener('change', yegiApplyFilter);
}

// ==========================================
// 1. RINGKASAN KEUANGAN
// ==========================================

async function yegiLoadSummary() {
  setYegiStatus('Mengambil ringkasan keuangan...');
  yegiResults.innerHTML = '';

  try {
    const result = await callPpobGateway('summary');
    const d = result.data || {};

    const metrics = [
      ['TOTAL TRANSAKSI', Number(d.total_transactions || 0).toLocaleString('id-ID')],
      ['OMZET', yegiRupiah(d.omzet)],
      ['PROFIT', yegiRupiah(d.profit)],
      ['BERHASIL', Number(d.status?.completed || 0).toLocaleString('id-ID')],
      ['GAGAL', Number(d.status?.failed || 0).toLocaleString('id-ID')],
      ['REFUND', Number(d.status?.refunded || 0).toLocaleString('id-ID')]
    ];

    yegiSummary.innerHTML = metrics.map(([label, value]) => `
      <article class="yegi-metric">
        <small>${label}</small>
        <strong>${value}</strong>
      </article>
    `).join('');

    setYegiStatus(
      `Ringkasan berhasil dimuat · ${d.period?.start_date || 'Semua data'} sampai ${d.period?.end_date || '-'}.`,
      'success'
    );

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

// ==========================================
// 2. TRANSAKSI TERBARU
// ==========================================

async function yegiLoadTransactions() {
  yegiCurrentTab = 'transactions';
  setYegiStatus('Mengambil transaksi terbaru...');
  yegiResults.innerHTML = '';

  try {
    const result = await callPpobGateway('transactions', {
      limit: 100
    });

    const rows = Array.isArray(result.data) ? result.data : [];

    if (!rows.length) {
      yegiResults.innerHTML =
        '<div class="office-order-empty">Belum ada transaksi.</div>';
      setYegiStatus('Tidak ada transaksi.', 'success');
      return;
    }

    yegiResults.innerHTML = yegiToolbar('transactions') +
      rows.map(row => {
        const invoice = yegiValue(row, [
          'invoice_code', 'invoice', 'id'
        ], '-');

        const status = String(row.status || '-').toLowerCase();

        const customer = yegiValue(row, [
          'customer_name_snapshot',
          'customer_name',
          'customer'
        ], 'Pelanggan');

        const product = yegiValue(row, [
          'product_name_snapshot',
          'product_name',
          'game_name_snapshot',
          'game_name'
        ], '-');

        const target = yegiValue(row, [
          'target_user_id',
          'customer_no',
          'destination',
          'target'
        ], '-');

        const price = yegiValue(row, [
          'sell_price_snapshot',
          'sell_price',
          'total_price'
        ], 0);

        return `
          <article
            class="office-order-card yegi-data-card"
            data-search="${safe(`${invoice} ${customer} ${product} ${target} ${status}`.toLowerCase())}"
            data-status="${safe(status)}"
          >
            <div class="office-order-head">
              <strong>${safe(invoice)}</strong>
              <span>${safe(row.status || '-')}</span>
            </div>

            <div class="office-order-meta">
              Pelanggan: ${safe(customer)}
            </div>

            <div class="office-order-meta">
              Produk: ${safe(product)}
            </div>

            <div class="office-order-meta">
              Tujuan: ${safe(target)}
              ${row.target_zone_id
                ? ` · Zona ${safe(row.target_zone_id)}`
                : ''}
            </div>

            <div class="office-order-foot">
              <strong>${yegiRupiah(price)}</strong>
              <small>${safe(yegiDate(row.created_at))}</small>
            </div>
          </article>
        `;
      }).join('');

    yegiBindFilter();
    setYegiStatus(`${rows.length} transaksi berhasil dimuat.`, 'success');

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

// ==========================================
// 3. DAFTAR PRODUK
// ==========================================

async function yegiLoadProducts() {
  yegiCurrentTab = 'products';
  setYegiStatus('Mengambil daftar produk...');
  yegiResults.innerHTML = '';

  try {
    const [productResult, gameResult] = await Promise.all([
      callPpobGateway('products'),
      callPpobGateway('games')
    ]);

    const products = Array.isArray(productResult.data)
      ? productResult.data : [];

    yegiGamesCache = Array.isArray(gameResult.data)
      ? gameResult.data : [];

    yegiCatalogCache = products;

    if (!products.length) {
      yegiResults.innerHTML =
        '<div class="office-order-empty">Belum ada produk.</div>';
      setYegiStatus('Produk: 0 data.', 'success');
      return;
    }

    yegiResults.innerHTML = yegiToolbar('products') +
      products.map(row => {
        const name = yegiProductName(row);
        const price = yegiPrice(row);
        const cost = yegiCost(row);
        const profit = yegiProfit(row);

        const gameId = yegiValue(row, [
          'game_id',
          'games_id'
        ]);

        const gameSlug = yegiValue(row, [
          'game_slug',
          'slug_game'
        ]);

        const gameNameDirect = yegiValue(row, [
          'game_name',
          'game_name_snapshot'
        ]);

        const game = yegiGamesCache.find(g =>
          (gameId && g.id === gameId) ||
          (gameSlug && g.slug === gameSlug)
        );

        const gameName = gameNameDirect ||
          (game ? yegiGameName(game) : 'Game tidak terhubung');

        const status = yegiActive(row) ? 'active' : 'inactive';

        const nominal = yegiValue(row, [
          'nominal_label',
          'nominal',
          'description',
          'detail'
        ]);

        const sku = yegiValue(row, [
          'sku',
          'code',
          'product_code'
        ], '-');

        return `
          <article
            class="office-order-card yegi-data-card"
            data-search="${safe(`${name} ${gameName} ${sku} ${nominal || ''}`.toLowerCase())}"
            data-status="${status}"
          >
            <div class="office-order-head">
              <strong>${safe(name)}</strong>
              <span>${status === 'active' ? 'Aktif' : 'Nonaktif'}</span>
            </div>

            <div class="office-order-meta">
              Game: ${safe(gameName)}
            </div>

            <div class="office-order-meta">
              SKU: ${safe(sku)}
            </div>

            ${nominal ? `
              <div class="office-order-meta">
                Nominal: ${safe(nominal)}
              </div>
            ` : ''}

            <div class="office-order-foot">
              <span>Jual: ${price !== null ? yegiRupiah(price) : 'Belum tersedia'}</span>
              <small>
                Profit: ${profit !== null ? yegiRupiah(profit) : 'Belum tersedia'}
              </small>
            </div>

            ${cost !== null ? `
              <div class="office-order-meta">
                Harga modal: ${yegiRupiah(cost)}
              </div>
            ` : ''}
          </article>
        `;
      }).join('');

    yegiBindFilter();
    setYegiStatus(`${products.length} produk berhasil dimuat.`, 'success');

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

// ==========================================
// 4. DAFTAR GAME + LOGO
// ==========================================

async function yegiLoadGames() {
  yegiCurrentTab = 'games';
  setYegiStatus('Mengambil daftar game...');
  yegiResults.innerHTML = '';

  try {
    const result = await callPpobGateway('games');
    const rows = Array.isArray(result.data) ? result.data : [];

    yegiGamesCache = rows;

    if (!rows.length) {
      yegiResults.innerHTML =
        '<div class="office-order-empty">Belum ada game.</div>';
      setYegiStatus('Game: 0 data.', 'success');
      return;
    }

    yegiResults.innerHTML = yegiToolbar('games') +
      rows.map(row => {
        const name = yegiGameName(row);
        const status = yegiActive(row) ? 'active' : 'inactive';

        return `
          <article
            class="office-order-card yegi-game-card"
            data-search="${safe(`${name} ${row.slug || ''}`.toLowerCase())}"
            data-status="${status}"
          >
            <div class="yegi-game-main">
              <div class="yegi-game-image">
                ${yegiGameLogo(row)}
              </div>

              <div class="yegi-game-info">
                <div class="office-order-head">
                  <strong>${safe(name)}</strong>
                  <span>${status === 'active' ? 'Aktif' : 'Nonaktif'}</span>
                </div>

                <div class="office-order-meta">
                  ${safe(row.slug || '-')}
                </div>
              </div>
            </div>

            <div class="office-order-meta">
              ${safe(row.id_instruction || 'Tidak ada instruksi UID.')}
            </div>

            <div class="office-order-meta">
              Zone ID:
              ${row.requires_zone_id ? 'Diperlukan' : 'Tidak diperlukan'}
            </div>
          </article>
        `;
      }).join('');

    yegiBindFilter();
    setYegiStatus(`${rows.length} game berhasil dimuat.`, 'success');

  } catch (error) {
    setYegiStatus(error.message, 'error');
  }
}

// ==========================================
// 5. EVENT BUTTONS
// ==========================================

$('#yegiLoadSummary')?.addEventListener(
  'click',
  yegiLoadSummary
);

$('#yegiLoadTransactions')?.addEventListener(
  'click',
  yegiLoadTransactions
);

$('#yegiLoadProducts')?.addEventListener(
  'click',
  yegiLoadProducts
);

$('#yegiLoadGames')?.addEventListener(
  'click',
  yegiLoadGames
);

// Status awal
setYegiStatus('Login admin untuk mengakses data PPOB.');

// ==============================
// LOGIN ADMIN
// ==============================

async function syncSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  currentSession = session;
  
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
