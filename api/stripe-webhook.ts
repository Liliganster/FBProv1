import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { Buffer } from 'buffer';

// Disable body parsing to verify Stripe signature
export const config = {
    api: {
        bodyParser: false,
    },
};

async function buffer(readable: any) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
        console.error('Missing Stripe or Supabase configuration');
        res.status(500).json({
            error: 'Server Configuration Error',
            details: {
                hasStripeKey: !!stripeSecretKey,
                hasWebhookSecret: !!webhookSecret,
                hasSupabaseUrl: !!supabaseUrl,
                hasServiceKey: !!serviceRoleKey
            }
        });
        return;
    }

    const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-01-27.acacia' as any,
    });

    let event: Stripe.Event;

    try {
        let buf: Buffer;

        // Vercel sometimes parses the body automatically. 
        // We need the raw body for Stripe signature verification.
        if ((req as any).rawBody && Buffer.isBuffer((req as any).rawBody)) {
            // Best case: Vercel provided the raw body as Buffer
            buf = (req as any).rawBody;
        } else if (req.body && Buffer.isBuffer(req.body)) {
            // req.body is already a buffer
            buf = req.body;
        } else if (req.body && typeof req.body === 'string') {
            // req.body is a string
            buf = Buffer.from(req.body, 'utf8');
        } else {
            // Fallback: Try to read from stream if not consumed
            try {
                buf = await buffer(req);
            } catch (e) {
                console.error('Error reading request stream:', e);
            }
        }

        // If we still don't have a buffer (or it's empty) and we have a parsed body object
        if ((!buf || buf.length === 0) && req.body) {
            console.warn('Raw body not available, attempting to reconstruct from parsed body (JSON.stringify).');
            try {
                if (typeof req.body === 'object') {
                    buf = Buffer.from(JSON.stringify(req.body));
                } else {
                    buf = Buffer.from(String(req.body));
                }
            } catch (e) {
                console.error('Failed to stringify body:', e);
            }
        }

        if (!buf || buf.length === 0) {
            res.status(400).json({
                error: 'Webhook Error: No body available',
                details: 'Could not retrieve raw or parsed body.'
            });
            return;
        }

        const sig = req.headers['stripe-signature'];

        if (!sig) {
            console.error('Missing Stripe signature header');
            res.status(400).json({ error: 'Missing Stripe signature' });
            return;
        }

        event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).json({
            error: `Webhook Error: ${err.message}`,
            details: 'Check your STRIPE_WEBHOOK_SECRET or raw body parsing'
        });
        return;
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
                res.status(500).json({ error: 'Failed to update user plan' });
                return;
            }
            console.log(`User ${userId} upgraded to Pro`);
        }
    }

    res.status(200).json({ received: true });
}
