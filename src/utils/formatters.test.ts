import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRomanMonth,
  formatNomorSurat,
  formatRupiah,
  calculateRABTotal,
  calculateLABBalance,
  computeLABRecord,
  formatTanggalIndonesia,
} from './formatters';

test('getRomanMonth converts month names and indices correctly', () => {
  assert.equal(getRomanMonth('Januari'), 'I');
  assert.equal(getRomanMonth('juni'), 'VI');
  assert.equal(getRomanMonth('Agustus'), 'VIII');
  assert.equal(getRomanMonth('November'), 'XI');
  assert.equal(getRomanMonth('Desember'), 'XII');
  assert.equal(getRomanMonth(11), 'XI');
  assert.equal(getRomanMonth(1), 'I');
});

test('formatNomorSurat matches official format: 001/YMU/RQ/XI/2026', () => {
  assert.equal(formatNomorSurat(1, 'November', '2026'), '001/YMU/RQ/XI/2026');
  assert.equal(formatNomorSurat(15, 'Januari', '2025'), '015/YMU/RQ/I/2025');
  assert.equal(formatNomorSurat(102, 'Desember', '2026'), '102/YMU/RQ/XII/2026');
});

test('formatRupiah formats integer values with id-ID locale', () => {
  assert.equal(formatRupiah(1500000), 'Rp 1.500.000');
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah('250000'), 'Rp 250.000');
});

test('calculateRABTotal computes sum of dynamic item rows', () => {
  const items = [
    { jumlah: 500000 },
    { jumlah: 1250000 },
    { jumlah: '750000' },
  ];
  assert.equal(calculateRABTotal(items), 2500000);
  assert.equal(calculateRABTotal([]), 0);
});

test('calculateLABBalance computes saldo akhir correctly', () => {
  const res = calculateLABBalance(1000000, [
    { masuk: 500000, keluar: 0 },
    { masuk: 2000000, keluar: 0 },
    { masuk: 0, keluar: 800000 },
  ]);
  assert.equal(res.saldoAwal, 1000000);
  assert.equal(res.totalMasuk, 2500000);
  assert.equal(res.totalKeluar, 800000);
  assert.equal(res.saldoAkhir, 2700000);
});

test('formatTanggalIndonesia formats ISO date correctly', () => {
  assert.equal(formatTanggalIndonesia('2026-11-03'), '3 November 2026');
  assert.equal(formatTanggalIndonesia('2025-01-15'), '15 Januari 2025');
});

test('computeLABRecord updates totalMasuk, totalKeluar, saldoAkhir, and trxCount accurately', () => {
  const dummyLab = {
    id: 'lab-1',
    nomor: '001/YMU/RQ/XI/2026',
    bulan: 'November',
    tahun: 2026,
    tanggal: '2026-11-01',
    kota: 'Kibang Budi Jaya',
    ketuaRQ: 'AL MUTAQIN',
    bendaharaRQ: 'HAMIDAH FAUZIYAH',
    saldoAwal: 5000000,
    totalMasuk: 0,
    totalKeluar: 0,
    saldoAkhir: 5000000,
    trxCount: 0,
    hasLink: true,
  };

  const trxs = [
    { id: 't1', idLAB: 'lab-1', tanggal: '2026-11-02', keterangan: 'Infaq', masuk: 1500000, keluar: 0 },
    { id: 't2', idLAB: 'lab-1', tanggal: '2026-11-05', keterangan: 'Belanja ATK', masuk: 0, keluar: 500000 },
    { id: 't3', idLAB: 'other-lab', tanggal: '2026-11-06', keterangan: 'Other', masuk: 200000, keluar: 0 },
  ];

  const computed = computeLABRecord(dummyLab, trxs as any);
  assert.equal(computed.totalMasuk, 1500000);
  assert.equal(computed.totalKeluar, 500000);
  assert.equal(computed.saldoAkhir, 6000000);
  assert.equal(computed.trxCount, 2);
});
