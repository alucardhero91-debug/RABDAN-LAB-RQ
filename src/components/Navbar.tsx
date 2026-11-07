import React from 'react';
import { User } from 'firebase/auth';
import { RefreshCw, Settings } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  onOpenSheetModal: () => void;
  sheetTitle: string;
  isSyncing: boolean;
  onManualSync: () => void;
  spreadsheetId?: string;
  webAppUrl?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSheetModal,
  isSyncing,
  onManualSync,
  spreadsheetId,
  webAppUrl,
}) => {
  const isSheetConnected = Boolean(spreadsheetId?.trim());

  return (
    <header className="mb-4 sm:mb-6">
      {/* Main Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-base shadow-sm shrink-0 tracking-wider">
            FIA
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            {/* Baris 1: FIA Finance Instansi Azmi */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                FIA Finance Instansi Azmi
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                RQ Ulul Azmi
              </span>
            </div>

            {/* Baris 2: Yayasan Misykatul Ummah */}
            <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
              Yayasan Misykatul Ummah <span className="hidden sm:inline">&bull; Manajemen Keuangan Pesantren</span>
            </p>

            {/* Baris 3: Keterangan Notif Tersambung dibawah tulisan yayasan */}
            <div className="mt-1 flex items-center">
              {isSheetConnected ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                  title="Database Google Sheet Terhubung Permanen di Cloud"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span>Tersambung</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                  title="Cloud Database Aktif"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Cloud Aktif</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSheetModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Buka Pengaturan Database & Sinkronisasi (Khusus Admin)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden xs:inline">Pengaturan Admin</span>
            <span className="xs:hidden">Admin</span>
          </button>

          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Muat ulang data terbaru dari database server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Memuat...' : 'Muat Ulang'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
