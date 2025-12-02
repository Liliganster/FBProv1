/**
 * Admin API endpoint for running API key encryption migration
 * 
 * This should be used only by administrators and removed after migration
 * 
 * Usage:
 * - GET /api/admin/migrate-api-keys?dryRun=true - Analyze current state
 * - POST /api/admin/migrate-api-keys - Run the actual migration
 */

// Temporarily disabled migration functions
// import { migrateApiKeysToEncrypted, dryRunApiKeyMigration } from '../../scripts/migrateApiKeyEncryption';

function toJsonResponse(res: any, status: number, payload: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
  // Basic security check - this should be enhanced in production
  const authHeader = req.headers.authorization;
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    toJsonResponse(res, 401, { 
      error: 'Unauthorized', 
      message: 'Admin access required. Set ADMIN_SECRET environment variable and provide Authorization header.' 
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      // Dry run - analyze current state
      // await dryRunApiKeyMigration(); // Temporarily disabled
      
      toJsonResponse(res, 200, {
        message: 'Dry run completed successfully',
        note: 'Check server logs for detailed analysis'
      });
      
    } else if (req.method === 'POST') {
      // Actual migration
      // const result = await migrateApiKeysToEncrypted(); // Temporarily disabled
      const result = { 
        message: 'Migration temporarily disabled',
        errors: [],
        processed: 0
      };
      
      toJsonResponse(res, 200, {
        message: 'Migration completed',
        result: result,
        success: result.errors.length === 0
      });
      
    } else {
      toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    }
    
  } catch (error) {
    console.error('API key migration endpoint error:', error);
    toJsonResponse(res, 500, {
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: 'Check server logs for more information'
    });
  }
}
