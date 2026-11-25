import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCheckoutBreakdown,
  evaluateNegotiationOffer,
  evaluateWeightShrinkage,
  filterAndSortLivestock,
  validateLivestockSubmission,
} from './domain.js';

const SAMPLE_ITEMS = [
  {
    id: 'TRN-01',
    nama: 'Sapi Aceh Seulawah',
    jenis: 'Sapi Aceh',
    peruntukan: 'Kurban',
    lokasi: 'Aceh Besar',
    bobot: 320,
    harga: 21500000,
    peternak: 'Tgk. Sulaiman',
  },
  {
    id: 'TRN-02',
    nama: 'Kerbau Pidie Raya',
    jenis: 'Kerbau',
    peruntukan: 'Meugang / Potong',
    lokasi: 'Pidie',
    bobot: 460,
    harga: 31000000,
    peternak: 'H. Mukhtaruddin',
  },
  {
    id: 'TRN-03',
    nama: 'Kambing Etawa Syawal',
    jenis: 'Kambing Etawa',
    peruntukan: 'Akikah',
    lokasi: 'Banda Aceh',
    bobot: 42,
    harga: 3850000,
    peternak: 'Ust. Rizal',
  },
];

test('filterAndSortLivestock filters by jenis, lokasi, search and sorts by weight/price', () => {
  const onlySapi = filterAndSortLivestock(SAMPLE_ITEMS, { jenis: 'Sapi Aceh' });
  assert.equal(onlySapi.length, 1);
  assert.equal(onlySapi[0].id, 'TRN-01');

  const searchPidie = filterAndSortLivestock(SAMPLE_ITEMS, { search: 'pidie' });
  assert.equal(searchPidie.length, 1);
  assert.equal(searchPidie[0].id, 'TRN-02');

  const sortedByWeight = filterAndSortLivestock(SAMPLE_ITEMS, { sort: 'bobot-berat' });
  assert.deepEqual(
    sortedByWeight.map((i) => i.id),
    ['TRN-02', 'TRN-01', 'TRN-03']
  );

  const sortedByNegotiatedPrice = filterAndSortLivestock(
    SAMPLE_ITEMS,
    { sort: 'harga-rendah' },
    { 'TRN-02': 3000000 }
  );
  assert.equal(sortedByNegotiatedPrice[0].id, 'TRN-02');
});

test('evaluateNegotiationOffer accepts >= 90% and rejects < 90% with counter guidance', () => {
  const accepted = evaluateNegotiationOffer(20000000, 18000000);
  assert.equal(accepted.valid, true);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.agreedPrice, 18000000);

  const rejected = evaluateNegotiationOffer(20000000, 17500000);
  assert.equal(rejected.valid, true);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.minAcceptable, 18000000);

  const invalid = evaluateNegotiationOffer(20000000, -500);
  assert.equal(invalid.valid, false);
});

test('calculateCheckoutBreakdown computes DP, Patungan 1/7, Titip Rawat, Shipping, and Add-ons accurately', () => {
  const dpOrder = calculateCheckoutBreakdown({
    basePrice: 20000000,
    weightKg: 320,
    originLokasi: 'Aceh Besar',
    scheme: 'dp',
    titipRawat: true,
    titipDays: 30,
    shippingMethod: 'farmer',
    shippingDest: 'Aceh Besar',
    addonJagal: true,
    addonKatering: false,
  });

  assert.equal(dpOrder.ternakCost, 6000000);
  assert.equal(dpOrder.titipCost, 25000 * 30);
  assert.equal(dpOrder.shippingCost, 150000);
  assert.equal(dpOrder.addonCost, 350000);
  assert.equal(dpOrder.grandTotal, 6000000 + 750000 + 150000 + 350000);

  const patunganOrder = calculateCheckoutBreakdown({
    basePrice: 21000000,
    weightKg: 42,
    originLokasi: 'Aceh Besar',
    scheme: 'patungan',
    selectedSlotCount: 2,
    titipRawat: false,
    shippingMethod: 'pickup',
    shippingDest: 'Banda Aceh',
  });

  assert.equal(patunganOrder.ternakCost, 6000000);
  assert.equal(patunganOrder.shippingCost, 0);
  assert.equal(patunganOrder.grandTotal, 6000000);
});

test('evaluateWeightShrinkage enforces 5% tolerance rule', () => {
  const ok = evaluateWeightShrinkage(320, 306);
  assert.equal(ok.valid, true);
  assert.equal(ok.withinTolerance, true);
  assert.equal(ok.shrinkagePct, 4.4);

  const dispute = evaluateWeightShrinkage(320, 290);
  assert.equal(dispute.valid, true);
  assert.equal(dispute.withinTolerance, false);
  assert.equal(dispute.shrinkagePct, 9.4);
});

test('validateLivestockSubmission requires all 4 photos and valid numeric bounds', () => {
  const angles = [
    { key: 'samping', label: 'Tampak Samping' },
    { key: 'depan', label: 'Tampak Depan' },
    { key: 'gigi', label: 'Kondisi Gigi' },
    { key: 'belakang', label: 'Belakang & Kaki' },
  ];

  const missingPhotos = validateLivestockSubmission(
    {
      nama: 'Sapi Aceh Baru',
      usia: '2.5 Tahun',
      skkh: 'SKKH-01',
      peternak: 'Tgk. Hasan',
      bobot: 300,
      harga: 20000000,
    },
    { samping: 'data:image/png;base64,123', depan: null, gigi: null, belakang: null },
    angles
  );

  assert.equal(missingPhotos.valid, false);
  assert.equal(missingPhotos.missingAngles.length, 3);

  const complete = validateLivestockSubmission(
    {
      nama: 'Sapi Aceh Baru',
      usia: '2.5 Tahun',
      skkh: 'SKKH-01',
      peternak: 'Tgk. Hasan',
      bobot: 300,
      harga: 20000000,
    },
    {
      samping: 'img1',
      depan: 'img2',
      gigi: 'img3',
      belakang: 'img4',
    },
    angles
  );

  assert.equal(complete.valid, true);
});
