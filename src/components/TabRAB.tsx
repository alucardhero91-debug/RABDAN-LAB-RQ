import React, { useState, useEffect } from 'react';
import { BULAN_NAMES, formatNomorSurat, formatRupiah, calculateRABTotal } from '../utils/formatters';
import { RABRecord, RABItem } from '../types';
import { generateRABPDFBlob } from '../services/pdfGenerator';
import { Sparkles, Plus, Trash2, ExternalLink } from 'lucide-react';

interface TabRABProps {
  rabList: RABRecord[];
  onSubmitRAB: (data: Omit<RABRecord, 'id' | 'hasLink'>) => Promise<RABRecord>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const TabRAB: React.FC<TabRABProps> = ({
  rabList,
  onSubmitRAB,
  onNotify,
}) => {
  const now = new Date();
  const currentMonthName = BULAN_NAMES[now.getMonth()];
  const currentYear = now.getFullYear();

  const [bulan, setBulan] = useState<string>(currentMonthName);
  const [tahun, setTahun] = useState<number>(currentYear);
  const [nomor, setNomor] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>(now.toISOString().split('T')[0]);
  const [kota, setKota] = useState<string>('Kibang Budi Jaya');
  const [ketuaRQ, setKetuaRQ] = useState<string>('AL MUTAQIN');
  const [bendaharaRQ, setBendaharaRQ] = useState<string>('HAMIDAH FAUZIYAH');
  const [ketuaYayasan, setKetuaYayasan] = useState<string>('SURYADI');
  const [autoGenPDF, setAutoGenPDF] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Dynamic RAB items - start clean with no sample/dummy data
  const [items, setItems] = useState<RABItem[]>([
    { id: '1', rincian: '', jumlah: 0 },
  ]);

  const [resultCard, setResultCard] = useState<{
    show: boolean;
    msg: string;
    pdfUrl?: string;
    rab?: RABRecord;
  }>({ show: false, msg: '' });

  useEffect(() => {
    if (bulan && tahun) {
      const countForPeriod = rabList.filter((r) => r.tahun === Number(tahun)).length;
      const autoNum = formatNomorSurat(countForPeriod + 1, bulan, tahun);
      setNomor(autoNum);
    }
  }, [bulan, tahun, rabList]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), rincian: '', jumlah: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ id: Date.now().toString(), rincian: '', jumlah: 0 }]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemRincian = (index: number, val: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rincian: val };
      return updated;
    });
  };

  const updateItemJumlah = (index: number, val: string) => {
    const num = Number(val) || 0;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], jumlah: num };
      return updated;
    });
  };

  const totalRAB = calculateRABTotal(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomor.trim()) {
      onNotify('Nomor surat tidak boleh kosong', 'error');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].rincian.trim()) {
        onNotify(`Item #${i + 1}: Rincian kebutuhan belum diisi`, 'error');
        return;
      }
      if (items[i].jumlah <= 0) {
        onNotify(`Item #${i + 1}: Jumlah anggaran harus lebih dari 0`, 'error');
        return;
      }
    }

    setIsSubmitting(true);
    setResultCard({ show: false, msg: '' });

    try {
      const created = await onSubmitRAB({
        nomor: nomor.trim(),
        bulan,
        tahun: Number(tahun),
        tanggal,
        kota: kota.trim(),
        ketuaRQ: ketuaRQ.trim(),
        bendaharaRQ: bendaharaRQ.trim(),
        ketuaYayasan: ketuaYayasan.trim(),
        total: totalRAB,
        itemCount: items.length,
        items,
      });

      const msg = `RAB periode ${bulan} ${tahun} berhasil disimpan!`;

      if (autoGenPDF) {
        onNotify(msg + ' — Membuat PDF RAB...', 'success');
        const pdf = generateRABPDFBlob(created);
        setResultCard({
          show: true,
          msg: msg + ' + PDF RAB Jadi',
          pdfUrl: pdf.url,
          rab: created,
        });
      } else {
        onNotify(msg, 'success');
        setResultCard({
          show: true,
          msg,
          rab: created,
        });
      }
      setItems([{ id: Date.now().toString(), rincian: '', jumlah: 0 }]);
    } catch (err: any) {
      onNotify('Gagal menyimpan RAB: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        {/* Nomor Surat with auto badge */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <span>Nomor Surat FIA</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              <Sparkles className="w-3 h-3" /> auto
            </span>
          </label>
          <input
            type="text"
            id="rab-nomor"
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <small className="block text-[11px] text-slate-400">
            Format: <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">nomor/YMU/RQ/bulan_romawi/tahun</code>
          </small>
        </div>

        {/* Bulan & Tahun */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Bulan</label>
            <select
              id="rab-bulan"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              required
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {BULAN_NAMES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Tahun</label>
            <input
              type="number"
              id="rab-tahun"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              min="2020"
              max="2100"
              required
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Tanggal Surat */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Tanggal Surat</label>
          <input
            type="date"
            id="rab-tanggal"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Kota */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Kota</label>
          <input
            type="text"
            id="rab-kota"
            value={kota}
            onChange={(e) => setKota(e.target.value)}
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Ketua RQ & Bendahara RQ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Ketua RQ</label>
            <input
              type="text"
              id="rab-ketuaRQ"
              value={ketuaRQ}
              onChange={(e) => setKetuaRQ(e.target.value)}
              placeholder="AL MUTAQIN"
              required
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Bendahara RQ</label>
            <input
              type="text"
              id="rab-bendaharaRQ"
              value={bendaharaRQ}
              onChange={(e) => setBendaharaRQ(e.target.value)}
              placeholder="HAMIDAH FAUZIYAH"
              required
              className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Ketua Yayasan */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Ketua Yayasan</label>
          <input
            type="text"
            id="rab-ketuaYayasan"
            value={ketuaYayasan}
            onChange={(e) => setKetuaYayasan(e.target.value)}
            placeholder="SURYADI"
            required
            className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm sm:text-base bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Rincian Anggaran (Mobile Responsive Items) */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              📋 Rincian Kebutuhan Anggaran ({items.length} item)
            </span>
          </div>

          <div id="rab-items" className="space-y-2.5">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2"
              >
                <div className="flex items-center justify-between sm:hidden">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Item #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                    title="Hapus item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <span className="hidden sm:inline-block w-5 text-center text-xs font-bold text-slate-400">
                  {index + 1}
                </span>

                <input
                  type="text"
                  value={item.rincian}
                  onChange={(e) => updateItemRincian(index, e.target.value)}
                  placeholder="Rincian kebutuhan"
                  required
                  className="w-full sm:flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
                />

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={item.jumlah || ''}
                      onChange={(e) => updateItemJumlah(index, e.target.value)}
                      placeholder="0"
                      min="0"
                      required
                      className="w-full pl-8 pr-2.5 py-2 text-xs sm:text-sm font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500 text-right"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="hidden sm:flex p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Hapus item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="w-full min-h-[44px] py-2.5 px-3 border-2 border-dashed border-emerald-400 hover:bg-emerald-50/50 text-emerald-700 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>➕ Tambah Item Kebutuhan</span>
          </button>

          {/* Total Box */}
          <div className="flex items-center justify-between p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-slate-800">
            <span className="text-xs sm:text-sm font-bold">Total RAB FIA:</span>
            <strong id="rab-total" className="text-base sm:text-lg font-black text-amber-800">
              {formatRupiah(totalRAB)}
            </strong>
          </div>
        </div>

        {/* Auto Generate PDF Toggle */}
        <label className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 cursor-pointer select-none">
          <input
            type="checkbox"
            id="autoGenRABPDF"
            checked={autoGenPDF}
            onChange={(e) => setAutoGenPDF(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
          />
          <span className="font-medium">Auto-generate PDF RAB setelah simpan</span>
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[48px] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer"
        >
          <span>{isSubmitting ? '⏳ Menyimpan RAB...' : '💾 Simpan RAB'}</span>
        </button>
      </form>

      {/* Result Card */}
      {resultCard.show && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border-l-4 border-emerald-500 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800">✅ {resultCard.msg}</h3>
          {resultCard.pdfUrl && (
            <div className="pt-1">
              <a
                href={resultCard.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors min-h-[42px]"
              >
                <ExternalLink className="w-4 h-4" />
                <span>🔗 Buka Dokumen PDF RAB</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
