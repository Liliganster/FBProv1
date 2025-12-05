import { createClient } from '@supabase/supabase-js';
import { logAbuse } from '../../abuse-prevention.js';

function toJsonResponse(res: any, status: number, payload: unknown) {
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return toJsonResponse(res, 401, { error: 'Unauthorized', message: 'Missing Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Missing Supabase configuration');
        return toJsonResponse(res, 500, { error: 'Server Configuration Error' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Verify the user's token and get their ID
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return toJsonResponse(res, 401, { error: 'Unauthorized', message: 'Invalid token' });
        }

        // Check AI usage before deletion
        const { count, error: usageError } = await supabaseAdmin
            .from('trip_ledger')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('source', 'AI_AGENT')
            .in('operation', ['CREATE', 'IMPORT_BATCH']);

        if (!usageError && count !== null && count > 0) {
            // User has used AI, log identifiers for abuse prevention
            const fingerprint = req.body?.fingerprint;
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            // Simple email hash (in production use a proper crypto library)
            // For now we just log the raw email if needed or skip it to avoid PII issues if not hashed
            // We'll rely mostly on IP and Fingerprint

            await logAbuse(supabaseAdmin, {
                ip: Array.isArray(ip) ? ip[0] : ip,
                fingerprint: typeof fingerprint === 'string' ? fingerprint : undefined
            }, {
                email: user.email,
                usage_count: count,
                deleted_at: new Date().toISOString()
            });
        }

        // Delete the user from auth.users
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error('Error deleting user from auth:', deleteError);
            return toJsonResponse(res, 500, { error: 'Failed to delete user account', details: deleteError.message });
        }

        return toJsonResponse(res, 200, { message: 'Account deleted successfully' });

    } catch (error) {
        console.error('Unexpected error in delete-account handler:', error);
        return toJsonResponse(res, 500, {
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
