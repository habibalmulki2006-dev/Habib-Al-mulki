import { PHOTO_ANGLE_CONFIG } from './data/seed.js';
import {
  approveVerification,
  createAdminUser,
  createLivestock,
  deleteAdminUser,
  fetchAuthMe,
  fetchPublicCatalog,
  fetchWorkspace,
  loginWithGoogleToken,
  loginWithPassword,
  logoutSession,
  registerAccount,
  resetDemoDatabase,
  updateLivestockStatus,
  updateUserRole,
} from './services/api.js';
import {
  initFirebaseAuthObserver,
  signInWithGooglePopup,
  signOutFirebase,
  syncFirebaseUserProfile,
  testConnection,
} from './services/firebase.js';
import {
  applyPublicCatalog,
  applyWorkspaceData,
  notify,
  store,
  subscribe,
} from './state/store.js';
import { buildFirebaseSessionUser, isStaticHostApiError } from './utils/authFallback.js';
import { validateLivestockSubmission } from './utils/domain.js';
import { canAccessTab, getRoleLabel, validateAuthCredentials } from './utils/rbac.js';
import { compressUploadedImage, generateAngleCanvasPreview } from './components/svgLivestock.js';
import { showToast } from './components/toast.js';
import {
  renderAdminView,
  renderCatalogView,
  renderFarmerStockTable,
  renderHeaderAndMetrics,
  renderOrdersView,
  renderPatunganView,
  renderPhotoUploadSlots,
} from './components/views.js';
import {
  closeAllModals,
  closeModal,
  handleCompleteEscrowRelease,
  handleConfirmCheckout,
  handleOpenEscrowDispute,
  handleSendChatMessage,
  handleSimulateBarnLog,
  handleSubmitNegoOffer,
  openAuthModal,
  openCheckoutModal,
  openDetailModal,
  openHandoverModal,
  openVirtualBarnModal,
  recalculateCheckout,
  renderDetailSubtab,
  renderInspectionAngle,
  setAuthError,
  switchAuthMode,
  togglePatunganSlot,
  updateHandoverShrinkageUI,
} from './components/modals.js';

function renderApp(state) {
  renderHeaderAndMetrics(state);
  renderCatalogView(state);
  renderPatunganView(state);
  renderOrdersView(state);
  renderPhotoUploadSlots(state);
  renderFarmerStockTable(state);
  renderAdminView(state);
}

function syncFilterInputsFromState() {
  const { filters } = store.state;
  document.getElementById('global-search').value = filters.search;
  document.getElementById('filter-jenis').value = filters.jenis;
  document.getElementById('filter-peruntukan').value = filters.peruntukan;
  document.getElementById('filter-lokasi').value = filters.lokasi;
  document.getElementById('filter-sort').value = filters.sort;
}

function switchTab(tabName) {
  const role = store.state.currentUser?.role || null;
  if (!canAccessTab(role, tabName)) {
    if (!store.state.currentUser) {
      openAuthModal('login', 'Silakan masuk terlebih dahulu untuk membuka menu ini.');
    } else {
      showToast(
        'Akses Dibatasi',
        `Peran ${getRoleLabel(role)} tidak memiliki akses ke halaman ini.`,
        'warning'
      );
    }
    return;
  }
  store.state.activeTab = tabName;
  notify();
}

function handleFillSamplePhotos() {
  const jenis = document.getElementById('f-jenis')?.value || 'Sapi Aceh';
  PHOTO_ANGLE_CONFIG.forEach((slot) => {
    store.state.farmerPhotoDraft[slot.key] = generateAngleCanvasPreview(
      jenis,
      slot.key,
      slot.label,
      slot.desc
    );
  });
  renderPhotoUploadSlots(store.state);
  showToast('4 Foto Contoh Terisi', `Seluruh sudut foto & gigi untuk ${jenis} siap diterbitkan.`);
}

async function handleAddLivestockSubmit(event) {
  event.preventDefault();

  const formData = {
    nama: document.getElementById('f-nama')?.value.trim() || '',
    jenis: document.getElementById('f-jenis')?.value || 'Sapi Aceh',
    peruntukan: document.getElementById('f-peruntukan')?.value || 'Kurban',
    lokasi: document.getElementById('f-lokasi')?.value || 'Aceh Besar',
    kelamin: document.getElementById('f-kelamin')?.value || 'Jantan',
    bobot: Number.parseInt(document.getElementById('f-bobot')?.value || '0', 10),
    usia: document.getElementById('f-usia')?.value.trim() || '',
    harga: Number.parseInt(document.getElementById('f-harga')?.value || '0', 10),
    skkh: document.getElementById('f-skkh')?.value.trim() || '',
    peternak: document.getElementById('f-peternak')?.value.trim() || '',
    patungan: Boolean(document.getElementById('f-patungan')?.checked),
    titipRawat: Boolean(document.getElementById('f-titip')?.checked),
  };

  const validation = validateLivestockSubmission(
    formData,
    store.state.farmerPhotoDraft,
    PHOTO_ANGLE_CONFIG
  );

  if (!validation.valid) {
    showToast('Data Listing Belum Lengkap', validation.errors[0], 'warning');
    return;
  }

  try {
    const res = await createLivestock(formData, store.state.farmerPhotoDraft);
    store.state.farmerPhotoDraft = { samping: null, depan: null, gigi: null, belakang: null };
    document.getElementById('farmer-add-form')?.reset();
    applyWorkspaceData(res.workspace);
    showToast(
      'Ternak Berhasil Diterbitkan!',
      `${formData.nama} beserta 4 foto sudut & gigi kini tersimpan di database.`
    );
  } catch (error) {
    showToast(
      'Gagal Menerbitkan Ternak',
      error instanceof Error ? error.message : 'Pastikan Anda masuk sebagai Operator atau Admin.',
      'warning'
    );
  }
}

async function handleApproveAdminVerification(verId) {
  try {
    const res = await approveVerification(verId);
    applyWorkspaceData(res.workspace);
    showToast('Verifikasi Disetujui', `${res.ver.kandang} resmi mendapat lencana KYC & SKKH.`);
  } catch (error) {
    showToast(
      'Verifikasi Gagal',
      error instanceof Error ? error.message : 'Hanya Admin yang dapat menyetujui KYC & SKKH.',
      'warning'
    );
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  setAuthError('');

  const username = document.getElementById('login-username')?.value || '';
  const password = document.getElementById('login-password')?.value || '';

  const check = validateAuthCredentials({ username, password });
  if (!check.valid) {
    setAuthError(check.error);
    return;
  }

  const submitBtn = document.getElementById('auth-login-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await loginWithPassword(username, password);
    const workspace = await fetchWorkspace();
    applyWorkspaceData(workspace);
    closeModal('modal-auth');
    document.getElementById('auth-login-form')?.reset();

    const user = workspace.user;
    showToast(
      `Selamat Datang, ${user.displayName}`,
      `Masuk berhasil dengan peran ${getRoleLabel(user.role)}.`
    );
  } catch (error) {
    setAuthError(error instanceof Error ? error.message : 'Username atau password salah.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  setAuthError('');

  const displayName = document.getElementById('reg-display-name')?.value || '';
  const username = document.getElementById('reg-username')?.value || '';
  const email = document.getElementById('reg-email')?.value || '';
  const password = document.getElementById('reg-password')?.value || '';

  const check = validateAuthCredentials({
    username,
    password,
    displayName,
    isRegister: true,
  });
  if (!check.valid) {
    setAuthError(check.error);
    return;
  }

  const submitBtn = document.getElementById('auth-register-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await registerAccount({ username, password, displayName, email });
    const workspace = await fetchWorkspace();
    applyWorkspaceData(workspace);
    closeModal('modal-auth');
    document.getElementById('auth-register-form')?.reset();
    showToast(
      'Akun Berhasil Dibuat',
      `Selamat datang ${workspace.user.displayName} (${getRoleLabel(workspace.user.role)}).`
    );
  } catch (error) {
    setAuthError(error instanceof Error ? error.message : 'Pendaftaran gagal.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleAdminCreateUser(event) {
  event.preventDefault();

  const displayName = document.getElementById('admin-new-name')?.value || '';
  const username = document.getElementById('admin-new-username')?.value || '';
  const email = document.getElementById('admin-new-email')?.value || '';
  const password = document.getElementById('admin-new-password')?.value || '';
  const role = document.getElementById('admin-new-role')?.value || 'user';

  const check = validateAuthCredentials({
    username,
    password,
    displayName,
    isRegister: true,
  });
  if (!check.valid) {
    showToast('Data Akun Tidak Valid', check.error, 'warning');
    return;
  }

  const submitBtn = document.getElementById('admin-create-user-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await createAdminUser({ displayName, username, email, password, role });
    applyWorkspaceData(res.workspace);
    document.getElementById('admin-create-user-form')?.reset();
    showToast(
      'Akun Berhasil Ditambahkan',
      `Akun @${res.user.username} (${getRoleLabel(res.user.role)}) tersimpan aman di database.`
    );
  } catch (error) {
    showToast(
      'Gagal Menambahkan Akun',
      error instanceof Error ? error.message : 'Periksa kembali data akun yang dimasukkan.',
      'warning'
    );
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleDeleteAdminUser(userId, username) {
  if (!userId) return;
  try {
    const res = await deleteAdminUser(userId);
    applyWorkspaceData(res.workspace);
    showToast('Akun Dihapus', `Akun @${username || userId} telah dihapus dari database.`);
  } catch (error) {
    showToast(
      'Gagal Menghapus Akun',
      error instanceof Error ? error.message : 'Akun tidak dapat dihapus.',
      'warning'
    );
  }
}

async function handleGoogleLogin() {
  setAuthError('');
  const googleBtn = document.getElementById('auth-google-btn');
  if (googleBtn) googleBtn.disabled = true;

  try {
    const { firebaseUser, idToken, profile } = await signInWithGooglePopup();
    try {
      await loginWithGoogleToken(idToken);
      const workspace = await fetchWorkspace();
      applyWorkspaceData(workspace);
      closeModal('modal-auth');
      showToast(
        'Masuk Google Berhasil',
        `Selamat datang ${workspace.user.displayName} (${getRoleLabel(workspace.user.role)}).`
      );
    } catch (apiError) {
      if (!isStaticHostApiError(apiError)) {
        throw apiError;
      }
      const fallbackUser = profile || buildFirebaseSessionUser(firebaseUser);
      if (!fallbackUser) {
        throw apiError;
      }
      store.state.currentUser = fallbackUser;
      notify();
      closeModal('modal-auth');
      showToast(
        'Masuk Google Berhasil',
        `Selamat datang ${fallbackUser.displayName} (${getRoleLabel(fallbackUser.role)}).`
      );
    }
  } catch (error) {
    setAuthError(
      error instanceof Error
        ? error.message
        : 'Gagal masuk dengan akun Google. Pastikan popup tidak diblokir.'
    );
  } finally {
    if (googleBtn) googleBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await logoutSession().catch(() => {});
    await signOutFirebase().catch(() => {});
  } finally {
    store.state.activeTab = 'katalog';
    const catalog = await fetchPublicCatalog().catch(() => null);
    if (catalog) {
      applyPublicCatalog(catalog);
    } else {
      store.state.currentUser = null;
      store.state.userOrders = [];
      store.state.adminVerifications = [];
      store.state.users = [];
      store.state.negotiatedPrices = {};
      store.state.chatHistory = {};
      notify();
    }
    showToast('Keluar Berhasil', 'Sesi akun Anda telah ditutup.');
  }
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const backdrop = event.target.closest('.modal-backdrop');
    if (backdrop && event.target === backdrop) {
      closeModal(backdrop.id);
      return;
    }

    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');
    switch (action) {
      case 'open-auth':
        openAuthModal('login');
        break;
      case 'switch-auth-mode':
        switchAuthMode(trigger.getAttribute('data-mode') || 'login');
        break;
      case 'google-login':
        await handleGoogleLogin();
        break;
      case 'logout':
        await handleLogout();
        break;
      case 'switch-tab':
        switchTab(trigger.getAttribute('data-tab'));
        break;
      case 'scroll-to-catalog':
        document.getElementById('filter-bar')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'reset-filters':
        store.state.filters = {
          jenis: 'Semua',
          peruntukan: 'Semua',
          lokasi: 'Semua',
          sort: 'terbaru',
          search: '',
        };
        syncFilterInputsFromState();
        renderCatalogView(store.state);
        showToast('Filter Direset', 'Menampilkan seluruh ternak terverifikasi di Aceh.');
        break;
      case 'quick-filter': {
        const filterType = trigger.getAttribute('data-filter-type');
        const filterVal = trigger.getAttribute('data-filter-value');
        if (filterType && filterVal) {
          store.state.filters[filterType] = filterVal;
          syncFilterInputsFromState();
          renderCatalogView(store.state);
        }
        break;
      }
      case 'open-detail':
        openDetailModal(
          trigger.getAttribute('data-id'),
          trigger.getAttribute('data-subtab') || 'info'
        );
        break;
      case 'close-modal':
        closeModal(trigger.getAttribute('data-modal'));
        break;
      case 'switch-angle':
        store.state.activeInspectionAngle = trigger.getAttribute('data-angle') || 'samping';
        renderInspectionAngle();
        break;
      case 'switch-detail-subtab':
        store.state.activeDetailSubtab = trigger.getAttribute('data-subtab') || 'info';
        renderDetailSubtab();
        break;
      case 'submit-nego-offer':
        await handleSubmitNegoOffer();
        break;
      case 'open-checkout-from-detail': {
        const id = store.state.activeDetailId;
        closeModal('modal-detail');
        if (id) openCheckoutModal(id, 'full');
        break;
      }
      case 'open-checkout-direct':
        openCheckoutModal(
          trigger.getAttribute('data-id'),
          trigger.getAttribute('data-scheme') || 'full'
        );
        break;
      case 'toggle-patungan-slot':
        togglePatunganSlot(Number.parseInt(trigger.getAttribute('data-slot-no') || '0', 10));
        break;
      case 'confirm-checkout':
        await handleConfirmCheckout();
        break;
      case 'open-virtual-barn':
        openVirtualBarnModal(trigger.getAttribute('data-order-id'));
        break;
      case 'simulate-barn-log':
        await handleSimulateBarnLog();
        break;
      case 'open-handover':
        openHandoverModal(trigger.getAttribute('data-order-id'));
        break;
      case 'complete-escrow-release':
        await handleCompleteEscrowRelease();
        break;
      case 'open-escrow-dispute':
        await handleOpenEscrowDispute();
        break;
      case 'fill-sample-photos':
        handleFillSamplePhotos();
        break;
      case 'trigger-photo-input': {
        const angle = trigger.getAttribute('data-angle');
        document.getElementById(`photo-input-${angle}`)?.click();
        break;
      }
      case 'remove-photo-slot': {
        const angle = trigger.getAttribute('data-angle');
        if (angle) {
          store.state.farmerPhotoDraft[angle] = null;
          renderPhotoUploadSlots(store.state);
        }
        break;
      }
      case 'approve-admin-ver':
        await handleApproveAdminVerification(trigger.getAttribute('data-ver-id'));
        break;
      case 'delete-admin-user':
        await handleDeleteAdminUser(
          trigger.getAttribute('data-user-id'),
          trigger.getAttribute('data-username')
        );
        break;
      case 'reset-demo':
        try {
          const res = await resetDemoDatabase();
          applyWorkspaceData(res.workspace);
          syncFilterInputsFromState();
          showToast('Data Demo Direset', 'Database katalog, pesanan, dan escrow dikembalikan ke awal.');
        } catch (error) {
          showToast(
            'Gagal Mereset Database',
            error instanceof Error ? error.message : 'Hanya Admin yang dapat mereset data.',
            'warning'
          );
        }
        break;
      default:
        break;
    }
  });

  document.getElementById('global-search')?.addEventListener('input', (e) => {
    store.state.filters.search = e.target.value;
    renderCatalogView(store.state);
  });

  ['jenis', 'peruntukan', 'lokasi', 'sort'].forEach((key) => {
    document.getElementById(`filter-${key}`)?.addEventListener('change', (e) => {
      store.state.filters[key] = e.target.value;
      renderCatalogView(store.state);
    });
  });

  document.addEventListener('change', async (event) => {
    const target = event.target;

    if (target.matches('[data-action="update-stock-status"]')) {
      const id = target.getAttribute('data-id');
      try {
        const res = await updateLivestockStatus(id, target.value);
        applyWorkspaceData(res.workspace);
        showToast('Status Stok Diperbarui', `${res.item.nama} diubah menjadi "${target.value}".`);
      } catch (error) {
        showToast(
          'Gagal Memperbarui Status',
          error instanceof Error ? error.message : 'Akses ditolak.',
          'warning'
        );
      }
      return;
    }

    if (target.matches('[data-action="change-user-role"]')) {
      const userId = target.getAttribute('data-user-id');
      try {
        const res = await updateUserRole(userId, target.value);
        applyWorkspaceData(res.workspace);
        showToast(
          'Peran Pengguna Diperbarui',
          `${res.user.displayName} kini memiliki peran ${getRoleLabel(res.user.role)}.`
        );
      } catch (error) {
        showToast(
          'Gagal Mengubah Peran',
          error instanceof Error ? error.message : 'Tidak dapat memperbarui peran pengguna.',
          'warning'
        );
      }
      return;
    }

    if (target.matches('[data-photo-angle]')) {
      const angle = target.getAttribute('data-photo-angle');
      const file = target.files && target.files[0];
      if (!file || !angle) return;

      if (!file.type.startsWith('image/')) {
        showToast(
          'Format Tidak Didukung',
          'Silakan pilih file gambar (JPG, PNG, atau WEBP).',
          'warning'
        );
        return;
      }

      try {
        const compressed = await compressUploadedImage(file);
        store.state.farmerPhotoDraft[angle] = compressed;
        renderPhotoUploadSlots(store.state);
        const meta = PHOTO_ANGLE_CONFIG.find((s) => s.key === angle);
        showToast('Foto Berhasil Diunggah', `${meta ? meta.label : angle} siap dipublikasikan.`);
      } catch {
        showToast('Gagal Memproses Foto', 'Silakan coba file gambar lain.', 'warning');
      }
      return;
    }

    if (
      target.matches(
        'input[name="co-scheme"], #co-titip-check, #co-titip-days, #co-shipping-method, #co-shipping-dest, #co-addon-jagal, #co-addon-katering'
      )
    ) {
      recalculateCheckout();
    }
  });

  document.getElementById('ho-actual-weight')?.addEventListener('input', updateHandoverShrinkageUI);
  document.getElementById('farmer-add-form')?.addEventListener('submit', handleAddLivestockSubmit);
  document.getElementById('admin-create-user-form')?.addEventListener('submit', handleAdminCreateUser);
  document.getElementById('auth-login-form')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('auth-register-form')?.addEventListener('submit', handleRegisterSubmit);

  document.getElementById('chat-msg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-msg-input');
    if (!input) return;
    await handleSendChatMessage(input.value);
    input.value = '';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

async function init() {
  subscribe(renderApp);
  bindEvents();
  syncFilterInputsFromState();
  renderApp(store.state);

  // Verify Firestore connectivity on boot
  testConnection();

  try {
    const me = await fetchAuthMe();
    if (me && me.user) {
      const workspace = await fetchWorkspace();
      applyWorkspaceData(workspace);
    } else {
      const catalog = await fetchPublicCatalog();
      applyPublicCatalog(catalog);
    }
  } catch (error) {
    if (isStaticHostApiError(error)) {
      initFirebaseAuthObserver(async (firebaseUser) => {
        if (!firebaseUser) return;
        try {
          const synced = await syncFirebaseUserProfile(firebaseUser);
          store.state.currentUser = synced || buildFirebaseSessionUser(firebaseUser);
        } catch {
          store.state.currentUser = buildFirebaseSessionUser(firebaseUser);
        }
        notify();
      });
    }
    renderApp(store.state);
  }
}

init();
