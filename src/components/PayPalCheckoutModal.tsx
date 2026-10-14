import React, { useEffect, useRef, useState } from 'react';
import { 
  X, CheckCircle, AlertCircle, Loader2, ExternalLink, 
  Copy, Check, ShieldCheck, CreditCard, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  createPayPalOrder, 
  capturePayPalOrder, 
  loadPayPalSdk, 
  getPayPalOrder,
  CreateOrderParams,
  CaptureOrderResponse 
} from '../services/paypalService';

interface PayPalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number; // In USD
  currency?: string;
  description: string;
  itemType: 'marketplace_item' | 'marketplace_cart' | 'wallet_topup' | 'ad_campaign' | 'service';
  itemId?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
  onSuccess: (response: CaptureOrderResponse) => void;
  onError?: (errorMessage: string) => void;
}

export const PayPalCheckoutModal: React.FC<PayPalCheckoutModalProps> = ({
  isOpen,
  onClose,
  amount,
  currency = 'USD',
  description,
  itemType,
  itemId,
  userId,
  userEmail,
  metadata,
  onSuccess,
  onError
}) => {
  const [loadingSdk, setLoadingSdk] = useState(true);
  const [buttonsRendered, setButtonsRendered] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [directApproveUrl, setDirectApproveUrl] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedPayment, setCompletedPayment] = useState<CaptureOrderResponse | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setCompletedPayment(null);
      setProcessingStatus(null);
      setActiveOrderId(null);
      setDirectApproveUrl(null);
      setButtonsRendered(false);
      setLoadingSdk(true);
      initializePayPal();
    }
  }, [isOpen, amount]);

  const initializePayPal = async () => {
    try {
      setLoadingSdk(true);
      const sdkLoaded = await loadPayPalSdk(currency);
      if (!isMountedRef.current) return;

      if (!sdkLoaded || !(window as any).paypal) {
        setErrorMessage('Unable to load PayPal Checkout SDK. You can still pay using the direct link below.');
        setLoadingSdk(false);
        return;
      }

      setLoadingSdk(false);
      renderPayPalButtons();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('PayPal init failed:', err);
      setErrorMessage(err.message || 'Failed to initialize PayPal.');
      setLoadingSdk(false);
    }
  };

  const renderPayPalButtons = () => {
    if (!paypalContainerRef.current || !(window as any).paypal) return;

    // Clear previous renders
    paypalContainerRef.current.innerHTML = '';

    try {
      (window as any).paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay',
          height: 44
        },
        createOrder: async () => {
          setProcessingStatus('Creating secure PayPal order...');
          setErrorMessage(null);
          try {
            const params: CreateOrderParams = {
              amount,
              currency,
              description,
              itemType,
              itemId,
              userId,
              userEmail,
              metadata
            };
            const res = await createPayPalOrder(params);
            if (!isMountedRef.current) return '';

            setActiveOrderId(res.orderId);
            if (res.approveUrl) {
              setDirectApproveUrl(res.approveUrl);
            }
            setProcessingStatus('Authorizing with PayPal...');
            return res.orderId;
          } catch (err: any) {
            if (!isMountedRef.current) return '';
            console.error('Error creating order:', err);
            setErrorMessage(err.message || 'Failed to initiate order.');
            setProcessingStatus(null);
            throw err;
          }
        },
        onApprove: async (data: any) => {
          setProcessingStatus('Payment approved! Finalizing and capturing funds...');
          try {
            const captureRes = await capturePayPalOrder({
              orderId: data.orderID,
              itemType,
              itemId,
              userId,
              userEmail,
              metadata
            });

            if (!isMountedRef.current) return;

            setProcessingStatus(null);
            setCompletedPayment(captureRes);
            onSuccess(captureRes);
          } catch (err: any) {
            if (!isMountedRef.current) return;
            console.error('Error capturing order:', err);
            setErrorMessage(err.message || 'Failed to capture payment. Please verify your PayPal account.');
            setProcessingStatus(null);
            onError?.(err.message || 'Payment capture failed');
          }
        },
        onCancel: () => {
          setProcessingStatus(null);
          setErrorMessage('Payment cancelled by user.');
        },
        onError: (err: any) => {
          console.error('PayPal button error:', err);
          setProcessingStatus(null);
          setErrorMessage('An error occurred in PayPal Checkout. Please try again or use the direct link.');
        }
      }).render(paypalContainerRef.current).then(() => {
        if (isMountedRef.current) {
          setButtonsRendered(true);
        }
      }).catch((renderErr: any) => {
        console.warn('Buttons render caught error:', renderErr);
      });
    } catch (e: any) {
      console.error('Exception rendering PayPal buttons:', e);
    }
  };

  // Pre-generate order for fallback link
  const handleGenerateFallbackOrder = async () => {
    try {
      setProcessingStatus('Generating PayPal direct link...');
      const params: CreateOrderParams = {
        amount,
        currency,
        description,
        itemType,
        itemId,
        userId,
        userEmail,
        metadata
      };
      const res = await createPayPalOrder(params);
      setActiveOrderId(res.orderId);
      if (res.approveUrl) {
        setDirectApproveUrl(res.approveUrl);
        window.open(res.approveUrl, '_blank');
      }
      setProcessingStatus(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not generate payment link.');
      setProcessingStatus(null);
    }
  };

  // Check manual status of order
  const handleCheckManualStatus = async () => {
    if (!activeOrderId) return;
    try {
      setProcessingStatus('Checking payment status with PayPal...');
      const order = await getPayPalOrder(activeOrderId);
      if (order.status === 'APPROVED' || order.status === 'COMPLETED') {
        const captureRes = await capturePayPalOrder({
          orderId: activeOrderId,
          itemType,
          itemId,
          userId,
          userEmail,
          metadata
        });
        setProcessingStatus(null);
        setCompletedPayment(captureRes);
        onSuccess(captureRes);
      } else {
        setProcessingStatus(null);
        setErrorMessage(`Order status is "${order.status}". Please complete the payment on PayPal.`);
      }
    } catch (err: any) {
      setProcessingStatus(null);
      setErrorMessage(err.message || 'Could not verify payment status.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-[440px] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#003087] flex items-center justify-center text-white shadow-xs">
                <span className="font-black italic text-lg tracking-tighter">P</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-gray-900 tracking-tight">IMChat Pay</span>
                  <span className="bg-blue-100 text-[#003087] text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase">
                    PayPal
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium">Official PayPal Checkout</p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={!!processingStatus}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4">
            {completedPayment ? (
              /* Success State */
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Payment Verified!</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Your PayPal transaction has been completed and confirmed.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Amount Paid</span>
                    <span className="font-black text-base text-gray-900 font-mono">
                      ${completedPayment.paidAmount.toFixed(2)} {completedPayment.currency}
                    </span>
                  </div>
                  <div className="h-[1px] bg-gray-200/60" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Item Description</span>
                    <span className="font-bold text-gray-800 truncate max-w-[180px]">{description}</span>
                  </div>
                  {completedPayment.payer?.email && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Payer Account</span>
                      <span className="font-bold text-gray-800">{completedPayment.payer.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">PayPal Capture ID</span>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-gray-700">
                      <span className="truncate max-w-[140px]">{completedPayment.captureId}</span>
                      <button
                        onClick={() => copyToClipboard(completedPayment.captureId)}
                        className="p-1 hover:bg-gray-200 rounded-md text-gray-500 cursor-pointer"
                        title="Copy Capture ID"
                      >
                        {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 font-semibold bg-emerald-50/80 py-2 rounded-xl border border-emerald-100">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified by PayPal Seller & Buyer Protection</span>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-[#0070BA] hover:bg-[#003087] text-white font-bold rounded-2xl active:scale-98 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ) : (
              /* Checkout In-Progress State */
              <>
                {/* Order Details Card */}
                <div className="bg-gray-50/80 border border-gray-200/60 rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Order Details</span>
                      <h4 className="font-extrabold text-sm text-gray-900 leading-snug">{description}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Total Due</span>
                      <p className="text-xl font-black text-gray-900 font-mono">
                        ${amount.toFixed(2)} <span className="text-xs font-normal text-gray-500">{currency}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <div className="flex-1">
                      <p className="font-bold">Notice</p>
                      <p className="leading-relaxed mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Processing Overlay State */}
                {processingStatus && (
                  <div className="py-6 px-4 bg-blue-50/60 border border-blue-200/60 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-[#0070BA] animate-spin" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{processingStatus}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Please do not close this window</p>
                    </div>
                  </div>
                )}

                {/* PayPal Buttons Render Area */}
                {!processingStatus && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold text-gray-500 flex items-center justify-between">
                      <span>Choose PayPal Payment Option:</span>
                      <span className="text-[10px] font-normal text-gray-400 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> PayPal & Cards
                      </span>
                    </div>

                    {loadingSdk && (
                      <div className="h-28 rounded-xl bg-gray-100 animate-pulse flex items-center justify-center text-xs text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2 text-gray-400" />
                        Connecting to PayPal...
                      </div>
                    )}

                    <div 
                      ref={paypalContainerRef} 
                      className={`min-h-[100px] transition-opacity ${loadingSdk ? 'hidden' : 'block'}`}
                    />

                    {/* Direct window option if needed */}
                    {directApproveUrl ? (
                      <div className="pt-2 border-t border-gray-100 space-y-2">
                        <a
                          href={directApproveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Complete in PayPal Window</span>
                        </a>
                        <button
                          onClick={handleCheckManualStatus}
                          className="w-full py-2 px-3 rounded-xl bg-blue-50 text-[#0070BA] hover:bg-blue-100 text-xs font-bold transition-colors cursor-pointer"
                        >
                          I Have Paid — Verify & Confirm
                        </button>
                      </div>
                    ) : (
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={handleGenerateFallbackOrder}
                          className="text-[11px] font-medium text-gray-500 hover:text-[#0070BA] underline transition-colors cursor-pointer"
                        >
                          Having trouble with buttons? Open PayPal in new tab
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Secure Trust Badge */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-4 text-[10px] text-gray-400 font-medium">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 256-Bit SSL Encrypted
                  </span>
                  <span>•</span>
                  <span>Instant Delivery</span>
                  <span>•</span>
                  <span>IMChat Verified</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
