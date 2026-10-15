import { PAPER_DATABASE, PAPER_DATABASE_VERSION, PAPER_STORE } from './paperLedger';

/** Fixed-capacity event history. Appending never shifts or copies the backing array. */
export class RingBuffer<T> {
  private readonly values: Array<T | undefined>;
  private start = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be positive');
    this.values = new Array<T | undefined>(capacity);
  }

  push(value: T): void {
    this.values[(this.start + this.count) % this.capacity] = value;
    if (this.count < this.capacity) this.count++;
    else this.start = (this.start + 1) % this.capacity;
  }

  snapshot(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const value = this.values[(this.start + i) % this.capacity];
      if (value !== undefined) result.push(value);
    }
    return result;
  }
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PAPER_DATABASE, PAPER_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PAPER_STORE)) request.result.createObjectStore(PAPER_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Separate records from financial balances; failures leave current-session history intact. */
export async function readOfficeHistory(): Promise<unknown> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    return await new Promise((resolve, reject) => {
      const request = db!.transaction(PAPER_STORE).objectStore(PAPER_STORE).get('office-chat-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function saveOfficeHistory(events: readonly unknown[]): Promise<boolean> {
  let db: IDBDatabase | undefined;
  try {
    db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(PAPER_STORE, 'readwrite');
      tx.objectStore(PAPER_STORE).put(events, 'office-chat-v1');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}
