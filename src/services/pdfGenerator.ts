import { jsPDF } from 'jspdf';
import { LABRecord, RABRecord, TransaksiRecord } from '../types';
import { LOGO_RQ_BASE64 } from './logoBase64';
import { KOP_SURAT_BASE64 } from './kopSuratBase64';

// Helper to format currency exactly as in sample PDFs
function formatCurrency(amount: number, withDecimals = false): string {
  const num = Math.round(Number(amount) || 0);
  const formatted = num.toLocaleString('id-ID');
  return withDecimals ? `Rp ${formatted},00` : `Rp ${formatted}`;
}

// Format date to Indonesian (e.g. "31 Agustus 2025" or "02 November 2026")
function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

// Generate rendered Arabic header image using HTML5 Canvas for flawless cursive rendering
function getArabicHeaderDataURL(): string {
  try {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 650;
    canvas.height = 170;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';

    // Line 1: Title (Bold)
    ctx.font = 'bold 38px "Traditional Arabic", "Amiri", "Times New Roman", "Scheherazade", serif';
    ctx.fillText('بيت القرآن أولو العزم', 640, 42);

    // Line 2: Address line 1
    ctx.font = 'normal 24px "Traditional Arabic", "Amiri", "Times New Roman", serif';
    ctx.fillText('أونيت 6، كيبانج بودي جايا، لمبو كيبانج', 640, 88);

    // Line 3: Address line 2
    ctx.font = 'normal 24px "Traditional Arabic", "Amiri", "Times New Roman", serif';
    ctx.fillText('توالنج بوانج غربي 34388 لمبونج', 640, 132);

    return canvas.toDataURL('image/png');
  } catch (e) {
    return '';
  }
}

/**
 * Draws the official standardized Kop Surat of Rumah Qur'an Ulul Azmi
 * using the newly uploaded official Kop image.
 */
function drawOfficialKopSurat(doc: jsPDF): number {
  const kopX = 15;
  const kopY = 10;
  const kopW = 180;
  // Aspect ratio is 4999 / 930 = 5.3752688
  const kopH = kopW / 5.3752688; // ~33.486 mm

  try {
    if (KOP_SURAT_BASE64) {
      doc.addImage(KOP_SURAT_BASE64, 'JPEG', kopX, kopY, kopW, kopH);
      return kopY + kopH + 3.5; // ~47 mm
    }
  } catch (e) {
    console.warn('Could not add official kop surat image to PDF:', e);
  }

  // Fallback to manual vector rendering if image is unavailable
  const leftX = 20;
  const rightX = 190;
  const logoX = 94.5;
  const logoY = 11;
  const logoSize = 21;

  // 1. Left: Indonesian Institution Header
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("RUMAH QUR'AN ULUL AZMI", leftX, 17);

  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text('Unit VI, Kibang Budi Jaya, Lambu Kibang', leftX, 22.5);
  doc.text('Tulang Bawang Barat 34388 Lampung', leftX, 27.5);
  doc.text('Telp. 0813 6748 7538', leftX, 32.5);

  // 2. Center: Logo
  try {
    if (LOGO_RQ_BASE64) {
      doc.addImage(LOGO_RQ_BASE64, 'JPEG', logoX, logoY, logoSize, logoSize);
    }
  } catch (e) {
    console.warn('Could not add logo image to PDF:', e);
  }

  // 3. Right: Arabic Header
  try {
    const arabicImg = getArabicHeaderDataURL();
    if (arabicImg) {
      doc.addImage(arabicImg, 'PNG', 128, 10, 62, 22);
    }
  } catch (e) {
    console.warn('Arabic header render notice:', e);
  }

  // 4. Horizontal Separator Line (Black double line)
  const lineY = 36;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(leftX, lineY, rightX, lineY);

  doc.setLineWidth(0.25);
  doc.line(leftX, lineY + 1.2, rightX, lineY + 1.2);

  return lineY + 8;
}

/**
 * ============================================================================
 * GENERATOR LAB (Laporan Anggaran Bulanan)
 * 3 Halaman Persis Sesuai Lampiran LAB_RQ_057a94ea.pdf
 * ============================================================================
 */
export function generateLABPDFBlob(
  rawLab: LABRecord,
  transactions: TransaksiRecord[] = []
): { blob: Blob; url: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Calculate real totals directly from transactions to guarantee 100% mathematical accuracy
  const matchingTrx = (transactions || []).filter((t) => !t.idLAB || t.idLAB === rawLab.id);
  const sumMasuk = matchingTrx.reduce((acc, t) => acc + (Number(t.masuk) || 0), 0);
  const sumKeluar = matchingTrx.reduce((acc, t) => acc + (Number(t.keluar) || 0), 0);
  const saldoAwal = Number(rawLab.saldoAwal) || 0;
  const computedSaldoAkhir = saldoAwal + sumMasuk - sumKeluar;

  const lab: LABRecord = {
    ...rawLab,
    totalMasuk: sumMasuk,
    totalKeluar: sumKeluar,
    saldoAkhir: computedSaldoAkhir,
    trxCount: matchingTrx.length,
  };

  const kota = lab.kota || 'Kibang Budi Jaya';
  const tglSurat = formatFullDate(lab.tanggal) || `${lab.bulan} ${lab.tahun}`;
  const ketuaName = (lab.ketuaRQ || 'AL MUTAQIN').toUpperCase();
  const bendaharaName = (lab.bendaharaRQ || 'HAMMAD').toUpperCase();

  // --------------------------------------------------------------------------
  // HALAMAN 1: Surat Pengantar Laporan Rekapitulasi Keuangan
  // --------------------------------------------------------------------------
  let y = drawOfficialKopSurat(doc);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);

  // Metadata surat
  doc.text(`Nomor : ${lab.nomor || '125/YUA/RQ/VIII/2025'}`, 20, y);
  y += 5.5;
  doc.text('Lamp. : 1 bundel', 20, y);
  y += 5.5;
  doc.text('Perihal : Laporan Rekapitulasi Keuangan', 20, y);
  y += 11;

  // Tujuan surat
  doc.text('KepadaYkh.', 20, y);
  y += 5.5;
  doc.setFont('times', 'bold');
  doc.text('Ketua Yayasan Misykatul Ummah', 20, y);
  y += 5.5;
  doc.setFont('times', 'normal');
  doc.text('Di Tempat', 20, y);
  y += 12;

  // Salam Pembuka & Isi Surat
  doc.setFont('times', 'bolditalic');
  doc.text('Assalamualaikum Warahmatullahi Wabarakatuh', 20, y);
  y += 6.5;

  doc.setFont('times', 'normal');
  const paragraf1 =
    "Alhamdulillah, segala puji bagi Allah Subhanahu wata'ala. Sholawat dan salam semoga tetap tercurah limpahkan kepada Nabi Muhammad Shallallahu 'alaihi wasallam.";
  const splitP1 = doc.splitTextToSize(paragraf1, 170);
  doc.text(splitP1, 20, y);
  y += splitP1.length * 5.2 + 2;

  const paragraf2 = `Bersama ini kami sampaikan kepada ketua Yayasan Misykatul Ummah, sirkulasi keuangan Rumah Qur’an Ulul Azmi selama bulan ${lab.bulan} ${lab.tahun}. Adapun rinciannya sebagai berikut;`;
  const splitP2 = doc.splitTextToSize(paragraf2, 170);
  doc.text(splitP2, 20, y);
  y += splitP2.length * 5.2 + 2;

  // Poin-poin lampiran
  doc.text(`1.  Rekapitulasi keuangan bulan ${lab.bulan} ${lab.tahun} (terlampir)`, 25, y);
  y += 5.5;
  doc.text(`2.  Laporan jumlah pemasukan dan pengeluaran bulan ${lab.bulan} ${lab.tahun} (terlampir)`, 25, y);
  y += 5.5;
  doc.text('3.  Bukti pemasukan dan pengeluaran (terlampir)', 25, y);
  y += 8;

  // Penutup
  const paragraf3 =
    'Demikian laporan yang kami buat, atas perhatiannya kami ucapkan Jazakumullah Khoiron.';
  doc.text(paragraf3, 20, y);
  y += 6;

  doc.setFont('times', 'bolditalic');
  doc.text('Wassalamualaikum Warahmatullahi Wabarakatuh', 20, y);
  y += 24;

  // Tanda Tangan Halaman 1
  // Tanggal di atas kolom kanan
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(`${kota}, ${tglSurat}`, 155, y, { align: 'center' });
  y += 8;

  doc.text('Mengetahui,', 105, y, { align: 'center' });
  y += 7;

  // Dua kolom tanda tangan
  const colLeft = 55;
  const colRight = 155;

  doc.text("Ketua Rumah Qur'an", colLeft, y, { align: 'center' });
  doc.text("Bendahara Rumah Qur'an", colRight, y, { align: 'center' });

  y += 26; // Ruang tanda tangan

  doc.setFont('times', 'bold');
  doc.text(ketuaName, colLeft, y, { align: 'center' });
  // Underline
  const ketuaWidth = doc.getTextWidth(ketuaName);
  doc.setLineWidth(0.3);
  doc.line(colLeft - ketuaWidth / 2, y + 1, colLeft + ketuaWidth / 2, y + 1);

  doc.text(bendaharaName, colRight, y, { align: 'center' });
  const bendaharaWidth = doc.getTextWidth(bendaharaName);
  doc.line(colRight - bendaharaWidth / 2, y + 1, colRight + bendaharaWidth / 2, y + 1);

  // --------------------------------------------------------------------------
  // HALAMAN 2: Rekapitulasi Keuangan Bulan [Bulan] [Tahun]
  // --------------------------------------------------------------------------
  doc.addPage();
  y = drawOfficialKopSurat(doc);

  // Judul Tabel Halaman 2
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`REKAPITULASI KEUANGAN BULAN ${(lab.bulan || '').toUpperCase()} ${lab.tahun}`, 105, y, {
    align: 'center',
  });
  y += 5.5;
  doc.text("RUMAH QUR'AN ULUL AZMI", 105, y, { align: 'center' });
  y += 7;

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Bulan : ${lab.bulan} ${lab.tahun}`, 20, y);
  y += 3;

  // Definisi Kolom Tabel Rekapitulasi
  // Total width: 170mm (from 20 to 190)
  const cols = [20, 42, 51, 114, 140, 166, 190];
  const rowH = 6;

  // Header Tabel
  doc.setFillColor(255, 255, 255);
  doc.rect(cols[0], y, cols[6] - cols[0], rowH + 1, 'S');

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('Hari/Tgl', (cols[0] + cols[1]) / 2, y + 4.5, { align: 'center' });
  doc.text('No', (cols[1] + cols[2]) / 2, y + 4.5, { align: 'center' });
  doc.text('Keterangan', (cols[2] + cols[3]) / 2, y + 4.5, { align: 'center' });
  doc.text('Masuk', (cols[3] + cols[4]) / 2, y + 4.5, { align: 'center' });
  doc.text('Keluar', (cols[4] + cols[5]) / 2, y + 4.5, { align: 'center' });
  doc.text('Saldo', (cols[5] + cols[6]) / 2, y + 4.5, { align: 'center' });

  // Grid vertical header lines
  for (let i = 1; i < cols.length - 1; i++) {
    doc.line(cols[i], y, cols[i], y + rowH + 1);
  }
  y += rowH + 1;

  // Baris 0: Saldo Awal Kas
  let runningSaldo = Number(lab.saldoAwal) || 0;
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.rect(cols[0], y, cols[6] - cols[0], rowH, 'S');
  for (let i = 1; i < cols.length - 1; i++) {
    doc.line(cols[i], y, cols[i], y + rowH);
  }
  doc.text(`Saldo Awal ${lab.bulan} ${lab.tahun}`, cols[2] + 2, y + 4.2);
  doc.text(formatCurrency(runningSaldo, true), cols[4] - 2, y + 4.2, { align: 'right' });
  doc.text(formatCurrency(runningSaldo, true), cols[6] - 2, y + 4.2, { align: 'right' });
  y += rowH;

  // Baris-baris Transaksi
  const sortedTrx = [...transactions].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  sortedTrx.forEach((trx, idx) => {
    // Check if page overflow
    if (y > 240) {
      doc.addPage();
      y = drawOfficialKopSurat(doc) + 5;
    }

    const masuk = Number(trx.masuk) || 0;
    const keluar = Number(trx.keluar) || 0;
    runningSaldo += masuk - keluar;

    doc.rect(cols[0], y, cols[6] - cols[0], rowH, 'S');
    for (let i = 1; i < cols.length - 1; i++) {
      doc.line(cols[i], y, cols[i], y + rowH);
    }

    // Hari/Tgl format (DD/MM/YYYY)
    let tglDisplay = trx.tanggal;
    try {
      const parts = trx.tanggal.split('-');
      if (parts.length === 3) {
        tglDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}

    doc.text(tglDisplay, (cols[0] + cols[1]) / 2, y + 4.2, { align: 'center' });
    doc.text(String(idx + 1), (cols[1] + cols[2]) / 2, y + 4.2, { align: 'center' });
    
    // Truncate keterangan if too long
    const ket = doc.splitTextToSize(trx.keterangan || '-', cols[3] - cols[2] - 3);
    doc.text(ket[0] || '-', cols[2] + 2, y + 4.2);

    if (masuk > 0) {
      doc.text(formatCurrency(masuk, true), cols[4] - 2, y + 4.2, { align: 'right' });
    }
    if (keluar > 0) {
      doc.text(formatCurrency(keluar, true), cols[5] - 2, y + 4.2, { align: 'right' });
    }
    doc.text(formatCurrency(runningSaldo, true), cols[6] - 2, y + 4.2, { align: 'right' });

    y += rowH;
  });

  // Baris SALDO AKHIR
  doc.setFont('times', 'bold');
  doc.rect(cols[0], y, cols[6] - cols[0], rowH + 1, 'S');
  doc.line(cols[5], y, cols[5], y + rowH + 1);
  doc.text('SALDO AKHIR', (cols[0] + cols[5]) / 2, y + 4.8, { align: 'center' });
  doc.text(formatCurrency(lab.saldoAkhir, true), cols[6] - 2, y + 4.8, { align: 'right' });
  y += rowH + 8;

  // Tanda Tangan Halaman 2
  if (y > 245) {
    doc.addPage();
    y = drawOfficialKopSurat(doc) + 15;
  }
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(`${kota}, ${tglSurat}`, 155, y, { align: 'center' });
  y += 7;

  doc.text('Mengetahui,', 105, y, { align: 'center' });
  y += 7;

  doc.text("Ketua Rumah Qur'an", colLeft, y, { align: 'center' });
  doc.text("Bendahara Rumah Qur'an", colRight, y, { align: 'center' });
  y += 26;

  doc.setFont('times', 'bold');
  doc.text(ketuaName, colLeft, y, { align: 'center' });
  doc.line(colLeft - ketuaWidth / 2, y + 1, colLeft + ketuaWidth / 2, y + 1);

  doc.text(bendaharaName, colRight, y, { align: 'center' });
  doc.line(colRight - bendaharaWidth / 2, y + 1, colRight + bendaharaWidth / 2, y + 1);

  // --------------------------------------------------------------------------
  // HALAMAN 3: Laporan Jumlah Pemasukan dan Pengeluaran
  // --------------------------------------------------------------------------
  doc.addPage();
  y = drawOfficialKopSurat(doc);

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('LAPORAN JUMLAH PEMASUKAN DAN PENGELUARAN', 105, y, { align: 'center' });
  y += 5.5;
  doc.text(`BULAN ${(lab.bulan || '').toUpperCase()} ${lab.tahun}`, 105, y, { align: 'center' });
  y += 10;

  // Tabel Rekap Sederhana 4 Kolom
  // Total width: 146mm (from 32 to 178)
  const sumCols = [32, 45, 88, 133, 178];
  const sumRowH = 8;

  // Header
  doc.rect(sumCols[0], y, sumCols[4] - sumCols[0], sumRowH, 'S');
  for (let i = 1; i < sumCols.length - 1; i++) {
    doc.line(sumCols[i], y, sumCols[i], y + sumRowH);
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text('No', (sumCols[0] + sumCols[1]) / 2, y + 5.5, { align: 'center' });
  doc.text('Bulan', (sumCols[1] + sumCols[2]) / 2, y + 5.5, { align: 'center' });
  doc.text('Pemasukan', (sumCols[2] + sumCols[3]) / 2, y + 5.5, { align: 'center' });
  doc.text('Pengeluaran', (sumCols[3] + sumCols[4]) / 2, y + 5.5, { align: 'center' });
  y += sumRowH;

  // Data row
  doc.rect(sumCols[0], y, sumCols[4] - sumCols[0], sumRowH, 'S');
  for (let i = 1; i < sumCols.length - 1; i++) {
    doc.line(sumCols[i], y, sumCols[i], y + sumRowH);
  }

  const grandTotalMasuk = (Number(lab.saldoAwal) || 0) + (Number(lab.totalMasuk) || 0);

  doc.setFont('times', 'normal');
  doc.text('1', (sumCols[0] + sumCols[1]) / 2, y + 5.5, { align: 'center' });
  doc.text(`01 ${lab.bulan} ${lab.tahun}`, sumCols[1] + 3, y + 5.5);
  doc.text(formatCurrency(grandTotalMasuk, true), sumCols[3] - 3, y + 5.5, { align: 'right' });
  doc.text(formatCurrency(lab.totalKeluar, true), sumCols[4] - 3, y + 5.5, { align: 'right' });
  y += sumRowH + 8;

  // Rumus Saldo Akhir di bawah tabel
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  const formulaStr = `Saldo akhir = ${formatCurrency(grandTotalMasuk, true)} – ${formatCurrency(lab.totalKeluar, true)} = ${formatCurrency(lab.saldoAkhir, true)}`;
  doc.text(formulaStr, 32, y);
  y += 24;

  // Tanda Tangan Halaman 3
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(`${kota}, ${tglSurat}`, 155, y, { align: 'center' });
  y += 7;

  doc.text('Mengetahui,', 105, y, { align: 'center' });
  y += 7;

  doc.text("Ketua Rumah Qur'an", colLeft, y, { align: 'center' });
  doc.text("Bendahara Rumah Qur'an", colRight, y, { align: 'center' });
  y += 26;

  doc.setFont('times', 'bold');
  doc.text(ketuaName, colLeft, y, { align: 'center' });
  doc.line(colLeft - ketuaWidth / 2, y + 1, colLeft + ketuaWidth / 2, y + 1);

  doc.text(bendaharaName, colRight, y, { align: 'center' });
  doc.line(colRight - bendaharaWidth / 2, y + 1, colRight + bendaharaWidth / 2, y + 1);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

/**
 * ============================================================================
 * GENERATOR RAB (Rencana Anggaran Biaya)
 * 2 Halaman Persis Sesuai Lampiran RAB_RQ_e82518b1.pdf
 * ============================================================================
 */
export function generateRABPDFBlob(rab: RABRecord): { blob: Blob; url: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const kota = rab.kota || 'Kibang Budi Jaya';
  const tglSurat = formatFullDate(rab.tanggal) || `${rab.bulan} ${rab.tahun}`;
  const ketuaRQName = (rab.ketuaRQ || 'AL MUTAQIN').toUpperCase();
  const bendaharaRQName = (rab.bendaharaRQ || 'HAMIDAH FAUZIYAH').toUpperCase();
  const ketuaYayasanName = (rab.ketuaYayasan || 'SURYADI').toUpperCase();

  // --------------------------------------------------------------------------
  // HALAMAN 1: Surat Permohonan RAB
  // --------------------------------------------------------------------------
  let y = drawOfficialKopSurat(doc);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);

  // Metadata Surat
  doc.text(`Nomor : ${rab.nomor || '0/YMU/RQ/XI/2026'}`, 20, y);
  y += 5.5;
  doc.text('Lamp. : -', 20, y);
  y += 5.5;
  doc.text('Perihal : ', 20, y);
  doc.setFont('times', 'bold');
  doc.text('Permohonan', 37, y);
  y += 11;

  // Tujuan Surat
  doc.setFont('times', 'normal');
  doc.text('KepadaYkh.', 20, y);
  y += 5.5;
  doc.setFont('times', 'bold');
  doc.text('Ketua Yayasan Misykatul Ummah', 20, y);
  y += 5.5;
  doc.setFont('times', 'normal');
  doc.text('Di Tempat', 20, y);
  y += 12;

  // Salam Pembuka & Isi Surat
  doc.setFont('times', 'bolditalic');
  doc.text('Assalamualaikum Warahmatullahi Wabarakatuh', 20, y);
  y += 6.5;

  doc.setFont('times', 'normal');
  const paragraf1 =
    "Alhamdulillah, segala puji bagi Allah Subhanahu wata'ala. Sholawat dan salam semoga tetap tercurah limpahkan kepada Nabi Muhammad Shallallahu 'alaihi wasallam.";
  const splitP1 = doc.splitTextToSize(paragraf1, 170);
  doc.text(splitP1, 20, y);
  y += splitP1.length * 5.2 + 2;

  const paragraf2 =
    "Untuk menunjang sarana prasarana dan kegiatan belajar mengajar di Rumah Qur'an Ulul Azmi pada setiap bulannya, maka dengan ini kami mengajukan Rencana Anggaran Biaya oprasional Rumah Qur'an. Adapun rincian Rencana Anggaran Biaya terlampir.";
  const splitP2 = doc.splitTextToSize(paragraf2, 170);
  doc.text(splitP2, 20, y);
  y += splitP2.length * 5.2 + 2;

  const paragraf3 =
    'Demikian surat permohonan ini yang kami buat, mohon kiranya agar diterima dan ditindaklanjuti. Atas perhatiannya kami ucapkan Jazakumullah Khoiron';
  const splitP3 = doc.splitTextToSize(paragraf3, 170);
  doc.text(splitP3, 20, y);
  y += splitP3.length * 5.2 + 2;

  doc.setFont('times', 'bolditalic');
  doc.text('Wassalamualaikum Warahmatullahi Wabarakatuh.', 20, y);
  y += 18;

  // Tanggal Surat
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text(`${kota}, ${tglSurat}`, 155, y, { align: 'center' });
  y += 8;

  // Mengetahui
  doc.text('Mengetahui,', 105, y, { align: 'center' });
  y += 7;

  // Dua kolom (Ketua RQ & Bendahara RQ)
  const colLeft = 55;
  const colRight = 155;

  doc.text("Ketua RQ Ulul Azmi", colLeft, y, { align: 'center' });
  doc.text("Bendahara RQ Ulul Azmi", colRight, y, { align: 'center' });
  y += 24;

  doc.setFont('times', 'bold');
  doc.text(ketuaRQName, colLeft, y, { align: 'center' });
  const ketuaRQWidth = doc.getTextWidth(ketuaRQName);
  doc.setLineWidth(0.3);
  doc.line(colLeft - ketuaRQWidth / 2, y + 1, colLeft + ketuaRQWidth / 2, y + 1);

  doc.text(bendaharaRQName, colRight, y, { align: 'center' });
  const bendaharaRQWidth = doc.getTextWidth(bendaharaRQName);
  doc.line(colRight - bendaharaRQWidth / 2, y + 1, colRight + bendaharaWidth(bendaharaRQName) / 2, y + 1);

  y += 10;

  // Baris Menyetujui (Ketua Yayasan di tengah bawah)
  doc.setFont('times', 'normal');
  doc.text('Yang menyetujui,', 105, y, { align: 'center' });
  y += 5.5;
  doc.text('Ketua Yayasan Misykatul Ummah', 105, y, { align: 'center' });
  y += 24;

  doc.setFont('times', 'bold');
  doc.text(ketuaYayasanName, 105, y, { align: 'center' });
  const yayasanWidth = doc.getTextWidth(ketuaYayasanName);
  doc.line(105 - yayasanWidth / 2, y + 1, 105 + yayasanWidth / 2, y + 1);

  // Helper inside scope
  function bendaharaWidth(name: string) {
    return doc.getTextWidth(name);
  }

  // --------------------------------------------------------------------------
  // HALAMAN 2: Lampiran Rencana Anggaran Biaya
  // --------------------------------------------------------------------------
  doc.addPage();
  y = 25; // Sesuai lampiran tidak ada kop surat di halaman 2 lampiran RAB

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Lampiran', 35, y);
  y += 10;

  doc.setFont('times', 'bold');
  doc.text('I.       Rencana Anggaran Biaya', 35, y);
  y += 4;

  // Tabel 3 Kolom
  // Total width: 135mm (from 35 to 170)
  const rabCols = [35, 48, 125, 170];
  const rabRowH = 7.5;

  // Header
  doc.rect(rabCols[0], y, rabCols[3] - rabCols[0], rabRowH, 'S');
  for (let i = 1; i < rabCols.length - 1; i++) {
    doc.line(rabCols[i], y, rabCols[i], y + rabRowH);
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text('No', (rabCols[0] + rabCols[1]) / 2, y + 5.2, { align: 'center' });
  doc.text('Rincian Kebutuhan', (rabCols[1] + rabCols[2]) / 2, y + 5.2, { align: 'center' });
  doc.text('Jumlah', (rabCols[2] + rabCols[3]) / 2, y + 5.2, { align: 'center' });
  y += rabRowH;

  // Item Rows
  doc.setFont('times', 'normal');
  doc.setFontSize(9);

  let totalRAB = 0;
  rab.items.forEach((item, idx) => {
    const jml = Number(item.jumlah) || 0;
    totalRAB += jml;

    doc.rect(rabCols[0], y, rabCols[3] - rabCols[0], rabRowH, 'S');
    for (let i = 1; i < rabCols.length - 1; i++) {
      doc.line(rabCols[i], y, rabCols[i], y + rabRowH);
    }

    doc.text(String(idx + 1), (rabCols[0] + rabCols[1]) / 2, y + 5.2, { align: 'center' });
    doc.text(item.rincian || '-', rabCols[1] + 3, y + 5.2);
    doc.text(formatCurrency(jml, false), rabCols[2] + 3, y + 5.2);

    y += rabRowH;
  });

  // Total Row
  doc.setFont('times', 'bold');
  doc.rect(rabCols[0], y, rabCols[3] - rabCols[0], rabRowH, 'S');
  doc.line(rabCols[2], y, rabCols[2], y + rabRowH);

  doc.text('Jumlah Total', (rabCols[0] + rabCols[2]) / 2, y + 5.2, { align: 'center' });
  doc.text(formatCurrency(totalRAB || rab.total, false), rabCols[2] + 3, y + 5.2);

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  return { blob, url };
}
