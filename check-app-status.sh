#!/bin/bash

echo "==================================="
echo "Fahrtenbuch Pro - Status Check"
echo "==================================="
echo ""

echo "1. Verificando archivos críticos..."
echo "-----------------------------------"

FILES=(
  "services/googleCalendarService.ts"
  "services/geminiService.ts"
  "services/googleMapsService.ts"
  "lib/api-handlers/google/maps/directions.ts"
  "lib/api-handlers/google/calendar/events.ts"
  "components/CalendarView.tsx"
  "components/TripEditorModal.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    size=$(ls -lh "$file" | awk '{print $5}')
    if [ $lines -gt 0 ]; then
      echo "✅ $file ($lines líneas, $size)"
    else
      echo "❌ $file (VACÍO)"
    fi
  else
    echo "❌ $file (NO EXISTE)"
  fi
done

echo ""
echo "2. Verificando compilación TypeScript..."
echo "-----------------------------------"
npm run lint 2>&1 | tail -5
if [ $? -eq 0 ]; then
  echo "✅ Sin errores de TypeScript"
else
  echo "❌ Hay errores de TypeScript"
fi

echo ""
echo "3. Verificando variables de entorno..."
echo "-----------------------------------"
if [ -f ".env" ] || [ -f ".env.local" ]; then
  echo "✅ Archivo .env encontrado"
  
  # Check critical env vars (without showing values)
  ENV_FILE=".env.local"
  [ ! -f "$ENV_FILE" ] && ENV_FILE=".env"
  
  if [ -f "$ENV_FILE" ]; then
    grep -q "VITE_SUPABASE_URL" "$ENV_FILE" && echo "  ✅ VITE_SUPABASE_URL configurada" || echo "  ❌ VITE_SUPABASE_URL falta"
    grep -q "VITE_SUPABASE_ANON_KEY" "$ENV_FILE" && echo "  ✅ VITE_SUPABASE_ANON_KEY configurada" || echo "  ❌ VITE_SUPABASE_ANON_KEY falta"
    grep -q "VITE_GOOGLE_MAPS_API_KEY" "$ENV_FILE" && echo "  ✅ VITE_GOOGLE_MAPS_API_KEY configurada" || echo "  ⚠️  VITE_GOOGLE_MAPS_API_KEY falta (opcional en dev)"
  fi
else
  echo "⚠️  No se encontró archivo .env o .env.local"
  echo "   Copia .env.example a .env.local y configura tus API keys"
fi

echo ""
echo "4. Verificando dependencias..."
echo "-----------------------------------"
if [ -d "node_modules" ]; then
  echo "✅ node_modules existe"
  
  # Check critical packages
  [ -d "node_modules/react" ] && echo "  ✅ react instalado" || echo "  ❌ react NO instalado"
  [ -d "node_modules/@supabase/supabase-js" ] && echo "  ✅ @supabase/supabase-js instalado" || echo "  ❌ @supabase/supabase-js NO instalado"
  [ -d "node_modules/@google/genai" ] && echo "  ✅ @google/genai instalado" || echo "  ❌ @google/genai NO instalado"
else
  echo "❌ node_modules NO existe"
  echo "   Ejecuta: npm install"
fi

echo ""
echo "5. Intentando build..."
echo "-----------------------------------"
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Build exitoso"
  
  if [ -d "dist" ]; then
    total_size=$(du -sh dist 2>/dev/null | awk '{print $1}')
    echo "  📦 Tamaño del build: $total_size"
  fi
else
  echo "❌ Build falló"
  echo "   Ejecuta 'npm run build' para ver los errores"
fi

echo ""
echo "==================================="
echo "Resumen"
echo "==================================="
echo ""

# Count checks
total_checks=0
passed_checks=0

# Check if files exist
for file in "${FILES[@]}"; do
  total_checks=$((total_checks + 1))
  [ -f "$file" ] && [ $(wc -l < "$file") -gt 0 ] && passed_checks=$((passed_checks + 1))
done

# Check TypeScript
total_checks=$((total_checks + 1))
npm run lint > /dev/null 2>&1 && passed_checks=$((passed_checks + 1))

# Check node_modules
total_checks=$((total_checks + 1))
[ -d "node_modules" ] && passed_checks=$((passed_checks + 1))

# Check build
total_checks=$((total_checks + 1))
[ -d "dist" ] && passed_checks=$((passed_checks + 1))

echo "Verificaciones: $passed_checks/$total_checks pasadas"
echo ""

if [ $passed_checks -eq $total_checks ]; then
  echo "🎉 Todo parece estar bien configurado"
  echo ""
  echo "Si aún tienes problemas:"
  echo "1. Abre la app en el navegador (npm run dev)"
  echo "2. Presiona F12 para abrir DevTools"
  echo "3. Ve a la pestaña Console"
  echo "4. Copia cualquier error en rojo que veas"
  echo "5. Comparte esos errores para ayudarte mejor"
else
  echo "⚠️  Hay algunos problemas que necesitan atención"
  echo ""
  echo "Ejecuta los comandos sugeridos arriba para resolver los problemas"
fi

echo ""
