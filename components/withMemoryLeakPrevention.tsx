import React, { useEffect, useRef } from 'react';
import { useMemoryLeakPrevention } from '../hooks/useAbortController';
import { memoryLeakDetector } from '../services/memoryLeakDetector';

/**
 * Higher-Order Component for automatic memory leak prevention
 * 
 * Wraps any component and automatically provides:
 * - AbortController management
 * - Subscription cleanup tracking
 * - Memory leak monitoring
 * - Automatic resource cleanup on unmount
 * 
 * Usage:
 * ```tsx
 * const MyComponent = withMemoryLeakPrevention(({ createController, addCleanup }) => {
 *   useEffect(() => {
 *     const controller = createController('fetchData');
 *     
 *     fetch('/api/data', { signal: controller.signal })
 *       .then(response => response.json())
 *       .then(data => setData(data));
 *   }, [createController]);
 * 
 *   return <div>My Component</div>;
 * });
 * ```
 */

interface MemoryLeakPreventionProps {
  createController: (name?: string) => AbortController;
  getController: (name: string) => AbortController | undefined;
  abortController: (name: string, reason?: string) => void;
  abortAll: (reason?: string) => void;
  createFetchController: (name?: string) => {
    controller: AbortController;
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    signal: AbortSignal;
  };
  addCleanup: (cleanupFn: () => void) => void;
  cleanup: () => void;
  groupName: string;
}

export function withMemoryLeakPrevention<P extends object>(
  WrappedComponent: React.ComponentType<P & MemoryLeakPreventionProps>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const MemoryLeakPreventedComponent: React.FC<P> = (props) => {
    const componentIdRef = useRef(`${displayName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const memoryLeakPrevention = useMemoryLeakPrevention(displayName);

    // Register component for monitoring
    useEffect(() => {
      const componentId = componentIdRef.current;
      memoryLeakDetector.registerComponent(componentId, displayName);

      return () => {
        memoryLeakDetector.unregisterComponent(componentId);
      };
    }, []);

    return <WrappedComponent {...props} {...memoryLeakPrevention} />;
  };

  MemoryLeakPreventedComponent.displayName = `withMemoryLeakPrevention(${displayName})`;
  
  return MemoryLeakPreventedComponent;
}

/**
 * Hook version for functional components that want manual control
 */
export function useMemoryLeakPreventionWithMonitoring(componentName?: string) {
  const componentIdRef = useRef(
    `${componentName || 'Component'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const memoryLeakPrevention = useMemoryLeakPrevention(componentName);

  // Register component for monitoring
  useEffect(() => {
    const componentId = componentIdRef.current;
    const name = componentName || 'Component';
    
    memoryLeakDetector.registerComponent(componentId, name);

    return () => {
      memoryLeakDetector.unregisterComponent(componentId);
    };
  }, [componentName]);

  // Enhanced tracking functions
  const trackTimer = (timerId: number) => {
    memoryLeakDetector.trackTimer(componentIdRef.current, timerId);
  };

  const trackInterval = (intervalId: number) => {
    memoryLeakDetector.trackInterval(componentIdRef.current, intervalId);
  };

  const trackEventListener = (eventType: string, element?: Element) => {
    memoryLeakDetector.trackEventListener(componentIdRef.current, eventType, element);
  };

  const trackSubscription = (unsubscribe: () => void) => {
    memoryLeakDetector.trackSubscription(componentIdRef.current, unsubscribe);
    memoryLeakPrevention.addCleanup(unsubscribe);
  };

  // Enhanced timer creation with tracking
  const createTrackedTimeout = (callback: () => void, delay: number) => {
    const timerId = Number(setTimeout(() => {
      callback();
      memoryLeakDetector.cleanupTimer(componentIdRef.current, Number(timerId));
    }, delay));
    
    trackTimer(timerId);
    memoryLeakPrevention.addCleanup(() => {
      clearTimeout(timerId);
      memoryLeakDetector.cleanupTimer(componentIdRef.current, timerId);
    });
    
    return timerId;
  };

  const createTrackedInterval = (callback: () => void, delay: number) => {
    const intervalId = Number(setInterval(callback, delay));
    
    trackInterval(intervalId);
    memoryLeakPrevention.addCleanup(() => {
      clearInterval(intervalId);
      memoryLeakDetector.cleanupInterval(componentIdRef.current, intervalId);
    });
    
    return intervalId;
  };

  // Enhanced event listener with tracking
  const addTrackedEventListener = <K extends keyof WindowEventMap>(
    target: Window | Document | Element,
    event: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(event, handler as EventListener, options);
    
    trackEventListener(event, target instanceof Element ? target : undefined);
    memoryLeakPrevention.addCleanup(() => {
      target.removeEventListener(event, handler as EventListener, options);
    });
  };

  return {
    ...memoryLeakPrevention,
    trackTimer,
    trackInterval,
    trackEventListener,
    trackSubscription,
    createTrackedTimeout,
    createTrackedInterval,
    addTrackedEventListener,
    componentId: componentIdRef.current,
  };
}

/**
 * Class component decorator (legacy support)
 */
export function memoryLeakPreventionDecorator<T extends { new(...args: any[]): React.Component }>(
  constructor: T,
  componentName?: string
) {
  return class extends constructor {
    private componentId: string;
    private memoryLeakPrevention: any;

    constructor(...args: any[]) {
      super(...args);
      const name = componentName || constructor.name;
      this.componentId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Note: This is a simplified version for class components
      // Full implementation would require more complex lifecycle management
    }

    componentDidMount() {
      memoryLeakDetector.registerComponent(this.componentId, componentName || constructor.name);
      super.componentDidMount?.();
    }

    componentWillUnmount() {
      memoryLeakDetector.unregisterComponent(this.componentId);
      super.componentWillUnmount?.();
    }
  };
}

/**
 * Global memory leak prevention utility
 */
export const memoryLeakPrevention = {
  /**
   * Start global memory leak monitoring
   */
  startGlobalMonitoring() {
    memoryLeakDetector.startMonitoring();
  },

  /**
   * Stop global memory leak monitoring
   */
  stopGlobalMonitoring() {
    memoryLeakDetector.stopMonitoring();
  },

  /**
   * Get current memory leak status
   */
  getStatus() {
    return memoryLeakDetector.getStatus();
  },

  /**
   * Force cleanup of all tracked resources
   */
  forceCleanup() {
    // This would trigger cleanup of all tracked resources
    // Implementation depends on specific requirements
    console.warn('🧹 Force cleanup requested - this should only be used in emergencies');
  }
};

// Export for use in debugging
if (typeof window !== 'undefined') {
  (window as any).memoryLeakPrevention = memoryLeakPrevention;
}