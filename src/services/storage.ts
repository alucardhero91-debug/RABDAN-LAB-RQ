import { LABRecord, RABRecord, TransaksiRecord } from '../types';
import { computeLABRecord } from '../utils/formatters';
import {
  getFirestoreAllData,
  saveFirestoreLAB,
  saveFirestoreRAB,
  saveFirestoreTransaksi,
  saveFirestoreSheetConfig,
  deleteFirestoreLAB,
  deleteFirestoreRAB,
  deleteFirestoreTransaksi,
  clearFirestoreAllData,
} from './firestoreService';
import { SHEET_ID_KEY } from './sheets';

const STORAGE_LAB_KEY = 'rq_ulul_azmi_lab_master_v1';
const STORAGE_RAB_KEY = 'rq_ulul_azmi_rab_master_v1';
const STORAGE_TRX_KEY = 'rq_ulul_azmi_transaksi_v1';

export function getLocalData(): {
  labList: LABRecord[];
  rabList: RABRecord[];
  transaksiList: TransaksiRecord[];
} {
  try {
    const rawLab = localStorage.getItem(STORAGE_LAB_KEY);
    const rawRab = localStorage.getItem(STORAGE_RAB_KEY);
    const rawTrx = localStorage.getItem(STORAGE_TRX_KEY);

    return {
      labList: rawLab ? JSON.parse(rawLab) : [],
      rabList: rawRab ? JSON.parse(rawRab) : [],
      transaksiList: rawTrx ? JSON.parse(rawTrx) : [],
    };
  } catch (e) {
    return { labList: [], rabList: [], transaksiList: [] };
  }
}

export function saveLocalData(
  labList: LABRecord[],
  rabList: RABRecord[],
  transaksiList: TransaksiRecord[]
) {
  try {
    localStorage.setItem(STORAGE_LAB_KEY, JSON.stringify(labList));
    localStorage.setItem(STORAGE_RAB_KEY, JSON.stringify(rabList));
    localStorage.setItem(STORAGE_TRX_KEY, JSON.stringify(transaksiList));
  } catch (e) {
    console.error('Failed saving to localStorage mirror:', e);
  }
}

/**
 * Fetch all shared real-time data from Cloud Database (Firestore) or server database
 */
export async function fetchSharedData(): Promise<{
  labList: LABRecord[];
  rabList: RABRecord[];
  transaksiList: TransaksiRecord[];
  sheetConfig?: any;
}> {
  // Always query centralized server config to guarantee latest sheetConfig
  let serverConfig: any = null;
  let serverData: any = null;
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      serverData = await res.json();
      if (serverData?.ok && serverData.sheetConfig) {
        serverConfig = serverData.sheetConfig;
      }
    }
  } catch (e) {
    console.warn('Server fetch notice:', e);
  }

  // 1. Try fetching from Cloud Firestore
  try {
    const firestoreData = await getFirestoreAllData();
    const resolvedConfig = firestoreData.sheetConfig || serverConfig;

    if (resolvedConfig?.spreadsheetId) {
      localStorage.setItem(SHEET_ID_KEY, resolvedConfig.spreadsheetId);
    }

    const computedLabs = firestoreData.labList.map((l) =>
      computeLABRecord(l, firestoreData.transaksiList)
    );
    saveLocalData(
      computedLabs,
      firestoreData.rabList,
      firestoreData.transaksiList
    );
    return {
      labList: computedLabs,
      rabList: firestoreData.rabList,
      transaksiList: firestoreData.transaksiList,
      sheetConfig: resolvedConfig,
    };
  } catch (err) {
    console.warn('Firestore fetch notice, trying server fallback:', err);
  }

  // 2. Fallback to centralized server API
  if (serverData && serverData.ok) {
    const computedLabs = (serverData.labList || []).map((l: LABRecord) =>
      computeLABRecord(l, serverData.transaksiList || [])
    );
    saveLocalData(computedLabs, serverData.rabList || [], serverData.transaksiList || []);
    if (serverData.sheetConfig?.spreadsheetId) {
      localStorage.setItem(SHEET_ID_KEY, serverData.sheetConfig.spreadsheetId);
    }

    return {
      labList: computedLabs,
      rabList: serverData.rabList || [],
      transaksiList: serverData.transaksiList || [],
      sheetConfig: serverData.sheetConfig,
    };
  }

  const local = getLocalData();
  const computedLocalLabs = local.labList.map((l) => computeLABRecord(l, local.transaksiList));
  return {
    labList: computedLocalLabs,
    rabList: local.rabList,
    transaksiList: local.transaksiList,
    sheetConfig: serverConfig,
  };
}

/**
 * Persists a new transaction to Cloud Firestore and centralized server
 */
export async function persistTransaksi(
  trx: TransaksiRecord
): Promise<{ ok: boolean; syncedToSheets: boolean; updatedLAB?: LABRecord }> {
  // 1. Save to Cloud Firestore
  try {
    await saveFirestoreTransaksi(trx);
  } catch (err) {
    console.warn('Failed saving to Firestore directly:', err);
  }

  // 2. Also persist to Express server API for Google Sheet webhook sync & local file backup
  try {
    const res = await fetch('/api/transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trx),
    });
    if (res.ok) {
      const json = await res.json();
      return { ok: true, syncedToSheets: true, updatedLAB: json.updatedLAB };
    }
  } catch (err) {
    console.error('Error posting transaksi to server:', err);
  }

  // Local fallback
  const local = getLocalData();
  const updatedTrx = [trx, ...local.transaksiList.filter((t) => t.id !== trx.id)];
  const updatedLabs = local.labList.map((l) => computeLABRecord(l, updatedTrx));
  saveLocalData(updatedLabs, local.rabList, updatedTrx);
  return { ok: true, syncedToSheets: false };
}

/**
 * Updates an existing transaction in Cloud Firestore and central server
 */
export async function updateExistingTransaksi(
  trx: TransaksiRecord
): Promise<{ ok: boolean; syncedToSheets: boolean; updatedLAB?: LABRecord }> {
  // 1. Update in Cloud Firestore
  try {
    await saveFirestoreTransaksi(trx);
  } catch (err) {
    console.warn('Failed updating Firestore directly:', err);
  }

  // 2. Update via server PUT
  try {
    const res = await fetch(`/api/transaksi/${trx.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trx),
    });
    if (res.ok) {
      const json = await res.json();
      return { ok: true, syncedToSheets: true, updatedLAB: json.updatedLAB };
    }
  } catch (err) {
    console.error('Error updating transaksi on server:', err);
  }

  // Local fallback
  const local = getLocalData();
  const updatedList = local.transaksiList.map((t) => (t.id === trx.id ? trx : t));
  const updatedLabs = local.labList.map((l) => computeLABRecord(l, updatedList));
  saveLocalData(updatedLabs, local.rabList, updatedList);
  return { ok: true, syncedToSheets: false };
}

/**
 * Persists a new LAB to Cloud Firestore and centralized server
 */
export async function persistLAB(
  lab: LABRecord
): Promise<{ ok: boolean; syncedToSheets: boolean }> {
  // 1. Save to Cloud Firestore
  try {
    await saveFirestoreLAB(lab);
  } catch (err) {
    console.warn('Failed saving LAB to Firestore directly:', err);
  }

  // 2. Persist to server API
  try {
    const res = await fetch('/api/lab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lab),
    });
    if (res.ok) {
      return { ok: true, syncedToSheets: true };
    }
  } catch (err) {
    console.error('Error posting LAB to server:', err);
  }

  const local = getLocalData();
  const updatedLab = [lab, ...local.labList];
  saveLocalData(updatedLab, local.rabList, local.transaksiList);
  return { ok: true, syncedToSheets: false };
}

/**
 * Persists a new RAB to Cloud Firestore and centralized server
 */
export async function persistRAB(
  rab: RABRecord
): Promise<{ ok: boolean; syncedToSheets: boolean }> {
  // 1. Save to Cloud Firestore
  try {
    await saveFirestoreRAB(rab);
  } catch (err) {
    console.warn('Failed saving RAB to Firestore directly:', err);
  }

  // 2. Persist to server API
  try {
    const res = await fetch('/api/rab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rab),
    });
    if (res.ok) {
      return { ok: true, syncedToSheets: true };
    }
  } catch (err) {
    console.error('Error posting RAB to server:', err);
  }

  const local = getLocalData();
  const updatedRab = [rab, ...local.rabList];
  saveLocalData(local.labList, updatedRab, local.transaksiList);
  return { ok: true, syncedToSheets: false };
}

/**
 * Delete a transaction from Cloud Firestore and shared database
 */
export async function deleteLocalTransaksi(idTrx: string): Promise<boolean> {
  try {
    await deleteFirestoreTransaksi(idTrx);
  } catch (err) {
    console.warn('Failed deleting from Firestore:', err);
  }

  try {
    const res = await fetch(`/api/transaksi/${idTrx}`, { method: 'DELETE' });
    if (res.ok) return true;
  } catch (err) {
    console.error('Error deleting transaksi on server:', err);
  }

  const local = getLocalData();
  const updatedTrx = local.transaksiList.filter((t) => t.id !== idTrx);
  const updatedLabs = local.labList.map((l) => computeLABRecord(l, updatedTrx));
  saveLocalData(updatedLabs, local.rabList, updatedTrx);
  return true;
}

/**
 * Delete a LAB record from Cloud Firestore and shared database
 */
export async function deleteLocalLAB(idLAB: string): Promise<boolean> {
  try {
    await deleteFirestoreLAB(idLAB);
  } catch (err) {
    console.warn('Failed deleting LAB from Firestore:', err);
  }

  try {
    const res = await fetch(`/api/lab/${idLAB}`, { method: 'DELETE' });
    if (res.ok) return true;
  } catch (err) {
    console.error('Error deleting LAB on server:', err);
  }

  const local = getLocalData();
  const updatedLab = local.labList.filter((l) => l.id !== idLAB);
  saveLocalData(updatedLab, local.rabList, local.transaksiList);
  return true;
}

/**
 * Delete a RAB record from Cloud Firestore and shared database
 */
export async function deleteLocalRAB(idRAB: string): Promise<boolean> {
  try {
    await deleteFirestoreRAB(idRAB);
  } catch (err) {
    console.warn('Failed deleting RAB from Firestore:', err);
  }

  try {
    const res = await fetch(`/api/rab/${idRAB}`, { method: 'DELETE' });
    if (res.ok) return true;
  } catch (err) {
    console.error('Error deleting RAB on server:', err);
  }

  const local = getLocalData();
  const updatedRab = local.rabList.filter((r) => r.id !== idRAB);
  saveLocalData(local.labList, updatedRab, local.transaksiList);
  return true;
}

/**
 * Update Google Sheet webhook / sync config permanently in Firestore & Server
 */
export async function updateSheetConfig(config: {
  spreadsheetName?: string;
  spreadsheetId?: string;
  webAppUrl?: string;
  adminPin?: string;
}): Promise<boolean> {
  // 1. Immediately store to local storage
  if (config.spreadsheetId) {
    localStorage.setItem(SHEET_ID_KEY, config.spreadsheetId);
  }
  if (config.adminPin) {
    localStorage.setItem('rq_fia_admin_pin', config.adminPin);
  }

  // 2. Save permanently to Cloud Firestore
  try {
    await saveFirestoreSheetConfig(config);
  } catch (err) {
    console.warn('Failed saving sheet config to Firestore:', err);
  }

  // 3. Save to Centralized Server API
  try {
    const res = await fetch('/api/sheet-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Resets all data in Cloud Firestore, server DB, and local cache
 */
export async function clearAllData(): Promise<boolean> {
  try {
    await clearFirestoreAllData();
  } catch (err) {
    console.warn('Failed clearing Firestore:', err);
  }

  try {
    const res = await fetch('/api/reset-data', { method: 'POST' });
    if (res.ok) {
      saveLocalData([], [], []);
      return true;
    }
  } catch (err) {
    console.error('Error calling /api/reset-data:', err);
  }

  saveLocalData([], [], []);
  return true;
}
