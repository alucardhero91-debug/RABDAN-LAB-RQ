import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { TabTransaksi } from './components/TabTransaksi';
import { TabLAB } from './components/TabLAB';
import { TabRAB } from './components/TabRAB';
import { TabRiwayat } from './components/TabRiwayat';
import { SheetConfigModal } from './components/SheetConfigModal';
import { ConfirmModal } from './components/ConfirmModal';
import { UnauthorizedDomainModal } from './components/UnauthorizedDomainModal';
import { EditTransaksiModal } from './components/EditTransaksiModal';
import { FinancialSummaryBanner } from './components/FinancialSummaryBanner';
import { LABRecord, RABRecord, TransaksiRecord } from './types';
import { computeLABRecord } from './utils/formatters';
import {
  fetchSharedData,
  persistLAB,
  persistRAB,
  persistTransaksi,
  updateExistingTransaksi,
  deleteLocalTransaksi,
  deleteLocalLAB,
  deleteLocalRAB,
  clearAllData,
} from './services/storage';
import { initAuth, googleSignIn, logout } from './services/auth';
import { appendRowToSheet, SHEET_ID_KEY, extractSpreadsheetId } from './services/sheets';
import { subscribeToFirestoreData } from './services/firestoreService';
import { testFirestoreConnection } from './lib/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<'transaksi' | 'lab' | 'rab' | 'riwayat'>('transaksi');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sheetTitle, setSheetTitle] = useState<string>('Database Keuangan RQ Ulul Azmi (RAB & LAB)');
  const [webAppUrl, setWebAppUrl] = useState<string>('');
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem(SHEET_ID_KEY) || '';
  });
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(false);
  const [isUnauthorizedModalOpen, setIsUnauthorizedModalOpen] = useState<boolean>(false);

  // Auth state for direct Google Sheets API connection
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Shared Multi-user App Data
  const [labList, setLabList] = useState<LABRecord[]>([]);
  const [rabList, setRabList] = useState<RABRecord[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiRecord[]>([]);
  const [editingTrx, setEditingTrx] = useState<TransaksiRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Toast Notification
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info'; show: boolean }>({
    msg: '',
    type: 'info',
    show: false,
  });

  // Confirmation Modal for Destructive operations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type, show: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Fetch shared database data from central server
  const loadSharedData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const data = await fetchSharedData();
      if (data) {
        setLabList(data.labList || []);
        setRabList(data.rabList || []);
        setTransaksiList(data.transaksiList || []);
        if (data.sheetConfig) {
          if (data.sheetConfig.spreadsheetName) {
            setSheetTitle(data.sheetConfig.spreadsheetName);
          }
          if (data.sheetConfig.spreadsheetId) {
            setSpreadsheetId(data.sheetConfig.spreadsheetId);
            localStorage.setItem(SHEET_ID_KEY, data.sheetConfig.spreadsheetId);
          }
          if (data.sheetConfig.adminPin) {
            localStorage.setItem('rq_fia_admin_pin', data.sheetConfig.adminPin);
          }
        }
      }
    } catch (e: any) {
      console.warn('Failed to load shared data:', e);
      if (!silent) {
        showToast('Gagal memuat data terbaru: ' + (e.message || ''), 'error');
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [showToast]);

  // Initial load and real-time Firestore auto-sync
  useEffect(() => {
    testFirestoreConnection();
    loadSharedData();

    // Real-time Firestore subscription for instantaneous synchronization across all devices
    const unsubscribeFirestore = subscribeToFirestoreData((data) => {
      setLabList(data.labList || []);
      setRabList(data.rabList || []);
      setTransaksiList(data.transaksiList || []);
      if (data.sheetConfig) {
        if (data.sheetConfig.spreadsheetId) {
          setSpreadsheetId(data.sheetConfig.spreadsheetId);
          localStorage.setItem(SHEET_ID_KEY, data.sheetConfig.spreadsheetId);
        }
        if (data.sheetConfig.spreadsheetName) {
          setSheetTitle(data.sheetConfig.spreadsheetName);
        }
        if (data.sheetConfig.adminPin) {
          localStorage.setItem('rq_fia_admin_pin', data.sheetConfig.adminPin);
        }
      }
    });

    const interval = setInterval(() => {
      loadSharedData(true);
    }, 10000);

    return () => {
      unsubscribeFirestore();
      clearInterval(interval);
    };
  }, [loadSharedData]);

  // Google Sign In handler
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast(`Berhasil terhubung ke akun Google: ${result.user.email}`, 'success');
        // Ensure shared data & persistent spreadsheet ID stay loaded
        await loadSharedData(true);
      }
    } catch (err: any) {
      const isUnauthorizedDomain =
        err?.code === 'auth/unauthorized-domain' ||
        (err?.message && String(err.message).includes('auth/unauthorized-domain'));

      if (isUnauthorizedDomain) {
        setIsUnauthorizedModalOpen(true);
        showToast('Domain aplikasi belum diizinkan di Firebase. Panduan telah dibuka di layar.', 'error');
      } else {
        showToast('Gagal menghubungkan akun Google: ' + (err.message || ''), 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      showToast('Telah keluar dari akun Google.', 'info');
    } catch (err: any) {
      showToast('Gagal logout: ' + err.message, 'error');
    }
  };

  // Handlers for creating records with dual sync (Server DB + Direct Google Sheet if authenticated)
  const handleSubmitTransaksi = async (data: {
    idLAB: string;
    tanggal: string;
    keterangan: string;
    masuk: number;
    keluar: number;
  }) => {
    const newTrx: TransaksiRecord = {
      id: 'trx-' + Date.now(),
      idLAB: data.idLAB,
      tanggal: data.tanggal,
      keterangan: data.keterangan,
      masuk: data.masuk,
      keluar: data.keluar,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update React state immediately
    const nextTrxList = [newTrx, ...transaksiList];
    const nextLabList = labList.map((l) => computeLABRecord(l, nextTrxList));
    setTransaksiList(nextTrxList);
    setLabList(nextLabList);

    const res = await persistTransaksi(newTrx);

    // Direct write to Google Sheets if connected via Google Sheets API
    const cleanId = extractSpreadsheetId(spreadsheetId);
    if (accessToken && cleanId) {
      appendRowToSheet(accessToken, cleanId, 'Transaksi!A:G', [
        newTrx.id,
        newTrx.idLAB,
        newTrx.tanggal,
        newTrx.keterangan,
        newTrx.masuk,
        newTrx.keluar,
        newTrx.createdAt,
      ]);
    }

    await loadSharedData(true);
    const calculatedTargetLab = nextLabList.find((l) => l.id === data.idLAB);
    return { idLAB: data.idLAB, updatedLAB: calculatedTargetLab || res.updatedLAB };
  };

  const handleSubmitLAB = async (
    data: Omit<LABRecord, 'id' | 'totalMasuk' | 'totalKeluar' | 'saldoAkhir' | 'trxCount' | 'hasLink'>
  ): Promise<LABRecord> => {
    const newLAB: LABRecord = {
      ...data,
      id: 'lab-' + Date.now(),
      totalMasuk: 0,
      totalKeluar: 0,
      saldoAkhir: data.saldoAwal,
      trxCount: 0,
      hasLink: true,
      createdAt: new Date().toISOString(),
    };

    await persistLAB(newLAB);

    const cleanId = extractSpreadsheetId(spreadsheetId);
    if (accessToken && cleanId) {
      appendRowToSheet(accessToken, cleanId, 'LAB_Master!A:P', [
        newLAB.id,
        newLAB.nomor,
        newLAB.bulan,
        newLAB.tahun,
        newLAB.tanggal,
        newLAB.kota,
        newLAB.ketuaRQ,
        newLAB.bendaharaRQ,
        newLAB.saldoAwal,
        newLAB.totalMasuk,
        newLAB.totalKeluar,
        newLAB.saldoAkhir,
        newLAB.trxCount,
        'Ada',
        '',
        newLAB.createdAt,
      ]);
    }

    await loadSharedData(true);
    return newLAB;
  };

  const handleSubmitRAB = async (
    data: Omit<RABRecord, 'id' | 'hasLink'>
  ): Promise<RABRecord> => {
    const newRAB: RABRecord = {
      ...data,
      id: 'rab-' + Date.now(),
      hasLink: true,
      createdAt: new Date().toISOString(),
    };

    await persistRAB(newRAB);

    const cleanId = extractSpreadsheetId(spreadsheetId);
    if (accessToken && cleanId) {
      appendRowToSheet(accessToken, cleanId, 'RAB_Master!A:N', [
        newRAB.id,
        newRAB.nomor,
        newRAB.bulan,
        newRAB.tahun,
        newRAB.tanggal,
        newRAB.kota,
        newRAB.ketuaRQ,
        newRAB.bendaharaRQ,
        newRAB.ketuaYayasan,
        newRAB.total,
        newRAB.itemCount,
        'Ada',
        '',
        newRAB.createdAt,
      ]);
      (newRAB.items || []).forEach((item, idx) => {
        appendRowToSheet(accessToken, cleanId, 'RAB_Items!A:F', [
          item.id,
          newRAB.id,
          idx + 1,
          item.rincian,
          item.jumlah,
          newRAB.createdAt,
        ]);
      });
    }

    await loadSharedData(true);
    return newRAB;
  };

  // Deletions with explicit confirmation (Destructive operations requirement)
  const handleRequestDeleteTransaksi = (trx: TransaksiRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Catatan Transaksi?',
      message: `Apakah Anda yakin ingin menghapus transaksi "${trx.keterangan}" sebesar ${trx.masuk > 0 ? 'Rp ' + trx.masuk.toLocaleString('id-ID') : 'Rp ' + trx.keluar.toLocaleString('id-ID')}? Tindakan ini akan memperbarui saldo kas untuk semua pengguna.`,
      onConfirm: async () => {
        const nextTrxList = transaksiList.filter((t) => t.id !== trx.id);
        const nextLabList = labList.map((l) => computeLABRecord(l, nextTrxList));
        setTransaksiList(nextTrxList);
        setLabList(nextLabList);

        await deleteLocalTransaksi(trx.id);
        await loadSharedData(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('Transaksi berhasil dihapus dari database', 'success');
      },
    });
  };

  const handleRequestDeleteLAB = (lab: LABRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Laporan Anggaran Bulanan (LAB)?',
      message: `Hapus LAB periode ${lab.bulan} ${lab.tahun} (${lab.nomor}) beserta seluruh transaksi yang terkait untuk semua pengguna?`,
      onConfirm: async () => {
        await deleteLocalLAB(lab.id);
        await loadSharedData(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('LAB berhasil dihapus dari database', 'success');
      },
    });
  };

  const handleRequestDeleteRAB = (rab: RABRecord) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Rencana Anggaran Biaya (RAB)?',
      message: `Hapus RAB periode ${rab.bulan} ${rab.tahun} (${rab.nomor}) dengan total anggaran Rp ${rab.total.toLocaleString('id-ID')} untuk semua pengguna?`,
      onConfirm: async () => {
        await deleteLocalRAB(rab.id);
        await loadSharedData(true);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('RAB berhasil dihapus dari database', 'success');
      },
    });
  };

  const handleEditTransaksi = (trx: TransaksiRecord) => {
    setEditingTrx(trx);
    setIsEditModalOpen(true);
  };

  const handleSaveEditTransaksi = async (updatedTrx: TransaksiRecord) => {
    const nextTrxList = transaksiList.map((t) => (t.id === updatedTrx.id ? updatedTrx : t));
    const nextLabList = labList.map((l) => computeLABRecord(l, nextTrxList));
    setTransaksiList(nextTrxList);
    setLabList(nextLabList);

    await updateExistingTransaksi(updatedTrx);
    await loadSharedData(true);
    showToast('Transaksi berhasil diperbarui', 'success');
  };

  const handleResetDatabase = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Kosongkan Semua Data Database?',
      message:
        'PERINGATAN: Tindakan ini akan mengosongkan seluruh data Transaksi, LAB, dan RAB di cloud dan server agar database kembali 100% bersih tanpa data apapun. Lanjutkan?',
      onConfirm: async () => {
        await clearAllData();
        setLabList([]);
        setRabList([]);
        setTransaksiList([]);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('Semua data berhasil dikosongkan. Database 100% bersih dan siap digunakan!', 'success');
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased font-sans p-3 sm:p-6 pb-24 sm:pb-8 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full">
        {/* Navigation & Header */}
        <Navbar
          user={user}
          onLogin={handleGoogleLogin}
          onLogout={handleGoogleLogout}
          isLoggingIn={isLoggingIn}
          onOpenSheetModal={() => setIsSheetModalOpen(true)}
          sheetTitle={sheetTitle}
          isSyncing={isRefreshing}
          onManualSync={() => loadSharedData(false)}
          spreadsheetId={spreadsheetId}
          webAppUrl={webAppUrl}
        />

        {/* Real-time Financial Summary Banner (Saldo Awal, Total Masuk, Total Keluar, Saldo Akhir, Jumlah Transaksi) */}
        <FinancialSummaryBanner
          labList={labList}
          transaksiList={transaksiList}
        />

        {/* Desktop / Tablet Tab Switcher (On mobile, uses the bottom nav bar) */}
        <nav aria-label="Menu Utama" className="hidden sm:flex bg-white p-1.5 rounded-2xl shadow-xs border border-slate-200 mb-5 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('transaksi')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'transaksi'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💰 Transaksi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lab')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'lab'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📅 LAB
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rab')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'rab'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📝 RAB
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('riwayat')}
            className={`flex-1 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📋 Riwayat
          </button>
        </nav>

        {/* Tab Views */}
        <main>
          {activeTab === 'transaksi' && (
            <TabTransaksi
              labList={labList}
              transaksiList={transaksiList}
              onSubmitTransaksi={handleSubmitTransaksi}
              onRequestDelete={handleRequestDeleteTransaksi}
              onEditTransaksi={handleEditTransaksi}
              onNotify={showToast}
            />
          )}

          {activeTab === 'lab' && (
            <TabLAB
              labList={labList}
              onSubmitLAB={handleSubmitLAB}
              onNotify={showToast}
              onSwitchToTransaksi={() => setActiveTab('transaksi')}
            />
          )}

          {activeTab === 'rab' && (
            <TabRAB
              rabList={rabList}
              onSubmitRAB={handleSubmitRAB}
              onNotify={showToast}
            />
          )}

          {activeTab === 'riwayat' && (
            <TabRiwayat
              labList={labList}
              rabList={rabList}
              transaksiList={transaksiList}
              onRefresh={() => loadSharedData(false)}
              isRefreshing={isRefreshing}
              onNotify={showToast}
              onRequestDeleteLAB={handleRequestDeleteLAB}
              onRequestDeleteRAB={handleRequestDeleteRAB}
              onEditTransaksi={handleEditTransaksi}
              onRequestDeleteTransaksi={handleRequestDeleteTransaksi}
            />
          )}
        </main>
      </div>

      {/* Footer info */}
      <footer className="mt-8 text-center text-xs text-slate-400 py-3 hidden sm:block">
        FIA (Finance Instansi Azmi) &bull; Rumah Qur&apos;an Ulul Azmi &bull; Yayasan Misykatul Ummah (YMU)
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
      />

      {/* Modals & Toast */}
      <SheetConfigModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        onSync={() => loadSharedData(false)}
        sheetTitle={sheetTitle}
        setSheetTitle={setSheetTitle}
        onNotify={showToast}
        initialWebAppUrl={webAppUrl}
        user={user}
        accessToken={accessToken}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
        isLoggingIn={isLoggingIn}
        spreadsheetId={spreadsheetId}
        setSpreadsheetId={(id) => {
          setSpreadsheetId(id);
          localStorage.setItem(SHEET_ID_KEY, id);
        }}
        labList={labList}
        transaksiList={transaksiList}
        rabList={rabList}
        onOpenUnauthorizedDomainGuide={() => setIsUnauthorizedModalOpen(true)}
        onResetData={handleResetDatabase}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <UnauthorizedDomainModal
        isOpen={isUnauthorizedModalOpen}
        onClose={() => setIsUnauthorizedModalOpen(false)}
        onRetryLogin={handleGoogleLogin}
      />

      <EditTransaksiModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTrx(null);
        }}
        trx={editingTrx}
        labList={labList}
        onSave={handleSaveEditTransaksi}
        onNotify={showToast}
      />

      {/* Floating Toast Notification */}
      {toast.show && (
        <div
          role="status"
          className={`fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold text-white shadow-xl transition-all max-w-[90vw] text-center ${
            toast.type === 'success'
              ? 'bg-emerald-600 shadow-emerald-900/20'
              : toast.type === 'error'
              ? 'bg-rose-600 shadow-rose-900/20'
              : 'bg-slate-800 shadow-slate-900/20'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
