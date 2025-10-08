export const SYSTEM_INSTRUCTION_AGENT = `Eres un experto en logística de cine. Tu objetivo es llenar un JSON objetivo con la fecha del día de rodaje (YYYY-MM-DD), el nombre del proyecto y una lista ordenada de ubicaciones relevantes para transporte. Usa herramientas cuando necesites normalizar o geocodificar direcciones. Devuelve el JSON final solo cuando tengas toda la información.`;

export function buildDirectPrompt(text: string) {
  return `Analiza el siguiente contenido (callsheet/pdf/csv/texto) y devuelve SOLO un JSON con exactamente estas claves:\n\n{\n  "date": "YYYY-MM-DD",\n  "projectName": "string",\n  "locations": ["string", "string", ...]\n}\n\nReglas:\n- JSON válido sin explicaciones.\n- Si hay varias fechas, elige la principal del día de rodaje.\n- Si aparecen productora y título, devuelve el título del proyecto.\n- Ubicaciones legibles (direcciones o nombres) y deduplicadas en orden.\n\nContenido:\n\n${text}`;
}

