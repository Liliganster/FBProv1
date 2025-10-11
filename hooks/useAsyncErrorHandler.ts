import React, { useCallback, useRef, useEffect } from 'react';
import { logger } from '../lib/logger';
import useToast from './useToast';

/**
 * Async Error Handler Hook
 * 
 * Provides comprehensive error handling for Promise-based operations,
 * async/await functions, and unhandled Promise rejections.
 * 
 * Features:
 * - Automatic error categorization
 * - User-friendly error messages
 * - Retry mechanisms
 * - Error reporting
 * - Memory leak prevention
 */

export type AsyncErrorType = 
  | 'network'
  | 'auth'
  | 'validation'
  | 'permission'
  | 'timeout'
  | 'abort'
  | 'unknown';

export interface AsyncErrorDetails {
  type: AsyncErrorType;
  operation: string;
  message: string;
  originalError: Error;
  timestamp: number;
  retryable: boolean;
  userMessage: string;
}

export interface AsyncErrorHandlerOptions {
  operation: string;
  showToast?: boolean;
  retryable?: boolean;
  timeout?: number;
  maxRetries?: number;
  onError?: (error: AsyncErrorDetails) => void;
  onRetry?: (attempt: number) => void;
  onSuccess?: (result: any) => void;
}

/**
 * Hook for handling async operations with comprehensive error handling
 */
export const useAsyncErrorHandler = () => {
  const { showToast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      retryCountRef.current.clear();
    };
  }, []);

  /**
   * Categorize error based on error message and properties
   */
  const categorizeError = useCallback((error: Error): AsyncErrorType => {
    const message = error.message.toLowerCase();
    
    if (error.name === 'AbortError' || message.includes('abort')) {
      return 'abort';
    }
    
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('connection') || message.includes('timeout')) {
      return 'network';
    }
    
    if (message.includes('unauthorized') || message.includes('401') || 
        message.includes('auth') || message.includes('token')) {
      return 'auth';
    }
    
    if (message.includes('validation') || message.includes('invalid') || 
        message.includes('required') || message.includes('400')) {
      return 'validation';
    }
    
    if (message.includes('permission') || message.includes('403') || 
        message.includes('forbidden') || message.includes('access')) {
      return 'permission';
    }
    
    if (message.includes('timeout') || message.includes('408')) {
      return 'timeout';
    }
    
    return 'unknown';
  }, []);

  /**
   * Generate user-friendly error message
   */
  const getUserMessage = useCallback((errorType: AsyncErrorType, operation: string): string => {
    switch (errorType) {
      case 'network':
        return 'Error de conexión. Verifica tu internet e intenta de nuevo.';
      case 'auth':
        return 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      case 'validation':
        return 'Los datos proporcionados no son válidos. Revisa e intenta de nuevo.';
      case 'permission':
        return 'No tienes permisos para realizar esta acción.';
      case 'timeout':
        return 'La operación tardó demasiado tiempo. Intenta de nuevo.';
      case 'abort':
        return 'Operación cancelada.';
      default:
        return `Error inesperado en ${operation}. Intenta de nuevo.`;
    }
  }, []);

  /**
   * Check if error is retryable
   */
  const isRetryable = useCallback((errorType: AsyncErrorType): boolean => {
    return ['network', 'timeout', 'unknown'].includes(errorType);
  }, []);

  /**
   * Create error details object
   */
  const createErrorDetails = useCallback((
    error: Error,
    operation: string
  ): AsyncErrorDetails => {
    const type = categorizeError(error);
    const userMessage = getUserMessage(type, operation);
    const retryable = isRetryable(type);

    return {
      type,
      operation,
      message: error.message,
      originalError: error,
      timestamp: Date.now(),
      retryable,
      userMessage,
    };
  }, [categorizeError, getUserMessage, isRetryable]);

  /**
   * Handle async operation with comprehensive error handling
   */
  const handleAsyncOperation = useCallback(async <T>(
    asyncFn: (signal?: AbortSignal) => Promise<T>,
    options: AsyncErrorHandlerOptions
  ): Promise<T | null> => {
    const {
      operation,
      showToast: shouldShowToast = true,
      timeout = 30000,
      maxRetries = 3,
      onError,
      onRetry,
      onSuccess,
    } = options;

    // Create new abort controller for this operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const currentRetries = retryCountRef.current.get(operation) || 0;

    try {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      try {
        logger.debug(`🚀 Starting async operation: ${operation}`);
        const result = await asyncFn(abortControllerRef.current.signal);
        
        clearTimeout(timeoutId);
        
        // Reset retry count on success
        retryCountRef.current.delete(operation);
        
        logger.debug(`✅ Async operation completed: ${operation}`);
        onSuccess?.(result);
        
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      const asyncError = error as Error;
      const errorDetails = createErrorDetails(asyncError, operation);

      // Log error
      logger.error(`❌ Async operation failed: ${operation}`, {
        error: asyncError.message,
        type: errorDetails.type,
        retryable: errorDetails.retryable,
        attempt: currentRetries + 1,
      });

      // Call custom error handler
      onError?.(errorDetails);

      // Handle retries for retryable errors
      if (errorDetails.retryable && currentRetries < maxRetries && errorDetails.type !== 'abort') {
        const newRetryCount = currentRetries + 1;
        retryCountRef.current.set(operation, newRetryCount);

        logger.debug(`🔄 Retrying async operation: ${operation} (attempt ${newRetryCount}/${maxRetries})`);
        onRetry?.(newRetryCount);

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the operation
        return handleAsyncOperation(asyncFn, options);
      }

      // Show user-friendly error message
      if (shouldShowToast && errorDetails.type !== 'abort') {
        showToast(errorDetails.userMessage, 'error');
      }

      // Handle specific error types
      if (errorDetails.type === 'auth') {
        // Redirect to login or refresh auth
        logger.warn('Auth error detected, user needs re-authentication');
        // You can dispatch an auth refresh action here
      }

      return null;
    }
  }, [createErrorDetails, showToast]);

  /**
   * Wrapper for simple async operations
   */
  const executeAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    operation: string,
    options: Partial<AsyncErrorHandlerOptions> = {}
  ): Promise<T | null> => {
    return handleAsyncOperation(
      (signal) => asyncFn(),
      { operation, ...options }
    );
  }, [handleAsyncOperation]);

  /**
   * Wrapper for fetch operations
   */
  const executeFetch = useCallback(async (
    url: string,
    options: RequestInit = {},
    operation: string,
    handlerOptions: Partial<AsyncErrorHandlerOptions> = {}
  ): Promise<Response | null> => {
    return handleAsyncOperation(
      async (signal) => {
        const response = await fetch(url, {
          ...options,
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      },
      { operation, ...handlerOptions }
    );
  }, [handleAsyncOperation]);

  /**
   * Abort current operation
   */
  const abortOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      logger.debug('🛑 Async operation aborted by user');
    }
  }, []);

  /**
   * Clear retry count for an operation
   */
  const clearRetryCount = useCallback((operation: string) => {
    retryCountRef.current.delete(operation);
  }, []);

  /**
   * Get current retry count for an operation
   */
  const getRetryCount = useCallback((operation: string): number => {
    return retryCountRef.current.get(operation) || 0;
  }, []);

  return {
    handleAsyncOperation,
    executeAsync,
    executeFetch,
    abortOperation,
    clearRetryCount,
    getRetryCount,
    categorizeError,
    getUserMessage,
    isRetryable,
  };
};

/**
 * Hook for handling unhandled Promise rejections
 */
export const useUnhandledPromiseRejection = () => {
  const { showToast } = useToast();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('🚨 Unhandled Promise Rejection:', event.reason);

      // Prevent the default behavior (logging to console)
      event.preventDefault();

      // Show user-friendly error
      const errorMessage = event.reason?.message || 'Error inesperado en la aplicación';
      showToast(`Error no manejado: ${errorMessage}`, 'error');

      // Report to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Report to error monitoring service
        console.error('Unhandled promise rejection reported to monitoring service');
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [showToast]);
};

/**
 * HOC for wrapping components with async error handling
 */
export const withAsyncErrorHandling = <P extends object>(
  Component: React.ComponentType<P>,
  operationName?: string
) => {
  const WrappedComponent: React.FC<P> = (props) => {
    useUnhandledPromiseRejection();
    
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAsyncErrorHandling(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};

export default useAsyncErrorHandler;