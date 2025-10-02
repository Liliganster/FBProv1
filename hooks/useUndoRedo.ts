import { useState, useCallback, useRef } from 'react';

export interface UndoAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'bulk_delete';
  description: string;
  undo: () => void;
  timestamp: number;
}

interface UseUndoRedoOptions {
  maxHistorySize?: number;
  autoExpireMs?: number;
}

interface UseUndoRedoReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  addAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  getLastAction: () => UndoAction | null;
  historySize: number;
}

export const useUndoRedo = (options: UseUndoRedoOptions = {}): UseUndoRedoReturn => {
  const { maxHistorySize = 10, autoExpireMs = 30000 } = options; // 30 seconds default
  
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const nextActionId = useRef(0);

  // Clean expired actions
  const cleanExpiredActions = useCallback((stack: UndoAction[]): UndoAction[] => {
    if (!autoExpireMs) return stack;
    const now = Date.now();
    return stack.filter(action => now - action.timestamp < autoExpireMs);
  }, [autoExpireMs]);

  const addAction = useCallback((actionData: Omit<UndoAction, 'id' | 'timestamp'>) => {
    const action: UndoAction = {
      ...actionData,
      id: `action_${nextActionId.current++}`,
      timestamp: Date.now()
    };

    setUndoStack(prev => {
      const cleaned = cleanExpiredActions(prev);
      const newStack = [...cleaned, action];
      // Keep only the most recent actions up to maxHistorySize
      return newStack.slice(-maxHistorySize);
    });

    // Clear redo stack when a new action is added
    setRedoStack([]);
  }, [maxHistorySize, cleanExpiredActions]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      const cleaned = cleanExpiredActions(prev);
      if (cleaned.length === 0) return cleaned;

      const actionToUndo = cleaned[cleaned.length - 1];
      const remainingActions = cleaned.slice(0, -1);

      // Execute the undo function
      try {
        actionToUndo.undo();
        
        // Move action to redo stack
        setRedoStack(redoPrev => [...redoPrev, actionToUndo]);
        
        return remainingActions;
      } catch (error) {
        console.error('Error executing undo action:', error);
        return cleaned; // Keep the action if undo fails
      }
    });
  }, [cleanExpiredActions]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;

      const actionToRedo = prev[prev.length - 1];
      const remainingActions = prev.slice(0, -1);

      // For redo, we need to reverse the undo operation
      // This would require the original operation to be stored or reconstructed
      // For now, we'll just move it back to undo stack
      setUndoStack(undoPrev => [...undoPrev, actionToRedo]);
      
      return remainingActions;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const getLastAction = useCallback((): UndoAction | null => {
    const cleaned = cleanExpiredActions(undoStack);
    return cleaned.length > 0 ? cleaned[cleaned.length - 1] : null;
  }, [undoStack, cleanExpiredActions]);

  // Clean expired actions periodically
  const canUndo = cleanExpiredActions(undoStack).length > 0;
  const canRedo = redoStack.length > 0;
  const historySize = undoStack.length;

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    addAction,
    clearHistory,
    getLastAction,
    historySize
  };
};

export default useUndoRedo;