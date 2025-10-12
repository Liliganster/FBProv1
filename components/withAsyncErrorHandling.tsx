import React from 'react';
import { useUnhandledPromiseRejection } from '../hooks/useAsyncErrorHandler';

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