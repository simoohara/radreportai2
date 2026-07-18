import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.updateProfile(displayName);
      updateUser({ display_name: result.display_name });
      toast.success('Nom mis à jour');
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Profil</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0 0', fontSize: 15 }}>
            Gérez vos informations personnelles et votre parrainage.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card: Informations */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--color-accent)' }}>📝</span> Informations
            </h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Email</label>
                <p style={{ fontWeight: 500, margin: 0 }}>{user.email}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Membre depuis</label>
                <p style={{ fontWeight: 500, margin: 0 }}>{new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Rapports générés</label>
                  <p style={{ fontWeight: 500, margin: 0 }}>{user.generations_used}</p>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Générations restantes</label>
                  <p style={{ fontWeight: 500, margin: 0, color: 'var(--color-accent)' }}>
                    {user.subscription_plan ? '∞ (abonné)' : (user.generations_remaining ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card: Modifier le nom */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--color-accent)' }}>✏️</span> Modifier le nom
            </h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Nom d'affichage</label>
                <input
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Votre nom complet"
                  style={{ width: '100%' }}
                />
              </div>
              <button className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>

          {/* Card: Parrainage */}
          {user.referral_code && (
            <div className="card" style={{ padding: 24, background: 'var(--color-surface-hover)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--color-accent)' }}>🎁</span> Parrainage
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                Partagez votre lien. Pour chaque 5 confrères abonnés, vous gagnez 1 mois gratuit !
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input 
                  className="input" 
                  readOnly 
                  value={`${window.location.origin}/?ref=${user.referral_code}`} 
                  style={{ flex: 1, fontSize: 13, background: 'var(--color-surface)' }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?ref=${user.referral_code}`);
                    toast.success('Lien copié !');
                  }}
                >
                  Copier
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Points accumulés</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent)' }}>{user.referral_points} ⭐️</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
