import React from 'react';
import { ToastItem } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 size={16} className="text-[#3ee89a]" />,
          error: <AlertCircle size={16} className="text-[#ff6b9d]" />,
          info: <Info size={16} className="text-[#00e5ff]" />,
        };

        const borderStyles = {
          success: 'border-[#3ee89a]/30 shadow-[0_4px_20px_rgba(62,232,154,0.15)]',
          error: 'border-[#ff6b9d]/30 shadow-[0_4px_20px_rgba(255,107,157,0.15)]',
          info: 'border-[#00e5ff]/30 shadow-[0_4px_20px_rgba(0,229,255,0.15)]',
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-[#15152a]/95 border backdrop-blur-md text-xs text-[#e8e8f0] min-w-[260px] max-w-[380px] animate-in slide-in-from-right-4 duration-200 ${
              borderStyles[toast.type]
            }`}
          >
            <span className="shrink-0">{icons[toast.type]}</span>
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#555570] hover:text-[#e8e8f0] p-0.5 rounded transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
