import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  X,
  Check,
  RefreshCw,
  ExternalLink,
  LogIn,
  LogOut,
  FolderPlus,
  SendHorizontal,
  Database,
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { updateSheetConfig } from '../services/storage';
import {
  createDatabaseSpreadsheet,
  syncEntireDatabaseToSheets,
  extractSpreadsheetId,
} from '../services/sheets';
import { LABRecord, RABRecord, TransaksiRecord } from '../types';

const ADMIN_PIN_KEY = 'rq_fia_admin_pin';
const ADMIN_UNLOCKED_SESSION_KEY = 'rq_fia_admin_unlocked';

interface SheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: () => Promise<void>;
  sheetTitle: string;
  setSheetTitle: (title: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialWebAppUrl?: string;
  user: User | null;
  accessToken: string | null;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  isLoggingIn: boolean;
  spreadsheetId: string;
  setSpreadsheetId: (id: string) => void;
  labList: LABRecord[];
  transaksiList: TransaksiRecord[];
  rabList: RABRecord[];
  onOpenUnauthorizedDomainGuide?: () => void;
  initialTab?: string;
  onResetData?: () => void;
}

export const SheetConfigModal: React.FC<SheetConfigModalProps> = ({
  isOpen,
  onClose,
  onSync,
  sheetTitle,
  setSheetTitle,
  onNotify,
  user,
  accessToken,
  onLogin,
  onLogout,
  isLoggingIn,
  spreadsheetId,
  setSpreadsheetId,
  labList,
  transaksiList,
  rabList,
  onOpenUnauthorizedDomainGuide,
  onResetData,
}) => {
  const [inputSheetId, setInputSheetId] = useState(spreadsheetId);
  const [spreadsheetName, setSpreadsheetName] = useState(
    sheetTitle || 'Database Keuangan RQ Ulul Azmi (RAB & LAB)'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isPushingData, setIsPushingData] = useState(false);

  // Admin PIN Gate State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem(ADMIN_UNLOCKED_SESSION_KEY) === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    if (spreadsheetId) {
      setInputSheetId(spreadsheetId);
    }
  }, [spreadsheetId, isOpen]);

  useEffect(() => {
    if (sheetTitle) {
      setSpreadsheetName(sheetTitle);
    }
  }, [sheetTitle]);

  if (!isOpen) return null;

  const currentSheetId = extractSpreadsheetId(inputSheetId || spreadsheetId);

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const currentPin = localStorage.getItem(ADMIN_PIN_KEY) || '1234';
    if (pinInput.trim() === currentPin) {
      setIsUnlocked(true);
      setPinError('');
      sessionStorage.setItem(ADMIN_UNLOCKED_SESSION_KEY, 'true');
      onNotify('Akses Pengaturan Admin berhasil dibuka!', 'success');
    } else {
      setPinError('PIN Admin salah. Silakan periksa kembali PIN Anda.');
    }
  };

  const handleLockAdmin = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem(ADMIN_UNLOCKED_SESSION_KEY);
    setPinInput('');
    onNotify('Sesi Admin telah dikunci.', 'info');
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      onNotify('PIN minimal harus 4 digit/karakter.', 'error');
      return;
    }
    const cleanPin = newPin.trim();
    localStorage.setItem(ADMIN_PIN_KEY, cleanPin);
    await updateSheetConfig({ adminPin: cleanPin });
    setNewPin('');
    setIsChangingPin(false);
    onNotify('PIN Admin baru berhasil disimpan permanen di Cloud!', 'success');
  };

  const handleCreateAutoSheet = async () => {
    if (!accessToken) {
      onNotify('Silakan klik Masuk dengan Google terlebih dahulu.', 'error');
      return;
    }
    setIsCreatingSheet(true);
    try {
      const created = await createDatabaseSpreadsheet(accessToken, spreadsheetName);
      setInputSheetId(created.id);
      setSpreadsheetId(created.id);
      await updateSheetConfig({
        spreadsheetName,
        spreadsheetId: created.id,
      });
      onNotify(`Google Sheet baru berhasil dibuat di Google Drive Anda!`, 'success');
      await handlePushAllToSheets(created.id);
    } catch (err: any) {
      onNotify('Gagal membuat spreadsheet: ' + (err.message || 'Error tidak diketahui'), 'error');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handlePushAllToSheets = async (targetId?: string) => {
    const idToUse = targetId || currentSheetId;
    if (!accessToken) {
      onNotify('Silakan Masuk dengan Google terlebih dahulu untuk menyinkronkan data.', 'error');
      return;
    }
    if (!idToUse) {
      onNotify('Masukkan ID atau Tautan Google Spreadsheet terlebih dahulu.', 'error');
      return;
    }

    setIsPushingData(true);
    try {
      await syncEntireDatabaseToSheets(accessToken, idToUse, labList, transaksiList, rabList);
      onNotify(
        `Sukses! Seluruh data (${transaksiList.length} Transaksi, ${labList.length} LAB, ${rabList.length} RAB) berhasil masuk ke Google Spreadsheet!`,
        'success'
      );
    } catch (err: any) {
      onNotify('Gagal menyinkronkan ke Google Sheet: ' + (err.message || ''), 'error');
    } finally {
      setIsPushingData(false);
    }
  };

  const handleSaveDirectSheetId = async () => {
    const cleanedId = extractSpreadsheetId(inputSheetId);
    if (!cleanedId) {
      onNotify('Silakan masukkan tautan atau ID Google Spreadsheet yang valid.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await updateSheetConfig({
        spreadsheetName,
        spreadsheetId: cleanedId,
        webAppUrl: '',
      });
      setSpreadsheetId(cleanedId);
      setInputSheetId(cleanedId);
      setSheetTitle(spreadsheetName);
      onNotify(
        'ID Google Spreadsheet berhasil disimpan permanen di Cloud! Semua perangkat langsung terhubung otomatis.',
        'success'
      );
      await onSync();
    } catch (err: any) {
      onNotify('Gagal menyimpan ID: ' + (err.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Pengaturan Google Sheets API
              </h3>
              <p className="text-[11px] text-slate-500">
                Khusus Admin &bull; Multi-Device Bebas Login
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isUnlocked && (
              <button
                type="button"
                onClick={handleLockAdmin}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Kunci Akses Admin"
              >
                <Lock className="w-4 h-4 text-slate-500" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PIN Challenge Screen (If locked) */}
        {!isUnlocked ? (
          <div className="py-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800 flex items-center justify-center shadow-xs border border-emerald-200">
                <Lock className="w-7 h-7 text-emerald-700" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Verifikasi Akses Admin</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Aplikasi ini <strong>bebas login untuk semua perangkat</strong> (HP santri & pengurus). Halaman pengaturan Google Sheets ini hanya perlu dibuka oleh Admin.
              </p>
            </div>

            <form onSubmit={handleUnlockAdmin} className="space-y-3 max-w-xs mx-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                  Masukkan PIN Pengaman Admin
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="Masukkan PIN Admin"
                  autoFocus
                  className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 bg-slate-50"
                />
                {pinError && (
                  <p className="text-[11px] text-rose-600 text-center font-medium mt-1">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Buka Pengaturan
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Full Admin Google API Settings Panel */
          <div className="py-3 space-y-4">
            {/* Multi-Device Free Login Reassurance Banner */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 text-xs text-emerald-950 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <Database className="w-4 h-4 text-emerald-700" />
                  <span>Google Sheets API &amp; Cloud Database Aktif</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  Tersambung Otomatis
                </span>
              </div>
              <p className="leading-relaxed text-slate-700 text-[11px] sm:text-xs">
                Perangkat lain <strong>TIDAK PERLU login Google</strong>. Santri dan pengurus bisa langsung mencatat transaksi. Cukup Admin menautkan ID Google Spreadsheet di bawah satu kali, dan seluruh data otomatis tersinkronisasi ke Google Sheet Anda.
              </p>
            </div>

            {/* Google Sign In Status for Admin */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                  Akun Google Admin
                </div>
                <div className="font-semibold text-slate-800 text-xs sm:text-sm truncate max-w-[210px]">
                  {user ? user.email : 'Belum Terhubung'}
                </div>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                </button>
              )}
            </div>

            {!user && onOpenUnauthorizedDomainGuide && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Muncul kendala <em>auth/unauthorized-domain</em>?</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenUnauthorizedDomainGuide}
                  className="font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 cursor-pointer"
                >
                  Atasi di sini
                </button>
              </div>
            )}

            {/* Permanent Connected Status Card */}
            {currentSheetId && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Status: Terhubung Permanen di Cloud</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                    Terkunci Otomatis
                  </span>
                </div>
                <div className="font-mono text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 break-all select-all text-slate-800">
                  {currentSheetId}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  ID ini tersimpan permanen di Cloud Firestore. Seluruh HP santri &amp; pengurus otomatis tersambung tanpa perlu menautkan ulang.
                </p>
                <div className="pt-1">
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${currentSheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Buka Spreadsheet di Tab Baru</span>
                  </a>
                </div>
              </div>
            )}

            {/* Spreadsheet ID / Link Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Tautan atau ID Google Spreadsheet Anda
              </label>
              <input
                type="text"
                value={inputSheetId}
                onChange={(e) => setInputSheetId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit atau ID Spreadsheet"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveDirectSheetId}
                  disabled={isSaving || !inputSheetId.trim()}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan & Kunci ID Ini Permanen di Cloud'}</span>
                </button>
              </div>
            </div>

            {/* Google Drive Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreateAutoSheet}
                disabled={isCreatingSheet || !user}
                className="py-2.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title={!user ? 'Masuk dengan Google terlebih dahulu' : 'Buat file Google Spreadsheet baru di Drive Anda'}
              >
                <FolderPlus className={`w-3.5 h-3.5 ${isCreatingSheet ? 'animate-spin' : ''}`} />
                <span>{isCreatingSheet ? 'Membuat Sheet...' : 'Buat Sheet Baru di Drive'}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePushAllToSheets()}
                disabled={isPushingData || !user || !currentSheetId}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title={!user ? 'Masuk dengan Google terlebih dahulu' : 'Kirim semua data transaksi, LAB, dan RAB ke Google Sheet'}
              >
                <SendHorizontal className={`w-3.5 h-3.5 ${isPushingData ? 'animate-spin' : ''}`} />
                <span>{isPushingData ? 'Mengirim Data...' : 'Kirim Semua Data Sekarang'}</span>
              </button>
            </div>

            {/* Pengaturan Ganti PIN Admin */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ganti PIN Pengaman Admin</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(!isChangingPin)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                >
                  {isChangingPin ? 'Batal' : 'Ubah PIN'}
                </button>
              </div>

              {isChangingPin && (
                <form
                  onSubmit={handleSaveNewPin}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Masukkan 4 digit PIN baru"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono bg-white"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                  >
                    Simpan PIN Baru Permanen
                  </button>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await onSync();
                      onNotify('Data berhasil dimuat ulang dari database pusat!', 'success');
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Muat Ulang Cloud</span>
                </button>

                {onResetData && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onResetData();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer transition-colors"
                    title="Kosongkan seluruh data transaksi, LAB, dan RAB"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Kosongkan Semua Data</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
