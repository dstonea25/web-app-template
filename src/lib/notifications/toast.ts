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
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  dismissible?: boolean;
}

type Listener = (msg: ToastMessage) => void;

const listeners = new Set<Listener>();

const notify = (msg: ToastMessage) => {
  for (const l of Array.from(listeners)) l(msg);
};

const genId = () => Math.random().toString(36).slice(2);

type ToastOptions = Partial<Pick<ToastMessage, 'ttlMs' | 'actionLabel' | 'onAction' | 'dismissible'>>;

export const toast = {
  on(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  success(message: string, opts: number | ToastOptions = 3000) {
    const ttlMs = typeof opts === 'number' ? opts : (opts.ttlMs ?? 3000);
    const rest = typeof opts === 'number' ? {} : opts;
    notify({ id: genId(), variant: 'success', message, ttlMs, ...rest });
  },
  error(message: string, opts: number | ToastOptions = 4000) {
    const ttlMs = typeof opts === 'number' ? opts : (opts.ttlMs ?? 4000);
    const rest = typeof opts === 'number' ? {} : opts;
    notify({ id: genId(), variant: 'error', message, ttlMs, ...rest });
  },
  info(message: string, opts: number | ToastOptions = 3000) {
    const ttlMs = typeof opts === 'number' ? opts : (opts.ttlMs ?? 3000);
    const rest = typeof opts === 'number' ? {} : opts;
    notify({ id: genId(), variant: 'info', message, ttlMs, ...rest });
  },
};

export default toast;


