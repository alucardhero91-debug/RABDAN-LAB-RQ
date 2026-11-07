import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { LABRecord, RABRecord, TransaksiRecord } from '../types';
import { computeLABRecord } from '../utils/formatters';

export const LAB_COLLECTION = 'lab';
export const TRANSAKSI_COLLECTION = 'transaksi';
export const RAB_COLLECTION = 'rab';
export const SETTINGS_COLLECTION = 'settings';
export const SHEET_CONFIG_DOC_ID = 'sheet_config';

export interface SheetConfigData {
  spreadsheetName?: string;
  spreadsheetId?: string;
  webAppUrl?: string;
  adminPin?: string;
  updatedAt?: string;
}

/**
 * Save Google Sheet configuration permanently to Cloud Firestore
 */
export async function saveFirestoreSheetConfig(config: SheetConfigData): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, SHEET_CONFIG_DOC_ID);
  try {
    const payload: Record<string, any> = {
      spreadsheetName: config.spreadsheetName || 'Database Keuangan RQ Ulul Azmi (RAB & LAB)',
      spreadsheetId: config.spreadsheetId || '',
      webAppUrl: config.webAppUrl || '',
      updatedAt: new Date().toISOString(),
    };
    if (config.adminPin) {
      payload.adminPin = config.adminPin;
    }
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SETTINGS_COLLECTION}/${SHEET_CONFIG_DOC_ID}`);
  }
}

/**
 * Get Google Sheet configuration from Cloud Firestore
 */
export async function getFirestoreSheetConfig(): Promise<SheetConfigData | null> {
  const docRef = doc(db, SETTINGS_COLLECTION, SHEET_CONFIG_DOC_ID);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SheetConfigData;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${SETTINGS_COLLECTION}/${SHEET_CONFIG_DOC_ID}`);
    return null;
  }
}

/**
 * Fetch all documents and persistent settings from Firestore collections
 */
export async function getFirestoreAllData(): Promise<{
  labList: LABRecord[];
  rabList: RABRecord[];
  transaksiList: TransaksiRecord[];
  sheetConfig?: SheetConfigData;
}> {
  try {
    const [labSnap, rabSnap, trxSnap, configSnap] = await Promise.all([
      getDocs(collection(db, LAB_COLLECTION)),
      getDocs(collection(db, RAB_COLLECTION)),
      getDocs(collection(db, TRANSAKSI_COLLECTION)),
      getDoc(doc(db, SETTINGS_COLLECTION, SHEET_CONFIG_DOC_ID)),
    ]);

    const rawLabList = labSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LABRecord));
    const rabList = rabSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RABRecord));
    const transaksiList = trxSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as TransaksiRecord)
    );
    const labList = rawLabList.map((l) => computeLABRecord(l, transaksiList));
    const sheetConfig = configSnap.exists() ? (configSnap.data() as SheetConfigData) : undefined;

    return { labList, rabList, transaksiList, sheetConfig };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'all_collections');
    return { labList: [], rabList: [], transaksiList: [] };
  }
}

/**
 * Real-time listener for multi-user automatic synchronization across all devices
 */
export function subscribeToFirestoreData(
  onUpdate: (data: {
    labList: LABRecord[];
    rabList: RABRecord[];
    transaksiList: TransaksiRecord[];
    sheetConfig?: SheetConfigData;
  }) => void
) {
  let currentLab: LABRecord[] = [];
  let currentRab: RABRecord[] = [];
  let currentTrx: TransaksiRecord[] = [];
  let currentConfig: SheetConfigData | undefined = undefined;

  const triggerUpdate = () => {
    const computedLabs = currentLab.map((l) => computeLABRecord(l, currentTrx));
    onUpdate({
      labList: computedLabs,
      rabList: currentRab,
      transaksiList: currentTrx,
      sheetConfig: currentConfig,
    });
  };

  const unsubLab = onSnapshot(
    collection(db, LAB_COLLECTION),
    (snap) => {
      currentLab = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LABRecord));
      triggerUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, LAB_COLLECTION);
    }
  );

  const unsubRab = onSnapshot(
    collection(db, RAB_COLLECTION),
    (snap) => {
      currentRab = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RABRecord));
      triggerUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, RAB_COLLECTION);
    }
  );

  const unsubTrx = onSnapshot(
    collection(db, TRANSAKSI_COLLECTION),
    (snap) => {
      currentTrx = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TransaksiRecord));
      triggerUpdate();
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, TRANSAKSI_COLLECTION);
    }
  );

  const unsubConfig = onSnapshot(
    doc(db, SETTINGS_COLLECTION, SHEET_CONFIG_DOC_ID),
    (snap) => {
      if (snap.exists()) {
        currentConfig = snap.data() as SheetConfigData;
        triggerUpdate();
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${SHEET_CONFIG_DOC_ID}`);
    }
  );

  return () => {
    unsubLab();
    unsubRab();
    unsubTrx();
    unsubConfig();
  };
}

/**
 * Save / Update LAB document in Cloud Firestore
 */
export async function saveFirestoreLAB(lab: LABRecord): Promise<void> {
  const docRef = doc(db, LAB_COLLECTION, lab.id);
  try {
    await setDoc(docRef, {
      nomor: lab.nomor || '',
      bulan: lab.bulan || '',
      tahun: Number(lab.tahun) || new Date().getFullYear(),
      tanggal: lab.tanggal || '',
      kota: lab.kota || 'Kibang Budi Jaya',
      ketuaRQ: lab.ketuaRQ || 'AL MUTAQIN',
      bendaharaRQ: lab.bendaharaRQ || 'HAMIDAH FAUZIYAH',
      saldoAwal: Number(lab.saldoAwal) || 0,
      totalMasuk: Number(lab.totalMasuk) || 0,
      totalKeluar: Number(lab.totalKeluar) || 0,
      saldoAkhir: Number(lab.saldoAkhir) || 0,
      trxCount: Number(lab.trxCount) || 0,
      hasLink: !!lab.hasLink,
      createdAt: lab.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${LAB_COLLECTION}/${lab.id}`);
  }
}

/**
 * Save / Update Transaksi document in Cloud Firestore
 */
export async function saveFirestoreTransaksi(trx: TransaksiRecord): Promise<void> {
  const docRef = doc(db, TRANSAKSI_COLLECTION, trx.id);
  try {
    await setDoc(docRef, {
      idLAB: trx.idLAB || '',
      tanggal: trx.tanggal || '',
      keterangan: trx.keterangan || '',
      masuk: Number(trx.masuk) || 0,
      keluar: Number(trx.keluar) || 0,
      createdAt: trx.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${TRANSAKSI_COLLECTION}/${trx.id}`);
  }
}

/**
 * Save / Update RAB document in Cloud Firestore
 */
export async function saveFirestoreRAB(rab: RABRecord): Promise<void> {
  const docRef = doc(db, RAB_COLLECTION, rab.id);
  try {
    await setDoc(docRef, {
      nomor: rab.nomor || '',
      bulan: rab.bulan || '',
      tahun: Number(rab.tahun) || new Date().getFullYear(),
      tanggal: rab.tanggal || '',
      kota: rab.kota || 'Kibang Budi Jaya',
      ketuaRQ: rab.ketuaRQ || 'AL MUTAQIN',
      bendaharaRQ: rab.bendaharaRQ || 'HAMIDAH FAUZIYAH',
      ketuaYayasan: rab.ketuaYayasan || 'H. AHMAD RIFAI, M.Pd.',
      total: Number(rab.total) || 0,
      itemCount: Number(rab.itemCount) || (rab.items ? rab.items.length : 0),
      items: rab.items || [],
      hasLink: !!rab.hasLink,
      createdAt: rab.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${RAB_COLLECTION}/${rab.id}`);
  }
}

/**
 * Delete Transaksi
 */
export async function deleteFirestoreTransaksi(id: string): Promise<void> {
  const docRef = doc(db, TRANSAKSI_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${TRANSAKSI_COLLECTION}/${id}`);
  }
}

/**
 * Delete LAB
 */
export async function deleteFirestoreLAB(id: string): Promise<void> {
  const docRef = doc(db, LAB_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${LAB_COLLECTION}/${id}`);
  }
}

/**
 * Delete RAB
 */
export async function deleteFirestoreRAB(id: string): Promise<void> {
  const docRef = doc(db, RAB_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${RAB_COLLECTION}/${id}`);
  }
}

/**
 * Clear all records from Firestore collections (used for resetting database to clean state)
 */
export async function clearFirestoreAllData(): Promise<void> {
  try {
    const [labSnap, rabSnap, trxSnap] = await Promise.all([
      getDocs(collection(db, LAB_COLLECTION)),
      getDocs(collection(db, RAB_COLLECTION)),
      getDocs(collection(db, TRANSAKSI_COLLECTION)),
    ]);

    const deletes: Promise<void>[] = [];
    labSnap.docs.forEach((d) => deletes.push(deleteDoc(d.ref)));
    rabSnap.docs.forEach((d) => deletes.push(deleteDoc(d.ref)));
    trxSnap.docs.forEach((d) => deletes.push(deleteDoc(d.ref)));

    await Promise.all(deletes);
  } catch (err) {
    console.warn('Failed clearing Firestore:', err);
  }
}
