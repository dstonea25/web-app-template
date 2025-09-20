import React, { useEffect, useState } from 'react';
import { toast, type ToastMessage } from '../../lib/notifications/toast';
import { tokens, cn } from '../../theme/config';

const useIsBrowser = () => typeof window !== 'undefined';

const variantClass = (_v: ToastMessage['variant']) => {
  // All toasts use black background
  return 'text-white bg-black border-black hover:bg-gray-900 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950';
};

export const ToastHost: React.FC = () => {
  // SSR guard
  if (!useIsBrowser()) return null;

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
        <div key={t.id} className={cn('px-3 py-2 rounded-xl border flex items-center gap-2', variantClass(t.variant))}>
          <span className="flex-1">{t.message}</span>
          {t.actionLabel && (
            <button
              className={cn(tokens.button.base, tokens.button.ghost, 'text-sm px-2 py-1')}
              onClick={async () => {
                try { await t.onAction?.(); } catch {}
                setItems((prev) => prev.filter((i) => i.id !== t.id));
              }}
            >
              {t.actionLabel}
            </button>
          )}
          {(t.dismissible ?? true) && (
            <button
              aria-label="Dismiss"
              className={cn(tokens.button.base, tokens.button.ghost, 'text-sm px-2 py-1')}
              onClick={() => setItems((prev) => prev.filter((i) => i.id !== t.id))}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastHost;


