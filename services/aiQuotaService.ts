import { User as SupabaseUser } from '@supabase/supabase-js';
import { PlanTier, Trip, TripLedgerOperation, TripLedgerEntry, UserProfile, TripLedgerSource } from '../types';
import { databaseService } from './databaseService';

const PLAN_LIMITS: Record<PlanTier, number | null> = {
  free: 20,
  pro: 150,
  enterprise: null, // ilimitado
};

const normalizePlan = (raw?: string | null): PlanTier => {
  const value = (raw || '').toString().trim().toLowerCase();
  if (value.startsWith('pro')) return 'pro';
  if (value.startsWith('enter') || value === 'unlimited') return 'enterprise';
  return 'free';
};

const resolvePlan = (profile?: UserProfile | null, supabaseUser?: SupabaseUser | null): PlanTier => {
  const metaPlan = (supabaseUser?.user_metadata as any)?.plan || (supabaseUser?.app_metadata as any)?.plan;
  const profilePlan = (profile as any)?.plan || (profile as any)?.subscriptionPlan;
  return normalizePlan(metaPlan || profilePlan);
};

const countAiDays = (entries: TripLedgerEntry[]): Set<string> => {
  const aiDays = new Set<string>();
  entries.forEach(entry => {
    if (
      entry.source === TripLedgerSource.AI_AGENT &&
      (entry.operation === TripLedgerOperation.CREATE || entry.operation === TripLedgerOperation.IMPORT_BATCH)
    ) {
      const date = (entry.tripSnapshot as any)?.date;
      if (typeof date === 'string' && date.trim()) {
        aiDays.add(date.trim());
      }
    }
  });
  return aiDays;
};

export interface AiQuotaCheck {
  plan: PlanTier;
  limit: number | null;
  used: number;
  needed: number;
  remaining: number | null;
  allowed: boolean;
}

export const checkAiQuota = async (params: {
  userId: string;
  trips: Omit<Trip, 'id'>[];
  profile?: UserProfile | null;
  supabaseUser?: SupabaseUser | null;
}): Promise<AiQuotaCheck> => {
  const plan = resolvePlan(params.profile, params.supabaseUser);
  const limit = PLAN_LIMITS[plan];

  // Si el plan es ilimitado, permitimos sin consultar.
  if (limit === null) {
    return { plan, limit, used: 0, needed: 0, remaining: null, allowed: true };
  }

  const entries = await databaseService.getAiLedgerEntries(params.userId);
  const usedDays = countAiDays(entries);

  const incomingDays = new Set<string>();
  params.trips.forEach(trip => {
    if (trip.date) {
      incomingDays.add(trip.date);
    }
  });

  let needed = 0;
  incomingDays.forEach(date => {
    if (!usedDays.has(date)) {
      needed += 1;
    }
  });

  const used = usedDays.size;
  const allowed = used + needed <= limit;
  const remaining = Math.max(limit - used, 0);

  return { plan, limit, used, needed, remaining, allowed };
};

export const buildQuotaError = (quota: AiQuotaCheck): string => {
  const remainingText = quota.remaining === 0 ? 'sin cupo restante' : `te quedan ${quota.remaining} día(s)`;
  return `Has alcanzado el límite de IA para tu plan (${quota.limit} días). Actualmente llevas ${quota.used} y ${remainingText}.`;
};
