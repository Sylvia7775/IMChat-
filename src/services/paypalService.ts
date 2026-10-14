// Client-side PayPal payment service for IMChat
// Communicates with /api/paypal endpoints and loads PayPal JavaScript SDK

export interface PayPalConfig {
  clientId: string;
  currency: string;
  appName: string;
  mode: string;
  configured: boolean;
}

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  description?: string;
  itemType: 'marketplace_item' | 'marketplace_cart' | 'wallet_topup' | 'ad_campaign' | 'service';
  itemId?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  status: string;
  approveUrl?: string;
  currency: string;
  amount: string;
  error?: string;
}

export interface CaptureOrderResponse {
  success: boolean;
  status: string;
  orderId: string;
  captureId: string;
  paidAmount: number;
  currency: string;
  payer?: {
    email?: string;
    name?: string;
  };
  transaction?: any;
  error?: string;
}

export interface PayPalTransaction {
  id: string;
  orderId: string;
  captureId: string;
  status: string;
  amount: number;
  currency: string;
  payerEmail: string;
  payerName: string;
  itemType: string;
  itemId: string;
  userId: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

let cachedConfig: PayPalConfig | null = null;
let scriptLoadingPromise: Promise<boolean> | null = null;

/**
 * Get PayPal public configuration from the server
 */
export async function getPayPalConfig(): Promise<PayPalConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/api/paypal/config');
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching PayPal config`);
    const data = await res.json();
    cachedConfig = data;
    return data;
  } catch (err: any) {
    console.error('Failed to get PayPal config:', err);
    // Fallback default
    return {
      clientId: 'AaCTLbvNfi673I0PkreXuEuoauzuj9bzYTckhZTaT6AoUR1LgPHsR8QghOxqIsn_plBK0hJ2_bpfazOP',
      currency: 'USD',
      appName: 'IMChat',
      mode: 'live',
      configured: true
    };
  }
}

/**
 * Dynamically loads the PayPal JS SDK into the document
 */
export async function loadPayPalSdk(currency = 'USD'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).paypal) return true;
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise(async (resolve) => {
    try {
      const config = await getPayPalConfig();
      const clientId = config.clientId;
      
      const scriptId = 'paypal-js-sdk';
      const existingScript = document.getElementById(scriptId) as HTMLScriptElement;
      if (existingScript) {
        if ((window as any).paypal) {
          resolve(true);
          return;
        }
        existingScript.onload = () => resolve(true);
        existingScript.onerror = () => resolve(false);
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
      script.async = true;
      
      script.onload = () => {
        console.log('[PayPal SDK] Loaded successfully');
        resolve(true);
      };
      
      script.onerror = (err) => {
        console.warn('[PayPal SDK] Failed to load script from PayPal CDN:', err);
        resolve(false);
      };

      document.body.appendChild(script);
    } catch (err) {
      console.error('[PayPal SDK] Initialization error:', err);
      resolve(false);
    }
  });

  return scriptLoadingPromise;
}

/**
 * Request server to create a PayPal Order
 */
export async function createPayPalOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
  const res = await fetch('/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create PayPal order');
  }

  return data;
}

/**
 * Request server to capture payment for an approved PayPal Order
 */
export async function capturePayPalOrder(params: {
  orderId: string;
  itemType?: string;
  itemId?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}): Promise<CaptureOrderResponse> {
  const res = await fetch('/api/paypal/capture-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to capture PayPal payment');
  }

  return data;
}

/**
 * Check details or status of a PayPal Order
 */
export async function getPayPalOrder(orderId: string): Promise<any> {
  const res = await fetch(`/api/paypal/order/${encodeURIComponent(orderId)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Order lookup failed');
  }
  return res.json();
}

/**
 * Fetch recorded PayPal transactions for a user
 */
export async function getPayPalTransactions(userId?: string): Promise<PayPalTransaction[]> {
  const url = userId ? `/api/paypal/transactions?userId=${encodeURIComponent(userId)}` : '/api/paypal/transactions';
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.transactions || [];
  } catch (e) {
    console.warn('Error fetching transactions:', e);
    return [];
  }
}
