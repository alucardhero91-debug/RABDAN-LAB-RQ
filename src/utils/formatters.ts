import { LABRecord, TransaksiRecord } from '../types';

/**
 * Utility functions for RAB & LAB Rumah Qur'an Ulul Azmi
 */

export const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
] as const;

export type BulanName = typeof BULAN_NAMES[number];

const ROMAN_MONTHS: Record<string, string> = {
  januari: 'I',
  februari: 'II',
  maret: 'III',
  april: 'IV',
  mei: 'V',
  juni: 'VI',
  juli: 'VII',
  agustus: 'VIII',
  september: 'IX',
  oktober: 'X',
  november: 'XI',
  desember: 'XII',
};

/**
 * Returns Roman numeral for a given month name (or 1-12 index)
 */
export function getRomanMonth(month: string | number): string {
  if (typeof month === 'number') {
    const names = BULAN_NAMES;
    if (month >= 1 && month <= 12) {
      return ROMAN_MONTHS[names[month - 1].toLowerCase()] || 'I';
    }
    return 'I';
  }
  const clean = String(month || '').trim().toLowerCase();
  return ROMAN_MONTHS[clean] || 'I';
}

/**
 * Generates official letter number format: [nomor]/YMU/RQ/[bulan_romawi]/[tahun]
 * Example: 001/YMU/RQ/XI/2026
 */
export function formatNomorSurat(
  sequence: number,
  bulan: string | number,
  tahun: number | string,
  entity: string = 'YMU/RQ'
): string {
  const padded = String(Math.max(1, sequence)).padStart(3, '0');
  const roman = getRomanMonth(bulan);
  const year = String(tahun || new Date().getFullYear()).trim();
  return `${padded}/${entity}/${roman}/${year}`;
}

/**
 * Formats a numeric amount to Indonesian Rupiah representation: Rp 1.250.000
 */
export function formatRupiah(amount: number | string | null | undefined): string {
  const val = Math.round(Number(amount) || 0);
  return 'Rp ' + val.toLocaleString('id-ID');
}

/**
 * Parses numeric input safely
 */
export function parseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Sums up RAB items
 */
export function calculateRABTotal(items: Array<{ jumlah: number | string }>): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, item) => acc + parseNumber(item.jumlah), 0);
}

/**
 * Calculates LAB summary: total masuk, total keluar, and final balance
 */
export function calculateLABBalance(
  saldoAwal: number | string,
  transactions: Array<{ masuk?: number | string; keluar?: number | string }>
): {
  saldoAwal: number;
  totalMasuk: number;
  totalKeluar: number;
  saldoAkhir: number;
} {
  const awal = parseNumber(saldoAwal);
  let totalMasuk = 0;
  let totalKeluar = 0;

  if (Array.isArray(transactions)) {
    for (const trx of transactions) {
      totalMasuk += parseNumber(trx.masuk);
      totalKeluar += parseNumber(trx.keluar);
    }
  }

  const saldoAkhir = awal + totalMasuk - totalKeluar;
  return {
    saldoAwal: awal,
    totalMasuk,
    totalKeluar,
    saldoAkhir,
  };
}

/**
 * Computes an updated LABRecord with exact totalMasuk, totalKeluar, saldoAkhir,
 * and trxCount calculated dynamically from matching transactions.
 */
export function computeLABRecord(
  lab: LABRecord,
  transactions: TransaksiRecord[]
): LABRecord {
  if (!lab) return lab;
  const matchingTrx = (transactions || []).filter((t) => t.idLAB === lab.id);
  const balance = calculateLABBalance(lab.saldoAwal, matchingTrx);
  return {
    ...lab,
    totalMasuk: balance.totalMasuk,
    totalKeluar: balance.totalKeluar,
    saldoAkhir: balance.saldoAkhir,
    trxCount: matchingTrx.length,
  };
}

/**
 * Format ISO date string (YYYY-MM-DD) to Indonesian long format: 03 November 2026
 */
export function formatTanggalIndonesia(isoDateStr: string): string {
  if (!isoDateStr) return '';
  try {
    const [year, month, day] = isoDateStr.split('-');
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < BULAN_NAMES.length) {
      return `${parseInt(day, 10)} ${BULAN_NAMES[mIdx]} ${year}`;
    }
  } catch (e) {
    // fallback
  }
  return isoDateStr;
}
