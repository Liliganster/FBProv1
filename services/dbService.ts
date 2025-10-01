const DB_NAME = 'FahrtenbuchDB';
const DB_VERSION = 1;
const STORE_NAME = 'callsheets';

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
      reject('IndexedDB error');
    };
  });
};

export const saveFile = async (id: string, file: File): Promise<void> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, file });

    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Failed to save file to IndexedDB:', request.error);
        reject(request.error);
    };
  });
};

export const getFile = async (id: string): Promise<File | null> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result.file);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => {
        console.error('Failed to get file from IndexedDB:', request.error);
        reject(request.error);
    };
  });
};

export const deleteFile = async (id: string): Promise<void> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Failed to delete file from IndexedDB:', request.error);
        reject(request.error);
    };
  });
};

export const deleteMultipleFiles = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    let completed = 0;
    const errors: any[] = [];
    
    ids.forEach(id => {
      const request = store.delete(id);
      request.onsuccess = () => {
        completed++;
        if (completed === ids.length) {
          if (errors.length > 0) reject(errors);
          else resolve();
        }
      };
      request.onerror = () => {
        console.error(`Failed to delete file with id ${id} from IndexedDB`);
        errors.push(request.error);
        completed++;
        if (completed === ids.length) {
          reject(errors);
        }
      };
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
