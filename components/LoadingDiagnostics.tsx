import React, { useState, useEffect } from 'react';

interface LoadingDiagnosticsProps {
  stage: string;
  details?: string;
}

const LoadingDiagnostics: React.FC<LoadingDiagnosticsProps> = ({ stage, details }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <h1 className="text-2xl font-bold">Cargando Fahrtenbuch Pro</h1>
        <p className="text-lg text-blue-300">{stage}{dots}</p>
        {details && (
          <p className="text-sm text-gray-400 max-w-md">{details}</p>
        )}
        <div className="text-xs text-gray-500 mt-8">
          Si la aplicación no carga, revisa la consola del navegador (F12)
        </div>
      </div>
    </div>
  );
};

export default LoadingDiagnostics;