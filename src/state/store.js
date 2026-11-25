import { createInitialSeedState } from '../data/seed.js';

const initial = createInitialSeedState();

export const store = {
  state: {
    currentUser: null,
    authReady: false,
    authMode: 'login',
    livestockData: initial.livestockData,
    userOrders: [],
    adminVerifications: [],
    users: [],
    chatHistory: {},
    negotiatedPrices: {},
    escrowReleasedTotal: initial.escrowReleasedTotal,
    heldEscrowTotal: 0,
    activeTab: 'katalog',
    filters: {
      jenis: 'Semua',
      peruntukan: 'Semua',
      lokasi: 'Semua',
      sort: 'terbaru',
      search: '',
    },
    activeDetailId: null,
    activeInspectionAngle: 'samping',
    activeDetailSubtab: 'info',
    activeCheckoutId: null,
    selectedPatunganSlots: [],
    activeVirtualBarnOrderId: null,
    activeHandoverOrderId: null,
    farmerPhotoDraft: {
      samping: null,
      depan: null,
      gigi: null,
      belakang: null,
    },
  },
  listeners: new Set(),
};

export function subscribe(listener) {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

export function notify() {
  store.listeners.forEach((listener) => listener(store.state));
}

export function applyPublicCatalog(catalog) {
  if (!catalog) return;
  if (Array.isArray(catalog.livestockData)) {
    store.state.livestockData = catalog.livestockData;
  }
  if (typeof catalog.escrowReleasedTotal === 'number') {
    store.state.escrowReleasedTotal = catalog.escrowReleasedTotal;
  }
  if (typeof catalog.heldEscrowTotal === 'number') {
    store.state.heldEscrowTotal = catalog.heldEscrowTotal;
  }
  store.state.currentUser = null;
  store.state.userOrders = [];
  store.state.adminVerifications = [];
  store.state.users = [];
  store.state.negotiatedPrices = {};
  store.state.chatHistory = {};
  notify();
}

export function applyWorkspaceData(workspace) {
  if (!workspace) return;
  store.state.currentUser = workspace.user || null;
  if (Array.isArray(workspace.livestockData)) {
    store.state.livestockData = workspace.livestockData;
  }
  if (Array.isArray(workspace.userOrders)) {
    store.state.userOrders = workspace.userOrders;
  }
  if (Array.isArray(workspace.adminVerifications)) {
    store.state.adminVerifications = workspace.adminVerifications;
  }
  if (Array.isArray(workspace.users)) {
    store.state.users = workspace.users;
  }
  if (workspace.chatHistory && typeof workspace.chatHistory === 'object') {
    store.state.chatHistory = workspace.chatHistory;
  }
  if (workspace.negotiatedPrices && typeof workspace.negotiatedPrices === 'object') {
    store.state.negotiatedPrices = workspace.negotiatedPrices;
  }
  if (typeof workspace.escrowReleasedTotal === 'number') {
    store.state.escrowReleasedTotal = workspace.escrowReleasedTotal;
  }
  store.state.heldEscrowTotal = store.state.userOrders
    .filter((o) => !o.isEscrowReleased)
    .reduce((sum, o) => sum + Number(o.totalPaid || 0), 0);

  notify();
}
