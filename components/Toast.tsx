import React, { useEffect } from 'react';
import { XIcon, InfoIcon, CheckCircleIcon, WarningIcon, XCircleIcon } from './Icons';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
  duration?: number;
}

const icons: Record<ToastType, React.ReactNode> = {
  info: <InfoIcon className="w-6 h-6" />,
  success: <CheckCircleIcon className="w-6 h-6" />,
  warning: <WarningIcon className="w-6 h-6" />,
  error: <XCircleIcon className="w-6 h-6" />,
};

const colors: Record<ToastType, string> = {
    info: 'bg-blue-600/80 border-blue-500 text-blue-100',
    success: 'bg-green-600/80 border-green-500 text-green-100',
    warning: 'bg-yellow-600/80 border-yellow-500 text-yellow-100',
    error: 'bg-red-600/80 border-red-500 text-red-100',
};

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [id, duration, onClose]);

  return (
    <div
      className={`flex items-start p-4 rounded-lg shadow-2xl border-l-4 backdrop-blur-md transition-all duration-300 ease-in-out transform animate-toast-in ${colors[type]}`}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <div className="ml-3 flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button onClick={() => onClose(id)} className="ml-4 -mr-1 -mt-1 p-1 rounded-md hover:bg-white/10">
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Toast;
