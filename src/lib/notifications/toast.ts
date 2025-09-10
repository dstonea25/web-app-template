/**
 * Global toast API. Import { toast } from 'lib/notifications/toast';
 * Example: toast.success('Saved settings'); // available from any tab
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
  ttlMs: number;
}

type Listener = (msg: ToastMessage) => void;

const listeners = new Set<Listener>();

const notify = (msg: ToastMessage) => {
  for (const l of Array.from(listeners)) l(msg);
};

const genId = () => Math.random().toString(36).slice(2);

export const toast = {
  on(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  success(message: string, ttlMs = 3000) {
    notify({ id: genId(), variant: 'success', message, ttlMs });
  },
  error(message: string, ttlMs = 4000) {
    notify({ id: genId(), variant: 'error', message, ttlMs });
  },
  info(message: string, ttlMs = 3000) {
    notify({ id: genId(), variant: 'info', message, ttlMs });
  },
};

export default toast;


