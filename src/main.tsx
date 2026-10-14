import { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { LanguageProvider } from './lib/i18n';

// Initialize LocalStorage safely & handle QuotaExceededError
if (typeof window !== 'undefined' && window.localStorage) {
  const originalSetItem = window.localStorage.setItem;
  window.localStorage.setItem = function (key, value) {
    const context = (this === window.localStorage || !this) ? window.localStorage : this;
    try {
      return originalSetItem.call(context, key, value);
    } catch (e: any) {
      console.warn(`[LocalStorage] QuotaExceededError or write failure writing key "${key}". Attempting cache purge...`, e);
      // Evict large non-critical cache items
      const cacheKeysToEvict = [
        'imchat_cached_posts',
        'cached_stickers_emoji_pack',
        'imchat_call_logs',
        'yolanda_marketplace_items',
        'imchat_sandbox_snippets',
        'news_bookmarks'
      ];
      for (const ck of cacheKeysToEvict) {
        if (ck !== key) {
          try { window.localStorage.removeItem(ck); } catch (_) {}
        }
      }
      try {
        return originalSetItem.call(context, key, value);
      } catch (retryError) {
        console.warn(`[LocalStorage] Could not write "${key}" even after cache purge. Suppressing throw to prevent UI crash.`, retryError);
        return;
      }
    }
  };
}

// Register Service Worker for Offline PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[Service Worker] Registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.error('[Service Worker] Registration failed:', err);
      });
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-lg w-full border-t-8 border-red-500">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
            <p className="text-gray-600 mb-6">IMChat encountered an unexpected error. Please try refreshing the page or check your connection.</p>
            <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-48 mb-6">
              <pre className="text-xs text-red-500 font-mono">{this.state.error?.toString()}</pre>
              <pre className="text-[10px] text-gray-500 font-mono mt-2">{this.state.error?.stack}</pre>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
            >
              Reload Application
            </button>
            <p className="text-[10px] text-gray-400 mt-4 text-center italic">Domain: {window.location.hostname}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global Error Handler for easier debugging in production
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", { message, source, lineno, colno, error });
  
  const errorMsg = (error?.message || error?.toString() || message || "").toString();
  const isQuota = errorMsg.toLowerCase().includes('quota exceeded') || 
                  errorMsg.toLowerCase().includes('quota limit exceeded') || 
                  errorMsg.toLowerCase().includes('resource-exhausted') || 
                  errorMsg.toLowerCase().includes('resource_exhausted') ||
                  errorMsg.toLowerCase().includes('free daily read');
  
  if (isQuota && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', {
      detail: {
        message: "Firestore daily quota has been reached. It will reset automatically tomorrow. Detailed information: https://firebase.google.com/pricing#cloud-firestore (Spark plan / Enterprise edition)"
      }
    }));
  }
  return false;
};

// Global Media Error Fallback using inline SVG data URI to avoid external network failures
const FALLBACK_IMAGE_DATA_URI = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22400%22%20viewBox%3D%220%200%20400%20400%22%3E%3Crect%20fill%3D%22%231e293b%22%20width%3D%22400%22%20height%3D%22400%22%2F%3E%3Ctext%20fill%3D%22%2394a3b8%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EMedia%20Preview%3C%2Ftext%3E%3C%2Fsvg%3E";

window.addEventListener('error', (e: Event) => {
  const target = e.target as HTMLElement;
  if (target && target instanceof HTMLImageElement) {
    if (!target.src.startsWith('data:image')) {
      target.src = FALLBACK_IMAGE_DATA_URI;
    }
  }
  if (target && target instanceof HTMLVideoElement) {
    if (!target.poster || !target.poster.startsWith('data:image')) {
      target.poster = FALLBACK_IMAGE_DATA_URI;
    }
  }
}, true);

window.onunhandledrejection = function(event) {
  const reason = event.reason?.toString() || "";
  const message = event.reason?.message || reason;

  // Ignore benign browser media playback / abort rejections
  if (
    message.includes("play() failed") ||
    message.includes("interrupted by a call to pause()") ||
    message.includes("The play() request was interrupted") ||
    message.includes("AbortError") ||
    message.includes("user didn't interact")
  ) {
    event.preventDefault();
    return;
  }

  console.warn("Unhandled Promise Rejection caught:", event.reason);
  
  const isQuota = reason.toLowerCase().includes('quota exceeded') || 
                  reason.toLowerCase().includes('quota limit exceeded') || 
                  reason.toLowerCase().includes('resource-exhausted') || 
                  reason.toLowerCase().includes('resource_exhausted') ||
                  reason.toLowerCase().includes('free daily read');
  
  if (isQuota && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', {
      detail: {
        message: "Firestore daily quota has been reached. It will reset automatically tomorrow. Detailed information: https://firebase.google.com/pricing#cloud-firestore (Spark plan / Enterprise edition)"
      }
    }));
  }

  if (reason.includes("auth/unauthorized-domain")) {
    alert("CRITICAL: This domain (" + window.location.hostname + ") is not authorized in your Firebase Project. Please add it to Firebase Console > Authentication > Settings > Authorized Domains.");
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  </StrictMode>,
);
