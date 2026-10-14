import {
  collection as realCollection,
  doc as realDoc,
  onSnapshot as realOnSnapshot,
  addDoc as realAddDoc,
  setDoc as realSetDoc,
  updateDoc as realUpdateDoc,
  deleteDoc as realDeleteDoc,
  getDocs as realGetDocs,
  getDoc as realGetDoc,
  query as realQuery,
  where as realWhere,
  orderBy as realOrderBy,
  limit as realLimit,
  arrayUnion as realArrayUnion,
  arrayRemove as realArrayRemove,
  serverTimestamp as realServerTimestamp,
  enableIndexedDbPersistence as realEnableIndexedDbPersistence,
  setLogLevel as realSetLogLevel,
  getFirestore as realGetFirestore,
  initializeFirestore as realInitializeFirestore,
  Timestamp as realTimestamp
} from '@firebase/firestore';

export const getFirestore = realGetFirestore;
export const initializeFirestore = realInitializeFirestore;
export const Timestamp = realTimestamp;

// Helper to determine if a path is for the 'media' collection
function isMediaPath(path: string | undefined): boolean {
  if (!path) return false;
  return path === 'media' || path.startsWith('media/');
}

// Check if we should use mock storage (in browser environment)
function shouldMock(path: string | undefined): boolean {
  if (typeof window === 'undefined') return false;
  return true;
}

// Local mock database helpers using localStorage
function getLocalCollection(collectionPath: string): any[] {
  if (typeof window === 'undefined') return [];
  const key = `mock_firestore_${collectionPath}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to parse mock firestore path:", collectionPath, e);
    }
  }
  return [];
}

function saveLocalCollection(collectionPath: string, data: any[]) {
  if (typeof window === 'undefined') return;
  const key = `mock_firestore_${collectionPath}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save to local storage for path:", collectionPath, e);
  }
  // Dispatch a custom event to notify listeners in real-time
  window.dispatchEvent(new CustomEvent(`mock_db_update_${collectionPath}`));
}

function createMockSnapshot(data: any[], path: string) {
  const docs = data.map(docData => ({
    id: docData.id,
    data: () => {
      const { id, ...rest } = docData;
      return rest;
    },
    exists: () => true
  }));
  return {
    docs,
    forEach: (cb: any) => docs.forEach(cb),
    docChanges: () => [],
    empty: docs.length === 0,
    size: docs.length
  };
}

// Wrapped exports to selectively intercept non-media collections

export function collection(parent: any, path: string, ...pathSegments: string[]) {
  if (parent && parent._isMock) {
    const fullPath = [parent.path, path, ...pathSegments].filter(Boolean).join('/');
    return {
      _isMock: true,
      type: 'collection',
      path: fullPath
    } as any;
  }

  const fullPath = [path, ...pathSegments].filter(Boolean).join('/');
  if (shouldMock(fullPath)) {
    return {
      _isMock: true,
      type: 'collection',
      path: fullPath
    } as any;
  }

  return realCollection(parent, path, ...pathSegments);
}

export function doc(parent: any, path?: string, ...pathSegments: string[]) {
  if (parent && parent._isMock) {
    const fullPath = [parent.path, path, ...pathSegments].filter(Boolean).join('/');
    const parts = fullPath.split('/');
    return {
      _isMock: true,
      type: 'document',
      path: fullPath,
      id: parts[parts.length - 1]
    } as any;
  }

  let checkPath = '';
  if (typeof parent === 'string') {
    checkPath = [parent, path, ...pathSegments].filter(Boolean).join('/');
  } else if (parent && 'path' in parent) {
    checkPath = [parent.path, path, ...pathSegments].filter(Boolean).join('/');
  } else {
    checkPath = [path, ...pathSegments].filter(Boolean).join('/');
  }

  if (shouldMock(checkPath)) {
    const parts = checkPath.split('/');
    return {
      _isMock: true,
      type: 'document',
      path: checkPath,
      id: parts[parts.length - 1]
    } as any;
  }

  return realDoc(parent, path!, ...pathSegments);
}

export function query(queryRef: any, ...queryConstraints: any[]) {
  if (queryRef && queryRef._isMock) {
    return {
      ...queryRef,
      constraints: queryConstraints
    } as any;
  }
  return realQuery(queryRef, ...queryConstraints);
}

export function where(fieldPath: string, opStr: any, value: any) {
  const real = realWhere(fieldPath, opStr, value);
  (real as any)._mock = { type: 'where', fieldPath, opStr, value };
  return real;
}

export function orderBy(fieldPath: string, directionStr?: any) {
  const real = realOrderBy(fieldPath, directionStr);
  (real as any)._mock = { type: 'orderBy', fieldPath, directionStr: directionStr || 'asc' };
  return real;
}

export function limit(limitNum: number) {
  const real = realLimit(limitNum);
  (real as any)._mock = { type: 'limit', limitNum };
  return real;
}

// Helper to apply mock query constraints (where, orderBy, limit)
function applyConstraints(data: any[], constraints: any[]): any[] {
  if (!constraints || !Array.isArray(constraints)) return data;
  
  let result = [...data];
  
  // 1. Apply where filters
  for (const c of constraints) {
    if (c && c._mock && c._mock.type === 'where') {
      const { fieldPath, opStr, value } = c._mock;
      result = result.filter(item => {
        // Resolve nested fields if any, e.g., "user.id"
        let itemVal = item;
        const parts = fieldPath.split('.');
        for (const part of parts) {
          if (itemVal && typeof itemVal === 'object') {
            itemVal = itemVal[part];
          } else {
            itemVal = undefined;
            break;
          }
        }
        
        switch (opStr) {
          case '==':
            return itemVal === value;
          case '!=':
            return itemVal !== value;
          case '>':
            return itemVal > value;
          case '>=':
            return itemVal >= value;
          case '<':
            return itemVal < value;
          case '<=':
            return itemVal <= value;
          case 'array-contains':
            return Array.isArray(itemVal) && itemVal.includes(value);
          case 'array-contains-any':
            return Array.isArray(itemVal) && Array.isArray(value) && value.some((v: any) => itemVal.includes(v));
          case 'in':
            return Array.isArray(value) && value.includes(itemVal);
          case 'not-in':
            return Array.isArray(value) && !value.includes(itemVal);
          default:
            return true;
        }
      });
    }
  }
  
  // 2. Apply orderBy sorting
  for (const c of constraints) {
    if (c && c._mock && c._mock.type === 'orderBy') {
      const { fieldPath, directionStr } = c._mock;
      const isAsc = directionStr === 'asc';
      result.sort((a, b) => {
        let valA = a;
        let valB = b;
        const parts = fieldPath.split('.');
        for (const part of parts) {
          if (valA && typeof valA === 'object') valA = valA[part];
          if (valB && typeof valB === 'object') valB = valB[part];
        }
        
        if (valA === undefined || valA === null) return isAsc ? 1 : -1;
        if (valB === undefined || valB === null) return isAsc ? -1 : 1;
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
      });
    }
  }
  
  // 3. Apply limit slicing
  for (const c of constraints) {
    if (c && c._mock && c._mock.type === 'limit') {
      result = result.slice(0, c._mock.limitNum);
    }
  }
  
  return result;
}

export function getDocs(queryRef: any): Promise<any> {
  if (queryRef && queryRef._isMock) {
    const data = getLocalCollection(queryRef.path);
    let result = applyConstraints(data, queryRef.constraints);
    return Promise.resolve(createMockSnapshot(result, queryRef.path));
  }
  return realGetDocs(queryRef);
}

export function getDoc(docRef: any): Promise<any> {
  if (docRef && docRef._isMock) {
    const parts = docRef.path.split('/');
    const docId = parts.pop();
    const collectionPath = parts.join('/');
    const collectionData = getLocalCollection(collectionPath);
    const docData = collectionData.find(d => d.id === docId);
    
    return Promise.resolve({
      id: docId,
      exists: () => !!docData,
      data: () => docData ? { ...docData } : undefined
    });
  }
  return realGetDoc(docRef);
}

export function onSnapshot(queryOrRef: any, onNext: any, onError?: any) {
  if (queryOrRef && queryOrRef._isMock) {
    const path = queryOrRef.path;
    const isDoc = queryOrRef.type === 'document';
    
    const triggerUpdate = () => {
      if (isDoc) {
        const parts = path.split('/');
        const docId = parts.pop();
        const collectionPath = parts.join('/');
        const data = getLocalCollection(collectionPath);
        const docData = data.find((d: any) => d.id === docId);
        
        onNext({
          id: docId,
          exists: () => !!docData,
          data: () => docData ? { ...docData } : undefined
        });
      } else {
        const data = getLocalCollection(path);
        let result = applyConstraints(data, queryOrRef.constraints);
        onNext(createMockSnapshot(result, path));
      }
    };

    const listener = () => {
      triggerUpdate();
    };
    
    const listenPath = isDoc ? path.split('/').slice(0, -1).join('/') : path;
    window.addEventListener(`mock_db_update_${listenPath}`, listener);
    
    // Initial async trigger
    setTimeout(triggerUpdate, 0);

    return () => {
      window.removeEventListener(`mock_db_update_${listenPath}`, listener);
    };
  }
  
  return realOnSnapshot(queryOrRef, onNext, onError);
}

export async function addDoc(collectionRef: any, data: any): Promise<any> {
  if (collectionRef && collectionRef._isMock) {
    const id = "mock_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const path = collectionRef.path;
    const collectionData = getLocalCollection(path);
    
    const processedData = { ...data };
    for (const key in processedData) {
      if (processedData[key] && processedData[key]._isServerTimestamp) {
        processedData[key] = new Date().toISOString();
      }
    }

    const newDoc = { id, ...processedData };
    collectionData.push(newDoc);
    saveLocalCollection(path, collectionData);
    
    return { id, path: `${path}/${id}` };
  }
  return realAddDoc(collectionRef, data);
}

export async function setDoc(docRef: any, data: any, options?: any): Promise<any> {
  if (docRef && docRef._isMock) {
    const parts = docRef.path.split('/');
    const docId = parts.pop();
    const collectionPath = parts.join('/');
    const collectionData = getLocalCollection(collectionPath);
    
    const processedData = { ...data };
    for (const key in processedData) {
      if (processedData[key] && processedData[key]._isServerTimestamp) {
        processedData[key] = new Date().toISOString();
      }
    }

    const existingIndex = collectionData.findIndex(d => d.id === docId);
    if (existingIndex >= 0) {
      if (options && options.merge) {
        collectionData[existingIndex] = { ...collectionData[existingIndex], ...processedData };
      } else {
        collectionData[existingIndex] = { id: docId, ...processedData };
      }
    } else {
      collectionData.push({ id: docId, ...processedData });
    }
    
    saveLocalCollection(collectionPath, collectionData);
    return;
  }
  return realSetDoc(docRef, data, options);
}

export async function updateDoc(docRef: any, dataOrField: any, ...moreFields: any[]): Promise<any> {
  if (docRef && docRef._isMock) {
    const parts = docRef.path.split('/');
    const docId = parts.pop();
    const collectionPath = parts.join('/');
    const collectionData = getLocalCollection(collectionPath);
    
    const existingIndex = collectionData.findIndex(d => d.id === docId);
    if (existingIndex >= 0) {
      let updates = { ...dataOrField };
      for (const key in updates) {
        const val = updates[key];
        if (val && val._isUnion) {
          const currentArray = Array.isArray(collectionData[existingIndex][key]) ? collectionData[existingIndex][key] : [];
          updates[key] = Array.from(new Set([...currentArray, ...val.elements]));
        } else if (val && val._isRemove) {
          const currentArray = Array.isArray(collectionData[existingIndex][key]) ? collectionData[existingIndex][key] : [];
          updates[key] = currentArray.filter((item: any) => {
            if (typeof item === 'object' && item !== null && typeof val.elements[0] === 'object' && val.elements[0] !== null) {
              return JSON.stringify(item) !== JSON.stringify(val.elements[0]);
            }
            return !val.elements.includes(item);
          });
        } else if (val && val._isServerTimestamp) {
          updates[key] = new Date().toISOString();
        }
      }

      collectionData[existingIndex] = { ...collectionData[existingIndex], ...updates };
      saveLocalCollection(collectionPath, collectionData);
    }
    return;
  }
  return (realUpdateDoc as any)(docRef, dataOrField, ...moreFields);
}

export async function deleteDoc(docRef: any): Promise<any> {
  const path = docRef?.path || '';
  const lowercasePath = path.toLowerCase();
  
  if (
    lowercasePath.includes('post') || 
    lowercasePath.includes('comment') || 
    lowercasePath.includes('shared_music') ||
    lowercasePath.includes('reels')
  ) {
    console.warn(`[BLOCKED DELETION] Deletion blocked for path: ${path}`);
    return Promise.resolve(); // Return success without actual Firestore deletion
  }

  if (docRef && docRef._isMock) {
    const parts = docRef.path.split('/');
    const docId = parts.pop();
    const collectionPath = parts.join('/');
    const collectionData = getLocalCollection(collectionPath);
    
    const filtered = collectionData.filter(d => d.id !== docId);
    saveLocalCollection(collectionPath, filtered);
    return;
  }
  return realDeleteDoc(docRef);
}

export function arrayUnion(...elements: any[]) {
  const real = realArrayUnion(...elements);
  (real as any)._isUnion = true;
  (real as any).elements = elements;
  return real;
}

export function arrayRemove(...elements: any[]) {
  const real = realArrayRemove(...elements);
  (real as any)._isRemove = true;
  (real as any).elements = elements;
  return real;
}

export function serverTimestamp() {
  const real = realServerTimestamp();
  (real as any)._isServerTimestamp = true;
  return real;
}

export function enableIndexedDbPersistence(db: any) {
  return realEnableIndexedDbPersistence(db);
}

export function setLogLevel(level: any) {
  return realSetLogLevel(level);
}
