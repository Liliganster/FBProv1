import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useTranslation from '../hooks/useTranslation';
import { UndoAction } from '../hooks/useUndoRedo';
import { LuRotateCcw as RotateCcw, LuX as X } from 'react-icons/lu';

interface UndoToastProps {
  action: UndoAction | null;
  onUndo: () => void;
  onDismiss: () => void;
  isVisible: boolean;
  theme: 'light' | 'dark';
}

const UndoToast: React.FC<UndoToastProps> = ({ 
  action, 
  onUndo, 
  onDismiss, 
  isVisible, 
  theme 
}) => {
  const { t } = useTranslation();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && action) {
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, action, onDismiss]);

  if (!shouldRender || !action) return null;

  const handleUndo = () => {
    onUndo();
    onDismiss();
  };

  const toastContent = (
    <div 
      className={`
        fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl
        transition-all duration-300 ease-in-out border
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
        bg-background-dark/95 border-gray-600/50 text-white backdrop-blur-sm
      `}
      style={{ maxWidth: '400px', minWidth: '300px' }}
    >
      <div className="flex-1 flex items-center gap-2">
        <RotateCcw 
          size={16} 
          className="text-gray-400" 
        />
        <span className="text-sm">
          {t('undo_toast_message', { action: action.description })}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleUndo}
          className={`
            px-3 py-1.5 text-sm font-medium rounded-md 
            transition-colors duration-200
            bg-brand-primary hover:brightness-110 text-white
          `}
        >
          {t('undo_toast_button')}
        </button>
        
        <button
          onClick={onDismiss}
          className={`
            p-1.5 rounded-md transition-colors duration-200
            hover:bg-gray-700 text-gray-400 hover:text-gray-300
          `}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );

  return createPortal(toastContent, document.body);
};

export default UndoToast;
