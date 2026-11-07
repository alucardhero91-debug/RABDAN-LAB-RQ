import React, { useState, useEffect } from 'react';
import { LABRecord, TransaksiRecord } from '../types';
import { formatRupiah, formatTanggalIndonesia } from '../utils/formatters';
import { generateLABPDFBlob } from '../services/pdfGenerator';
import { FileText, ExternalLink, Trash2, ArrowDownLeft, ArrowUpRight, Edit3 } from 'lucide-react';

interface TabTransaksiProps {
  labList: LABRecord[];
  transaksiList: TransaksiRecord[];
  onSubmitTransaksi: (data: {
    idLAB: string;
    tanggal: string;
    keterangan: string;
    masuk: number;
    keluar: number;
  }) => Promise<{ idLAB: string; updatedLAB?: LABRecord }>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onRequestDelete: (trx: TransaksiRecord) => void;
  onEditTransaksi: (trx: TransaksiRecord) => void;
}

export const TabTransaksi: React.FC<TabTransaksiProps> = ({
  labList,
  transaksiList,
  onSubmitTransaksi,
  onNotify,
  onRequestDelete,
  onEditTransaksi,
}) => {
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>('');
  const [keterangan, setKeterangan] = useState<string>('');
  const [trxType, setTrxType] = useState<'masuk' | 'keluar'>('masuk');
  const [nominal, setNominal] = useState<string>('');
  const [autoGenPDF, setAutoGenPDF] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resultCard, setResultCard] = useState<{
    show: boolean;
    msg: string;
    pdfUrl?: string;
    idLAB: string;
  }>({ show: false, msg: '', idLAB: '' });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setTanggal(today);

    if (labList.length > 0 && !selectedLabId) {
      setSelectedLabId(labList[0].id);
    }
  }, [labList, selectedLabId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLabId) {
      onNotify('Silakan pilih Bulan LAB terlebih dahulu', 'error');
      return;
    }
    const valNominal = Number(nominal) || 0;
    if (valNominal <= 0) {
      onNotify('Masukkan nominal transaksi yang valid', 'error');
      return;
    }

    const valMasuk = trxType === 'masuk' ? valNominal : 0;
    const valKeluar = trxType === 'keluar' ? valNominal : 0;

    setIsSubmitting(true);
    setResultCard({ show: false, msg: '', idLAB: '' });

    try {
      const res = await onSubmitTransaksi({
        idLAB: selectedLabId,
        tanggal,
        keterangan: keterangan.trim(),
        masuk: valMasuk,
        keluar: valKeluar,
      });

      const msg = `Transaksi ${trxType === 'masuk' ? 'Masuk' : 'Keluar'} berhasil disimpan!`;
      setKeterangan('');
      setNominal('');

      if (autoGenPDF) {
        onNotify(msg + ' — Membuat PDF LAB...', 'success');
        const targetLab = res.updatedLAB || labList.find((l) => l.id === res.idLAB);
        if (targetLab) {
          const submittedTrx: TransaksiRecord = {
            id: 'trx-new-' + Date.now(),
            idLAB: res.idLAB,
            tanggal,
            keterangan: keterangan.trim(),
            masuk: valMasuk,
            keluar: valKeluar,
          };
          const existingMatching = transaksiList.filter((t) => t.idLAB === res.idLAB);
          const allMatching = [submittedTrx, ...existingMatching];
          const pdf = generateLABPDFBlob(targetLab, allMatching);
          setResultCard({
            show: true,
            msg: msg + ' + PDF resmi terbit',
            pdfUrl: pdf.url,
            idLAB: res.idLAB,
          });
        }
      } else {
        onNotify(msg, 'success');
        setResultCard({
          show: true,
          msg,
          idLAB: res.idLAB,
        });
      }
    } catch (err: any) {
      onNotify('Gagal menyimpan transaksi: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualPDF = () => {
    const targetLab = labList.find((l) => l.id === resultCard.idLAB);
    if (!targetLab) return;
    const matchingTrx = transaksiList.filter((t) => t.idLAB === resultCard.idLAB);
    const pdf = generateLABPDFBlob(targetLab, matchingTrx);
    window.open(pdf.url, '_blank');
    setResultCard((prev) => ({ ...prev, pdfUrl: pdf.url }));
    onNotify('PDF LAB berhasil dibuat', 'success');
  };

  const filteredTrx = transaksiList.filter((t) => t.idLAB === selectedLabId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        {/* Pilih Bulan LAB */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Pilih Bulan LAB</span>
            <span className="text-rose-500">*</span>
          </label>
          <select
            id="idLAB"
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            {labList.length === 0 ? (
              <option value="">⚠️ Belum ada LAB — buat dulu di tab &quot;LAB&quot;</option>
            ) : (
              <>
                <option value="">-- Pilih Bulan LAB --</option>
                {labList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.bulan} {l.tahun} ({l.nomor})
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Tanggal Transaksi */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Tanggal Transaksi</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            id="tanggal"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Keterangan */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Keterangan Transaksi</span>
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="keterangan"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Contoh: Belanja Dapur / Infaq Santri"
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Mobile-Friendly Segmented Toggle: Masuk vs Keluar */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            Jenis &amp; Jumlah Arus Kas
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setTrxType('masuk')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                trxType === 'masuk'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Kas Masuk (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setTrxType('keluar')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                trxType === 'keluar'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Kas Keluar (-)</span>
            </button>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              Rp
            </span>
            <input
              type="number"
              id="nominal"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              placeholder="0"
              min="1"
              required
              className="w-full pl-11 pr-3.5 py-3 rounded-xl border border-slate-300 text-base sm:text-lg font-bold bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Auto Generate PDF Toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 cursor-pointer select-none">
          <input
            type="checkbox"
            id="autoGenPDF"
            checked={autoGenPDF}
            onChange={(e) => setAutoGenPDF(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
          />
          <span className="font-medium">Auto-generate PDF LAB setelah simpan</span>
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || labList.length === 0}
          className="w-full min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
        >
          <span>{isSubmitting ? '⏳ Menyimpan...' : '💾 Simpan Transaksi'}</span>
        </button>
      </form>

      {/* Result Card */}
      {resultCard.show && (
        <div className="bg-white p-4 rounded-xl border-l-4 border-emerald-500 shadow-sm space-y-2">
          <h3 className="text-sm font-bold text-slate-800">✅ {resultCard.msg}</h3>
          {resultCard.pdfUrl ? (
            <div>
              <p className="text-xs text-slate-500 mb-2">Dokumen PDF LAB siap dibuka:</p>
              <a
                href={resultCard.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors min-h-[42px]"
              >
                <ExternalLink className="w-4 h-4" />
                <span>🔗 Buka PDF</span>
              </a>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-2">Generate PDF LAB sekarang?</p>
              <button
                type="button"
                onClick={handleManualPDF}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors min-h-[42px]"
              >
                <FileText className="w-4 h-4" />
                <span>📄 Generate PDF</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected LAB Transactions Log */}
      {selectedLabId && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Transaksi Bulan Ini ({filteredTrx.length})
            </h3>
            {labList.find((l) => l.id === selectedLabId) && (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                Saldo: {formatRupiah(labList.find((l) => l.id === selectedLabId)?.saldoAkhir)}
              </span>
            )}
          </div>

          {filteredTrx.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center italic">
              Belum ada transaksi di bulan LAB yang dipilih.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTrx.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5 min-w-0 pr-1">
                    <div className="font-semibold text-slate-800 truncate">{t.keterangan}</div>
                    <div className="text-[11px] text-slate-400">
                      {formatTanggalIndonesia(t.tanggal)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {t.masuk > 0 && (
                      <span className="font-bold text-emerald-600">+{formatRupiah(t.masuk)}</span>
                    )}
                    {t.keluar > 0 && (
                      <span className="font-bold text-rose-600">-{formatRupiah(t.keluar)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditTransaksi(t)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
                      title="Edit transaksi"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDelete(t)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
                      title="Hapus transaksi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
