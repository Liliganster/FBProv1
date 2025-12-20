import React from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Este componente asegura que TODAS tus páginas tengan los mismos márgenes
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col">
      {/* Navbar iría aquí */}
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer iría aquí */}
    </div>
  );
};

export default AppLayout;
