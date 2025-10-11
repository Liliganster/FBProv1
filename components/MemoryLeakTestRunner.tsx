/**
 * Memory Leak Prevention Examples and Tests
 * 
 * Demonstrates how to use the memory leak prevention system
 * and provides tests to verify it's working correctly.
 */

import React, { useState, useEffect } from 'react';
import { withMemoryLeakPrevention, useMemoryLeakPreventionWithMonitoring } from './withMemoryLeakPrevention';
import { memoryLeakPrevention } from './withMemoryLeakPrevention';

/**
 * Example 1: Component with potential memory leaks (BAD)
 */
const LeakyComponent: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // BAD: Timer without cleanup
    setTimeout(() => {
      console.log('This timer will leak if component unmounts before 5 seconds');
    }, 5000);

    // BAD: Interval without cleanup
    const interval = setInterval(() => {
      console.log('This interval will leak memory');
    }, 1000);
    // Missing: return () => clearInterval(interval);

    // BAD: Event listener without cleanup
    const handleResize = () => console.log('Window resized');
    window.addEventListener('resize', handleResize);
    // Missing: return () => window.removeEventListener('resize', handleResize);

    // BAD: Fetch without AbortController
    fetch('/api/data')
      .then(response => response.json())
      .then(data => setData(data))
      .catch(error => console.error('Fetch error:', error));
    // This will continue even if component unmounts
  }, []);

  return <div>Leaky Component: {data ? 'Data loaded' : 'Loading...'}</div>;
};

/**
 * Example 2: Component with proper cleanup (GOOD)
 */
const CleanComponent: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    // GOOD: Timer with cleanup
    const timer = setTimeout(() => {
      if (mounted) {
        console.log('Timer executed safely');
      }
    }, 5000);

    // GOOD: Interval with cleanup
    const interval = setInterval(() => {
      if (mounted) {
        console.log('Interval tick');
      }
    }, 1000);

    // GOOD: Event listener with cleanup
    const handleResize = () => {
      if (mounted) {
        console.log('Window resized');
      }
    };
    window.addEventListener('resize', handleResize);

    // GOOD: Fetch with AbortController
    fetch('/api/data', { signal: controller.signal })
      .then(response => response.json())
      .then(data => {
        if (mounted) {
          setData(data);
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError' && mounted) {
          console.error('Fetch error:', error);
        }
      });

    // GOOD: Proper cleanup
    return () => {
      mounted = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      controller.abort();
    };
  }, []);

  return <div>Clean Component: {data ? 'Data loaded' : 'Loading...'}</div>;
};

/**
 * Example 3: Component using memory leak prevention hooks (BEST)
 */
const AutoCleanComponent: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const {
    createController,
    createTrackedTimeout,
    createTrackedInterval,
    addTrackedEventListener,
    createFetchController
  } = useMemoryLeakPreventionWithMonitoring('AutoCleanComponent');

  useEffect(() => {
    // BEST: Auto-tracked timer
    createTrackedTimeout(() => {
      console.log('Auto-tracked timer executed');
    }, 5000);

    // BEST: Auto-tracked interval
    createTrackedInterval(() => {
      console.log('Auto-tracked interval tick');
    }, 1000);

    // BEST: Auto-tracked event listener
    const handleResize = () => console.log('Auto-tracked resize');
    addTrackedEventListener(window, 'resize', handleResize);

    // BEST: Auto-managed fetch
    const { fetch: managedFetch } = createFetchController('fetchData');
    managedFetch('/api/data')
      .then(response => response.json())
      .then(data => setData(data))
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Fetch error:', error);
        }
      });

    // No cleanup needed - all handled automatically!
  }, [createTrackedTimeout, createTrackedInterval, addTrackedEventListener, createFetchController]);

  return <div>Auto-clean Component: {data ? 'Data loaded' : 'Loading...'}</div>;
};

/**
 * Example 4: Component using HOC (ALTERNATIVE BEST)
 */
const HOCComponent = withMemoryLeakPrevention<{}>(({ 
  createController, 
  createFetchController, 
  addCleanup 
}) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Using HOC-provided functions
    const timer = setTimeout(() => {
      console.log('HOC-managed timer');
    }, 3000);

    // Register cleanup manually
    addCleanup(() => clearTimeout(timer));

    // Use managed fetch
    const { fetch: managedFetch } = createFetchController('hocFetch');
    managedFetch('/api/data')
      .then(response => response.json())
      .then(data => setData(data));

  }, [createController, createFetchController, addCleanup]);

  return <div>HOC Component: {data ? 'Data loaded' : 'Loading...'}</div>;
}, 'HOCComponent');

/**
 * Test component that creates and destroys components to test memory leaks
 */
export const MemoryLeakTestRunner: React.FC = () => {
  const [showLeaky, setShowLeaky] = useState(false);
  const [showClean, setShowClean] = useState(false);
  const [showAutoClean, setShowAutoClean] = useState(false);
  const [showHOC, setShowHOC] = useState(false);
  const [status, setStatus] = useState<any>({});

  useEffect(() => {
    // Start monitoring
    memoryLeakPrevention.startGlobalMonitoring();

    // Update status periodically
    const interval = setInterval(() => {
      setStatus(memoryLeakPrevention.getStatus());
    }, 2000);

    return () => {
      clearInterval(interval);
      memoryLeakPrevention.stopGlobalMonitoring();
    };
  }, []);

  const runLeakTest = async (componentType: string) => {
    console.log(`🧪 Testing ${componentType} component for memory leaks...`);
    
    // Show component for 2 seconds, then hide it
    switch (componentType) {
      case 'leaky':
        setShowLeaky(true);
        setTimeout(() => setShowLeaky(false), 2000);
        break;
      case 'clean':
        setShowClean(true);
        setTimeout(() => setShowClean(false), 2000);
        break;
      case 'autoClean':
        setShowAutoClean(true);
        setTimeout(() => setShowAutoClean(false), 2000);
        break;
      case 'hoc':
        setShowHOC(true);
        setTimeout(() => setShowHOC(false), 2000);
        break;
    }
    
    // Check for leaks after unmounting
    setTimeout(() => {
      const newStatus = memoryLeakPrevention.getStatus();
      console.log(`📊 Status after ${componentType} test:`, newStatus);
    }, 3000);
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Memory Leak Prevention Test Suite</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="font-semibold">Test Components:</h3>
          <button 
            onClick={() => runLeakTest('leaky')}
            className="block w-full p-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Test Leaky Component (BAD)
          </button>
          <button 
            onClick={() => runLeakTest('clean')}
            className="block w-full p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Test Manual Clean Component (GOOD)
          </button>
          <button 
            onClick={() => runLeakTest('autoClean')}
            className="block w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test Auto-clean Component (BEST)
          </button>
          <button 
            onClick={() => runLeakTest('hoc')}
            className="block w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test HOC Component (BEST)
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Memory Status:</h3>
          <div className="p-3 bg-gray-100 rounded text-sm">
            <div>Monitoring: {status.isMonitoring ? '🟢 Active' : '🔴 Inactive'}</div>
            <div>Components: {status.components || 0}</div>
            <div>Timers: {status.timers || 0}</div>
            <div>Intervals: {status.intervals || 0}</div>
            {status.memory && (
              <div>Memory: {Math.round(status.memory.usedJSHeapSize / 1024 / 1024)}MB</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <h3 className="font-semibold">Active Test Components:</h3>
        {showLeaky && <LeakyComponent />}
        {showClean && <CleanComponent />}
        {showAutoClean && <AutoCleanComponent />}
        {showHOC && <HOCComponent />}
        
        {!showLeaky && !showClean && !showAutoClean && !showHOC && (
          <div className="text-gray-500 italic">No test components active</div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold text-blue-800 mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Open browser DevTools (F12) and go to Console</li>
          <li>Click each test button to mount/unmount components</li>
          <li>Watch console for memory leak warnings and status updates</li>
          <li>Check Memory tab in DevTools for actual memory usage</li>
          <li>The "BAD" component should show leak warnings in console</li>
          <li>The "GOOD" and "BEST" components should clean up properly</li>
        </ol>
      </div>
    </div>
  );
};

export default MemoryLeakTestRunner;