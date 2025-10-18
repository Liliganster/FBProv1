// Orquestador del agente - Maneja la conversación multi-turno con function calling

import { tools } from './tools.js';
import { executeTool } from './executor.js';
import type { CrewFirstCallsheet } from '../../services/extractor-universal/config/schema.js';
import { isCrewFirstCallsheet } from '../../services/extractor-universal/verify.js';
import { SYSTEM_INSTRUCTION_CREW_FIRST_AGENT } from '../gemini/prompt.js';

const MAX_TURNS = 10; // Máximo de turnos de conversación

type Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

type AgentConfig = {
  apiKey: string;
  model?: string;
  text: string;
};

/**
 * Ejecuta el agente con OpenRouter usando function calling
 */
export async function runAgentWithOpenRouter(config: AgentConfig): Promise<CrewFirstCallsheet> {
  const { apiKey, text, model = 'google/gemini-2.0-flash-exp:free' } = config;

  // Inicializar conversación
  const messages: Message[] = [
    {
      role: 'system',
      content: SYSTEM_INSTRUCTION_CREW_FIRST_AGENT
    },
    {
      role: 'user',
      content: `Analiza esta hoja de rodaje y extrae la información:\n\n${text}`
    }
  ];

  // Bucle de conversación
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`[Agent] Turn ${turn + 1}/${MAX_TURNS}`);

    try {
      // Llamar a OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://fahrtenbuch-pro.app',
          'X-Title': process.env.OPENROUTER_TITLE || 'Fahrtenbuch Pro'
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${error}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response from OpenRouter');
      }

      const assistantMessage = choice.message;

      // Si el modelo quiere llamar a funciones
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[Agent] Model requested ${assistantMessage.tool_calls.length} tool call(s)`);

        // Añadir el mensaje del asistente con las tool_calls al historial
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls
        });

        // Ejecutar cada tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[Agent] Executing tool: ${functionName}`, functionArgs);

          try {
            // Ejecutar la herramienta REAL
            const result = await executeTool(functionName, functionArgs);

            console.log(`[Agent] Tool result:`, result);

            // Añadir el resultado al historial
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: JSON.stringify(result)
            });

          } catch (toolError) {
            console.error(`[Agent] Tool execution error:`, toolError);

            // Devolver error al modelo
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: JSON.stringify({ error: (toolError as Error).message })
            });
          }
        }

        // Continuar al siguiente turno para que el modelo procese los resultados
        continue;
      }

      // Si el modelo devolvió una respuesta final (sin tool_calls)
      const finalContent = assistantMessage.content;

      if (!finalContent) {
        throw new Error('Empty response from model');
      }

      // Intentar parsear como JSON
      try {
        // Limpiar markdown si existe
        let jsonText = finalContent.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(jsonText);

        // Validar que sea CrewFirstCallsheet
        if (isCrewFirstCallsheet(parsed)) {
          console.log('[Agent] Valid CrewFirstCallsheet received');
          return parsed;
        } else {
          console.warn('[Agent] Invalid schema, continuing...');

          // Pedirle al modelo que corrija
          messages.push({
            role: 'assistant',
            content: finalContent
          });
          messages.push({
            role: 'user',
            content: 'El JSON no cumple con el schema CrewFirstCallsheet. Asegúrate de incluir todos los campos requeridos y el formato correcto.'
          });
          continue;
        }

      } catch (parseError) {
        console.error('[Agent] JSON parse error:', parseError);

        // Pedirle al modelo que corrija
        messages.push({
          role: 'assistant',
          content: finalContent
        });
        messages.push({
          role: 'user',
          content: 'La respuesta no es un JSON válido. Por favor devuelve SOLO el objeto JSON sin explicaciones ni markdown.'
        });
        continue;
      }

    } catch (error) {
      console.error(`[Agent] Error in turn ${turn + 1}:`, error);
      throw error;
    }
  }

  throw new Error('Agent exceeded maximum turns without producing valid output');
}
