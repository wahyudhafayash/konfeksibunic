import { useState, useEffect } from 'react';

export interface PO {
  id?: number;
  poNumber: string;
  customerName: string;
  description?: string;
  photoData?: string;
  date: string;
  status: string;
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
  createdBy?: string;
  updatedBy?: string;
}

export interface Tailor {
  id?: number;
  name: string;
  partnerName?: string;
  phone: string;
  address: string;
  status?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ManualAdjustment {
  id?: number;
  tailorId: number;
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
  createdBy?: string;
  updatedBy?: string;
}

export interface SewingJob {
  id?: number;
  tailorId: number;
  poItemId: number;
  qtyTaken: number;
  qtySubmitted: number;
  wagePerPcs: number;
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
  qtySubmitted: number; // This can remain as the nominal qty (e.g., 2), and partType determines if it's Set, Inner, or Outer.
  partType?: 'Set' | 'Inner' | 'Outer';
  wageTotal: number;
  tabunganTotal: number;
  dateSubmitted: string;
  isPaid: boolean;
  paymentId?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface SalaryPayment {
  id?: number;
  tailorId: number;
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

// export class AppDB extends Dexie {
// removed dexie export

const listeners = new Set<() => void>();

export function triggerDbUpdate() {
   listeners.forEach(fn => fn());
}

// Temporary useLiveQuery replica
export function useLiveQuery<T>(querier: () => Promise<T>, deps: any[]): T | undefined {
   const [data, setData] = useState<T | undefined>(undefined);

   useEffect(() => {
     let isMounted = true;
     const fetchData = () => {
        querier().then(res => {
           if (isMounted) setData(res);
        }).catch(err => {
           // use console.warn to avoid triggering Next.js Error Overlay
           console.warn('DB LiveQuery warning:', err.message);
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

    const options: RequestInit = { method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
         let errorMsg = res.statusText;
         try {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
         } catch (e) {}
         console.warn(`API error (${this.tableName}): ${errorMsg}`);
         throw new Error(`API error: ${errorMsg}`);
      }
      return await res.json();
    } catch (e) {
       if (method === 'GET') return [];
       throw e;
    }
  }

  async toArray(): Promise<T[]> {
    return this.fetchApi('GET');
  }

  async add(item: T): Promise<number> {
    const res = await this.fetchApi('POST', '', item);
    triggerDbUpdate();
    return res.id;
  }

  async update(id: number, changes: Partial<T>): Promise<void> {
    await this.fetchApi('PUT', '', changes, id);
    triggerDbUpdate();
  }

  async delete(id: number): Promise<void> {
    await this.fetchApi('DELETE', '', undefined, id);
    triggerDbUpdate();
  }

  async bulkAdd(items: T[]): Promise<void> {
    await this.fetchApi('POST', 'bulkAdd', items);
    triggerDbUpdate();
  }

  async bulkUpdate(updates: {key: number, changes: Partial<T>}[]): Promise<void> {
    await this.fetchApi('POST', 'bulkUpdate', updates);
    triggerDbUpdate();
  }

  async bulkDelete(ids: number[]): Promise<void> {
    await this.fetchApi('POST', 'bulkDelete', ids);
    triggerDbUpdate();
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
    try {
      const res = await fetch(`/api/db?table=${this.tableName}&sortBy=${this.field}&reverse=${this.isReversed}`);
      if (!res.ok) {
         let errorMsg = res.statusText;
         try {
            const errData = await res.json();
            if (errData.error) errorMsg = errData.error;
         } catch (e) {}
         console.warn(`API error (${this.tableName}): ${errorMsg}`);
         throw new Error(`API error: ${errorMsg}`);
      }
      return await res.json();
    } catch (e) {
      return [];
    }
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
  catatan: new ApiTable<Catatan>('catatan')
};
