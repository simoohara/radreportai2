import { useAuthStore } from '../stores/authStore';

export function AdminPage() {
  const { user } = useAuthStore();

  if (user?.role !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <h2>Accès interdit</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>
          Cette page est réservée aux administrateurs.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Administration</h2>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Phase 9 — La gestion des feedbacks et les outils d'admin seront implémentés ici.
      </p>
    </div>
  );
}
