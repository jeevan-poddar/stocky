import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  sendNotification: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const sendNotification = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, action }]);

    // Auto-dismiss (longer if there is an action)
    setTimeout(() => {
      removeToast(id);
    }, action ? 8000 : 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  // Flat Peach & Orange Theme
  // Background: White (cleaner) or #FFF9F5 (Peach-light)
  // Border: #FFD8BE (Peach)
  // Shadow: Orange-ish tint
  const getStyles = (_type: ToastType) => {
    const base = "bg-[#FFF9F5] border border-[#FFD8BE] shadow-lg shadow-orange-500/10";
    return base;
  };

  return (
    <ToastContext.Provider value={{ sendNotification }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex flex-col gap-2 p-4 rounded-xl max-w-sm w-full animate-in slide-in-from-right-full duration-300 ${getStyles(toast.type)}`}
          >
            <div className="flex items-start gap-3">
                <div className="shrink-0 pt-0.5">
                    {getIcon(toast.type)}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 leading-snug">{toast.message}</p>
                </div>
                <button
                    onClick={() => removeToast(toast.id)}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            {/* Action Button */}
            {toast.action && (
                <div className="pl-8">
                    <button
                        onClick={() => {
                            toast.action?.onClick();
                            removeToast(toast.id);
                        }}
                        className="text-xs font-semibold text-white bg-[#FF9F6A] hover:bg-[#ff8a4c] px-3 py-1.5 rounded-lg transition-colors"
                    >
                        {toast.action.label}
                    </button>
                </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
