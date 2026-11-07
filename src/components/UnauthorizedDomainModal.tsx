import React, { useState } from 'react';
import { ShieldAlert, ExternalLink, Copy, Check, X, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface UnauthorizedDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryLogin?: () => void;
}

export const UnauthorizedDomainModal: React.FC<UnauthorizedDomainModalProps> = ({
  isOpen,
  onClose,
  onRetryLogin,
}) => {
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = firebaseConfig?.projectId || 'gen-lang-client-0501850538';
  const consoleSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const devDomain = 'ais-dev-mljlhc36i2sggbnt4oj2qk-591523715181.asia-southeast1.run.app';
  const preDomain = 'ais-pre-mljlhc36i2sggbnt4oj2qk-591523715181.asia-southeast1.run.app';

  if (!isOpen) return null;

  const handleCopy = (domainText: string) => {
    navigator.clipboard.writeText(domainText);
    setCopiedDomain(domainText);
    setTimeout(() => setCopiedDomain(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Mengapa Masih Error &ldquo;auth/unauthorized-domain&rdquo;?
              </h3>
              <p className="text-xs text-amber-700 font-semibold">
                Project ID: <span className="font-mono">{projectId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* 3 Reasons Why It Still Happened */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-slate-700 space-y-2 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Penyebab Mengapa Masih Gagal Setelah Tambah Domain:</span>
          </div>
          <ul className="space-y-1.5 list-disc list-inside text-slate-700 pl-1">
            <li>
              <strong>Format Salah:</strong> Mengetikkan <code className="bg-white px-1 rounded border border-amber-200 text-rose-600 font-bold">https://</code> atau tanda <code className="bg-white px-1 rounded border border-amber-200 text-rose-600 font-bold">/</code> di akhir. Firebase akan menolaknya.
            </li>
            <li>
              <strong>Beda Domain:</strong> Aplikasi memiliki 2 domain (Preview/Deploy &amp; Dev). Jika hanya menambahkan salah satu, domain lainnya tetap error.
            </li>
            <li>
              <strong>Salah Project:</strong> Pastikan Anda membuka project <strong className="font-mono text-emerald-900">{projectId}</strong> di Firebase Console, bukan project lain.
            </li>
          </ul>
        </div>

        {/* Two exact domains to copy */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            Daftarkan Kedua Domain Ini di Firebase Console:
          </label>

          {/* Domain 1 */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Domain Saat Ini ({currentDomain === preDomain ? 'Deploy/Shared' : 'Aktif'}):</span>
              <code className="text-xs font-mono font-bold text-emerald-800 break-all select-all">
                {currentDomain || preDomain}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(currentDomain || preDomain)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              {copiedDomain === (currentDomain || preDomain) ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDomain === (currentDomain || preDomain) ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>

          {/* Domain 2 (if different) */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">2. Domain Cadangan / Dev:</span>
              <code className="text-xs font-mono font-bold text-emerald-800 break-all select-all">
                {currentDomain === devDomain ? preDomain : devDomain}
              </code>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(currentDomain === devDomain ? preDomain : devDomain)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              {copiedDomain === (currentDomain === devDomain ? preDomain : devDomain) ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDomain === (currentDomain === devDomain ? preDomain : devDomain) ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
          <a
            href={consoleSettingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka Firebase Console</span>
          </a>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {onRetryLogin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetryLogin();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                <span>Coba Login Lagi</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
