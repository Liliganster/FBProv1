import { useEffect, useRef, useCallback } from 'react';
import { abortManager } from '../services/abortControllerManager';

/**
 * Custom hook for automatic AbortController management
 * 
 * Provides AbortControllers that are automatically cleaned up
 * when the component unmounts, preventing memory leaks.
 * 
 * Usage:
 * ```tsx
 * const { createController, abortAll } = useAbortController('MyComponent');
 * 
 * useEffect(() => {
 *   const controller = createController('fetchData');
 *   
 *   fetch('/api/data', { signal: controller.signal })
 *     .then(response => response.json())
 *     .catch(error => {
 *       if (error.name !== 'AbortError') {
 *         console.error('Fetch error:', error);
 *       }
 *     });
 * }, [createController]);
 * ```
 */
export function useAbortController(componentName?: string) {
  const groupName = useRef(
    componentName || `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const isUnmounted = useRef(false);

  /**
   * Create a new AbortController for this component
   */
  const createController = useCallback((name?: string): AbortController => {
    if (isUnmounted.current) {
      throw new Error('Cannot create AbortController after component unmount');
    }

    return abortManager.create(name, groupName.current);
  }, []);

  /**
   * Get an existing controller by name
   */
  const getController = useCallback((name: string): AbortController | undefined => {
    return abortManager.get(name, groupName.current);
  }, []);

  /**
   * Abort a specific controller
   */
  const abortController = useCallback((name: string, reason?: string): void => {
    abortManager.abort(name, groupName.current, reason);
  }, []);

  /**
   * Abort all controllers for this component
   */
  const abortAll = useCallback((reason?: string): void => {
    abortManager.abortGroup(groupName.current, reason);
  }, []);

  /**
   * Create an AbortController with automatic error handling for fetch
   */
  const createFetchController = useCallback((name?: string) => {
    const controller = createController(name);
    
    // Helper function for fetch with automatic error handling
    const fetchWithController = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        return response;
      } catch (error) {
        // Don't throw AbortError as it's expected behavior
        if (error instanceof Error && error.name === 'AbortError') {
          console.debug(`Fetch aborted: ${input}`);
          throw error; // Re-throw so caller can handle if needed
        }
        throw error;
      }
    };

    return {
      controller,
      fetch: fetchWithController,
      signal: controller.signal,
    };
  }, [createController]);

  // Cleanup all controllers when component unmounts
  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      abortManager.abortGroup(groupName.current, 'Component unmounted');
    };
  }, []);

  return {
    createController,
    getController,
    abortController,
    abortAll,
    createFetchController,
    groupName: groupName.current,
  };
}

/**
 * Hook specifically for managing a single long-lived AbortController
 * 
 * Usage:
 * ```tsx
 * const controller = useSingleAbortController('myOperation');
 * 
 * useEffect(() => {
 *   fetch('/api/data', { signal: controller.signal })
 *     .catch(error => {
 *       if (error.name !== 'AbortError') {
 *         console.error('Error:', error);
 *       }
 *     });
 * }, [controller]);
 * ```
 */
export function useSingleAbortController(name?: string): AbortController {
  const { createController } = useAbortController();
  const controller = useRef<AbortController | null>(null);

  if (!controller.current) {
    controller.current = createController(name);
  }

  return controller.current;
}

/**
 * Hook for managing subscription cleanup
 * 
 * Usage:
 * ```tsx
 * const { addCleanup, cleanup } = useSubscriptionCleanup();
 * 
 * useEffect(() => {
 *   const unsubscribe = someService.subscribe(callback);
 *   addCleanup(unsubscribe);
 *   
 *   // Cleanup function will be called automatically
 * }, [addCleanup]);
 * ```
 */
export function useSubscriptionCleanup() {
  const cleanupFunctions = useRef<(() => void)[]>([]);
  const isUnmounted = useRef(false);

  const addCleanup = useCallback((cleanupFn: () => void) => {
    if (isUnmounted.current) {
      // If component is already unmounted, call cleanup immediately
      cleanupFn();
      return;
    }
    cleanupFunctions.current.push(cleanupFn);
  }, []);

  const cleanup = useCallback(() => {
    cleanupFunctions.current.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });
    cleanupFunctions.current = [];
  }, []);

  useEffect(() => {
    return () => {
      isUnmounted.current = true;
      cleanup();
    };
  }, [cleanup]);

  return { addCleanup, cleanup };
}

/**
 * Hook that combines AbortController with subscription cleanup
 * 
 * The ultimate hook for preventing memory leaks
 */
export function useMemoryLeakPrevention(componentName?: string) {
  const abortController = useAbortController(componentName);
  const subscriptionCleanup = useSubscriptionCleanup();

  return {
    ...abortController,
    ...subscriptionCleanup,
  };
}