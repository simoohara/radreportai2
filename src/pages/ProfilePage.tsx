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
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ marginBottom: 24 }}>Profil</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Informations</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Email</label>
            <p style={{ fontWeight: 500 }}>{user.email}</p>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Membre depuis</label>
            <p style={{ fontWeight: 500 }}>{new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Rapports générés</label>
            <p style={{ fontWeight: 500 }}>{user.generations_used}</p>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Générations restantes</label>
            <p style={{ fontWeight: 500 }}>
              {user.subscription_plan ? '∞ (abonné)' : (user.generations_remaining ?? 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Modifier le nom</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', gap: 12 }}>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Votre nom"
          />
          <button className="btn btn-primary" disabled={saving}>
            {saving ? '...' : 'Enregistrer'}
          </button>
        </form>
      </div>

      {user.referral_code && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Parrainage</h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            Partagez votre code de parrainage. Pour chaque 5 filleuls abonnés, vous gagnez 1 mois gratuit.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" readOnly value={`${window.location.origin}/?ref=${user.referral_code}`} />
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
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 8 }}>
            Points accumulés : {user.referral_points}
          </p>
        </div>
      )}
    </div>
  );
}
