import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const LOCAL_DB_PATH = path.join('/tmp', 'konfeksi-local-db.json');

interface StoreData {
  [dbName: string]: {
    [colName: string]: any[];
  };
}

let inMemoryStore: StoreData | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

function loadStore(): StoreData {
  if (inMemoryStore) return inMemoryStore;
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      inMemoryStore = JSON.parse(raw);
      return inMemoryStore!;
    }
  } catch (e) {
    console.warn('Failed to load local fallback DB:', e);
  }
  inMemoryStore = {};
  return inMemoryStore;
}

function saveStore(store: StoreData) {
  inMemoryStore = store;
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    try {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save local fallback DB:', e);
    }
    saveDebounceTimer = null;
  }, 100);
}

function getNestedValue(obj: any, keyPath: string): any {
  return keyPath.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

function setNestedValue(obj: any, keyPath: string, value: any) {
  const keys = keyPath.split('.');
  let curr = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof curr[k] !== 'object' || curr[k] === null) {
      curr[k] = {};
    }
    curr = curr[k];
  }
  curr[keys[keys.length - 1]] = value;
}

function matchesFilter(doc: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [k, cond] of Object.entries(filter)) {
    const val = getNestedValue(doc, k);
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond && Array.isArray((cond as any).$in)) {
        if (!(cond as any).$in.includes(val)) return false;
      } else {
        if (val !== cond) return false;
      }
    } else {
      if (val !== cond) return false;
    }
  }
  return true;
}

function applyUpdate(doc: any, update: any) {
  if (!update) return;
  if (update.$set && typeof update.$set === 'object') {
    for (const [k, v] of Object.entries(update.$set)) {
      if (k.includes('.')) {
        setNestedValue(doc, k, v);
      } else {
        doc[k] = v;
      }
    }
  }
  if (update.$inc && typeof update.$inc === 'object') {
    for (const [k, v] of Object.entries(update.$inc)) {
      const curr = Number(getNestedValue(doc, k) || 0);
      setNestedValue(doc, k, curr + Number(v));
    }
  }
}

function createFallbackClient(): any {
  return {
    db(dbName: string = 'konfeksi') {
      return {
        collection(colName: string) {
          const getCol = (store: StoreData) => {
            if (!store[dbName]) store[dbName] = {};
            if (!store[dbName][colName]) {
              store[dbName][colName] = [];
              if (colName === 'admins') {
                store[dbName][colName].push(
                  { username: 'admin', password: 'admin123', role: 'admin' },
                  { username: 'admin123', password: 'admin123', role: 'admin' }
                );
              }
            }
            return store[dbName][colName];
          };

          return {
            find(filter: any = {}) {
              let sortSpec: Record<string, number> = {};
              const cursor = {
                sort(s: Record<string, number>) {
                  sortSpec = s || {};
                  return cursor;
                },
                async toArray() {
                  const store = loadStore();
                  const col = getCol(store);
                  const results = col.filter(d => matchesFilter(d, filter)).map(d => ({ ...d }));
                  const sortKeys = Object.keys(sortSpec);
                  if (sortKeys.length > 0) {
                    const key = sortKeys[0];
                    const dir = sortSpec[key] === -1 ? -1 : 1;
                    results.sort((a, b) => {
                      const va = getNestedValue(a, key);
                      const vb = getNestedValue(b, key);
                      if (va < vb) return -1 * dir;
                      if (va > vb) return 1 * dir;
                      return 0;
                    });
                  }
                  return results;
                }
              };
              return cursor;
            },
            async findOne(filter: any = {}) {
              const store = loadStore();
              const col = getCol(store);
              const found = col.find(d => matchesFilter(d, filter));
              return found ? { ...found } : null;
            },
            async findOneAndUpdate(filter: any, update: any, options?: { upsert?: boolean; returnDocument?: string }) {
              const store = loadStore();
              const col = getCol(store);
              let doc = col.find(d => matchesFilter(d, filter));
              if (!doc && options?.upsert) {
                doc = { ...filter };
                col.push(doc);
              }
              if (doc) {
                applyUpdate(doc, update);
                saveStore(store);
                return { ...doc, value: { ...doc } };
              }
              return null;
            },
            async insertOne(doc: any) {
              const store = loadStore();
              const col = getCol(store);
              const newDoc = { ...doc };
              col.push(newDoc);
              saveStore(store);
              return { acknowledged: true, insertedId: newDoc.id || Date.now() };
            },
            async insertMany(docs: any[]) {
              const store = loadStore();
              const col = getCol(store);
              for (const d of docs) {
                col.push({ ...d });
              }
              saveStore(store);
              return { acknowledged: true, insertedCount: docs.length };
            },
            async updateOne(filter: any, update: any) {
              const store = loadStore();
              const col = getCol(store);
              const doc = col.find(d => matchesFilter(d, filter));
              if (doc) {
                applyUpdate(doc, update);
                saveStore(store);
                return { acknowledged: true, modifiedCount: 1 };
              }
              return { acknowledged: true, modifiedCount: 0 };
            },
            async updateMany(filter: any, update: any) {
              const store = loadStore();
              const col = getCol(store);
              let count = 0;
              for (const doc of col) {
                if (matchesFilter(doc, filter)) {
                  applyUpdate(doc, update);
                  count++;
                }
              }
              if (count > 0) saveStore(store);
              return { acknowledged: true, modifiedCount: count };
            },
            async deleteOne(filter: any) {
              const store = loadStore();
              const col = getCol(store);
              const idx = col.findIndex(d => matchesFilter(d, filter));
              if (idx !== -1) {
                col.splice(idx, 1);
                saveStore(store);
                return { acknowledged: true, deletedCount: 1 };
              }
              return { acknowledged: true, deletedCount: 0 };
            },
            async deleteMany(filter: any) {
              const store = loadStore();
              const col = getCol(store);
              const before = col.length;
              store[dbName][colName] = col.filter(d => !matchesFilter(d, filter));
              saveStore(store);
              return { acknowledged: true, deletedCount: before - store[dbName][colName].length };
            },
            async bulkWrite(ops: any[]) {
              const store = loadStore();
              const col = getCol(store);
              let modifiedCount = 0;
              for (const op of ops) {
                if (op.updateOne) {
                  const doc = col.find(d => matchesFilter(d, op.updateOne.filter));
                  if (doc) {
                    applyUpdate(doc, op.updateOne.update);
                    modifiedCount++;
                  }
                }
              }
              if (modifiedCount > 0) saveStore(store);
              return { acknowledged: true, modifiedCount };
            }
          };
        }
      };
    }
  };
}

function sanitizeMongoUri(rawUri?: string): string {
  if (!rawUri) return '';
  let cleaned = rawUri.trim();
  // Remove accidental surrounding quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // If user pasted "MONGODB_URI=mongodb+srv://..." into the value field
  if (cleaned.startsWith('MONGODB_URI=')) {
    cleaned = cleaned.slice('MONGODB_URI='.length).trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }
  }
  return cleaned;
}

let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<any>;
};

async function initMongoClient(): Promise<any> {
  const uri = sanitizeMongoUri(process.env.MONGODB_URI);
  const isValidScheme = uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');

  if (!isValidScheme) {
    console.warn('MONGODB_URI is not configured or does not start with mongodb:// or mongodb+srv://. Using local persistent database fallback.');
    return createFallbackClient();
  }

  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    return await client.connect();
  } catch (err: any) {
    console.warn('MongoDB connection failed, using local persistent database fallback:', err?.message || err);
    return createFallbackClient();
  }
}

if (!globalWithMongo._mongoClientPromise) {
  globalWithMongo._mongoClientPromise = initMongoClient();
}

const clientPromise: Promise<any> = globalWithMongo._mongoClientPromise;

export default clientPromise;


