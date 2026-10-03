import { useState, useEffect, useRef } from 'react';

export type POSetType = 'Set' | 'Inner & Outer' | 'Atasan & Bawahan' | 'Inner, Outer & Bawahan';
export type SubmissionPartType =
  | 'Set'
  | 'Inner'
  | 'Outer'
  | 'Atasan'
  | 'Bawahan'
  | 'Inner & Outer'
  | 'Inner & Bawahan'
  | 'Outer & Bawahan';

export interface PO {
  id?: number;
  poNumber: string;
  customerName: string;
  description?: string;
  photoData?: string;
  date: string;
  status: string;
  setType?: POSetType;
  wageSet?: number;
  wageInner?: number;
  wageOuter?: number;
  wageAtasan?: number;
  wageBawahan?: number;
  tabunganPerPcs?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface POItem {
  id?: number;
  poId: number;
  itemName: string;
  color: string;
  size: string;
  qty: number;
  qtyCut: number; // berapa yg sudah dipotong
  setType?: POSetType;
  wageSet?: number;
  wageInner?: number;
  wageOuter?: number;
  wageAtasan?: number;
  wageBawahan?: number;
  tabunganPerPcs?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface Tailor {
  id?: number;
  name: string;
  productionNumber?: string;
  partnerName?: string;
  partnerCount?: number;
  phone: string;
  address: string;
  status?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ManualAdjustment {
  id?: number;
  tailorId: number;
  tailorName?: string;
  amount: number;
  date: string;
  notes: string;
  isPaid: boolean;
  paymentId?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface Kasbon {
  id?: number;
  tailorId: number;
  tailorName?: string;
  amount: number;
  date: string;
  notes: string;
  isPaid: boolean; 
  paymentId?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface GradeRule {
  id?: number;
  name: string;
  minQtySingle: number;
  bonusSingle: number;
  minQtyCollab: number;
  bonusCollab: number;
  partnerRules?: { partnerCount: number; minQty: number; bonus: number }[];
  createdBy?: string;
  updatedBy?: string;
}

export interface SewingJob {
  id?: number;
  tailorId: number;
  tailorName?: string;
  poItemId: number;
  qtyTaken: number;
  nominalQtyTaken?: number;
  assignedPart?: SubmissionPartType;
  transferredInner?: number;
  transferredOuter?: number;
  transferredAtasan?: number;
  transferredBawahan?: number;
  transferredSet?: number;
  qtySubmitted: number;
  wagePerPcs: number;
  setType?: POSetType;
  wageSet?: number;
  wageInner?: number;
  wageOuter?: number;
  wageAtasan?: number;
  wageBawahan?: number;
  tabunganPerPcs: number;
  dateTaken: string;
  productionNumber?: string;
  status: 'Proses' | 'Selesai';
  createdBy?: string;
  updatedBy?: string;
}

export interface SewingSubmission {
  id?: number;
  jobId: number;
  tailorId: number;
  tailorName?: string;
  qtySubmitted: number; // Effective setoran in sets (1/2 for partial, 1 for full Set)
  nominalQty?: number; // Nominal pieces of the part submitted
  partType?: SubmissionPartType;
  wageTotal: number;
  tabunganTotal: number;
  dateSubmitted: string;
  isPaid: boolean;
  paymentId?: number;
  createdBy?: string;
  updatedBy?: string;
}

export function getPOItemPricing(po?: PO, item?: POItem, job?: SewingJob) {
  const setType: POSetType = po?.setType || item?.setType || job?.setType || 'Set';
  const wageSet = Number(po?.wageSet ?? item?.wageSet ?? job?.wageSet ?? job?.wagePerPcs ?? 0);
  const wageInner = Number(po?.wageInner ?? item?.wageInner ?? job?.wageInner ?? 0);
  const wageOuter = Number(po?.wageOuter ?? item?.wageOuter ?? job?.wageOuter ?? 0);
  const wageAtasan = Number(po?.wageAtasan ?? item?.wageAtasan ?? job?.wageAtasan ?? 0);
  const wageBawahan = Number(po?.wageBawahan ?? item?.wageBawahan ?? job?.wageBawahan ?? 0);
  const tabunganPerPcs = Number(po?.tabunganPerPcs ?? item?.tabunganPerPcs ?? job?.tabunganPerPcs ?? 0);

  let totalFullWage = wageSet;
  let wageSummaryText = `Set: Rp ${wageSet.toLocaleString('id-ID')}`;
  if (setType === 'Inner & Outer') {
    totalFullWage = wageInner + wageOuter;
    wageSummaryText = `Inner: Rp ${wageInner.toLocaleString('id-ID')} | Outer: Rp ${wageOuter.toLocaleString('id-ID')} (Total Rp ${totalFullWage.toLocaleString('id-ID')})`;
  } else if (setType === 'Atasan & Bawahan') {
    totalFullWage = wageAtasan + wageBawahan;
    wageSummaryText = `Atasan: Rp ${wageAtasan.toLocaleString('id-ID')} | Bawahan: Rp ${wageBawahan.toLocaleString('id-ID')} (Total Rp ${totalFullWage.toLocaleString('id-ID')})`;
  } else if (setType === 'Inner, Outer & Bawahan') {
    totalFullWage = wageInner + wageOuter + wageBawahan;
    wageSummaryText = `Inner: Rp ${wageInner.toLocaleString('id-ID')} | Outer: Rp ${wageOuter.toLocaleString('id-ID')} | Bawahan: Rp ${wageBawahan.toLocaleString('id-ID')} (Total Rp ${totalFullWage.toLocaleString('id-ID')})`;
  } else if (!totalFullWage && job?.wagePerPcs) {
    totalFullWage = Number(job.wagePerPcs);
    wageSummaryText = `Set: Rp ${totalFullWage.toLocaleString('id-ID')}`;
  }

  return {
    setType,
    wageSet,
    wageInner,
    wageOuter,
    wageAtasan,
    wageBawahan,
    tabunganPerPcs,
    totalFullWage,
    wageSummaryText,
  };
}

export function getWageForPart(
  partType: SubmissionPartType | undefined,
  pricing: ReturnType<typeof getPOItemPricing>
): number {
  const pt = partType || 'Set';
  if (pt === 'Set') return pricing.totalFullWage;
  if (pt === 'Inner') {
    return pricing.setType === 'Set' ? pricing.totalFullWage * 0.5 : pricing.wageInner;
  }
  if (pt === 'Outer') {
    return pricing.setType === 'Set' ? pricing.totalFullWage * 0.5 : pricing.wageOuter;
  }
  if (pt === 'Atasan') {
    return pricing.setType === 'Set' ? pricing.totalFullWage * 0.5 : pricing.wageAtasan;
  }
  if (pt === 'Bawahan') {
    return pricing.setType === 'Set' ? pricing.totalFullWage * 0.5 : pricing.wageBawahan;
  }
  if (pt === 'Inner & Outer') {
    return pricing.wageInner + pricing.wageOuter;
  }
  if (pt === 'Inner & Bawahan') {
    return pricing.wageInner + pricing.wageBawahan;
  }
  if (pt === 'Outer & Bawahan') {
    return pricing.wageOuter + pricing.wageBawahan;
  }
  return pricing.totalFullWage;
}

export function getPartOptionsForSetType(setType?: POSetType): { value: SubmissionPartType; label: string }[] {
  if (setType === 'Inner & Outer') {
    return [
      { value: 'Set', label: 'Set (Inner & Outer)' },
      { value: 'Inner', label: 'Inner Saja (1/2 Set)' },
      { value: 'Outer', label: 'Outer Saja (1/2 Set)' }
    ];
  }
  if (setType === 'Atasan & Bawahan') {
    return [
      { value: 'Set', label: 'Set (Atasan & Bawahan)' },
      { value: 'Atasan', label: 'Atasan / Baju Saja (1/2 Set)' },
      { value: 'Bawahan', label: 'Bawahan / Celana Saja (1/2 Set)' }
    ];
  }
  if (setType === 'Inner, Outer & Bawahan') {
    return [
      { value: 'Set', label: 'Set Lengkap (Inner, Outer & Bawahan)' },
      { value: 'Inner', label: 'Inner Saja (1/2 Set)' },
      { value: 'Outer', label: 'Outer Saja (1/2 Set)' },
      { value: 'Bawahan', label: 'Bawahan Saja (1/2 Set)' },
      { value: 'Inner & Outer', label: 'Inner & Outer (1/2 Set)' },
      { value: 'Inner & Bawahan', label: 'Inner & Bawahan (1/2 Set)' },
      { value: 'Outer & Bawahan', label: 'Outer & Bawahan (1/2 Set)' }
    ];
  }
  return [
    { value: 'Set', label: 'Set / Lengkap' },
    { value: 'Atasan', label: 'Atasan / Baju Saja (1/2 Set)' },
    { value: 'Bawahan', label: 'Bawahan / Celana Saja (1/2 Set)' }
  ];
}

export function getSubmissionNominalQty(sub: SewingSubmission): number {
  if (sub.nominalQty !== undefined && sub.nominalQty > 0) {
    return Number(sub.nominalQty);
  }
  return Number(sub.qtySubmitted) || 0;
}

export interface SalaryPayment {
  id?: number;
  tailorId: number;
  tailorName?: string;
  date: string;
  totalQty: number;
  totalWage: number;
  gradeName: string;
  bonusAmount: number;
  kasbonDeducted: number;
  netPayment: number;
  tabunganAccumulated: number;
  manualAdjustment?: number;
  manualNote?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface TabunganWithdrawal {
  id?: number;
  tailorId: number;
  tailorName?: string;
  amount: number;
  date: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface InhouseWorker {
  id?: number;
  name: string;
  phone: string;
  address: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface InhouseSalary {
  id?: number;
  workerId: number;
  date: string;
  amount: number;
  notes: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Catatan {
  id?: number;
  content: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AppLog {
  id?: number;
  date: string;
  user: string;
  action: string;
  details: string;
  table?: string;
}

export interface Setting {
  id?: number;
  key: string;
  value: any;
  updatedBy?: string;
}

export interface ActiveTabungan {
  id?: number;
  tailorId: number;
  tailorName: string;
  totalIn: number;
  totalOut: number;
  balance: number;
  lastUpdated: string;
}

export interface ArchivePO {
  id?: number;
  originalId: number;
  data: PO;
  archivedAt: string;
  archivedBy: string;
}

export interface ArchiveSalary {
  id?: number;
  originalId: number;
  data: SalaryPayment;
  archivedAt: string;
  archivedBy: string;
}

export interface ArchiveTabungan {
  id?: number;
  originalId: number;
  data: TabunganWithdrawal;
  archivedAt: string;
  archivedBy: string;
}

export interface ArchiveTailor {
  id?: number;
  originalId: number;
  data: Tailor;
  archivedAt: string;
  archivedBy: string;
}

// export class AppDB extends Dexie {
// removed dexie export

const listeners = new Set<() => void>();
let updateTimer: NodeJS.Timeout | null = null;
const dataCache = new Map<string, any>();
const inFlightRequests = new Map<string, Promise<any>>();

export function triggerDbUpdate(tableName?: string) {
   if (tableName) {
      // Invalidate cache for this table
      for (const key of dataCache.keys()) {
         if (key.startsWith(tableName)) {
            dataCache.delete(key);
         }
      }
   } else {
      dataCache.clear();
   }

   if (updateTimer) clearTimeout(updateTimer);
   updateTimer = setTimeout(() => {
      listeners.forEach(fn => {
         try { fn(); } catch (e) {}
      });
      updateTimer = null;
   }, 40);
}

// Optimized useLiveQuery with caching and instant initial render
export function useLiveQuery<T>(querier: () => Promise<T>, deps: any[] = []): T | undefined {
   const [data, setData] = useState<T | undefined>(undefined);
   const prevDataRef = useRef<string>('');

   useEffect(() => {
     let isMounted = true;
     const fetchData = () => {
        querier().then(res => {
           if (!isMounted) return;
           const serialized = JSON.stringify(res);
           if (prevDataRef.current !== serialized) {
              prevDataRef.current = serialized;
              setData(res);
           }
        }).catch(err => {
           console.warn('DB LiveQuery warning:', err?.message || err);
        });
     };
     
     fetchData();
     listeners.add(fetchData);
     return () => {
        isMounted = false;
        listeners.delete(fetchData);
     };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, deps);

   return data;
}

class ApiTable<T> {
  constructor(public tableName: string) {}

  private async fetchApi(method: string, action?: string, body?: any, id?: number, extraParams = '') {
    let url = `/api/db?table=${this.tableName}`;
    if (action) url += `&action=${action}`;
    if (id !== undefined) url += `&id=${id}`;
    if (extraParams) url += `&${extraParams}`;

    if (method === 'GET') {
       const cacheKey = `${this.tableName}_${action || ''}_${id || ''}_${extraParams || ''}`;
       if (dataCache.has(cacheKey)) {
          return dataCache.get(cacheKey);
       }
       if (inFlightRequests.has(cacheKey)) {
          return inFlightRequests.get(cacheKey);
       }

       const reqPromise = (async () => {
          try {
             const res = await fetch(url);
             const rawText = await res.text();
             if (!res.ok) {
                let errorMsg = res.statusText;
                try {
                   const errData = rawText ? JSON.parse(rawText) : {};
                   if (errData.error) errorMsg = errData.error;
                } catch (e) {}
                console.warn(`API error (${this.tableName}): ${errorMsg}`);
                return [];
             }
             const data = rawText ? JSON.parse(rawText) : [];
             dataCache.set(cacheKey, data);
             return data;
          } catch (e) {
             return [];
          } finally {
             inFlightRequests.delete(cacheKey);
          }
       })();

       inFlightRequests.set(cacheKey, reqPromise);
       return reqPromise;
    }

    const options: RequestInit = { method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      const rawText = await res.text();
      if (!res.ok) {
         let errorMsg = res.statusText;
         try {
            const errData = rawText ? JSON.parse(rawText) : {};
            if (errData.error) errorMsg = errData.error;
         } catch (e) {}
         console.warn(`API error (${this.tableName}): ${errorMsg}`);
         throw new Error(`API error: ${errorMsg}`);
      }
      return rawText ? JSON.parse(rawText) : {};
    } catch (e) {
       throw e;
    }
  }

  async toArray(): Promise<T[]> {
    return this.fetchApi('GET');
  }

  async add(item: T): Promise<number> {
    const res = await this.fetchApi('POST', '', item);
    triggerDbUpdate(this.tableName);
    return res.id;
  }

  async update(id: number, changes: Partial<T>): Promise<void> {
    await this.fetchApi('PUT', '', changes, id);
    triggerDbUpdate(this.tableName);
  }

  async delete(id: number): Promise<void> {
    await this.fetchApi('DELETE', '', undefined, id);
    triggerDbUpdate(this.tableName);
  }

  async bulkAdd(items: T[]): Promise<void> {
    await this.fetchApi('POST', 'bulkAdd', items);
    triggerDbUpdate(this.tableName);
  }

  async bulkUpdate(updates: {key: number, changes: Partial<T>}[]): Promise<void> {
    await this.fetchApi('POST', 'bulkUpdate', updates);
    triggerDbUpdate(this.tableName);
  }

  async bulkDelete(ids: number[]): Promise<void> {
    await this.fetchApi('POST', 'bulkDelete', ids);
    triggerDbUpdate(this.tableName);
  }

  async count(): Promise<number> {
    const data = await this.toArray();
    return data.length;
  }

  orderBy(field: string) {
    return new OrderedApiTable<T>(this.tableName, field);
  }

  toCollection() {
    return {
      first: async () => {
        const data = await this.toArray();
        return data[0];
      }
    };
  }
}

class OrderedApiTable<T> {
  private isReversed = false;
  constructor(public tableName: string, public field: string) {}

  reverse() {
    this.isReversed = true;
    return this;
  }

  async toArray(): Promise<T[]> {
    const cacheKey = `${this.tableName}_order_${this.field}_${this.isReversed}`;
    if (dataCache.has(cacheKey)) {
       return dataCache.get(cacheKey);
    }
    if (inFlightRequests.has(cacheKey)) {
       return inFlightRequests.get(cacheKey);
    }

    const reqPromise = (async () => {
       try {
          const res = await fetch(`/api/db?table=${this.tableName}&sortBy=${this.field}&reverse=${this.isReversed}`);
          const rawText = await res.text();
          if (!res.ok) {
             let errorMsg = res.statusText;
             try {
                const errData = rawText ? JSON.parse(rawText) : {};
                if (errData.error) errorMsg = errData.error;
             } catch (e) {}
             console.warn(`API error (${this.tableName}): ${errorMsg}`);
             return [];
          }
          const data = rawText ? JSON.parse(rawText) : [];
          dataCache.set(cacheKey, data);
          return data;
       } catch (e) {
          return [];
       } finally {
          inFlightRequests.delete(cacheKey);
       }
    })();

    inFlightRequests.set(cacheKey, reqPromise);
    return reqPromise;
  }
}

export const db = {
  pos: new ApiTable<PO>('pos'),
  poItems: new ApiTable<POItem>('poItems'),
  tailors: new ApiTable<Tailor>('tailors'),
  sewingJobs: new ApiTable<SewingJob>('sewingJobs'),
  sewingSubmissions: new ApiTable<SewingSubmission>('sewingSubmissions'),
  kasbons: new ApiTable<Kasbon>('kasbons'),
  manualAdjustments: new ApiTable<ManualAdjustment>('manualAdjustments'),
  gradeRules: new ApiTable<GradeRule>('gradeRules'),
  salaryPayments: new ApiTable<SalaryPayment>('salaryPayments'),
  tabunganWithdrawals: new ApiTable<TabunganWithdrawal>('tabunganWithdrawals'),
  inhouseWorkers: new ApiTable<InhouseWorker>('inhouseWorkers'),
  inhouseSalaries: new ApiTable<InhouseSalary>('inhouseSalaries'),
  catatan: new ApiTable<Catatan>('catatan'),
  appLogs: new ApiTable<AppLog>('appLogs'),
  settings: new ApiTable<Setting>('settings'),
  activeTabungan: new ApiTable<ActiveTabungan>('activeTabungan'),
  archivePOs: new ApiTable<ArchivePO>('archivePOs'),
  archiveSalaries: new ApiTable<ArchiveSalary>('archiveSalaries'),
  archiveTabungan: new ApiTable<ArchiveTabungan>('archiveTabungan'),
  archiveTailors: new ApiTable<ArchiveTailor>('archiveTailors')
};
