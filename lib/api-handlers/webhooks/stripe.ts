import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function toJsonResponse(res: any, status: number, payload: unknown) {
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
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
        // Vercel serverless functions usually provide the body as a buffer or object.
        // Stripe needs the raw body for signature verification.
        // If req.body is already parsed, we might have trouble verifying the signature 
        // unless we can access the raw body.
        // For now, assuming standard Vercel behavior where we might need to handle this carefully.
        // Ideally, we should disable body parsing for this route in vercel.json, 
        // but since we are using a proxy, it might be tricky.

        // However, if we trust the environment (e.g. just checking the secret in the header isn't enough),
        // we MUST verify the signature.

        // In this specific setup with a custom proxy, getting the raw body might be hard if 'express' or 'body-parser' 
        // is already running globally.
        // Let's assume for now we can get the raw body or that the user will configure Vercel to not parse it.

        // If req.body is an object, we can't verify signature easily.
        // We will try to use the body as is if it's a buffer/string.

        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return toJsonResponse(res, 400, { error: 'Missing Stripe signature' });
        }

        // NOTE: In a real Vercel deployment, you often need to consume the stream or use a helper 
        // to get the raw body buffer.
        // Here we assume req.body is the raw buffer (requires config) or we skip verification for dev if needed (NOT RECOMMENDED).

        // For safety, let's try to construct the event.
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

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
