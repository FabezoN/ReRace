import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const STYLES: Record<ToastType, string> = {
  success: 'border-f1-green bg-f1-green/10 text-f1-white',
  error: 'border-f1-red bg-f1-red/10 text-f1-white',
  info: 'border-f1-white/40 bg-f1-asphalt text-f1-white',
};

const ICON_STYLES: Record<ToastType, string> = {
  success: 'bg-f1-green text-f1-carbon',
  error: 'bg-f1-red text-f1-white',
  info: 'bg-f1-white/20 text-f1-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-20 right-4 z-[100] flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 border-2 -skew-x-12 px-4 py-3 shadow-xl font-body text-sm max-w-xs animate-slide-in ${STYLES[toast.type]}`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-sm font-bold text-xs flex-shrink-0 ${ICON_STYLES[toast.type]}`}
            >
              {ICONS[toast.type]}
            </span>
            <span className="inline-block skew-x-12 leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
