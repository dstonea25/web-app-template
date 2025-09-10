import React, { useEffect, useState } from 'react';
import { toast, type ToastMessage } from '../../lib/notifications/toast';
import { tokens, cn } from '../../theme/config';

const useIsBrowser = () => typeof window !== 'undefined';

const variantClass = (v: ToastMessage['variant']) => {
  if (v === 'success') return tokens.button.success;
  if (v === 'error') return tokens.button.danger;
  return tokens.button.secondary;
};

export const ToastHost: React.FC = () => {
  // SSR guard
  if (!useIsBrowser()) return null;
  // Singleton guard (avoid double mount during HMR)
  if ((window as any).__GERONIMO_TOAST_HOST__) return null;
  (window as any).__GERONIMO_TOAST_HOST__ = true;

  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const off = toast.on((msg) => {
      setItems((prev) => [...prev, msg]);
      if (msg.ttlMs > 0) {
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== msg.id));
        }, msg.ttlMs);
      }
    });
    return () => {
      off();
      // release singleton on unmount (rare in prod)
      (window as any).__GERONIMO_TOAST_HOST__ = false;
    };
  }, []);

  return (
    <div
      className={cn(
        (tokens as any).toast?.base || 'fixed bottom-4 right-4 z-[1000] space-y-2',
      )}
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((t) => (
        <div key={t.id} className={cn('px-3 py-2 rounded-xl border', variantClass(t.variant))}>
          {t.message}
        </div>
      ))}
    </div>
  );
};

export default ToastHost;


