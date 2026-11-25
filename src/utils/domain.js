/**
 * Pure domain logic for TernakAceh marketplace.
 * Decoupled from DOM so all calculations, filtering, and validations are unit-testable.
 */

export const SHIPPING_FEES = {
  sameRegency: 150000,
  interRegency: 350000,
  mitraSurcharge: 100000,
};

export const ADDON_FEES = {
  jagal: 350000,
  katering: 1250000,
};

export function filterAndSortLivestock(items, filters, negotiatedPrices = {}) {
  const jenis = filters?.jenis ?? 'Semua';
  const peruntukan = filters?.peruntukan ?? 'Semua';
  const lokasi = filters?.lokasi ?? 'Semua';
  const sort = filters?.sort ?? 'terbaru';
  const query = String(filters?.search ?? '')
    .trim()
    .toLowerCase();

  const filtered = items.filter((item) => {
    const matchJenis = jenis === 'Semua' || item.jenis === jenis;
    const matchPeruntukan = peruntukan === 'Semua' || item.peruntukan === peruntukan;
    const matchLokasi = lokasi === 'Semua' || item.lokasi === lokasi;
    const matchSearch =
      !query ||
      item.nama.toLowerCase().includes(query) ||
      item.jenis.toLowerCase().includes(query) ||
      item.lokasi.toLowerCase().includes(query) ||
      item.peternak.toLowerCase().includes(query);

    return matchJenis && matchPeruntukan && matchLokasi && matchSearch;
  });

  if (sort === 'harga-rendah') {
    return [...filtered].sort(
      (a, b) => (negotiatedPrices[a.id] ?? a.harga) - (negotiatedPrices[b.id] ?? b.harga)
    );
  }

  if (sort === 'bobot-berat') {
    return [...filtered].sort((a, b) => b.bobot - a.bobot);
  }

  return filtered;
}

export function evaluateNegotiationOffer(basePrice, offerAmount) {
  const price = Number(basePrice);
  const offer = Number(offerAmount);

  if (!Number.isFinite(offer) || offer <= 0) {
    return {
      valid: false,
      accepted: false,
      minAcceptable: Math.round(price * 0.9),
      reason: 'invalid-amount',
    };
  }

  const minAcceptable = Math.round(price * 0.9);
  if (offer >= minAcceptable) {
    return {
      valid: true,
      accepted: true,
      agreedPrice: Math.round(offer),
      minAcceptable,
      reason: 'accepted',
    };
  }

  return {
    valid: true,
    accepted: false,
    minAcceptable,
    reason: 'below-minimum',
  };
}

export function calculateTitipDailyRate(weightKg) {
  return Number(weightKg) > 100 ? 25000 : 10000;
}

export function calculateShippingCost(method, originLokasi, destLokasi) {
  if (method === 'pickup') return 0;
  const isSameRegency = originLokasi === destLokasi;
  const baseFee = isSameRegency ? SHIPPING_FEES.sameRegency : SHIPPING_FEES.interRegency;
  return method === 'mitra' ? baseFee + SHIPPING_FEES.mitraSurcharge : baseFee;
}

export function calculateCheckoutBreakdown({
  basePrice,
  weightKg,
  originLokasi,
  scheme = 'full',
  selectedSlotCount = 1,
  titipRawat = false,
  titipDays = 30,
  shippingMethod = 'farmer',
  shippingDest = 'Banda Aceh',
  addonJagal = false,
  addonKatering = false,
}) {
  const price = Number(basePrice) || 0;
  let ternakCost = price;
  let schemeLabel = 'Harga Ternak (Bayar Penuh 1 Ekor)';

  if (scheme === 'dp') {
    ternakCost = Math.round(price * 0.3);
    schemeLabel = 'Uang Muka / Booking DP (30%)';
  } else if (scheme === 'patungan') {
    const slots = Math.max(1, Number(selectedSlotCount) || 1);
    ternakCost = Math.ceil(price / 7) * slots;
    schemeLabel = `Patungan Kurban (${slots}/7 Slot)`;
  }

  const dailyRate = calculateTitipDailyRate(weightKg);
  const days = Math.max(1, Number(titipDays) || 30);
  const titipCost = titipRawat ? dailyRate * days : 0;

  const shippingCost = calculateShippingCost(shippingMethod, originLokasi, shippingDest);

  const addonCost =
    (addonJagal ? ADDON_FEES.jagal : 0) + (addonKatering ? ADDON_FEES.katering : 0);

  return {
    schemeLabel,
    ternakCost,
    dailyRate,
    titipCost,
    shippingCost,
    addonCost,
    grandTotal: ternakCost + titipCost + shippingCost + addonCost,
  };
}

export function evaluateWeightShrinkage(expectedWeight, actualWeight) {
  const expected = Number(expectedWeight);
  const actual = Number(actualWeight);

  if (!Number.isFinite(actual) || actual <= 0 || !Number.isFinite(expected) || expected <= 0) {
    return {
      valid: false,
      shrinkagePct: 0,
      withinTolerance: false,
    };
  }

  const rawPct = ((expected - actual) / expected) * 100;
  const shrinkagePct = Math.max(0, Number(rawPct.toFixed(1)));

  return {
    valid: true,
    shrinkagePct,
    withinTolerance: rawPct <= 5,
  };
}

export function validateLivestockSubmission(formData, photos, requiredAngles) {
  const errors = [];

  if (!String(formData?.nama ?? '').trim()) errors.push('Nama ternak wajib diisi.');
  if (!String(formData?.usia ?? '').trim()) errors.push('Usia & status gigi wajib diisi.');
  if (!String(formData?.skkh ?? '').trim()) errors.push('Nomor sertifikat SKKH wajib diisi.');
  if (!String(formData?.peternak ?? '').trim()) errors.push('Nama kandang/peternak wajib diisi.');

  const bobot = Number(formData?.bobot);
  if (!Number.isFinite(bobot) || bobot < 15 || bobot > 1200) {
    errors.push('Estimasi bobot harus antara 15 hingga 1.200 kg.');
  }

  const harga = Number(formData?.harga);
  if (!Number.isFinite(harga) || harga < 500000) {
    errors.push('Harga minimal Rp 500.000.');
  }

  const missingAngles = requiredAngles.filter((slot) => !photos?.[slot.key]);
  if (missingAngles.length > 0) {
    errors.push(
      `Foto belum lengkap (${requiredAngles.length - missingAngles.length}/${requiredAngles.length}): ${missingAngles
        .map((m) => m.label)
        .join(', ')}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    missingAngles,
  };
}
