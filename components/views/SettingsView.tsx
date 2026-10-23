'use client';

import { useState, useEffect, useRef } from 'react';
import { db, useLiveQuery, GradeRule, logAuditAction } from '@/lib/db';
import {
  Edit2,
  ShieldCheck,
  Trash2,
  Plus,
  X,
  Save,
  Lock,
  User,
  Users,
  CheckCircle2,
  ChevronRight,
  Settings,
  Download,
  Database,
  HardDrive,
  FileJson,
  Loader2,
  Sparkles,
  Layers,
  Calendar,
  AlertCircle,
  Package,
  Wallet,
  PiggyBank,
  FileText,
  Clock,
  Upload,
  FileUp,
  RotateCcw,
  AlertTriangle,
  Check,
  RefreshCw,
  FileCheck,
  CheckSquare,
  Square,
  Eye,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TableVerificationItem {
  key: string;
  label: string;
  category: string;
  backupCount: number;
  currentCount: number;
  status: 'valid' | 'empty' | 'extra';
}

export interface VerificationResult {
  fileName: string;
  fileSize: string;
  isValidJson: boolean;
  isValidBackup: boolean;
  integrityStatus: 'valid' | 'warning' | 'invalid';
  appName?: string;
  version?: string;
  exportedAt?: string;
  exportedBy?: string;
  totalBackupRecords: number;
  totalTablesWithData: number;
  tableDetails: TableVerificationItem[];
  nativeIdbStores: { key: string; count: number }[];
  validationIssues: string[];
  rawPayload: any;
}

const BACKUP_TABLES = [
  { key: 'pos', label: 'Purchase Orders (PO)', icon: Package, category: 'Order' },
  { key: 'poItems', label: 'Item & Model PO', icon: Layers, category: 'Order' },
  { key: 'tailors', label: 'SDM Penjahit', icon: Users, category: 'Produksi' },
  { key: 'sewingJobs', label: 'Ambil Jahitan (Jobs)', icon: Layers, category: 'Produksi' },
  { key: 'sewingSubmissions', label: 'Setor Jahitan', icon: Layers, category: 'Produksi' },
  { key: 'kasbons', label: 'Kasbon Penjahit', icon: Wallet, category: 'Keuangan' },
  { key: 'manualAdjustments', label: 'Penyesuaian Gaji', icon: Wallet, category: 'Keuangan' },
  { key: 'gradeRules', label: 'Aturan Grade & Bonus', icon: Settings, category: 'Sistem' },
  { key: 'salaryPayments', label: 'Riwayat Pembayaran Gaji', icon: Wallet, category: 'Keuangan' },
  { key: 'tabunganWithdrawals', label: 'Penarikan Tabungan', icon: PiggyBank, category: 'Keuangan' },
  { key: 'inhouseWorkers', label: 'Tenaga Inhouse', icon: Users, category: 'Produksi' },
  { key: 'inhouseSalaries', label: 'Gaji Tenaga Inhouse', icon: Wallet, category: 'Keuangan' },
  { key: 'catatan', label: 'Catatan Admin', icon: FileText, category: 'Admin' },
  { key: 'appLogs', label: 'Log Aktivitas Sistem', icon: Clock, category: 'Sistem' },
  { key: 'settings', label: 'Pengaturan Tambahan', icon: Settings, category: 'Sistem' },
  { key: 'activeTabungan', label: 'Saldo Tabungan Aktif', icon: PiggyBank, category: 'Keuangan' },
  { key: 'archivePOs', label: 'Arsip PO Selesai', icon: Package, category: 'Arsip' },
  { key: 'archiveSalaries', label: 'Arsip Gaji', icon: Wallet, category: 'Arsip' },
  { key: 'archiveTabungan', label: 'Arsip Tabungan', icon: PiggyBank, category: 'Arsip' },
  { key: 'archiveTailors', label: 'Arsip Penjahit', icon: Users, category: 'Arsip' },
] as const;

export default function SettingsView({ userRole, currentUsername }: { userRole?: string, currentUsername?: string }) {
  const grades = useLiveQuery(() => db.gradeRules.toArray(), []) || [];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<Partial<GradeRule>>({ name: '', minQtySingle: 0, bonusSingle: 0, minQtyCollab: 0, bonusCollab: 0, partnerRules: [] });
  const [editId, setEditId] = useState<number | null>(null);

  // Auth States
  const [isAuthFormOpen, setIsAuthFormOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [authStatus, setAuthStatus] = useState({ type: '', message: '' });
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false);

  // Export / Backup States
  const [isExporting, setIsExporting] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [lastExported, setLastExported] = useState<string | null>(null);
  const [showTableBreakdown, setShowTableBreakdown] = useState(false);
  const [exportSuccessModal, setExportSuccessModal] = useState<{
    isOpen: boolean;
    filename: string;
    totalRecords: number;
    fileSize: string;
    exportedAt: string;
    tableSummary: { name: string; count: number; category: string }[];
  } | null>(null);

  // Import / Restore & Verification States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [restoreMode, setRestoreMode] = useState<'clean' | 'merge'>('clean');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [tableSearchFilter, setTableSearchFilter] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [verificationModal, setVerificationModal] = useState<VerificationResult | null>(null);
  const [restoreSuccessModal, setRestoreSuccessModal] = useState<{
    isOpen: boolean;
    filename: string;
    totalRestored: number;
    tablesRestored: number;
    mode: string;
  } | null>(null);

  // Load live counts of all tables
  async function fetchCounts() {
    setIsLoadingCounts(true);
    const counts: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      try {
        const table = (db as any)[t.key];
        if (table && typeof table.count === 'function') {
          counts[t.key] = await table.count();
        } else if (table && typeof table.toArray === 'function') {
          const arr = await table.toArray();
          counts[t.key] = Array.isArray(arr) ? arr.length : 0;
        } else {
          counts[t.key] = 0;
        }
      } catch {
        counts[t.key] = 0;
      }
    }
    setTableCounts(counts);
    setIsLoadingCounts(false);
  }

  useEffect(() => {
    fetchCounts();
  }, []);

  const totalIndexedDBRecords = Object.values(tableCounts).reduce((sum, c) => sum + (Number(c) || 0), 0);

  // Export All Data to JSON
  async function handleExportAllData() {
    setIsExporting(true);
    try {
      const backupData: Record<string, any[]> = {};
      const exportedCounts: Record<string, number> = {};
      let totalRecords = 0;

      // 1. Fetch from app db tables
      for (const t of BACKUP_TABLES) {
        try {
          const table = (db as any)[t.key];
          if (table && typeof table.toArray === 'function') {
            const records = await table.toArray();
            const list = Array.isArray(records) ? records : [];
            backupData[t.key] = list;
            exportedCounts[t.key] = list.length;
            totalRecords += list.length;
          } else {
            backupData[t.key] = [];
            exportedCounts[t.key] = 0;
          }
        } catch (err) {
          console.warn(`Gagal membaca tabel ${t.key}:`, err);
          backupData[t.key] = [];
          exportedCounts[t.key] = 0;
        }
      }

      // 2. Also inspect and extract any native IndexedDB stores in browser
      if (typeof window !== 'undefined' && window.indexedDB) {
        try {
          if (typeof window.indexedDB.databases === 'function') {
            const dbs = await window.indexedDB.databases();
            for (const dbInfo of dbs) {
              if (!dbInfo.name) continue;
              try {
                const req = window.indexedDB.open(dbInfo.name);
                const dbInst = await new Promise<IDBDatabase>((resolve, reject) => {
                  req.onsuccess = () => resolve(req.result);
                  req.onerror = () => reject(req.error);
                });
                const storeNames = Array.from(dbInst.objectStoreNames);
                for (const storeName of storeNames) {
                  try {
                    const tx = dbInst.transaction(storeName, 'readonly');
                    const store = tx.objectStore(storeName);
                    const getAllReq = store.getAll();
                    const recs = await new Promise<any[]>((resolve, reject) => {
                      getAllReq.onsuccess = () => resolve(getAllReq.result || []);
                      getAllReq.onerror = () => reject(getAllReq.error);
                    });
                    if (recs && recs.length > 0) {
                      const customKey = `indexedDB_${dbInfo.name}_${storeName}`;
                      backupData[customKey] = recs;
                      exportedCounts[customKey] = recs.length;
                      totalRecords += recs.length;
                    }
                  } catch (storeErr) {}
                }
                dbInst.close();
              } catch (openErr) {}
            }
          }
        } catch (idbErr) {}
      }

      // 3. Assemble JSON Payload
      const now = new Date();
      const isoTimestamp = now.toISOString();
      const payload = {
        appName: 'Konfeksi Bunda Management System',
        type: 'INDEXEDDB_LOCAL_BACKUP',
        version: '1.0',
        exportedAt: isoTimestamp,
        exportedBy: currentUsername || 'admin',
        summary: {
          totalTables: Object.keys(backupData).length,
          totalRecords,
          tableCounts: exportedCounts,
        },
        data: backupData,
      };

      const jsonString = JSON.stringify(payload, null, 2);
      const byteLength = new Blob([jsonString]).size;
      const formattedSize = byteLength > 1024 * 1024
        ? `${(byteLength / (1024 * 1024)).toFixed(2)} MB`
        : byteLength > 1024
        ? `${(byteLength / 1024).toFixed(1)} KB`
        : `${byteLength} Bytes`;

      // 4. Construct file name: Backup_Konfeksi_IndexedDB_YYYY-MM-DD_HH-mm.json
      const pad = (n: number) => String(n).padStart(2, '0');
      const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const filename = `Backup_Konfeksi_IndexedDB_${datePart}.json`;

      // 5. Trigger download
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.setAttribute('download', filename);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      // 6. Log audit action
      try {
        await logAuditAction(
          'Backup Database',
          `Ekspor seluruh data IndexedDB ke file ${filename} (${totalRecords} data, ${formattedSize})`,
          currentUsername || 'Admin',
          'settings'
        );
      } catch (e) {}

      // 7. Update states & show modal
      setTableCounts(exportedCounts);
      setLastExported(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString('id-ID'));

      const summaryList = BACKUP_TABLES.map(t => ({
        name: t.label,
        count: exportedCounts[t.key] || 0,
        category: t.category,
      })).filter(t => t.count > 0);

      setExportSuccessModal({
        isOpen: true,
        filename,
        totalRecords,
        fileSize: formattedSize,
        exportedAt: now.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        tableSummary: summaryList,
      });
    } catch (err: any) {
      console.error('Backup error:', err);
      alert('Terjadi kesalahan saat mengekspor data: ' + (err?.message || 'Gagal'));
    } finally {
      setIsExporting(false);
    }
  }

  // Import & Verification Handler
  async function handleProcessBackupFile(file: File) {
    if (!file) return;
    setIsVerifying(true);
    setConfirmedCheckbox(false);
    setRestoreMode('clean');
    setTableSearchFilter('');

    const byteLength = file.size;
    const formattedSize = byteLength > 1024 * 1024
      ? `${(byteLength / (1024 * 1024)).toFixed(2)} MB`
      : byteLength > 1024
      ? `${(byteLength / 1024).toFixed(1)} KB`
      : `${byteLength} Bytes`;

    try {
      const text = await file.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch (parseErr: any) {
        setVerificationModal({
          fileName: file.name,
          fileSize: formattedSize,
          isValidJson: false,
          isValidBackup: false,
          integrityStatus: 'invalid',
          totalBackupRecords: 0,
          totalTablesWithData: 0,
          tableDetails: [],
          nativeIdbStores: [],
          validationIssues: [
            'Format berkas bukan JSON yang valid atau berkas mengalami kerusakan sintaks (' + (parseErr?.message || 'Invalid JSON') + ')'
          ],
          rawPayload: null,
        });
        setIsVerifying(false);
        return;
      }

      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        setVerificationModal({
          fileName: file.name,
          fileSize: formattedSize,
          isValidJson: true,
          isValidBackup: false,
          integrityStatus: 'invalid',
          totalBackupRecords: 0,
          totalTablesWithData: 0,
          tableDetails: [],
          nativeIdbStores: [],
          validationIssues: [
            'Struktur root berkas JSON tidak sesuai standar (root harus berupa objek data).'
          ],
          rawPayload: payload,
        });
        setIsVerifying(false);
        return;
      }

      const isStandardBackup = payload.type === 'INDEXEDDB_LOCAL_BACKUP';
      const dataObj = (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data))
        ? payload.data
        : payload;

      const issues: string[] = [];

      if (!isStandardBackup) {
        issues.push('Berkas tidak memiliki penanda header tipe standar INDEXEDDB_LOCAL_BACKUP, namun struktur tabel data dapat dibaca.');
      }

      // Format date if present
      let exportedAtFormatted = '-';
      if (payload.exportedAt) {
        try {
          const d = new Date(payload.exportedAt);
          if (!isNaN(d.getTime())) {
            exportedAtFormatted = d.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
          } else {
            exportedAtFormatted = String(payload.exportedAt);
          }
        } catch {
          exportedAtFormatted = String(payload.exportedAt);
        }
      }

      // Analyze tables
      const tableDetails: TableVerificationItem[] = [];
      let totalRecords = 0;
      let tablesWithData = 0;

      for (const t of BACKUP_TABLES) {
        const rawList = dataObj[t.key];
        const currentCount = tableCounts[t.key] || 0;
        if (Array.isArray(rawList)) {
          const count = rawList.length;
          totalRecords += count;
          if (count > 0) tablesWithData++;
          tableDetails.push({
            key: t.key,
            label: t.label,
            category: t.category,
            backupCount: count,
            currentCount,
            status: count > 0 ? 'valid' : 'empty'
          });
        } else {
          tableDetails.push({
            key: t.key,
            label: t.label,
            category: t.category,
            backupCount: 0,
            currentCount,
            status: 'empty'
          });
        }
      }

      // Check native IDB stores if present
      const nativeIdbStores: { key: string; count: number }[] = [];
      for (const key of Object.keys(dataObj)) {
        if (key.startsWith('indexedDB_') && Array.isArray(dataObj[key])) {
          const count = dataObj[key].length;
          totalRecords += count;
          nativeIdbStores.push({ key, count });
        }
      }

      // Integrity checks
      if (totalRecords === 0) {
        issues.push('Tidak ditemukan catatan data di dalam berkas cadangan ini (0 records).');
      }

      // Sample check on tables
      if (Array.isArray(dataObj.pos) && dataObj.pos.length > 0) {
        const sample = dataObj.pos[0];
        if (!sample || typeof sample !== 'object' || (!sample.poNumber && !sample.id)) {
          issues.push('Struktur Purchase Orders tidak memiliki kolom standar (poNumber / id).');
        }
      }

      if (Array.isArray(dataObj.tailors) && dataObj.tailors.length > 0) {
        const sample = dataObj.tailors[0];
        if (!sample || typeof sample !== 'object' || !sample.name) {
          issues.push('Struktur SDM Penjahit tidak memiliki kolom nama penjahit.');
        }
      }

      let integrityStatus: 'valid' | 'warning' | 'invalid' = 'valid';
      if (totalRecords === 0 || (tablesWithData === 0 && nativeIdbStores.length === 0)) {
        integrityStatus = 'invalid';
      } else if (issues.length > 0) {
        integrityStatus = 'warning';
      }

      setVerificationModal({
        fileName: file.name,
        fileSize: formattedSize,
        isValidJson: true,
        isValidBackup: isStandardBackup || totalRecords > 0,
        integrityStatus,
        appName: payload.appName || 'Konfeksi Bunda Management System',
        version: payload.version || '1.0',
        exportedAt: exportedAtFormatted,
        exportedBy: payload.exportedBy || 'Admin',
        totalBackupRecords: totalRecords,
        totalTablesWithData: tablesWithData + nativeIdbStores.length,
        tableDetails,
        nativeIdbStores,
        validationIssues: issues,
        rawPayload: payload,
      });
    } catch (err: any) {
      console.error('File read error:', err);
      setVerificationModal({
        fileName: file.name,
        fileSize: formattedSize,
        isValidJson: false,
        isValidBackup: false,
        integrityStatus: 'invalid',
        totalBackupRecords: 0,
        totalTablesWithData: 0,
        tableDetails: [],
        nativeIdbStores: [],
        validationIssues: ['Gagal membaca berkas: ' + (err?.message || 'File error')],
        rawPayload: null,
      });
    } finally {
      setIsVerifying(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // Restore Execution Handler
  async function handleExecuteRestore() {
    if (!verificationModal || verificationModal.integrityStatus === 'invalid' || !confirmedCheckbox) return;

    setIsRestoring(true);
    setRestoreProgress('Menyiapkan pemulihan database...');
    try {
      const dataObj = (verificationModal.rawPayload.data && typeof verificationModal.rawPayload.data === 'object' && !Array.isArray(verificationModal.rawPayload.data))
        ? verificationModal.rawPayload.data
        : verificationModal.rawPayload;

      let totalRestored = 0;
      let tablesRestored = 0;

      for (let i = 0; i < BACKUP_TABLES.length; i++) {
        const t = BACKUP_TABLES[i];
        const items = dataObj[t.key];
        const currentCount = tableCounts[t.key] || 0;

        setRestoreProgress(`Memulihkan ${t.label} (${i + 1}/${BACKUP_TABLES.length})...`);

        if (Array.isArray(items)) {
          if (items.length > 0 || (restoreMode === 'clean' && currentCount > 0)) {
            await (db as any)[t.key].restoreTable(items || [], restoreMode);
            if (items.length > 0) {
              totalRestored += items.length;
              tablesRestored++;
            }
          }
        } else if (restoreMode === 'clean' && currentCount > 0) {
          await (db as any)[t.key].clear();
        }
      }

      // Also restore native browser indexedDB stores if any
      if (typeof window !== 'undefined' && window.indexedDB && verificationModal.nativeIdbStores.length > 0) {
        for (const item of verificationModal.nativeIdbStores) {
          try {
            const parts = item.key.split('_');
            if (parts.length >= 3) {
              const dbName = parts[1];
              const storeName = parts.slice(2).join('_');
              const records = dataObj[item.key];
              if (Array.isArray(records) && records.length > 0) {
                const req = window.indexedDB.open(dbName);
                req.onsuccess = () => {
                  try {
                    const idb = req.result;
                    if (idb.objectStoreNames.contains(storeName)) {
                      const tx = idb.transaction(storeName, 'readwrite');
                      const store = tx.objectStore(storeName);
                      if (restoreMode === 'clean') store.clear();
                      for (const r of records) {
                        try { store.put(r); } catch (e) {}
                      }
                    }
                  } catch (e) {}
                };
              }
            }
          } catch (idbErr) {}
        }
      }

      // Log audit action
      try {
        await logAuditAction(
          'Restore Database',
          `Pemulihan data dari file ${verificationModal.fileName} (${restoreMode === 'clean' ? 'Ganti Bersih' : 'Gabungkan'}, ${totalRestored} data, ${tablesRestored} tabel)`,
          currentUsername || 'Admin',
          'settings'
        );
      } catch (e) {}

      // Refresh live counts
      await fetchCounts();

      const modalInfo = {
        filename: verificationModal.fileName,
        totalRestored,
        tablesRestored,
        mode: restoreMode === 'clean' ? 'Ganti Bersih (Clean Restore / Overwrite)' : 'Gabungkan (Merge / Upsert)',
      };

      setVerificationModal(null);
      setRestoreSuccessModal({
        isOpen: true,
        ...modalInfo,
      });
    } catch (err: any) {
      console.error('Restore execution error:', err);
      alert('Terjadi kesalahan saat memulihkan database: ' + (err?.message || 'Gagal'));
    } finally {
      setIsRestoring(false);
      setRestoreProgress('');
    }
  }

  async function handleSave(e: React.FormEvent) {
     e.preventDefault();
     if(!form.name) return;
     if (editId) {
        await db.gradeRules.update(editId, { ...form, updatedBy: currentUsername });
     } else {
        await db.gradeRules.add({ ...form, createdBy: currentUsername } as GradeRule);
     }
     setIsFormOpen(false);
     setEditId(null);
  }

  function openEdit(g: GradeRule) {
     setEditId(g.id!);
     setForm({ partnerRules: [], ...g });
     setIsFormOpen(true);
  }

  async function handleDelete(id: number) {
     if(confirm('Anda yakin ingin menghapus konfigurasi grade ini?')) {
        await db.gradeRules.delete(id);
     }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (authForm.newPassword !== authForm.confirmPassword) {
      setAuthStatus({ type: 'error', message: 'Konfirmasi password tidak cocok' });
      return;
    }

    setIsUpdatingAuth(true);
    setAuthStatus({ type: '', message: '' });

    try {
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: currentUsername,
          currentPassword: authForm.currentPassword,
          newPassword: authForm.newPassword
        }),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        if (rawText && !rawText.trim().startsWith('<')) {
          data = JSON.parse(rawText);
        }
      } catch (e) {}

      if (data.success) {
        setAuthStatus({ type: 'success', message: 'Password berhasil diperbarui!' });
        setAuthForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setIsAuthFormOpen(false), 2000);
      } else {
        setAuthStatus({ type: 'error', message: data.message || 'Gagal memperbarui password' });
      }
    } catch (err) {
      setAuthStatus({ type: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsUpdatingAuth(false);
    }
  }

  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
       {/* Top Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5">
               <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                  <Settings size={22} />
               </div>
               <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Pengaturan Sistem</h2>
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">Cadangan data lokal, keamanan akun & konfigurasi insentif produksi</p>
               </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
             <input
               ref={fileInputRef}
               type="file"
               accept=".json,application/json"
               className="hidden"
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) handleProcessBackupFile(file);
               }}
             />
             <button 
               onClick={handleExportAllData}
               disabled={isExporting}
               className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
             >
                {isExporting ? (
                  <>
                     <Loader2 size={16} className="animate-spin" /> Mengekspor...
                  </>
                ) : (
                  <>
                     <Download size={16}/> Backup JSON
                  </>
                )}
             </button>
             <button 
               onClick={() => fileInputRef.current?.click()}
               disabled={isExporting || isRestoring || isVerifying}
               className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
             >
                {isVerifying ? (
                  <>
                     <Loader2 size={16} className="animate-spin" /> Memeriksa...
                  </>
                ) : (
                  <>
                     <Upload size={16}/> Pulihkan JSON
                  </>
                )}
             </button>
             <button 
               onClick={() => setIsAuthFormOpen(true)} 
               className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
             >
                <Lock size={16}/> Keamanan
             </button>
             {(userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin') && (
               <button 
                 onClick={() => { setForm({ name: '', minQtySingle: 0, bonusSingle: 0, minQtyCollab: 0, bonusCollab: 0, partnerRules: [] }); setEditId(null); setIsFormOpen(true); }}
                 className="flex-1 md:flex-none bg-slate-900 text-white hover:bg-indigo-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
               >
                  <Plus size={16}/> Tambah Grade
               </button>
             )}
          </div>
       </div>

       {/* Security Section UI */}
       <AnimatePresence>
       {isAuthFormOpen && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -20 }}
           className="bg-indigo-900 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl shadow-indigo-900/20 relative overflow-hidden group"
         >
            <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform"><ShieldCheck size={160}/></div>
            
            <div className="relative z-10">
               <div className="flex justify-between items-start mb-8">
                  <div>
                     <h3 className="text-2xl font-black tracking-tight">Keamanan Akses</h3>
                     <p className="text-indigo-200 text-sm font-medium mt-1">Ubah kata sandi login admin untuk keamanan data.</p>
                  </div>
                  <button onClick={() => setIsAuthFormOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                     <X size={20}/>
                  </button>
               </div>

               <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest">Password Saat Ini</label>
                     <input 
                        type="password" 
                        required 
                        value={authForm.currentPassword}
                        onChange={e => setAuthForm({...authForm, currentPassword: e.target.value})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:outline-none transition-all placeholder:text-white/20" 
                        placeholder="••••••••"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest">Password Baru</label>
                     <input 
                        type="password" 
                        required 
                        value={authForm.newPassword}
                        onChange={e => setAuthForm({...authForm, newPassword: e.target.value})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:outline-none transition-all placeholder:text-white/20" 
                        placeholder="Min. 6 Karakter"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest">Konfirmasi Password</label>
                     <div className="flex gap-2">
                        <input 
                           type="password" 
                           required 
                           value={authForm.confirmPassword}
                           onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})}
                           className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:outline-none transition-all placeholder:text-white/20" 
                           placeholder="Ulangi Password"
                        />
                        <button type="submit" disabled={isUpdatingAuth} className="bg-white text-indigo-950 hover:bg-indigo-50 px-5 rounded-xl text-xs font-black uppercase flex items-center justify-center transition-all disabled:opacity-50">
                           {isUpdatingAuth ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>}
                        </button>
                     </div>
                  </div>
               </form>

               {authStatus.message && (
                 <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`mt-6 px-4 py-2 rounded-xl text-xs font-bold w-fit ${authStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {authStatus.message}
                 </motion.div>
               )}
            </div>
         </motion.div>
       )}
       </AnimatePresence>

       {/* ========================================================================= */}
       {/* Feature: Ekspor Data IndexedDB ke File JSON (Local Backup) */}
       {/* ========================================================================= */}
       <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform pointer-events-none">
             <Database size={180} className="text-slate-900" />
          </div>

          <div className="relative z-10 space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                   <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                      <HardDrive size={28} />
                   </div>
                   <div>
                      <div className="flex flex-wrap items-center gap-2">
                         <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Cadangan Data Lokal (IndexedDB Backup)
                         </h3>
                         <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                            JSON Export
                         </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                         Ekspor seluruh data operasional, produksi, penggajian, dan tabungan ke file JSON untuk disimpan secara lokal atau di drive eksternal.
                      </p>
                   </div>
                </div>

                {lastExported && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-right shrink-0">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Terakhir Dicadangkan</span>
                     <span className="text-xs font-black text-slate-700">{lastExported}</span>
                  </div>
                )}
             </div>

             {/* Key Metrics / Snapshot */}
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Total Entri Data</span>
                   <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
                         {isLoadingCounts ? '...' : totalIndexedDBRecords.toLocaleString('id-ID')}
                      </span>
                      <span className="text-xs font-bold text-slate-400">records</span>
                   </div>
                   <p className="text-[10px] text-slate-500 font-medium mt-1">Tersimpan di sistem</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tabel Terangkum</span>
                   <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-indigo-600 tabular-nums">
                         {BACKUP_TABLES.length}
                      </span>
                      <span className="text-xs font-bold text-slate-400">tabel</span>
                   </div>
                   <p className="text-[10px] text-slate-500 font-medium mt-1">Struktur lengkap</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Format Berkas</span>
                   <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-600">.JSON</span>
                   </div>
                   <p className="text-[10px] text-slate-500 font-medium mt-1">Standar & Universal</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Keamanan Cadangan</span>
                   <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-2xl font-black text-slate-800">Offline</span>
                   </div>
                   <p className="text-[10px] text-slate-500 font-medium mt-1">Langsung diunduh ke device</p>
                </div>
             </div>

             {/* Action Bar */}
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                   <button
                     type="button"
                     onClick={() => setShowTableBreakdown(!showTableBreakdown)}
                     className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors cursor-pointer"
                   >
                      <Layers size={14} />
                      {showTableBreakdown ? 'Sembunyikan Rincian Tabel' : 'Lihat Rincian Entri per Tabel'}
                   </button>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
                   <button
                      type="button"
                      onClick={handleExportAllData}
                      disabled={isExporting}
                      className="flex-1 sm:flex-none bg-slate-900 hover:bg-emerald-600 text-white font-extrabold px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center justify-center gap-2.5 text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                   >
                      {isExporting ? (
                         <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Mengekspor...</span>
                         </>
                      ) : (
                         <>
                            <Download size={16} />
                            <span>Unduh Backup JSON</span>
                         </>
                      )}
                   </button>

                   <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isExporting || isRestoring || isVerifying}
                      className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2.5 text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                   >
                      {isVerifying ? (
                         <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Memeriksa Berkas...</span>
                         </>
                      ) : (
                         <>
                            <FileUp size={16} />
                            <span>Pilih & Pulihkan Backup</span>
                         </>
                      )}
                   </button>
                </div>
             </div>

             {/* Drag and Drop Restore Box */}
             <div
                onDragOver={(e) => {
                   e.preventDefault();
                   setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                   e.preventDefault();
                   setIsDraggingFile(false);
                   const file = e.dataTransfer.files?.[0];
                   if (file) handleProcessBackupFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-all cursor-pointer ${
                   isDraggingFile
                     ? 'border-indigo-600 bg-indigo-50/70 scale-[0.99]'
                     : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60 bg-slate-50/30'
                }`}
             >
                <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                      {isVerifying ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                   </div>
                   <div>
                      <span className="text-xs sm:text-sm font-black text-slate-800 block">
                         Tarik & Lepaskan File Backup (.json) ke Sini
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                         atau <span className="text-indigo-600 font-bold underline">klik untuk memilih berkas</span> dari komputer/flashdisk
                      </span>
                   </div>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                         <Check size={10} /> Verifikasi Integritas Otomatis
                      </span>
                      <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                         Format Standar .JSON
                      </span>
                   </div>
                </div>
             </div>

             {/* Expandable Table Breakdown */}
             <AnimatePresence>
             {showTableBreakdown && (
               <motion.div
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 className="overflow-hidden"
               >
                  <div className="pt-4 border-t border-slate-100">
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        Rincian Entri per Tabel IndexedDB:
                     </p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {BACKUP_TABLES.map(t => {
                           const count = tableCounts[t.key] || 0;
                           return (
                              <div key={t.key} className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                                 <div className="truncate pr-2">
                                    <span className="text-xs font-bold text-slate-800 block truncate">{t.label}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">{t.key}</span>
                                 </div>
                                 <span className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                    count > 0 ? 'bg-indigo-50 text-indigo-700 font-mono' : 'bg-slate-100 text-slate-400'
                                 }`}>
                                    {count.toLocaleString('id-ID')}
                                 </span>
                              </div>
                           );
                        })}
                     </div>
                  </div>
               </motion.div>
             )}
             </AnimatePresence>
          </div>
       </div>

       {/* ========================================================================= */}
       {/* Grade Rules Section */}
       {/* ========================================================================= */}
       <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
             <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div> Definisi Grade Produksi & Insentif
             </h3>
             <span className="text-xs font-bold text-slate-400">{grades.length} Grade Dikonfigurasi</span>
          </div>

          <AnimatePresence>
          {isFormOpen && (
             <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden no-scrollbar"
             >
                <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-indigo-100 shadow-xl shadow-indigo-100/20 mb-8">
                   <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
                     <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                        {editId ? `Modifikasi ${form.name}` : 'Grade Rule Baru'}
                     </h3>
                     <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-xl"><X size={20}/></button>
                   </div>
                   <form onSubmit={handleSave} className="space-y-8">
                      <div className="max-w-md">
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Identifier Nama Grade</label>
                         <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" required placeholder="CONTOH: GRADE A" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-6 p-3.5 sm:p-5 bg-slate-50/50 rounded-xl sm:rounded-2xl border-2 border-slate-50 relative group hover:border-indigo-100 transition-all">
                            <div className="absolute -right-2 top-4 rotate-12 opacity-5 text-indigo-600"><User size={80}/></div>
                            <h4 className="font-black text-slate-900 text-xs flex items-center gap-3 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Pekerja Tunggal (Single)</h4>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Min. Setoran</label>
                                  <input type="number" min="0" value={form.minQtySingle || ''} onChange={e => setForm({...form, minQtySingle: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-500 focus:outline-none" required placeholder="0"/>
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Bonus Total (Rp)</label>
                                  <input type="number" min="0" value={form.bonusSingle || ''} onChange={e => setForm({...form, bonusSingle: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:border-indigo-500 focus:outline-none" required placeholder="0"/>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-6 p-3.5 sm:p-5 bg-slate-50/50 rounded-xl sm:rounded-2xl border-2 border-slate-50 relative group hover:border-emerald-100 transition-all">
                            <div className="absolute -right-2 top-4 rotate-12 opacity-5 text-emerald-600"><User size={80}/></div>
                            <h4 className="font-black text-slate-900 text-xs flex items-center gap-3 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Pekerja Kolaborasi (Partner)</h4>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Min. Setoran</label>
                                  <input type="number" min="0" value={form.minQtyCollab || ''} onChange={e => setForm({...form, minQtyCollab: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none" required placeholder="0"/>
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Bonus Total (Rp)</label>
                                  <input type="number" min="0" value={form.bonusCollab || ''} onChange={e => setForm({...form, bonusCollab: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:border-emerald-500 focus:outline-none" required placeholder="0"/>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                            <h4 className="font-black text-slate-900 text-xs flex items-center gap-3 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Pekerja Multi-Partner (2+, 3+, dst)</h4>
                            <button 
                               type="button"
                               onClick={() => setForm({...form, partnerRules: [...(form.partnerRules || []), { partnerCount: 2, minQty: 0, bonus: 0 }]})}
                               className="text-[10px] font-bold text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                            >
                               <Plus size={14}/> Tambah Konfigurasi
                            </button>
                         </div>
                         <div className="space-y-3">
                            {form.partnerRules?.map((rule, idx) => (
                               <div key={idx} className="flex gap-4 items-end bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100">
                                  <div className="flex-1 space-y-2">
                                     <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Jumlah Partner</label>
                                     <input type="number" min="2" value={rule.partnerCount} onChange={e => {
                                        const newRules = [...form.partnerRules!];
                                        newRules[idx].partnerCount = Number(e.target.value);
                                        setForm({...form, partnerRules: newRules});
                                     }} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black focus:border-orange-500 focus:outline-none" required/>
                                  </div>
                                  <div className="flex-1 space-y-2">
                                     <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Min. Setoran</label>
                                     <input type="number" min="0" value={rule.minQty || ''} onChange={e => {
                                        const newRules = [...form.partnerRules!];
                                        newRules[idx].minQty = Number(e.target.value);
                                        setForm({...form, partnerRules: newRules});
                                     }} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black focus:border-orange-500 focus:outline-none" required/>
                                  </div>
                                  <div className="flex-1 space-y-2">
                                     <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Bonus Total (Rp)</label>
                                     <input type="number" min="0" value={rule.bonus || ''} onChange={e => {
                                        const newRules = [...form.partnerRules!];
                                        newRules[idx].bonus = Number(e.target.value);
                                        setForm({...form, partnerRules: newRules});
                                     }} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-black focus:border-orange-500 focus:outline-none" required/>
                                  </div>
                                  <button type="button" onClick={() => {
                                     const newRules = form.partnerRules!.filter((_, i) => i !== idx);
                                     setForm({...form, partnerRules: newRules});
                                  }} className="bg-white border-2 border-slate-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 px-4 py-3 rounded-xl transition-all">
                                     <Trash2 size={16}/>
                                  </button>
                               </div>
                            ))}
                         </div>
                      </div>

                      <div className="flex justify-end pt-4">
                         <button type="submit" className="w-full md:w-auto bg-indigo-600 text-white hover:bg-slate-900 px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 transition-all active:scale-95">
                            <Save size={18}/> {editId ? 'Selesaikan Perubahan' : 'Publish Rule Baru'}
                         </button>
                      </div>
                   </form>
                </div>
             </motion.div>
          )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {grades.map(g => (
                <motion.div 
                   layout
                   key={g.id} 
                   className="bg-white border-2 border-slate-50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:translate-x-2 sm:-translate-y-2 sm:group-hover:translate-x-0 sm:group-hover:translate-y-0 transition-all duration-300">
                      <div className="flex gap-2">
                         {(userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin') && (
                           <>
                             <button onClick={() => openEdit(g)} className="bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 p-2 rounded-xl shadow-sm transition-colors"><Edit2 size={16}/></button>
                             <button onClick={() => handleDelete(g.id!)} className="bg-white border border-slate-200 text-slate-400 hover:text-rose-600 p-2 rounded-xl shadow-sm transition-colors"><Trash2 size={16}/></button>
                           </>
                         )}
                      </div>
                   </div>

                   <div className="mb-8">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 block">Rule Configuration</span>
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{g.name}</h4>
                   </div>

                   <div className="space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all"><User size={18}/></div>
                         <div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Potensi Single</p>
                            <p className="text-xs font-bold text-slate-700">Min. {g.minQtySingle} pcs → <span className="font-black text-indigo-600">+Rp {g.bonusSingle.toLocaleString('id-ID')}</span></p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all"><Users size={18}/></div>
                         <div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Potensi Berdua</p>
                            <p className="text-xs font-bold text-slate-700">Min. {g.minQtyCollab} pcs → <span className="font-black text-emerald-600">+Rp {g.bonusCollab.toLocaleString('id-ID')}</span></p>
                         </div>
                      </div>
                      {g.partnerRules?.map((rule, idx) => (
                         <div key={idx} className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-all"><Users size={18}/></div>
                            <div>
                               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Potensi {rule.partnerCount} Pekerja</p>
                               <p className="text-xs font-bold text-slate-700">Min. {rule.minQty} pcs → <span className="font-black text-orange-600">+Rp {rule.bonus.toLocaleString('id-ID')}</span></p>
                            </div>
                         </div>
                      ))}
                   </div>
                </motion.div>
             ))}
             {grades.length === 0 && (
                <div className="md:col-span-3 py-20 text-center opacity-40 font-bold border-2 border-dashed border-slate-100 rounded-[3rem]">
                   <Settings className="mx-auto mb-4 text-slate-200" size={48}/>
                   <p className="uppercase tracking-widest text-[10px]">Belum Ada Grade Terdaftar</p>
                </div>
             )}
          </div>
       </div>

       {/* ========================================================================= */}
       {/* Export Success Modal (Notification & Verification) */}
       {/* ========================================================================= */}
       <AnimatePresence>
       {exportSuccessModal && exportSuccessModal.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-8 sm:pt-14 p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
             <motion.div
                initial={{ scale: 0.95, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: -20, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 p-6 sm:p-8 text-center my-0"
             >
                <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
                   <CheckCircle2 size={32} />
                </div>

                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-2">
                   Backup Selesai Diunduh
                </span>

                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                   Data Berhasil Dicadangkan!
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mb-6 leading-relaxed max-w-md mx-auto">
                   File cadangan JSON siap disimpan ke tempat aman. Simpan file ini di flashdisk, cloud drive, atau komputer Anda.
                </p>

                {/* File Details Box */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs">
                   <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-slate-400 font-bold">Nama File:</span>
                      <span className="font-mono font-black text-slate-800 text-[11px] truncate max-w-[240px]" title={exportSuccessModal.filename}>
                         {exportSuccessModal.filename}
                      </span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold">Total Entri:</span>
                      <span className="font-black text-indigo-600">{exportSuccessModal.totalRecords.toLocaleString('id-ID')} records</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold">Ukuran File:</span>
                      <span className="font-bold text-slate-700">{exportSuccessModal.fileSize}</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-bold">Waktu Ekspor:</span>
                      <span className="font-bold text-slate-700">{exportSuccessModal.exportedAt}</span>
                   </div>
                </div>

                {/* Table Highlights */}
                {exportSuccessModal.tableSummary && exportSuccessModal.tableSummary.length > 0 && (
                   <div className="text-left mb-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                         Ringkasan Tabel Berisi Data ({exportSuccessModal.tableSummary.length}):
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                         {exportSuccessModal.tableSummary.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                               <span className="text-slate-700 font-bold truncate">{item.name}</span>
                               <span className="font-mono font-black text-slate-900 shrink-0">{item.count}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                )}

                <button
                   type="button"
                   onClick={() => setExportSuccessModal(null)}
                   className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 text-xs uppercase tracking-widest cursor-pointer"
                >
                   Tutup & Selesai
                </button>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* ========================================================================= */}
       {/* Verification & Restoration Preview Modal */}
       {/* ========================================================================= */}
       <AnimatePresence>
       {verificationModal && (
          <div className="fixed inset-0 z-[75] flex items-start justify-center pt-4 sm:pt-8 md:pt-10 p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
             <motion.div
                initial={{ scale: 0.95, y: -24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: -24, opacity: 0 }}
                className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 p-5 sm:p-8 text-left my-0 relative"
             >
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-slate-100 mb-6">
                   <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                         verificationModal.integrityStatus === 'valid'
                           ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                           : verificationModal.integrityStatus === 'warning'
                           ? 'bg-amber-50 text-amber-600 border border-amber-100'
                           : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                         {verificationModal.integrityStatus === 'valid' ? (
                            <FileCheck size={26} />
                         ) : verificationModal.integrityStatus === 'warning' ? (
                            <AlertTriangle size={26} />
                         ) : (
                            <AlertCircle size={26} />
                         )}
                      </div>
                      <div>
                         <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Verifikasi Cadangan Data
                         </h3>
                         <p className="text-xs text-slate-500 font-medium">
                            Pemeriksaan integritas skema dan pratinjau sebelum pemulihan ke database
                         </p>
                      </div>
                   </div>
                   <button
                      type="button"
                      onClick={() => setVerificationModal(null)}
                      disabled={isRestoring}
                      className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer"
                   >
                      <X size={20} />
                   </button>
                </div>

                {/* Verification Status Banner */}
                {verificationModal.integrityStatus === 'valid' && (
                   <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-4 text-emerald-950 mb-6 flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                         <span className="text-xs font-black uppercase tracking-wider block text-emerald-800">
                            Integritas Berkas Valid & Aman Dipulihkan
                         </span>
                         <p className="text-xs text-emerald-700 font-medium mt-0.5">
                            Format berkas sesuai spesifikasi backup sistem. Seluruh data tabel terverifikasi utuh dan siap disinkronkan ke database sistem.
                         </p>
                      </div>
                   </div>
                )}

                {verificationModal.integrityStatus === 'warning' && (
                   <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 text-amber-950 mb-6 flex items-start gap-3">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                         <span className="text-xs font-black uppercase tracking-wider block text-amber-800">
                            Berkas Terverifikasi Dengan Catatan
                         </span>
                         <ul className="text-xs text-amber-800 font-medium mt-1 space-y-1 list-disc list-inside">
                            {verificationModal.validationIssues.map((issue, idx) => (
                               <li key={idx}>{issue}</li>
                            ))}
                         </ul>
                      </div>
                   </div>
                )}

                {verificationModal.integrityStatus === 'invalid' && (
                   <div className="bg-rose-50/90 border border-rose-200/90 rounded-2xl p-4 text-rose-950 mb-6 flex items-start gap-3">
                      <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                         <span className="text-xs font-black uppercase tracking-wider block text-rose-800">
                            Berkas Tidak Dapat Dipulihkan (Verifikasi Gagal)
                         </span>
                         <ul className="text-xs text-rose-800 font-medium mt-1 space-y-1 list-disc list-inside">
                            {verificationModal.validationIssues.map((issue, idx) => (
                               <li key={idx}>{issue}</li>
                            ))}
                         </ul>
                      </div>
                   </div>
                )}

                {/* File Metadata Grid */}
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-6">
                   <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Nama Berkas</span>
                      <span className="font-mono font-bold text-slate-800 truncate block text-[11px]" title={verificationModal.fileName}>
                         {verificationModal.fileName}
                      </span>
                   </div>
                   <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Ukuran File</span>
                      <span className="font-bold text-slate-700 text-xs">{verificationModal.fileSize}</span>
                   </div>
                   <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Waktu Cadangan</span>
                      <span className="font-bold text-slate-700 text-xs">{verificationModal.exportedAt || '-'}</span>
                   </div>
                   <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Dibuat Oleh</span>
                      <span className="font-bold text-slate-700 text-xs">{verificationModal.exportedBy || 'Admin'}</span>
                   </div>
                   <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Total Data Cadangan</span>
                      <span className="font-black text-indigo-600 text-xs">
                         {verificationModal.totalBackupRecords.toLocaleString('id-ID')} records
                      </span>
                   </div>
                   <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Tabel Terisi</span>
                      <span className="font-black text-emerald-600 text-xs">
                         {verificationModal.totalTablesWithData} tabel
                      </span>
                   </div>
                </div>

                {/* Restoration Mode Selector */}
                {verificationModal.integrityStatus !== 'invalid' && (
                   <div className="mb-6 space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                         Pilih Mode Pemulihan Database:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div
                            onClick={() => !isRestoring && setRestoreMode('clean')}
                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                               restoreMode === 'clean'
                                 ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                                 : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                         >
                            <div className="flex items-center justify-between mb-1.5">
                               <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                     restoreMode === 'clean' ? 'border-indigo-600' : 'border-slate-300'
                                  }`}>
                                     {restoreMode === 'clean' && <div className="w-2 h-2 rounded-full bg-indigo-600"></div>}
                                  </div>
                                  <span className="text-xs font-black text-slate-900">Ganti Bersih (Clean Restore)</span>
                               </div>
                               <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase">
                                  Rekomendasi
                               </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed pl-6">
                               Kosongkan data saat ini di tabel terkait dan gantikan penuh dengan berkas cadangan. Menjamin keutuhan ID dan relasi data.
                            </p>
                         </div>

                         <div
                            onClick={() => !isRestoring && setRestoreMode('merge')}
                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                               restoreMode === 'merge'
                                 ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                                 : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                         >
                            <div className="flex items-center justify-between mb-1.5">
                               <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                     restoreMode === 'merge' ? 'border-emerald-600' : 'border-slate-300'
                                  }`}>
                                     {restoreMode === 'merge' && <div className="w-2 h-2 rounded-full bg-emerald-600"></div>}
                                  </div>
                                  <span className="text-xs font-black text-slate-900">Gabungkan (Merge / Upsert)</span>
                               </div>
                               <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                                  Pertahankan
                               </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed pl-6">
                               Data di database saat ini tidak dihapus. Entri dari cadangan akan ditambahkan atau diperbarui jika ID-nya telah ada.
                            </p>
                         </div>
                      </div>
                   </div>
                )}

                {/* Table Comparison Table */}
                <div className="mb-6 space-y-2">
                   <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         Pratinjau Perbandingan Data per Tabel:
                      </label>
                      <div className="relative">
                         <input
                            type="text"
                            placeholder="Cari tabel..."
                            value={tableSearchFilter}
                            onChange={(e) => setTableSearchFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:border-indigo-500 w-36"
                         />
                      </div>
                   </div>

                   <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      {verificationModal.tableDetails
                         .filter(t => !tableSearchFilter || t.label.toLowerCase().includes(tableSearchFilter.toLowerCase()) || t.key.toLowerCase().includes(tableSearchFilter.toLowerCase()))
                         .map(t => {
                            return (
                               <div key={t.key} className="p-2.5 px-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                                  <div className="truncate pr-2">
                                     <span className="font-bold text-slate-800 block truncate">{t.label}</span>
                                     <span className="text-[10px] text-slate-400 font-mono">{t.key}</span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                     <div className="text-right">
                                        <span className="text-[10px] text-slate-400 block">Cadangan</span>
                                        <span className="font-mono font-black text-indigo-600">{t.backupCount.toLocaleString('id-ID')}</span>
                                     </div>
                                     <div className="text-right pl-2 border-l border-slate-200">
                                        <span className="text-[10px] text-slate-400 block">Saat Ini</span>
                                        <span className="font-mono font-bold text-slate-600">{t.currentCount.toLocaleString('id-ID')}</span>
                                     </div>
                                  </div>
                               </div>
                            );
                         })}
                   </div>
                </div>

                {/* Safety Confirmation Checkbox */}
                {verificationModal.integrityStatus !== 'invalid' && (
                   <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-4 mb-6">
                      <label className="flex items-start gap-3 cursor-pointer">
                         <input
                            type="checkbox"
                            checked={confirmedCheckbox}
                            onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                            disabled={isRestoring}
                            className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                         />
                         <span className="text-xs text-amber-950 font-bold leading-relaxed">
                            Saya telah memeriksa informasi data cadangan di atas dan menyetujui pemulihan database dengan mode{' '}
                            <span className="underline font-black">
                               {restoreMode === 'clean' ? 'Ganti Bersih (Clean Restore)' : 'Gabungkan (Merge)'}
                            </span>
                            .
                         </span>
                      </label>
                   </div>
                )}

                {/* Modal Footer Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                       type="button"
                       onClick={() => setVerificationModal(null)}
                       disabled={isRestoring}
                       className="w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                       Batalkan
                    </button>

                    {verificationModal.integrityStatus !== 'invalid' && (
                       <button
                          type="button"
                          onClick={handleExecuteRestore}
                          disabled={!confirmedCheckbox || isRestoring}
                          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-8 py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest cursor-pointer"
                       >
                          {isRestoring ? (
                             <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>{restoreProgress || 'Memulihkan...'}</span>
                             </>
                          ) : (
                             <>
                                <RotateCcw size={16} />
                                <span>Mulai Pemulihan Data</span>
                             </>
                          )}
                       </button>
                    )}
                 </div>
              </motion.div>
           </div>
        )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* Restore Success Modal */}
        {/* ========================================================================= */}
        <AnimatePresence>
        {restoreSuccessModal && restoreSuccessModal.isOpen && (
           <div className="fixed inset-0 z-[80] flex items-start justify-center pt-8 sm:pt-14 p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
              <motion.div
                 initial={{ scale: 0.95, y: -20, opacity: 0 }}
                 animate={{ scale: 1, y: 0, opacity: 1 }}
                 exit={{ scale: 0.95, y: -20, opacity: 0 }}
                 className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 p-6 sm:p-8 text-center my-0"
              >
                 <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
                    <CheckCircle2 size={32} />
                 </div>

                 <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-2">
                    Pemulihan Database Sukses
                 </span>

                 <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                    Database Berhasil Dipulihkan!
                 </h3>
                 <p className="text-xs sm:text-sm font-medium text-slate-500 mb-6 leading-relaxed max-w-md mx-auto">
                    Seluruh data dari file cadangan telah sukses disinkronkan ke database sistem. Muat ulang halaman untuk melihat pembaruan di seluruh modul.
                 </p>

                 {/* Details Box */}
                 <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                       <span className="text-slate-400 font-bold">Berkas Cadangan:</span>
                       <span className="font-mono font-black text-slate-800 text-[11px] truncate max-w-[220px]" title={restoreSuccessModal.filename}>
                          {restoreSuccessModal.filename}
                       </span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-slate-400 font-bold">Mode Pemulihan:</span>
                       <span className="font-bold text-slate-700">{restoreSuccessModal.mode}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-slate-400 font-bold">Total Data Dipulihkan:</span>
                       <span className="font-black text-emerald-600">{restoreSuccessModal.totalRestored.toLocaleString('id-ID')} records</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-slate-400 font-bold">Tabel Terpulihkan:</span>
                       <span className="font-black text-indigo-600">{restoreSuccessModal.tablesRestored} tabel</span>
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-3">
                    <button
                       type="button"
                       onClick={() => window.location.reload()}
                       className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
                    >
                       <RefreshCw size={16} /> Muat Ulang Halaman
                    </button>
                    <button
                       type="button"
                       onClick={() => setRestoreSuccessModal(null)}
                       className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all text-xs uppercase tracking-widest cursor-pointer"
                    >
                       Tutup
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
        </AnimatePresence>
    </div>
  );
}
