/**
 * Production-safe logger utility
 * Only logs in development mode, suppresses logs in production
 */

const noop = () => {};

const resolveEnv = () => {
  const hasImportMeta = typeof import.meta !== 'undefined' && (import.meta as any)?.env;
  const envFromImportMeta = hasImportMeta ? (import.meta as any).env : {};
  const isProdByImportMeta = Boolean(envFromImportMeta?.PROD);
  const verboseByImportMeta = envFromImportMeta?.VITE_VERBOSE_LOGS === 'true';

  const isProdByProcess = typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : false;
  const verboseByProcess = typeof process !== 'undefined' ? process.env.VERBOSE_LOGS === 'true' : false;

  const isProd = isProdByImportMeta || isProdByProcess;
  const allowVerbose = verboseByImportMeta || verboseByProcess;

  return { isProd, allowVerbose };
};

const { isProd, allowVerbose } = resolveEnv();
const isDevelopment = !isProd;
const suppressNonCriticalLogs = isProd && !allowVerbose;

const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error,
};

// Silence noisy logs in production, but keep warnings/errors
if (suppressNonCriticalLogs) {
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

export const logger = {
  log: (...args: any[]) => {
    if (!suppressNonCriticalLogs) {
      originalConsole.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    originalConsole.warn(...args);
  },
  
  error: (...args: any[]) => {
    originalConsole.error(...args);
  },
  
  debug: (...args: any[]) => {
    if (!suppressNonCriticalLogs) {
      originalConsole.debug(...args);
    }
  }
};

export const loggingConfig = {
  isProd,
  allowVerbose,
  suppressNonCriticalLogs,
};

export default logger;

