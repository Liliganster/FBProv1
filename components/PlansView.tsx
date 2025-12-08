import React from 'react';
import { SparklesIcon, CheckIcon, UploadCloudIcon } from './Icons';
import { PersonalizationSettings, View } from '../types';
import { Button } from './Button';
import { useAuth } from '../hooks/useAuth';

interface PlansViewProps {
  setCurrentView: (view: View) => void;
  personalization: PersonalizationSettings;
  theme: 'light' | 'dark';
}

const proCheckoutUrl = import.meta.env.VITE_STRIPE_CHECKOUT_PRO;

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '0€',
    badge: '20 solicitudes',
    features: [
      '20 días de itinerarios con IA',
      'CSV/Excel ilimitado (sin IA)',
      'Proyectos y viajes ilimitados',
    ],
    cta: 'Seguir con Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '11.99€/mes',
    badge: '150 solicitudes',
    highlight: true,
    features: [
      '150 días de itinerarios con IA',
      'CSV/Excel ilimitado (sin IA)',
      'Prioridad en mejoras y soporte',
    ],
    cta: 'Elegir Pro',
  },
];

const PlansView: React.FC<PlansViewProps> = ({ setCurrentView }) => {
  const { user, profile } = useAuth();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-brand-primary/80 font-semibold">Planes</p>
          <h1 className="text-3xl font-bold text-white mt-2">Elige tu modalidad</h1>
          <p className="text-on-surface-secondary mt-2">Comparte IA limitada o ilimitada según tu equipo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5 p-6 shadow-lg relative overflow-hidden ${plan.highlight ? 'ring-2 ring-brand-primary/70 shadow-brand-primary/30' : ''
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-brand-primary" />
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              </div>
              <span className="text-xs font-semibold text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full border border-brand-primary/30">
                {plan.badge}
              </span>
            </div>
            <p className="text-3xl font-bold text-white mt-4">{plan.price}</p>
            <ul className="mt-4 space-y-2 text-sm text-on-surface-secondary">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-brand-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button
                variant={plan.highlight ? 'primary' : 'secondary'}
                disabled={profile?.plan === plan.id}
                onClick={() => {
                  if (profile?.plan === plan.id) return;

                  if (plan.id === 'pro' && proCheckoutUrl) {
                    const checkoutUrl = new URL(proCheckoutUrl);
                    if (user?.id) {
                      checkoutUrl.searchParams.set('client_reference_id', user.id);
                      if (user.email) {
                        checkoutUrl.searchParams.set('prefilled_email', user.email);
                      }
                    }
                    window.open(checkoutUrl.toString(), '_blank');
                    return;
                  }
                  setCurrentView('settings');
                }}
                className="w-full"
              >
                {profile?.plan === plan.id ? 'Plan Actual' : plan.cta}
              </Button>
              <p className="text-xs text-on-surface-secondary mt-2 flex items-center gap-1">
                <UploadCloudIcon className="w-4 h-4" />
                CSV/Excel ilimitado en todos los planes.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlansView;
