import React from 'react';

const EnvTest: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Variables de Entorno Test</h1>
      <div className="bg-gray-100 p-4 rounded">
        <p><strong>VITE_GOOGLE_MAPS_API_KEY:</strong> {import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'NO CONFIGURADA'}</p>
        <p><strong>DEV:</strong> {import.meta.env.DEV ? 'true' : 'false'}</p>
        <p><strong>PROD:</strong> {import.meta.env.PROD ? 'true' : 'false'}</p>
        <p><strong>MODE:</strong> {import.meta.env.MODE}</p>
      </div>
    </div>
  );
};

export default EnvTest;