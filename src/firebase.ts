import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Suppress low-level warnings and only log fatal errors
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'production') {
  try {
    setLogLevel('error');
  } catch (err) {
    console.warn("Failed to set Firestore log level:", err);
  }
}

// Robust Firestore initialization
let dbInstance: any;
try {
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.startsWith('ai-studio-')) {
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    dbInstance = getFirestore(app);
  }
} catch (e) {
  console.warn("Failed to initialize Firestore with specific database ID, falling back to default:", e);
  dbInstance = getFirestore(app);
}

// Enable local offline persistence for queries
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(dbInstance).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore offline persistence failed (failed-precondition): multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore offline persistence unimplemented in current browser.");
    }
  });
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errorMessage.toLowerCase().includes('quota exceeded') || 
                       errorMessage.toLowerCase().includes('quota limit exceeded') || 
                       errorMessage.toLowerCase().includes('resource-exhausted') ||
                       errorMessage.toLowerCase().includes('resource_exhausted') ||
                       errorMessage.toLowerCase().includes('quota reached');
  
  if (isQuotaError) {
    const quotaMessage = "Firestore daily quota has been reached. It will reset automatically tomorrow. Detailed information: https://firebase.google.com/pricing#cloud-firestore (Spark plan / Enterprise edition). Manage / Upgrade Database: https://console.firebase.google.com/project/imchat-3f2ac/firestore/databases/ai-studio-c2f70f42-b524-4182-99d1-3d0031a59b32/data?openUpgradeDialog=true";
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', {
        detail: {
          message: quotaMessage
        }
      }));
    }
    
    console.warn(`[Firestore Quota Exceeded Intercepted] Operation: ${operationType}, Path: ${path || 'unknown'}.`);
    
    const errInfo: FirestoreErrorInfo = {
      error: `[BUILD SYSTEM EXCEEDED ERROR - FIRESTORE QUOTA REACHED]: ${quotaMessage}`,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operationType,
      path
    };
    throw new Error(JSON.stringify(errInfo));
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface GeoCheckResult {
  isBlocked: boolean;
  countryName: string;
  countryCode: string;
}

const BANNED_COUNTRIES = [
  'russia', 'russian federation', 'china', 'israel', 'north korea', 
  "democratic people's republic of korea", 'kp', 'ru', 'cn', 'il'
];

export async function detectAndCheckGeoblock(): Promise<GeoCheckResult> {
  let countryName = '';
  let countryCode = '';
  
  try {
    const apis = [
      'https://ipapi.co/json/',
      'https://ip-api.com/json',
      'https://geolocation-db.com/json/'
    ];
    
    for (const url of apis) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          countryName = data.country_name || data.countryName || data.country || '';
          countryCode = data.country_code || data.countryCode || data.country || '';
          if (countryName || countryCode) break;
        }
      } catch (e) {
        console.warn(`Failed geo API fetch from ${url}:`, e);
      }
    }
  } catch (e) {
    console.error("Global geo check error:", e);
  }
  
  // Fallbacks: timezone & locale checks
  if (!countryName && !countryCode) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const locale = (navigator.language || '').toLowerCase();
      
      if (
        tz.includes('Moscow') || tz.includes('Volgograd') || tz.includes('Asia/Shanghai') || 
        tz.includes('Asia/Urumqi') || tz.includes('Asia/Jerusalem') || tz.includes('Asia/Tel_Aviv') || 
        tz.includes('Asia/Pyongyang') || locale === 'ru' || locale.startsWith('ru-') || 
        locale === 'zh' || locale.startsWith('zh-') || locale.startsWith('he-') || locale === 'he'
      ) {
        countryName = 'Restricted Region';
        countryCode = 'RESTRICTED';
      }
    } catch (e) {
      console.warn("Timezone fallback check failed:", e);
    }
  }
  
  const lowerName = countryName.toLowerCase();
  const lowerCode = countryCode.toLowerCase();
  
  const isBlocked = BANNED_COUNTRIES.some(banned => 
    lowerName.includes(banned) || 
    lowerCode === banned
  );
  
  return {
    isBlocked,
    countryName: countryName || 'Unknown',
    countryCode: countryCode || 'Unknown'
  };
}

