import { PHOTO_ANGLE_CONFIG } from '../data/seed.js';
import {
  addBarnLog,
  createOrder,
  sendChatMessage,
  submitHandover,
  submitNegoOffer,
} from '../services/api.js';
import { applyWorkspaceData, notify, store } from '../state/store.js';
import {
  calculateCheckoutBreakdown,
  evaluateWeightShrinkage,
} from '../utils/domain.js';
import { escapeHtml, formatRupiah, getInitials } from '../utils/formatters.js';
import { sanitizeHexColor, sanitizeImageSrc } from '../utils/security.js';
import { getLivestockSVG } from './svgLivestock.js';
import { showToast } from './toast.js';

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('is-hidden');
  document.body.style.overflow = 'hidden';
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('is-hidden');
  const hasVisibleModal = Array.from(document.querySelectorAll('.modal-backdrop')).some(
    (el) => !el.classList.contains('is-hidden')
  );
  if (!hasVisibleModal) {
    document.body.style.overflow = '';
  }
}

export function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.classList.add('is-hidden'));
  document.body.style.overflow = '';
}

export function setAuthError(message) {
  const errEl = document.getElementById('auth-error-msg');
  if (!errEl) return;
  if (!message) {
    errEl.textContent = '';
    errEl.classList.add('is-hidden');
  } else {
    errEl.textContent = message;
    errEl.classList.remove('is-hidden');
  }
}

export function switchAuthMode(mode = 'login') {
  store.state.authMode = mode;
  setAuthError('');
  const isLogin = mode === 'login';
  document.getElementById('auth-login-form')?.classList.toggle('is-hidden', !isLogin);
  document.getElementById('auth-register-form')?.classList.toggle('is-hidden', isLogin);

  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  loginTab?.classList.toggle('is-active', isLogin);
  regTab?.classList.toggle('is-active', !isLogin);
  loginTab?.setAttribute('aria-selected', String(isLogin));
  regTab?.setAttribute('aria-selected', String(!isLogin));

  const titleEl = document.getElementById('auth-modal-title');
  if (titleEl) {
    titleEl.textContent = isLogin ? 'Masuk ke TernakAceh' : 'Daftar Akun Baru TernakAceh';
  }
}

export function openAuthModal(mode = 'login', promptMessage = '') {
  switchAuthMode(mode);
  if (promptMessage) {
    showToast('Autentikasi Diperlukan', promptMessage, 'warning');
  }
  openModal('modal-auth');
}

// ==================== MODAL 1: DETAIL, 4-ANGLE INSPECTION & NEGO ====================
export function openDetailModal(id, initialSubtab = 'info') {
  const item = store.state.livestockData.find((t) => t.id === id);
  if (!item) return;

  store.state.activeDetailId = id;
  store.state.activeInspectionAngle = 'samping';
  store.state.activeDetailSubtab = initialSubtab;

  document.getElementById('detail-badge-jenis').textContent = item.jenis;
  document.getElementById('detail-title').textContent = item.nama;
  document.getElementById('detail-bobot').textContent = `${item.bobot} kg`;
  document.getElementById('detail-usia').textContent = item.usia;
  const activePrice = store.state.negotiatedPrices[item.id] || item.harga;
  document.getElementById('detail-harga-kg').textContent = formatRupiah(
    Math.round(activePrice / item.bobot)
  );
  document.getElementById('detail-peternak').textContent = item.peternak;
  document.getElementById('detail-lokasi').textContent = `${item.kecamatan}, Kab/Kota ${item.lokasi}`;
  document.getElementById('detail-skkh-no').textContent = item.skkh;
  document.getElementById('detail-syari').textContent = item.usia.includes('Poel')
    ? `Sah ${item.peruntukan}`
    : 'Bakalan / Penggemukan';
  document.getElementById('detail-deskripsi').textContent = item.deskripsi;

  const avatar = document.querySelector('.seller-avatar');
  if (avatar) avatar.textContent = getInitials(item.peternak);

  document.getElementById('detail-harga').textContent = formatRupiah(activePrice);
  document
    .getElementById('detail-deal-pill')
    .classList.toggle('is-hidden', !store.state.negotiatedPrices[item.id]);

  const checkoutBtn = document.getElementById('detail-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.disabled = item.status === 'Terjual';
    checkoutBtn.textContent =
      item.status === 'Terjual' ? 'Stok Terjual' : 'Lanjut Pemesanan & Escrow';
  }

  if (!store.state.chatHistory[item.id]) {
    store.state.chatHistory[item.id] = [
      {
        sender: 'seller',
        time: 'Baru saja',
        text: `Assalamu'alaikum! Saya ${item.peternak}. Ternak ${item.nama} (${item.bobot} kg) dalam kondisi sehat walafiat dan bersertifikat ${item.skkh}. Silakan ajukan penawaran harga atau tanyakan detail kandang.`,
      },
    ];
  }

  const offerInput = document.getElementById('nego-offer-input');
  if (offerInput) {
    offerInput.value = String(Math.round((item.harga * 0.95) / 50000) * 50000);
  }

  renderInspectionAngle();
  renderDetailSubtab();
  renderNegoChat();
  openModal('modal-detail');
}

export function renderInspectionAngle() {
  const item = store.state.livestockData.find((t) => t.id === store.state.activeDetailId);
  if (!item) return;

  const mode = store.state.activeInspectionAngle;
  const meta = PHOTO_ANGLE_CONFIG.find((a) => a.key === mode) || PHOTO_ANGLE_CONFIG[0];

  PHOTO_ANGLE_CONFIG.forEach((angle) => {
    const btn = document.getElementById(`insp-btn-${angle.key}`);
    if (btn) btn.classList.toggle('is-active', angle.key === mode);
  });

  const stage = document.getElementById('detail-visual-stage');
  if (stage) {
    const safeAnglePhoto = sanitizeImageSrc(item.photos?.[mode]);
    if (safeAnglePhoto) {
      stage.innerHTML = `
        <div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:8px;">
          <span style="position:absolute; top:8px; left:8px; padding:4px 10px; border-radius:6px; background:rgba(6,95,70,0.92); color:#fff; font-size:0.6875rem; font-weight:700; z-index:2;">
            Foto Asli · ${escapeHtml(meta.label)}
          </span>
          <img src="${safeAnglePhoto}" alt="${escapeHtml(meta.label)}" style="width:100%; height:100%; object-fit:cover; object-position:center 28%; border-radius:8px;" />
        </div>
      `;
    } else {
      stage.innerHTML = getLivestockSVG(item.jenis, sanitizeHexColor(item.colorHex), mode);
    }
  }

  const captionEl = document.getElementById('detail-visual-caption');
  if (captionEl) {
    captionEl.innerHTML = `<strong>${escapeHtml(meta.label)}:</strong> ${escapeHtml(meta.caption)}`;
  }
}

export function renderDetailSubtab() {
  const isInfo = store.state.activeDetailSubtab === 'info';
  document.getElementById('detail-subtab-info')?.classList.toggle('is-hidden', !isInfo);
  document.getElementById('detail-subtab-nego')?.classList.toggle('is-hidden', isInfo);

  const infoBtn = document.getElementById('subtab-btn-info');
  const negoBtn = document.getElementById('subtab-btn-nego');
  infoBtn?.classList.toggle('is-active', isInfo);
  negoBtn?.classList.toggle('is-active', !isInfo);
  infoBtn?.setAttribute('aria-selected', String(isInfo));
  negoBtn?.setAttribute('aria-selected', String(!isInfo));
}

export function renderNegoChat() {
  const box = document.getElementById('nego-chat-box');
  if (!box) return;
  const messages = store.state.chatHistory[store.state.activeDetailId] || [];

  box.innerHTML = messages
    .map(
      (m) => `
      <div class="chat-bubble-wrap ${m.sender === 'buyer' ? 'is-buyer' : ''}">
        <div class="chat-bubble">${escapeHtml(m.text)}</div>
        <span class="chat-time">${m.sender === 'buyer' ? 'Anda' : 'Peternak'} · ${escapeHtml(m.time)}</span>
      </div>
    `
    )
    .join('');

  box.scrollTop = box.scrollHeight;
}

export async function handleSubmitNegoOffer() {
  if (!store.state.currentUser) {
    closeModal('modal-detail');
    openAuthModal('login', 'Silakan masuk terlebih dahulu untuk mengajukan negosiasi harga.');
    return;
  }

  const item = store.state.livestockData.find((t) => t.id === store.state.activeDetailId);
  if (!item) return;

  const offerInput = document.getElementById('nego-offer-input');
  const offerVal = Number.parseInt(offerInput?.value ?? '', 10);

  try {
    const res = await submitNegoOffer(item.id, offerVal);
    applyWorkspaceData(res.workspace);

    if (res.result.accepted) {
      document.getElementById('detail-harga').textContent = formatRupiah(res.result.agreedPrice);
      document.getElementById('detail-harga-kg').textContent = formatRupiah(
        Math.round(res.result.agreedPrice / item.bobot)
      );
      document.getElementById('detail-deal-pill').classList.remove('is-hidden');
      showToast('Penawaran Disetujui!', `Harga deal ${formatRupiah(res.result.agreedPrice)} berhasil dikunci.`);
    } else {
      showToast(
        'Tawaran Belum Masuk',
        `Peternak menyarankan minimal ${formatRupiah(res.result.minAcceptable)}.`,
        'warning'
      );
    }

    renderNegoChat();
  } catch (error) {
    showToast(
      'Penawaran Ditolak',
      error instanceof Error ? error.message : 'Masukkan nominal tawaran harga yang sesuai.',
      'warning'
    );
  }
}

export async function handleSendChatMessage(text) {
  if (!store.state.currentUser) {
    closeModal('modal-detail');
    openAuthModal('login', 'Silakan masuk terlebih dahulu untuk mengirim pesan ke peternak.');
    return;
  }

  const detailId = store.state.activeDetailId;
  if (!detailId || !text.trim()) return;

  try {
    const res = await sendChatMessage(detailId, text.trim());
    applyWorkspaceData(res.workspace);
    renderNegoChat();
  } catch (error) {
    showToast(
      'Gagal Mengirim Pesan',
      error instanceof Error ? error.message : 'Silakan coba lagi.',
      'warning'
    );
  }
}

// ==================== MODAL 2: CHECKOUT & ESCROW ====================
export function openCheckoutModal(id, defaultScheme = 'full') {
  if (!store.state.currentUser) {
    openAuthModal('login', 'Silakan masuk dengan akun Anda sebelum melanjutkan pemesanan Escrow.');
    return;
  }

  const item = store.state.livestockData.find((t) => t.id === id);
  if (!item || item.status === 'Terjual') return;

  store.state.activeCheckoutId = id;
  const basePrice = store.state.negotiatedPrices[item.id] || item.harga;

  document.getElementById('co-peternak').textContent = item.peternak;
  document.getElementById('co-nama').textContent = item.nama;
  document.getElementById('co-specs').textContent = `${item.jenis} · Bobot ${item.bobot} kg · Lokasi Kandang: ${item.lokasi}`;
  document.getElementById('co-base-price').textContent = formatRupiah(basePrice);

  const patunganLabel = document.getElementById('co-patungan-option');
  patunganLabel?.classList.toggle('is-hidden', !item.patungan);

  const chosenScheme = defaultScheme === 'patungan' && item.patungan ? 'patungan' : 'full';
  document.querySelectorAll('input[name="co-scheme"]').forEach((radio) => {
    radio.checked = radio.value === chosenScheme;
  });

  store.state.selectedPatunganSlots = [];
  if (item.patungan && Array.isArray(item.slots)) {
    const firstOpen = item.slots.find((s) => !s.paid);
    if (firstOpen) store.state.selectedPatunganSlots = [firstOpen.no];
  }

  document.getElementById('co-titip-check').checked = false;
  document.getElementById('co-addon-jagal').checked = false;
  document.getElementById('co-addon-katering').checked = false;

  recalculateCheckout();
  openModal('modal-checkout');
}

export function togglePatunganSlot(slotNo) {
  const slots = store.state.selectedPatunganSlots;
  if (slots.includes(slotNo)) {
    if (slots.length > 1) {
      store.state.selectedPatunganSlots = slots.filter((n) => n !== slotNo);
    }
  } else {
    store.state.selectedPatunganSlots = [...slots, slotNo];
  }
  recalculateCheckout();
}

export function recalculateCheckout() {
  const item = store.state.livestockData.find((t) => t.id === store.state.activeCheckoutId);
  if (!item) return null;

  const basePrice = store.state.negotiatedPrices[item.id] || item.harga;
  const scheme = document.querySelector('input[name="co-scheme"]:checked')?.value || 'full';

  const patunganBox = document.getElementById('co-patungan-box');
  if (scheme === 'patungan' && item.patungan) {
    patunganBox?.classList.remove('is-hidden');
    document.getElementById('co-slot-selected-info').textContent =
      `${store.state.selectedPatunganSlots.length} Slot Dipilih`;

    document.getElementById('co-slots-grid').innerHTML = item.slots
      .map((slot) => {
        const isSelected = store.state.selectedPatunganSlots.includes(slot.no);
        if (slot.paid) {
          return `
            <div class="slot-taken-tile">
              <span class="slot-name">#${slot.no} ${escapeHtml(slot.name)}</span>
              <span class="slot-status">Terisi</span>
            </div>
          `;
        }
        return `
          <button
            type="button"
            class="slot-pick-btn ${isSelected ? 'is-selected' : ''}"
            data-action="toggle-patungan-slot"
            data-slot-no="${slot.no}"
          >
            <span>#${slot.no} Slot Kosong</span>
            <span>${isSelected ? 'Dipilih' : '+ Pilih'}</span>
          </button>
        `;
      })
      .join('');
  } else {
    patunganBox?.classList.add('is-hidden');
  }

  const titipRawat = document.getElementById('co-titip-check').checked;
  document.getElementById('co-titip-options')?.classList.toggle('is-hidden', !titipRawat);

  const titipDays = Number.parseInt(document.getElementById('co-titip-days').value, 10) || 30;
  const shippingMethod = document.getElementById('co-shipping-method').value;
  const shippingDest = document.getElementById('co-shipping-dest').value;
  const addonJagal = document.getElementById('co-addon-jagal').checked;
  const addonKatering = document.getElementById('co-addon-katering').checked;

  const breakdown = calculateCheckoutBreakdown({
    basePrice,
    weightKg: item.bobot,
    originLokasi: item.lokasi,
    scheme,
    selectedSlotCount: store.state.selectedPatunganSlots.length,
    titipRawat,
    titipDays,
    shippingMethod,
    shippingDest,
    addonJagal,
    addonKatering,
  });

  document.getElementById('co-titip-rate-text').textContent = `${formatRupiah(breakdown.dailyRate)} / hari`;
  document.getElementById('co-shipping-info').textContent =
    shippingMethod === 'pickup'
      ? `Ambil langsung di kandang (${item.lokasi})`
      : `Pengiriman dari ${item.lokasi} ke ${shippingDest}`;
  document.getElementById('co-shipping-cost').textContent =
    breakdown.shippingCost === 0 ? 'Gratis' : formatRupiah(breakdown.shippingCost);

  document.getElementById('co-summary-label').textContent = breakdown.schemeLabel;
  document.getElementById('co-summary-ternak').textContent = formatRupiah(breakdown.ternakCost);
  document.getElementById('co-summary-titip').textContent = formatRupiah(breakdown.titipCost);
  document.getElementById('co-summary-ongkir').textContent = formatRupiah(breakdown.shippingCost);
  document.getElementById('co-summary-addon').textContent = formatRupiah(breakdown.addonCost);
  document.getElementById('co-summary-total').textContent = formatRupiah(breakdown.grandTotal);

  return {
    item,
    scheme,
    titipRawat,
    titipDays,
    breakdown,
  };
}

export async function handleConfirmCheckout() {
  const result = recalculateCheckout();
  if (!result) return;

  const { item, scheme, titipRawat, titipDays, breakdown } = result;

  try {
    const res = await createOrder({
      ternakId: item.id,
      scheme,
      selectedPatunganSlots: store.state.selectedPatunganSlots,
      titipRawat,
      titipDays,
      shippingMethod: document.getElementById('co-shipping-method')?.value || 'farmer',
      shippingDest: document.getElementById('co-shipping-dest')?.value || 'Banda Aceh',
      addonJagal: Boolean(document.getElementById('co-addon-jagal')?.checked),
      addonKatering: Boolean(document.getElementById('co-addon-katering')?.checked),
    });

    store.state.activeTab = 'pesanan';
    closeModal('modal-checkout');
    applyWorkspaceData(res.workspace);
    showToast(
      'Pembayaran Escrow Berhasil!',
      `Dana ${formatRupiah(breakdown.grandTotal)} diamankan di Rekening Bersama Syariah.`
    );
  } catch (error) {
    showToast(
      'Gagal Memproses Pesanan',
      error instanceof Error ? error.message : 'Silakan periksa kembali pesanan Anda.',
      'warning'
    );
  }
}

// ==================== MODAL 3: KANDANG VIRTUAL ====================
export function openVirtualBarnModal(orderId) {
  const order = store.state.userOrders.find((o) => o.orderId === orderId);
  if (!order) return;

  store.state.activeVirtualBarnOrderId = orderId;
  document.getElementById('vb-title').textContent = `Kandang Virtual — ${order.nama}`;
  document.getElementById('vb-initial-weight').textContent = `${order.initialWeight} kg`;
  const gain = order.currentWeight - order.initialWeight;
  document.getElementById('vb-current-weight').textContent = `${order.currentWeight} kg (+${gain} kg)`;

  const logsContainer = document.getElementById('vb-logs-container');
  logsContainer.innerHTML = (order.logs || [])
    .map(
      (log) => `
      <div class="vb-log-card">
        <div class="vb-log-head">
          <strong>${escapeHtml(log.date)}</strong>
          <span class="status-text--ok tabular-nums">Bobot: ${log.weight} kg</span>
        </div>
        <p class="vb-log-note">${escapeHtml(log.note)}</p>
        <div class="vb-log-feed">Menu Pakan: ${escapeHtml(log.feed)}</div>
      </div>
    `
    )
    .join('');

  openModal('modal-virtual-barn');
}

export async function handleSimulateBarnLog() {
  const orderId = store.state.activeVirtualBarnOrderId;
  if (!orderId) return;

  try {
    const res = await addBarnLog(orderId);
    applyWorkspaceData(res.workspace);
    openVirtualBarnModal(orderId);
    showToast(
      'Laporan Kandang Diterima',
      `Bobot ternak naik +${res.addedKg} kg menjadi ${res.order.currentWeight} kg.`
    );
  } catch (error) {
    showToast(
      'Gagal Memperbarui Log',
      error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan log kandang.',
      'warning'
    );
  }
}

// ==================== MODAL 4: TIMBANG ULANG & SERAH TERIMA ====================
export function openHandoverModal(orderId) {
  const order = store.state.userOrders.find((o) => o.orderId === orderId);
  if (!order) return;

  store.state.activeHandoverOrderId = orderId;
  document.getElementById('ho-order-name').textContent = order.nama;
  document.getElementById('ho-expected-weight').textContent = `${order.currentWeight} kg`;
  document.getElementById('ho-actual-weight').value = String(Math.max(1, order.currentWeight - 2));

  updateHandoverShrinkageUI();
  openModal('modal-handover');
}

export function updateHandoverShrinkageUI() {
  const order = store.state.userOrders.find((o) => o.orderId === store.state.activeHandoverOrderId);
  if (!order) return;

  const actual = Number.parseFloat(document.getElementById('ho-actual-weight').value);
  const evaluation = evaluateWeightShrinkage(order.currentWeight, actual);
  const feedback = document.getElementById('ho-weight-feedback');
  const disputeBtn = document.getElementById('ho-dispute-btn');

  if (!evaluation.valid) {
    feedback.className = 'weight-feedback weight-feedback--warn';
    feedback.textContent = 'Masukkan bobot aktual ternak dalam satuan kg yang valid.';
    disputeBtn?.classList.add('is-hidden');
    return;
  }

  if (evaluation.withinTolerance) {
    feedback.className = 'weight-feedback';
    feedback.textContent = `Bobot sesuai toleransi penyusutan transportasi (${evaluation.shrinkagePct}% <= 5%).`;
    disputeBtn?.classList.add('is-hidden');
  } else {
    feedback.className = 'weight-feedback weight-feedback--warn';
    feedback.textContent = `Terdeteksi penyusutan bobot ${evaluation.shrinkagePct}% (> 5%). Anda dapat mengajukan mediasi Escrow.`;
    disputeBtn?.classList.remove('is-hidden');
  }
}

export async function handleCompleteEscrowRelease() {
  const order = store.state.userOrders.find((o) => o.orderId === store.state.activeHandoverOrderId);
  if (!order) return;

  const checkHealth = document.getElementById('ho-check-health')?.checked;
  const checkSkkh = document.getElementById('ho-check-skkh')?.checked;
  if (!checkHealth || !checkSkkh) {
    showToast(
      'Checklist Serah Terima Belum Lengkap',
      'Pastikan kondisi fisik sehat dan dokumen SKKH sesuai sebelum mencairkan dana.',
      'warning'
    );
    return;
  }

  try {
    const res = await submitHandover(order.orderId, {
      action: 'release',
      checkHealth: true,
      checkSkkh: true,
    });
    closeModal('modal-handover');
    applyWorkspaceData(res.workspace);
    showToast(
      'Serah Terima Dikonfirmasi!',
      `Dana ${formatRupiah(order.totalPaid)} telah diteruskan ke rekening peternak.`
    );
  } catch (error) {
    showToast(
      'Gagal Mencairkan Escrow',
      error instanceof Error ? error.message : 'Silakan coba beberapa saat lagi.',
      'warning'
    );
  }
}

export async function handleOpenEscrowDispute() {
  const order = store.state.userOrders.find((o) => o.orderId === store.state.activeHandoverOrderId);
  if (!order) return;

  const actualWeight = Number.parseFloat(document.getElementById('ho-actual-weight')?.value || '0');
  try {
    const res = await submitHandover(order.orderId, {
      action: 'dispute',
      actualWeight,
    });
    closeModal('modal-handover');
    applyWorkspaceData(res.workspace);
    showToast(
      'Mediasi Diajukan',
      'Dana Escrow tetap ditahan aman hingga tim mediator menyelesaikan selisih bobot.',
      'warning'
    );
  } catch (error) {
    showToast(
      'Gagal Mengajukan Mediasi',
      error instanceof Error ? error.message : 'Periksa kembali bobot aktual.',
      'warning'
    );
  }
}
