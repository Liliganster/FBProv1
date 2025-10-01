import React, { useState, useEffect, useCallback } from 'react';

function useLocalStorage<T>(key: string | null, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  
  const getInitialValue = useCallback(() => {
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }, [initialValue]);
  
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined' || key === null) {
      return getInitialValue();
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : getInitialValue();
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return getInitialValue();
    }
  });

  // Effect to update the state if the key changes (e.g., user logs in/out)
  useEffect(() => {
    if (key === null) {
      setStoredValue(getInitialValue());
      return;
    }
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? JSON.parse(item) : getInitialValue());
    } catch (error) {
       console.error(`Error reading localStorage key “${key}”:`, error);
       setStoredValue(getInitialValue());
    }
  // We only want this to run when the key changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);


  // Effect to write to localStorage whenever the state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && key !== null) {
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.error(`Error writing to localStorage key “${key}”:`, error);
        }
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
