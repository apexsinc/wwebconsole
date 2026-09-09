import { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { verifyCheckout } from '../services/api.js';
import { useWeatherStore } from '../store.js';

interface PolarCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutUrl: string | null;
  checkoutId: string | null;
  onSuccess: () => void;
}

export default function PolarCheckoutModal({
  isOpen,
  onClose,
  checkoutUrl,
  checkoutId,
  onSuccess,
}: PolarCheckoutModalProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Reset loading state when new checkoutUrl arrives
  useEffect(() => {
    if (checkoutUrl) {
      setIframeLoading(true);
      setVerifyError('');
    }
  }, [checkoutUrl]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !verifying) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, verifying, onClose]);

  // Listen for message events from Polar checkout iframe
  useEffect(() => {
    if (!isOpen || !checkoutId) return;

    const handleMessage = async (e: MessageEvent) => {
      const data = e.data;
      if (
        (typeof data === 'string' &&
          (data.includes('polar:checkout:success') || data.includes('polar:checkout:confirmed'))) ||
        (typeof data === 'object' &&
          data &&
          (data.event === 'checkout:success' ||
            data.event === 'checkout:confirmed' ||
            data.type === 'checkout.success'))
      ) {
        await handleCheckoutSuccess();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, checkoutId]);

  const handleCheckoutSuccess = async () => {
    if (!checkoutId) return;
    setVerifying(true);
    setVerifyError('');

    try {
      const res = await verifyCheckout(checkoutId);
      if (res.ok) {
        if (res.billing) {
          useWeatherStore.getState().setBilling(res.billing);
        }
        onSuccess();
        onClose();
      } else {
        setVerifyError(res.message || 'Payment received. Finalizing Pro subscription…');
      }
    } catch (err: any) {
      setVerifyError(err?.message || 'Verification in progress. Your subscription will activate shortly.');
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen || !checkoutUrl) return null;

  // Force light mode for the Polar checkout form
  const formattedUrl = checkoutUrl.includes('theme=')
    ? checkoutUrl.replace(/theme=[^&]+/, 'theme=light')
    : checkoutUrl.includes('?')
    ? `${checkoutUrl}&theme=light`
    : `${checkoutUrl}?theme=light`;

  return (
    <div className="fixed inset-0 z-[250] bg-white w-screen h-screen flex flex-col animate-in fade-in duration-150">
      {/* Completely Clean Minimalist Top Header */}
      <div className="h-14 px-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-xs">
        <h3 className="text-sm sm:text-base font-semibold text-slate-800 tracking-tight">
          Web Console Pro Checkout
        </h3>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={verifying}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close checkout"
            title="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Verification Status Banner (when processing) */}
      {verifying && (
        <div className="p-3 bg-sky-50 border-b border-sky-200 text-sky-800 text-xs flex items-center justify-center gap-2 font-medium shrink-0">
          <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
          <span>Confirming your payment with Polar &amp; activating your Pro subscription…</span>
        </div>
      )}

      {verifyError && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shrink-0">
          <span>{verifyError}</span>
          <button
            onClick={handleCheckoutSuccess}
            className="px-3 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Recheck Status
          </button>
        </div>
      )}

      {/* Full-Screen Iframe Container */}
      <div className="relative flex-1 w-full bg-white overflow-hidden">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white text-slate-700 gap-3">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <p className="text-xs font-medium text-slate-500">Loading secure checkout form…</p>
          </div>
        )}

        <iframe
          src={formattedUrl}
          title="Polar Checkout"
          onLoad={() => setIframeLoading(false)}
          className="w-full h-full border-0 bg-white"
          allow="payment; clipboard-write"
        />
      </div>
    </div>
  );
}
