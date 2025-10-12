import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Sends a JSON response with a specific status code.
 * @param res The Vercel response object.
 * @param status The HTTP status code.
 * @param payload The JSON payload to send.
 */
export function toJsonResponse(res: VercelResponse, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

/**
 * Reads and parses the JSON body from a request.
 * Handles cases where the body is already parsed by Vercel.
 * @param req The Vercel request object.
 * @returns A promise that resolves to the parsed JSON body.
 */
export async function readJsonBody<T = any>(req: VercelRequest): Promise<T> {
  if (req.body) {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString('utf8')));
    req.on('end', () => {
      if (!data.trim()) return resolve({} as T);
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}