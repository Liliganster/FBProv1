// Definiciones de herramientas para el modo agente (agnóstico del proveedor)
// Compatible con OpenRouter, Gemini y otros proveedores que soporten function calling

export const tools = [
  {
    type: 'function',
    function: {
      name: 'address_normalize',
      description: 'Normaliza y limpia una dirección cruda para prepararla para geocodificación',
      parameters: {
        type: 'object',
        properties: {
          raw: {
            type: 'string',
            description: 'La dirección original tal como aparece en el texto'
          }
        },
        required: ['raw']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'geocode_address',
      description: 'Geocodifica una dirección usando Google Maps API. Convierte dirección en coordenadas GPS',
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'La dirección a geocodificar (usa el resultado de address_normalize)'
          }
        },
        required: ['address']
      }
    }
  }
];

// Tipos TypeScript
export type ToolName = 'address_normalize' | 'geocode_address';

export type ToolCall = {
  name: ToolName;
  arguments: Record<string, any>;
};

export type ToolResult = {
  name: ToolName;
  result: any;
};
