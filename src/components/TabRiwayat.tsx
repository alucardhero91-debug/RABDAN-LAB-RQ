import React, { useState, useMemo } from 'react';
import { LABRecord, RABRecord, TransaksiRecord } from '../types';
import {
  formatRupiah,
  formatTanggalIndonesia,
  computeLABRecord,
} from '../utils/formatters';
import { generateLABPDFBlob, generateRABPDFBlob } from '../services/pdfGenerator';
import {
  RefreshCw,
  FileText,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Calendar,
} from 'lucide-react';

interface TabRiwayatProps {
  labList: LABRecord[];
  rabList: RABRecord[];
  transaksiList: TransaksiRecord[];
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onRequestDeleteLAB: (lab: LABRecord) => void;
  onRequestDeleteRAB: (rab: RABRecord) => void;
  onEditTransaksi?: (trx: TransaksiRecord) => void;
  onRequestDeleteTransaksi?: (trx: TransaksiRecord) => void;
}

export const TabRiwayat: React.FC<TabRiwayatProps> = ({
  labList,
  rabList,
  transaksiList,
  onRefresh,
  isRefreshing,
  onNotify,
  onRequestDeleteLAB,
  onRequestDeleteRAB,
  onEditTransaksi,
  onRequestDeleteTransaksi,
}) => {
  // Segment: 'transaksi' (Default so user sees all transaction history immediately), 'lab', 'rab'
  const [activeSegment, setActiveSegment] = useState<'transaksi' | 'lab' | 'rab'>('transaksi');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters for Transaksi segment
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLabId, setFilterLabId] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'masuk' | 'keluar'>('all');

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Dynamically computed LABs where totals match transactions 100%
  const computedLabs = useMemo(() => {
    return labList.map((l) => computeLABRecord(l, transaksiList));
  }, [labList, transaksiList]);

  // Filtered transactions for the 'transaksi' view
  const filteredTransactions = useMemo(() => {
    return transaksiList.filter((t) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKet = (t.keterangan || '').toLowerCase().includes(q);
        const matchesDate = (t.tanggal || '').includes(q);
        if (!matchesKet && !matchesDate) return false;
      }
      // 2. Filter LAB
      if (filterLabId !== 'all' && t.idLAB !== filterLabId) {
        return false;
      }
      // 3. Filter Type
      if (filterType === 'masuk' && !(Number(t.masuk) > 0)) {
        return false;
      }
      if (filterType === 'keluar' && !(Number(t.keluar) > 0)) {
        return false;
      }
      return true;
    });
  }, [transaksiList, searchQuery, filterLabId, filterType]);

  // Aggregate sums for filtered transactions
  const trxSummary = useMemo(() => {
    const totalMasuk = filteredTransactions.reduce((acc, t) => acc + (Number(t.masuk) || 0), 0);
    const totalKeluar = filteredTransactions.reduce((acc, t) => acc + (Number(t.keluar) || 0), 0);
    const selisih = totalMasuk - totalKeluar;
    return { totalMasuk, totalKeluar, selisih };
  }, [filteredTransactions]);

  const handleGeneratePDF = async (type: 'RAB' | 'LAB', id: string) => {
    setGeneratingId(id);
    try {
      if (type === 'RAB') {
        const rab = rabList.find((r) => r.id === id);
        if (!rab) return;
        const pdf = generateRABPDFBlob(rab);
        window.open(pdf.url, '_blank');
        onNotify('✅ PDF RAB berhasil dibuat', 'success');
      } else {
        const lab = computedLabs.find((l) => l.id === id) || labList.find((l) => l.id === id);
        if (!lab) return;
        const matchingTrx = transaksiList.filter((t) => t.idLAB === id);
        const computedLab = computeLABRecord(lab, matchingTrx);
        const pdf = generateLABPDFBlob(computedLab, matchingTrx);
        window.open(pdf.url, '_blank');
        onNotify('✅ PDF LAB resmi berhasil dibuat', 'success');
      }
    } catch (e: any) {
      onNotify('Gagal membuat PDF: ' + (e.message || 'Error'), 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 3-Way Segment Control: Transaksi, LAB, RAB */}
      <div className="flex bg-white p-1 rounded-2xl shadow-xs border border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveSegment('transaksi')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeSegment === 'transaksi'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          💰 Transaksi ({transaksiList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment('lab')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeSegment === 'lab'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📅 LAB ({labList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSegment('rab')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeSegment === 'rab'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📝 RAB ({rabList.length})
        </button>
      </div>

      {/* Refresh Button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-emerald-800 font-semibold rounded-xl text-xs sm:text-sm shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        <span>{isRefreshing ? 'Memuat data terbaru...' : '🔄 Sinkronkan / Muat Ulang Data'}</span>
      </button>

      {/* SEGMENT 1: RIWAYAT TRANSAKSI KAS */}
      {activeSegment === 'transaksi' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari transaksi (keterangan atau tanggal)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={filterLabId}
                  onChange={(e) => setFilterLabId(e.target.value)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Bulan LAB</option>
                  {labList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.bulan} {l.tahun}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Tipe (Masuk &amp; Keluar)</option>
                  <option value="masuk">Hanya Uang Masuk (+)</option>
                  <option value="keluar">Hanya Uang Keluar (-)</option>
                </select>
              </div>
            </div>

            {/* Filtered Summary Totals */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-[11px] sm:text-xs">
              <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-emerald-800 block text-[10px] font-semibold">Total Masuk</span>
                <strong className="text-emerald-700 block truncate" title={formatRupiah(trxSummary.totalMasuk)}>
                  +{formatRupiah(trxSummary.totalMasuk)}
                </strong>
              </div>
              <div className="p-1.5 bg-rose-50 rounded-lg border border-rose-100">
                <span className="text-rose-800 block text-[10px] font-semibold">Total Keluar</span>
                <strong className="text-rose-700 block truncate" title={formatRupiah(trxSummary.totalKeluar)}>
                  -{formatRupiah(trxSummary.totalKeluar)}
                </strong>
              </div>
              <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-slate-700 block text-[10px] font-semibold">Selisih Mutasi</span>
                <strong
                  className={`block truncate ${trxSummary.selisih >= 0 ? 'text-slate-900' : 'text-rose-600'}`}
                  title={formatRupiah(trxSummary.selisih)}
                >
                  {formatRupiah(trxSummary.selisih)}
                </strong>
              </div>
            </div>
          </div>

          {/* List of Transactions */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-xs sm:text-sm border border-slate-200 shadow-2xs">
              <p className="font-semibold text-slate-600 mb-1">Tidak ada catatan transaksi yang sesuai.</p>
              <p className="text-[11px]">
                {transaksiList.length === 0
                  ? 'Belum ada transaksi. Silakan input transaksi pada tab "Transaksi".'
                  : 'Coba ubah kata kunci pencarian atau reset filter di atas.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {filteredTransactions.map((trx, idx) => {
                const linkedLab = labList.find((l) => l.id === trx.idLAB);
                const isMasuk = Number(trx.masuk) > 0;
                return (
                  <div key={trx.id || idx} className="p-3 sm:p-4 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 transition-colors">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isMasuk
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isMasuk ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                          {trx.keterangan || '(Tanpa keterangan)'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                          <span>{formatTanggalIndonesia(trx.tanggal)}</span>
                          {linkedLab && (
                            <>
                              <span>&bull;</span>
                              <span className="font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                {linkedLab.bulan} {linkedLab.tahun}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {isMasuk ? (
                          <span className="font-bold text-emerald-600 block text-xs sm:text-sm">
                            +{formatRupiah(trx.masuk)}
                          </span>
                        ) : (
                          <span className="font-bold text-rose-600 block text-xs sm:text-sm">
                            -{formatRupiah(trx.keluar)}
                          </span>
                        )}
                      </div>

                      {onEditTransaksi && (
                        <button
                          type="button"
                          onClick={() => onEditTransaksi(trx)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit transaksi"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      {onRequestDeleteTransaksi && (
                        <button
                          type="button"
                          onClick={() => onRequestDeleteTransaksi(trx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus transaksi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEGMENT 2: LAB (Laporan Anggaran Bulanan) */}
      {activeSegment === 'lab' && (
        <div id="riwayat-lab-list" className="space-y-3">
          {computedLabs.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-xs sm:text-sm border border-slate-200">
              📭 Belum ada data LAB.
              <br />
              Buat dokumen LAB baru di tab <strong>&quot;LAB&quot;</strong>.
            </div>
          ) : (
            computedLabs.map((l) => {
              const isExpanded = expandedId === l.id;
              const matchingTrx = transaksiList.filter((t) => t.idLAB === l.id);

              return (
                <div
                  key={l.id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                          {l.bulan} {l.tahun}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✅ PDF Siap
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-500 mt-0.5">
                        {l.nomor} &bull; {matchingTrx.length} transaksi
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteLAB(l)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus LAB"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Real-time Stats Grid: Saldo Awal | Masuk | Keluar | Saldo Akhir */}
                  <div className="grid grid-cols-4 gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-[10px] sm:text-xs">
                    <div>
                      <span className="text-slate-500 block">Saldo Awal</span>
                      <strong className="text-slate-800 text-xs sm:text-sm block mt-0.5 truncate" title={formatRupiah(l.saldoAwal)}>
                        {formatRupiah(l.saldoAwal)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-emerald-800 block font-semibold">Masuk</span>
                      <strong className="text-emerald-700 text-xs sm:text-sm block mt-0.5 truncate" title={formatRupiah(l.totalMasuk)}>
                        +{formatRupiah(l.totalMasuk)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-rose-800 block font-semibold">Keluar</span>
                      <strong className="text-rose-700 text-xs sm:text-sm block mt-0.5 truncate" title={formatRupiah(l.totalKeluar)}>
                        -{formatRupiah(l.totalKeluar)}
                      </strong>
                    </div>
                    <div className="bg-emerald-100/70 p-1 rounded-lg border border-emerald-200">
                      <span className="text-emerald-900 block font-bold">Saldo Akhir</span>
                      <strong className="text-emerald-800 text-xs sm:text-sm block mt-0.5 truncate" title={formatRupiah(l.saldoAkhir)}>
                        {formatRupiah(l.saldoAkhir)}
                      </strong>
                    </div>
                  </div>

                  {/* Expand Details Trigger */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(l.id)}
                    className="w-full text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 py-1 cursor-pointer font-medium"
                  >
                    <span>{isExpanded ? 'Tutup Mutasi Kas' : `Lihat ${matchingTrx.length} Catatan Transaksi`}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {/* Expanded Transactions Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 pt-2 space-y-1.5 text-xs">
                      <div className="flex justify-between text-[11px] text-slate-600 bg-slate-100 p-2 rounded-lg font-semibold">
                        <span>Saldo Awal Kas Permulaan:</span>
                        <span>{formatRupiah(l.saldoAwal)}</span>
                      </div>
                      {matchingTrx.length === 0 ? (
                        <p className="text-center text-slate-400 py-3 italic text-[11px]">
                          Belum ada transaksi di bulan LAB ini.
                        </p>
                      ) : (
                        matchingTrx.map((trx, idx) => (
                          <div key={trx.id || idx} className="flex items-center justify-between py-1.5 border-b border-slate-50 gap-2">
                            <div className="min-w-0 pr-1">
                              <span className="font-medium text-slate-800 block truncate">{trx.keterangan}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {formatTanggalIndonesia(trx.tanggal)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                {trx.masuk > 0 && (
                                  <span className="font-bold text-emerald-600 block">+{formatRupiah(trx.masuk)}</span>
                                )}
                                {trx.keluar > 0 && (
                                  <span className="font-bold text-rose-600 block">-{formatRupiah(trx.keluar)}</span>
                                )}
                              </div>
                              {onEditTransaksi && (
                                <button
                                  type="button"
                                  onClick={() => onEditTransaksi(trx)}
                                  className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                                  title="Edit transaksi"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onRequestDeleteTransaksi && (
                                <button
                                  type="button"
                                  onClick={() => onRequestDeleteTransaksi(trx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Hapus transaksi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={generatingId === l.id}
                      onClick={() => handleGeneratePDF('LAB', l.id)}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{generatingId === l.id ? 'Membuat...' : '📄 Generate PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGeneratePDF('LAB', l.id)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>🔗 Buka PDF</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SEGMENT 3: RAB (Rencana Anggaran Biaya) */}
      {activeSegment === 'rab' && (
        <div id="riwayat-rab-list" className="space-y-3">
          {rabList.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-xs sm:text-sm border border-slate-200">
              📭 Belum ada data RAB.
              <br />
              Buat dokumen RAB baru di tab <strong>&quot;RAB&quot;</strong>.
            </div>
          ) : (
            rabList.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <div
                  key={r.id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                          {r.bulan} {r.tahun}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✅ PDF Siap
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-500 mt-0.5">
                        {r.nomor} &bull; {r.itemCount} item kebutuhan
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteRAB(r)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus RAB"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 font-medium">Total Anggaran:</span>
                    <strong className="text-amber-600 text-sm sm:text-base font-extrabold">
                      {formatRupiah(r.total)}
                    </strong>
                  </div>

                  {/* Expand Details Trigger */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(r.id)}
                    className="w-full text-xs text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 py-1 cursor-pointer font-medium"
                  >
                    <span>{isExpanded ? 'Tutup Rincian' : `Lihat ${r.items ? r.items.length : 0} Rincian Kebutuhan`}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {/* Expanded Items Table */}
                  {isExpanded && r.items && (
                    <div className="border-t border-slate-100 pt-2 space-y-1 text-xs">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase pb-1">
                        Daftar Anggaran Rincian:
                      </div>
                      {r.items.map((item, idx) => (
                        <div key={item.id || idx} className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-700">
                            {idx + 1}. {item.rincian}
                          </span>
                          <span className="font-semibold text-slate-900 shrink-0 ml-2">
                            {formatRupiah(item.jumlah)}
                          </span>
                        </div>
                      ))}
                      <div className="text-[11px] text-slate-400 pt-1">
                        Disetujui: {r.ketuaRQ} | Bendahara: {r.bendaharaRQ} | Yayasan: {r.ketuaYayasan}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={generatingId === r.id}
                      onClick={() => handleGeneratePDF('RAB', r.id)}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{generatingId === r.id ? 'Membuat...' : '📄 Generate PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGeneratePDF('RAB', r.id)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>🔗 Buka PDF</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
