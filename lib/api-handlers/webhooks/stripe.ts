import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import Stripe from 'stripe';

function toJsonResponse(res: any, status: number, payload: unknown) {
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

async function getRawBody(req: any): Promise<Buffer | null> {
    // Prefer any raw buffer already provided by the platform
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
    if (req.body && Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');

    if (req.body && typeof req.body === 'object') {
        // Body was parsed; re-stringify so Stripe gets a string/Buffer instead of an object
        try {
            return Buffer.from(JSON.stringify(req.body));
        } catch (e) {
            console.warn('[stripe webhook] Failed to stringify parsed body:', e);
        }
    }

    // Fallback: try to read the stream if still available
    try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        if (chunks.length) return Buffer.concat(chunks);
    } catch (err) {
        console.error('[stripe webhook] Error reading request stream:', err);
    }

    return null;
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return toJsonResponse(res, 405, { error: 'Method Not Allowed' });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
        console.error('Missing Stripe or Supabase configuration');
        return toJsonResponse(res, 500, { error: 'Server Configuration Error' });
    }

    const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-01-27.acacia' as any,
    });

    let event: Stripe.Event;

    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return toJsonResponse(res, 400, { error: 'Missing Stripe signature' });
        }

        const rawBody = await getRawBody(req);
        if (!rawBody || rawBody.length === 0) {
            console.error('[stripe webhook] Empty or unavailable raw body');
            return toJsonResponse(res, 400, { error: 'Webhook Error: No request body available for signature verification' });
        }

        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return toJsonResponse(res, 400, { error: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;

        if (userId) {
            const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });

            // Update user profile to Pro
            const { error } = await supabaseAdmin
                .from('user_profiles')
                .update({ plan: 'pro', subscription_status: 'active' })
                .eq('id', userId);

            if (error) {
                console.error('Error updating user plan:', error);
                return toJsonResponse(res, 500, { error: 'Failed to update user plan' });
            }
            console.log(`User ${userId} upgraded to Pro`);
        }
    }

    return toJsonResponse(res, 200, { received: true });
}
