import { SupabaseClient } from '@supabase/supabase-js';

export interface AbuseIdentifiers {
    ip?: string;
    fingerprint?: string;
    emailHash?: string;
}

/**
 * Log identifiers of a user who is deleting their account after using resources.
 */
export async function logAbuse(
    supabaseAdmin: SupabaseClient,
    identifiers: AbuseIdentifiers,
    metadata: any = {}
): Promise<void> {
    const entries = [];

    if (identifiers.ip) {
        entries.push({
            identifier_hash: identifiers.ip, // In a real app, you might hash this
            identifier_type: 'ip',
            banned: true,
            metadata
        });
    }

    if (identifiers.fingerprint) {
        entries.push({
            identifier_hash: identifiers.fingerprint,
            identifier_type: 'fingerprint',
            banned: true,
            metadata
        });
    }

    if (identifiers.emailHash) {
        entries.push({
            identifier_hash: identifiers.emailHash,
            identifier_type: 'email_hash',
            banned: true,
            metadata
        });
    }

    if (entries.length === 0) return;

    const { error } = await supabaseAdmin
        .from('abuse_prevention_log')
        .insert(entries);

    if (error) {
        console.error('Failed to log abuse identifiers:', error);
    }
}

/**
 * Check if any of the provided identifiers are banned.
 */
export async function checkAbuse(
    supabaseAdmin: SupabaseClient,
    identifiers: AbuseIdentifiers
): Promise<boolean> {
    const hashesToCheck = [
        identifiers.ip,
        identifiers.fingerprint,
        identifiers.emailHash
    ].filter(Boolean) as string[];

    if (hashesToCheck.length === 0) return false;

    const { data, error } = await supabaseAdmin
        .from('abuse_prevention_log')
        .select('id')
        .eq('banned', true)
        .in('identifier_hash', hashesToCheck)
        .limit(1);

    if (error) {
        console.error('Failed to check abuse status:', error);
        // Fail open (allow access) on DB error to avoid blocking legit users if DB is down
        return false;
    }

    return (data && data.length > 0);
}
