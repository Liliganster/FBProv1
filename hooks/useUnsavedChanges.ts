import { useState, useEffect, useCallback, useRef } from 'react';
import useTranslation from './useTranslation';

interface UseUnsavedChangesOptions {
  /** Whether to show confirmation dialog when leaving page/component */
  enableBeforeUnload?: boolean;
  /** Custom message for the confirmation dialog */
  confirmationMessage?: string;
  /** Function to enable/disable form controls based on unsaved changes */
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

interface UseUnsavedChangesReturn {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Function to mark data as saved (resets unsaved changes) */
  markAsSaved: () => void;
  /** Function to manually set unsaved changes state */
  setUnsavedChanges: (hasChanges: boolean) => void;
  /** Function to check for changes and show confirmation if needed */
  checkUnsavedChanges: () => Promise<boolean>;
  /** Function to reset the initial data reference (useful when loading new data) */
  resetInitialData: (newData: any) => void;
}

/**
 * Hook to track unsaved changes in forms by comparing initial and current values
 * @param initialData - The initial data to compare against
 * @param currentData - The current form data
 * @param options - Additional options for behavior customization
 */
export const useUnsavedChanges = <T>(
  initialData: T,
  currentData: T,
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn => {
  const { 
    enableBeforeUnload = true, 
    confirmationMessage,
    onUnsavedChangesChange 
  } = options;
  
  const { t } = useTranslation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const initialDataRef = useRef(initialData);
  const firstRender = useRef(true);

  // Deep comparison function to check if objects are equal
  const deepEqual = useCallback((obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return obj1 === obj2;
    
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
    
    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) return false;
      for (let i = 0; i < obj1.length; i++) {
        if (!deepEqual(obj1[i], obj2[i])) return false;
      }
      return true;
    }
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }, []);

  // Initialize after first render to prevent false positives
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      // Wait for next tick to ensure initial data is properly set
      const timeoutId = setTimeout(() => {
        initialDataRef.current = currentData;
        setIsInitialized(true);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [currentData]);

  // Update unsaved changes when data changes (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    
    const hasChanges = !deepEqual(initialDataRef.current, currentData);
    setHasUnsavedChanges(hasChanges);
  }, [currentData, deepEqual, isInitialized]);

  // Call callback when unsaved changes state changes
  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  // Handle browser beforeunload event
  useEffect(() => {
    if (!enableBeforeUnload) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        const message = confirmationMessage || t('common_unsaved_changes_warning') || 'You have unsaved changes. Are you sure you want to leave?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, enableBeforeUnload, confirmationMessage, t]);

  const markAsSaved = useCallback(() => {
    initialDataRef.current = currentData;
    setHasUnsavedChanges(false);
    setIsInitialized(true); // Ensure we're initialized after saving
  }, [currentData]);

  const setUnsavedChanges = useCallback((hasChanges: boolean) => {
    setHasUnsavedChanges(hasChanges);
  }, []);

  const resetInitialData = useCallback((newData: any) => {
    initialDataRef.current = newData;
    setHasUnsavedChanges(false);
    setIsInitialized(true);
  }, []);

  const checkUnsavedChanges = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (hasUnsavedChanges) {
        const message = confirmationMessage || t('common_unsaved_changes_warning') || 'You have unsaved changes. Are you sure you want to close?';
        const shouldContinue = confirm(message);
        resolve(shouldContinue);
      } else {
        resolve(true);
      }
    });
  }, [hasUnsavedChanges, confirmationMessage, t]);

  return {
    hasUnsavedChanges,
    markAsSaved,
    setUnsavedChanges,
    checkUnsavedChanges,
    resetInitialData,
  };
};

export default useUnsavedChanges;