import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Componente de ejemplo que demuestra el patrón responsive correcto
 * MOBILE-FIRST: Empieza con mobile, luego adapta a desktop
 */
export function ResponsiveExample() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
      {/* Header Section - Stack en mobile, inline en desktop */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
            Título Responsive
          </h1>
          <p className="text-sm md:text-base text-gray-400 mt-2">
            Descripción que se adapta al tamaño de pantalla
          </p>
        </div>
        <Button className="w-full md:w-auto">
          Acción Principal
        </Button>
      </div>

      {/* Grid de Cards - 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle>Card {item}</CardTitle>
              <CardDescription>
                Estas cards se adaptan automáticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Contenido responsive que se ajusta al ancho disponible.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section con Sidebar - Stack en mobile, lado a lado en desktop */}
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Main Content */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Contenido Principal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm md:text-base">
                Este contenido ocupa todo el ancho en mobile y 
                comparte espacio con el sidebar en desktop.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80">
          <Card>
            <CardHeader>
              <CardTitle>Sidebar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Aparece debajo en mobile, al lado en desktop.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Buttons Row - Stack en mobile, fila en desktop */}
      <div className="flex flex-col md:flex-row gap-4 mt-6">
        <Button variant="default" className="w-full md:w-auto">
          Primario
        </Button>
        <Button variant="secondary" className="w-full md:w-auto">
          Secundario
        </Button>
        <Button variant="outline" className="w-full md:w-auto">
          Outline
        </Button>
      </div>
    </div>
  );
}

/**
 * PATRONES RESPONSIVE CLAVE:
 * 
 * 1. CONTENEDOR PRINCIPAL:
 *    w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8
 * 
 * 2. FLEXBOX RESPONSIVE:
 *    flex flex-col md:flex-row (stack mobile, fila desktop)
 * 
 * 3. GRID RESPONSIVE:
 *    grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
 * 
 * 4. SPACING RESPONSIVE:
 *    gap-4 md:gap-6 (más espacio en desktop)
 *    p-4 md:p-6 (más padding en desktop)
 * 
 * 5. TEXTO RESPONSIVE:
 *    text-base md:text-lg lg:text-xl
 * 
 * 6. ANCHO RESPONSIVE:
 *    w-full md:w-auto (full en mobile, auto en desktop)
 * 
 * 7. ALTURA MÍNIMA TOUCH:
 *    min-h-[44px] (iOS guidelines para touch targets)
 */
