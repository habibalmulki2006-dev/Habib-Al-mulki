import { PHOTO_ANGLE_CONFIG } from '../data/seed.js';
import { filterAndSortLivestock } from '../utils/domain.js';
import { escapeHtml, formatRupiah } from '../utils/formatters.js';
import { ROLES, canAccessTab, getRoleLabel } from '../utils/rbac.js';
import { sanitizeHexColor, sanitizeImageSrc } from '../utils/security.js';
import { getLivestockSVG } from './svgLivestock.js';

export function renderHeaderAndMetrics(state) {
  const user = state.currentUser;
  const role = user?.role || null;

  if (!canAccessTab(role, state.activeTab)) {
    state.activeTab = 'katalog';
  }

  const heldTotal =
    typeof state.heldEscrowTotal === 'number' && !user
      ? state.heldEscrowTotal
      : state.userOrders
          .filter((o) => !o.isEscrowReleased)
          .reduce((sum, o) => sum + Number(o.totalPaid || 0), 0);

  const pendingCount = state.adminVerifications.filter(
    (v) => v.status === 'Menunggu Verifikasi'
  ).length;

  const totalTernakEl = document.getElementById('stat-total-ternak');
  if (totalTernakEl) totalTernakEl.textContent = `${state.livestockData.length} Ekor`;

  const headerEscrowEl = document.getElementById('header-escrow-total');
  if (headerEscrowEl) headerEscrowEl.textContent = formatRupiah(heldTotal);

  const navOrderEl = document.getElementById('nav-order-count');
  if (navOrderEl) navOrderEl.textContent = String(state.userOrders.length);

  const adminBadgeEl = document.getElementById('admin-pending-badge');
  if (adminBadgeEl) adminBadgeEl.textContent = String(pendingCount);

  const adminHeldEl = document.getElementById('admin-escrow-held');
  if (adminHeldEl) adminHeldEl.textContent = formatRupiah(heldTotal);

  const adminReleasedEl = document.getElementById('admin-escrow-released');
  if (adminReleasedEl) adminReleasedEl.textContent = formatRupiah(state.escrowReleasedTotal);

  const adminQueueEl = document.getElementById('admin-queue-count');
  if (adminQueueEl) adminQueueEl.textContent = `${pendingCount} Pengajuan`;

  // Role-gated navigation tabs
  document.getElementById('nav-tab-pesanan')?.classList.toggle('is-hidden', !canAccessTab(role, 'pesanan'));
  document.getElementById('nav-tab-peternak')?.classList.toggle('is-hidden', !canAccessTab(role, 'peternak'));
  document.getElementById('nav-tab-admin')?.classList.toggle('is-hidden', !canAccessTab(role, 'admin'));

  // Header auth controls
  const userInfoEl = document.getElementById('header-user-info');
  const userNameEl = document.getElementById('header-user-name');
  const userRoleEl = document.getElementById('header-user-role');
  const jualBtnEl = document.getElementById('header-jual-btn');
  const loginBtnEl = document.getElementById('header-login-btn');
  const logoutBtnEl = document.getElementById('header-logout-btn');
  const footerResetEl = document.getElementById('footer-reset-btn');

  if (user) {
    userInfoEl?.classList.remove('is-hidden');
    if (userNameEl) userNameEl.textContent = user.displayName || user.username;
    if (userRoleEl) {
      userRoleEl.textContent = getRoleLabel(role);
      userRoleEl.className = `header-role-tag ${
        role === ROLES.ADMIN
          ? 'header-role-tag--admin'
          : role === ROLES.OPERATOR
            ? 'header-role-tag--operator'
            : ''
      }`;
    }
    jualBtnEl?.classList.toggle('is-hidden', !canAccessTab(role, 'peternak'));
    loginBtnEl?.classList.add('is-hidden');
    logoutBtnEl?.classList.remove('is-hidden');
  } else {
    userInfoEl?.classList.add('is-hidden');
    jualBtnEl?.classList.add('is-hidden');
    loginBtnEl?.classList.remove('is-hidden');
    logoutBtnEl?.classList.add('is-hidden');
  }

  footerResetEl?.classList.toggle('is-hidden', role !== ROLES.ADMIN);

  document.querySelectorAll('.nav-link').forEach((btn) => {
    const isActive = btn.getAttribute('data-tab') === state.activeTab;
    btn.classList.toggle('is-active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  ['katalog', 'patungan', 'pesanan', 'peternak', 'admin'].forEach((tab) => {
    const section = document.getElementById(`view-${tab}`);
    const allowed = canAccessTab(role, tab);
    if (section) section.classList.toggle('is-hidden', !allowed || tab !== state.activeTab);
  });
}

export function renderCatalogView(state) {
  const filtered = filterAndSortLivestock(
    state.livestockData,
    state.filters,
    state.negotiatedPrices
  );

  const countEl = document.getElementById('catalog-count');
  if (countEl) countEl.textContent = String(filtered.length);

  const grid = document.getElementById('catalog-grid');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-card">
        <h3>Tidak ada ternak yang cocok dengan filter pencarian</h3>
        <p class="section-desc">Coba ubah kabupaten lokasi kandang atau reset filter pencarian Anda.</p>
        <button type="button" class="btn btn-primary btn-sm" data-action="reset-filters">
          Reset Filter Pencarian
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const dealPrice = state.negotiatedPrices[item.id];
      const activePrice = dealPrice || item.harga;
      const hargaPerKg = Math.round(activePrice / item.bobot);
      const isSold = item.status === 'Terjual';
      const filledSlots = item.slots ? item.slots.filter((s) => s.paid).length : 0;

      const statusClass =
        item.status === 'Dipesan (DP)'
          ? 'card-media-status card-media-status--dp'
          : isSold
            ? 'card-media-status card-media-status--sold'
            : 'card-media-status';

      const safeSidePhoto = sanitizeImageSrc(item.photos?.samping);
      const mediaHtml = safeSidePhoto
        ? `<img src="${safeSidePhoto}" alt="${escapeHtml(item.nama)}" class="card-media-img" referrerpolicy="no-referrer" />`
        : getLivestockSVG(item.jenis, sanitizeHexColor(item.colorHex), 'samping');

      const extraInfo = item.patungan
        ? `Patungan ${filledSlots}/7`
        : item.titipRawat
          ? 'Titip Rawat'
          : 'Siap Antar';

      return `
        <article class="livestock-card">
          <div>
            <button
              type="button"
              class="card-media-trigger"
              data-action="open-detail"
              data-id="${escapeHtml(item.id)}"
              data-subtab="info"
              aria-label="Lihat detail ${escapeHtml(item.nama)}"
            >
              <span class="${statusClass}">${escapeHtml(item.status)} · SKKH</span>
              <span class="card-media-visual">${mediaHtml}</span>
            </button>

            <div class="card-body">
              <div class="card-meta-line">
                <span class="meta-accent">${escapeHtml(item.jenis)}</span>
                <span aria-hidden="true"> · </span>
                <span>${escapeHtml(item.peruntukan)}</span>
                <span aria-hidden="true"> · </span>
                <span>${escapeHtml(item.lokasi)}</span>
              </div>

              <button
                type="button"
                class="card-title-btn"
                data-action="open-detail"
                data-id="${escapeHtml(item.id)}"
                data-subtab="info"
              >
                ${escapeHtml(item.nama)}
              </button>

              <div class="card-specs-line">
                <span class="tabular-nums"><strong>${item.bobot} kg</strong> · ${escapeHtml(item.usia)}</span>
                <span class="tabular-nums">${escapeHtml(extraInfo)}</span>
              </div>

              <div class="card-farmer-line">
                ${escapeHtml(item.peternak)} · KYC Terverifikasi
              </div>
            </div>
          </div>

          <div class="card-footer">
            <div>
              <div class="card-price-note ${dealPrice ? 'card-price-note--deal' : ''} tabular-nums">
                ${dealPrice ? 'Harga Deal Nego' : `Est. ${formatRupiah(hargaPerKg)}/kg`}
              </div>
              <div class="card-price tabular-nums">${formatRupiah(activePrice)}</div>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="btn btn-secondary btn-xs"
                data-action="open-detail"
                data-id="${escapeHtml(item.id)}"
                data-subtab="nego"
                aria-label="Nego harga ${escapeHtml(item.nama)}"
                ${isSold ? 'disabled' : ''}
              >
                Nego
              </button>
              <button
                type="button"
                class="btn btn-primary btn-xs"
                data-action="open-detail"
                data-id="${escapeHtml(item.id)}"
                data-subtab="info"
                aria-label="Detail dan beli ${escapeHtml(item.nama)}"
                ${isSold ? 'disabled' : ''}
              >
                ${isSold ? 'Terjual' : 'Detail & Beli'}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderPatunganView(state) {
  const grid = document.getElementById('patungan-grid');
  if (!grid) return;

  const patunganItems = state.livestockData.filter((item) => item.patungan);
  if (patunganItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-card">
        <h3>Belum ada ternak patungan yang tersedia</h3>
        <p class="section-desc">Tambahkan ternak kurban dari Portal Peternak dengan opsi Patungan 7 Slot aktif.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = patunganItems
    .map((item) => {
      const activePrice = state.negotiatedPrices[item.id] || item.harga;
      const pricePerSlot = Math.ceil(activePrice / 7);
      const filledCount = item.slots.filter((s) => s.paid).length;
      const openCount = 7 - filledCount;
      const isSold = item.status === 'Terjual';
      const isUnavailable = openCount === 0 || isSold;

      const safePatunganPhoto = sanitizeImageSrc(item.photos?.samping);
      const mediaHtml = safePatunganPhoto
        ? `<img src="${safePatunganPhoto}" alt="${escapeHtml(item.nama)}" class="card-media-img" referrerpolicy="no-referrer" />`
        : getLivestockSVG(item.jenis, sanitizeHexColor(item.colorHex), 'samping');

      return `
        <article class="patungan-card">
          <div class="patungan-head">
            <div class="patungan-thumb">${mediaHtml}</div>
            <div>
              <div class="card-meta-line">
                <span class="meta-accent">${escapeHtml(item.jenis)}</span>
                <span aria-hidden="true"> · </span>
                <span class="tabular-nums">${item.bobot} kg</span>
                <span aria-hidden="true"> · </span>
                <span>${escapeHtml(item.lokasi)}</span>
              </div>
              <h3 class="card-heading" style="margin-top:4px;">${escapeHtml(item.nama)}</h3>
              <p class="card-farmer-line" style="margin-top:4px;">
                ${escapeHtml(item.peternak)} · <span class="font-mono">${escapeHtml(item.skkh)}</span>
              </p>
              <div style="margin-top:8px;">
                <strong class="card-price tabular-nums">${formatRupiah(pricePerSlot)}</strong>
                <span class="card-price-note tabular-nums"> / 1 Slot (Total ${formatRupiah(activePrice)})</span>
              </div>
            </div>
          </div>

          <div class="patungan-slots-panel">
            <div class="patungan-slots-header">
              <span class="tabular-nums">Status Kuota Patungan (${filledCount}/7 Terisi)</span>
              <span class="${!isUnavailable ? 'status-text--ok' : 'status-text--warn'} tabular-nums">
                ${isSold ? 'Sudah Terjual' : openCount > 0 ? `Tersisa ${openCount} Slot Kosong` : 'Kuota Penuh'}
              </span>
            </div>

            <div class="patungan-slots-list">
              ${item.slots
                .map(
                  (slot) => `
                  <div class="slot-row ${slot.paid ? '' : 'slot-row--open'}">
                    <span class="slot-name">
                      <strong class="tabular-nums">#${slot.no}</strong>
                      ${slot.paid ? escapeHtml(slot.name) : 'Slot Kosong Tersedia'}
                    </span>
                    <span class="slot-status">${slot.paid ? 'Lunas' : 'Buka'}</span>
                  </div>
                `
                )
                .join('')}
            </div>
          </div>

          <div class="patungan-footer">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              data-action="open-detail"
              data-id="${escapeHtml(item.id)}"
              data-subtab="info"
            >
              Cek SKKH &amp; Gigi
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              style="flex:1;"
              data-action="open-checkout-direct"
              data-id="${escapeHtml(item.id)}"
              data-scheme="patungan"
              ${isUnavailable ? 'disabled' : ''}
            >
              ${isSold ? 'Sudah Terjual' : openCount > 0 ? 'Ambil Slot Patungan Sekarang' : 'Kuota Patungan Penuh'}
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderOrdersView(state) {
  const container = document.getElementById('orders-list');
  if (!container) return;

  if (state.userOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <h3>Belum ada transaksi aktif</h3>
        <p class="section-desc">Pilih ternak sehat di Katalog untuk memulai transaksi Escrow Syariah.</p>
        <button type="button" class="btn btn-primary btn-sm" data-action="switch-tab" data-tab="katalog">
          Jelajahi Katalog Ternak
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.userOrders
    .map(
      (order) => `
      <article class="order-card">
        <div class="order-card-top">
          <div>
            <div class="order-meta">
              <span class="font-mono">${escapeHtml(order.orderId)}</span>
              <span aria-hidden="true"> · </span>
              <span class="order-status-text ${order.isEscrowReleased ? 'order-status-text--done' : ''}">
                ${escapeHtml(order.escrowStatus)}
              </span>
            </div>
            <h3 class="card-heading">${escapeHtml(order.nama)}</h3>
            <p class="card-farmer-line" style="margin-top:4px;">
              Peternak: ${escapeHtml(order.peternak)} · Skema: <strong>${escapeHtml(order.scheme)}</strong>
            </p>
          </div>

          <div class="text-right">
            <span class="card-price-note">Nilai Transaksi Escrow</span>
            <div class="card-price tabular-nums">${formatRupiah(order.totalPaid)}</div>
          </div>
        </div>

        <div class="order-card-bottom">
          <div class="card-farmer-line tabular-nums">
            Bobot Akad: <strong>${order.initialWeight} kg</strong>
            ${
              order.hasTitipRawat
                ? ` · Bobot Terkini: <strong class="status-text--ok">${order.currentWeight} kg (+${order.currentWeight - order.initialWeight} kg)</strong>`
                : ''
            }
          </div>

          <div class="order-actions">
            ${
              order.hasTitipRawat
                ? `
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-action="open-virtual-barn"
                    data-order-id="${escapeHtml(order.orderId)}"
                  >
                    Pantau Kandang Virtual
                  </button>
                `
                : ''
            }
            ${
              !order.isEscrowReleased
                ? `
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-action="open-handover"
                    data-order-id="${escapeHtml(order.orderId)}"
                  >
                    Konfirmasi Terima &amp; Timbang Ulang
                  </button>
                `
                : `
                  <span class="status-text status-text--ok">Selesai &amp; Dana Cair</span>
                `
            }
          </div>
        </div>
      </article>
    `
    )
    .join('');
}

export function renderPhotoUploadSlots(state) {
  const grid = document.getElementById('farmer-photo-slots-grid');
  if (!grid) return;

  const uploadedCount = Object.values(state.farmerPhotoDraft).filter(Boolean).length;
  const badge = document.getElementById('photo-completeness-badge');
  if (badge) {
    badge.className = `status-text tabular-nums ${uploadedCount === 4 ? 'status-text--ok' : 'status-text--warn'}`;
    badge.textContent =
      uploadedCount === 4 ? '4/4 Foto Lengkap' : `${uploadedCount}/4 Foto Terunggah`;
  }

  grid.innerHTML = PHOTO_ANGLE_CONFIG.map((slot) => {
    const photoData = state.farmerPhotoDraft[slot.key];
    return `
      <div class="slot-card ${photoData ? 'is-filled' : ''}">
        <input
          type="file"
          id="photo-input-${slot.key}"
          data-photo-angle="${slot.key}"
          accept="image/*"
          class="is-hidden"
        />

        <div class="slot-card-top">
          <span>${escapeHtml(slot.step)}</span>
          <span class="${photoData ? 'status-text--ok' : 'status-text--warn'}">
            ${photoData ? 'Terunggah' : 'Wajib'}
          </span>
        </div>

        ${
          photoData
            ? `
              <img src="${photoData}" alt="${escapeHtml(slot.label)}" class="slot-preview-img" />
              <div class="slot-upload-title">${escapeHtml(slot.label)}</div>
              <div class="slot-actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-xs"
                  style="flex:1;"
                  data-action="trigger-photo-input"
                  data-angle="${slot.key}"
                >
                  Ganti
                </button>
                <button
                  type="button"
                  class="btn btn-warn btn-xs"
                  data-action="remove-photo-slot"
                  data-angle="${slot.key}"
                >
                  Hapus
                </button>
              </div>
            `
            : `
              <button
                type="button"
                class="slot-upload-trigger"
                data-action="trigger-photo-input"
                data-angle="${slot.key}"
              >
                <span class="slot-upload-title">${escapeHtml(slot.label)}</span>
                <span class="slot-upload-desc">${escapeHtml(slot.desc)}</span>
                <span class="btn btn-primary btn-xs" style="margin-top:4px;">+ Pilih Foto</span>
              </button>
            `
        }
      </div>
    `;
  }).join('');
}

export function renderFarmerStockTable(state) {
  const countEl = document.getElementById('farmer-stock-count');
  if (countEl) countEl.textContent = `${state.livestockData.length} Listing`;

  const tbody = document.getElementById('farmer-stock-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.livestockData
    .map((item) => {
      const safeThumb = sanitizeImageSrc(item.photos?.samping);
      const thumbHtml = safeThumb
        ? `<img src="${safeThumb}" alt="${escapeHtml(item.nama)}" class="table-thumb" />`
        : `<div class="table-thumb-placeholder">${escapeHtml(item.jenis.slice(0, 2).toUpperCase())}</div>`;

      return `
        <tr>
          <td>
            <div class="table-animal-cell">
              ${thumbHtml}
              <div>
                <div style="font-weight:700; color:var(--text-primary);">${escapeHtml(item.nama)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                  ${escapeHtml(item.jenis)} · ${escapeHtml(item.lokasi)} ·
                  <button
                    type="button"
                    class="table-link-btn"
                    data-action="open-detail"
                    data-id="${escapeHtml(item.id)}"
                    data-subtab="info"
                  >
                    Lihat 4 Sudut
                  </button>
                </div>
              </div>
            </div>
          </td>
          <td class="tabular-nums">
            <div style="font-weight:800; color:var(--brand-700);">${formatRupiah(item.harga)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${item.bobot} kg</div>
          </td>
          <td>
            <span class="font-mono" style="font-size:0.75rem;">${escapeHtml(item.skkh)}</span>
          </td>
          <td class="text-right">
            <label for="stock-status-${escapeHtml(item.id)}" class="sr-only">Status ${escapeHtml(item.nama)}</label>
            <select
              id="stock-status-${escapeHtml(item.id)}"
              class="status-select"
              data-action="update-stock-status"
              data-id="${escapeHtml(item.id)}"
            >
              <option value="Tersedia" ${item.status === 'Tersedia' ? 'selected' : ''}>Tersedia</option>
              <option value="Dipesan (DP)" ${item.status === 'Dipesan (DP)' ? 'selected' : ''}>Dipesan (DP)</option>
              <option value="Terjual" ${item.status === 'Terjual' ? 'selected' : ''}>Terjual</option>
            </select>
          </td>
        </tr>
      `;
    })
    .join('');
}

export function renderAdminView(state) {
  const list = document.getElementById('admin-verification-list');
  if (list) {
    list.innerHTML = state.adminVerifications
      .map((v) => {
        const isVerified = v.status === 'Terverifikasi KYC & SKKH';
        return `
          <div class="verification-row">
            <div>
              <div class="order-meta">
                <span class="font-mono">${escapeHtml(v.id)}</span>
                <span aria-hidden="true"> · </span>
                <span class="${isVerified ? 'status-text--ok' : 'status-text--warn'}">${escapeHtml(v.status)}</span>
              </div>
              <div style="font-weight:800; font-size:0.9375rem;">${escapeHtml(v.kandang)}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                Komoditas: <strong>${escapeHtml(v.ternak)}</strong> · Lokasi: ${escapeHtml(v.lokasi)} ·
                No. SKKH: <span class="font-mono">${escapeHtml(v.skkhNo)}</span>
              </div>
            </div>

            <div>
              ${
                !isVerified
                  ? `
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      data-action="approve-admin-ver"
                      data-ver-id="${escapeHtml(v.id)}"
                    >
                      Setujui KYC &amp; SKKH
                    </button>
                  `
                  : `<span class="status-text status-text--ok">Aktif di Katalog</span>`
              }
            </div>
          </div>
        `;
      })
      .join('');
  }

  const usersCountEl = document.getElementById('admin-user-count');
  if (usersCountEl) usersCountEl.textContent = `${state.users.length} Akun`;

  const usersTbody = document.getElementById('admin-users-tbody');
  if (usersTbody) {
    const adminCount = state.users.filter((u) => u.role === ROLES.ADMIN).length;
    usersTbody.innerHTML = state.users
      .map((u) => {
        const isSelf = state.currentUser && state.currentUser.id === u.id;
        const isLastAdmin = u.role === ROLES.ADMIN && adminCount <= 1;
        return `
          <tr>
            <td>
              <div style="font-weight:700; color:var(--text-primary);">${escapeHtml(u.displayName)}</div>
              <div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">@${escapeHtml(u.username)}</div>
            </td>
            <td style="font-size:0.8125rem; color:var(--text-secondary);">${escapeHtml(u.email)}</td>
            <td>
              <span class="status-text" style="color:var(--text-secondary);">
                ${u.provider === 'google' ? 'Akun Google' : 'Username & Password'}
              </span>
            </td>
            <td class="text-right">
              <div class="admin-user-actions">
                <label for="user-role-${escapeHtml(u.id)}" class="sr-only">Peran ${escapeHtml(u.displayName)}</label>
                <select
                  id="user-role-${escapeHtml(u.id)}"
                  class="status-select"
                  data-action="change-user-role"
                  data-user-id="${escapeHtml(u.id)}"
                  ${isSelf ? 'disabled title="Admin aktif tidak dapat mengubah perannya sendiri"' : ''}
                >
                  <option value="user" ${u.role === 'user' ? 'selected' : ''}>User Biasa</option>
                  <option value="operator" ${u.role === 'operator' ? 'selected' : ''}>Operator</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button
                  type="button"
                  class="btn btn-danger-outline btn-xs"
                  data-action="delete-admin-user"
                  data-user-id="${escapeHtml(u.id)}"
                  data-username="${escapeHtml(u.username)}"
                  aria-label="Hapus akun ${escapeHtml(u.username)}"
                  ${isSelf || isLastAdmin ? 'disabled title="Akun aktif atau Admin terakhir tidak dapat dihapus"' : ''}
                >
                  Hapus
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }
}
