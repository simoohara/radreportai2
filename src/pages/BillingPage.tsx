import { useState } from 'react';
import { useToast } from '../components/Toast';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

type BillingPeriod = 'monthly' | 'annual';

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: 'standard',
    name: 'Standard',
    monthlyPrice: 29,
    annualPrice: 299,
    description: 'Pour les radiologues isolés ou les débutants en IA. Outils de productivité essentiels.',
    features: [
      "1000 générations/mois",
      "Jusqu'à 25 modèles personnels",
      '1 session simultanée',
      'Modèle vocal IA standard',
      'Support par e-mail',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    annualPrice: 499,
    description: "L'option la plus populaire pour les utilisateurs avancés ou petites équipes. Efficacité et fonctionnalités avancées.",
    features: [
      "2000 générations/mois",
      "Jusqu'à 200 modèles personnels",
      '2 sessions simultanées',
      'Modèle vocal IA Rapide & Précis',
      'Accès anticipé aux nouveautés',
      'Support prioritaire',
    ],
    popular: true,
  },
  {
    id: 'elite',
    name: 'Élite',
    monthlyPrice: 99,
    annualPrice: 999,
    description: 'Solution tout-en-un pour les grands cabinets et services hospitaliers. Conçu pour la collaboration et la scalabilité.',
    features: [
      "Générations illimitées",
      'Modèles personnels illimités',
      '5 sessions simultanées',
      'Modèle vocal IA Rapide & Précis',
      "Gestion d'équipe & modèles partagés",
      'Support prioritaire',
    ],
  },
];

// Extend Window for LemonSqueezy overlay
declare global {
  interface Window {
    LemonSqueezy?: {
      Url: {
        Open: (url: string) => void;
      };
    };
    createLemonSqueezy?: () => void;
  }
}

export function BillingPage() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingManage, setLoadingManage] = useState(false);
  const toast = useToast();
  const { user, checkAuth } = useAuthStore();
  const remainingGenerations = Math.max(0, user?.generations_remaining ?? 0);
  const generationsUsedPercent = Math.min(100, ((20 - remainingGenerations) / 20) * 100);

  const isSubscribed = !!(
    user?.subscription_plan &&
    user?.subscription_expires_at &&
    new Date(user.subscription_expires_at) > new Date()
  );

  const handleSelect = async (plan: Plan) => {
    const planId = `${plan.id}_${period === 'monthly' ? 'monthly' : 'yearly'}`;
    setLoadingPlan(planId);
    try {
      const { url } = await api.createCheckout(planId);

      // Initialize LemonSqueezy overlay if available
      if (window.createLemonSqueezy) {
        window.createLemonSqueezy();
      }

      if (window.LemonSqueezy?.Url?.Open) {
        window.LemonSqueezy.Url.Open(url);
      } else {
        // Fallback: navigate in the same tab to avoid async popup blockers
        window.location.href = url;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du paiement.');
    }
    setLoadingPlan(null);
  };

  const handleManageSubscription = async () => {
    setLoadingManage(true);
    try {
      const { url } = await api.getManageUrl();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || 'Impossible de récupérer le portail de facturation.');
    }
    setLoadingManage(false);
  };

  // Listen for LemonSqueezy overlay close to refresh user data
  // (the subscription might have been created)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkAuth();
    }
  };

  // Attach listener on mount for tab focus
  useState(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Forfaits & Facturation</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0 0', fontSize: 15 }}>
            Choisissez le forfait adapté à vos besoins et gérez votre abonnement.
          </p>
        </div>
      </div>

      {/* ── Current plan ───────────────────────────────── */}
      <section className="card current-plan-card" aria-labelledby="current-plan-title">
        <div>
          <p className="current-plan-eyebrow">Votre abonnement</p>
          <h3 id="current-plan-title">Forfait actuel</h3>
        </div>
        {isSubscribed ? (
          <div className="current-plan-details">
            <span className="current-plan-badge">
              Forfait {user!.subscription_plan!.charAt(0).toUpperCase() + user!.subscription_plan!.slice(1)}
            </span>
            <p>
              {user?.subscription_plan === 'Elite' || user?.generations_remaining === null 
                ? 'Générations illimitées' 
                : `${user?.generations_remaining ?? 0} générations restantes`}
              {user!.subscription_expires_at && ` · Expire le ${new Date(user!.subscription_expires_at).toLocaleDateString('fr-FR')}`}
            </p>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 10 }}
              onClick={handleManageSubscription}
              disabled={loadingManage}
            >
              {loadingManage ? 'Chargement...' : 'Gérer mon abonnement'}
            </button>
          </div>
        ) : (
          <div className="current-plan-details">
            <span className="current-plan-badge current-plan-badge-free">Gratuit</span>
            <p>{remainingGenerations} générations restantes sur 20</p>
            <div className="generation-progress" aria-label={`${remainingGenerations} générations restantes sur 20`}>
              <span style={{ width: `${generationsUsedPercent}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* ── Billing Toggle ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 40 }}>
        <span style={{ fontSize: 14, fontWeight: period === 'monthly' ? 600 : 400, color: period === 'monthly' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
          Mensuel
        </span>
        <button
          onClick={() => setPeriod((p) => (p === 'monthly' ? 'annual' : 'monthly'))}
          aria-label="Changer la période de facturation"
          style={{
            position: 'relative',
            width: 52,
            height: 28,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: period === 'annual' ? 'var(--color-accent)' : 'var(--color-border)',
            transition: 'background var(--transition-fast)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: period === 'annual' ? 27 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left var(--transition-fast)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
        </button>
        <span style={{ fontSize: 14, fontWeight: period === 'annual' ? 600 : 400, color: period === 'annual' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
          Annuel{' '}
          <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 13 }}>
            (Économisez 15%+)
          </span>
        </span>
      </div>

      {/* ── Pricing Cards ──────────────────────────────── */}
      <div className="billing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
        {plans.map((plan) => {
          const planId = `${plan.id}_${period === 'monthly' ? 'monthly' : 'yearly'}`;
          const displayPrice = period === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice / 12);
          const price = period === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
          const isLoading = loadingPlan === planId;
          const isCurrentPlan = isSubscribed && user?.subscription_plan?.toLowerCase() === plan.id.toLowerCase();

          return (
            <div
              key={plan.id}
              className="card"
              style={{
                position: 'relative',
                border: plan.popular ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {plan.popular && (
                <span
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: 16,
                    background: 'var(--color-accent)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 100,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Le plus populaire
                </span>
              )}

              <h3 style={{ marginBottom: 4, fontSize: 18 }}>Forfait {plan.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                {plan.description}
              </p>

              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 32, fontWeight: 700 }}>{displayPrice}€</span>
                <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}> / mois</span>
                {period === 'annual' && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                    {price.toFixed(0)}€ facturés annuellement
                  </div>
                )}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%' }}
                onClick={() => handleSelect(plan)}
                disabled={isLoading || isCurrentPlan}
              >
                {isCurrentPlan ? 'Forfait actuel' : isLoading ? 'Chargement...' : `Choisir ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Responsive ─────────────────────────────────── */}
      <style>{`
        .current-plan-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 32px;
          padding: 20px 24px;
        }
        .current-plan-eyebrow {
          margin-bottom: 4px;
          color: var(--color-text-secondary);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .current-plan-card h3 { margin: 0; font-size: 18px; }
        .current-plan-details { min-width: 250px; }
        .current-plan-badge {
          display: inline-block;
          margin-bottom: 7px;
          padding: 4px 10px;
          border-radius: 100px;
          background: var(--color-accent);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
        }
        .current-plan-badge-free {
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text);
        }
        .current-plan-details p {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 13px;
        }
        .generation-progress {
          height: 6px;
          margin-top: 10px;
          overflow: hidden;
          border-radius: 3px;
          background: var(--color-surface);
        }
        .generation-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--color-accent);
          transition: width var(--transition-normal);
        }
        @media (max-width: 768px) {
          .billing-grid { grid-template-columns: 1fr !important; }
          .current-plan-card { align-items: flex-start; flex-direction: column; gap: 14px; }
          .current-plan-details { min-width: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
