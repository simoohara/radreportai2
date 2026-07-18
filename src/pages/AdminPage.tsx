import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import type { Feedback, AdminUser } from '../types';
import { FEEDBACK_TYPE_LABELS, STATUS_LABELS } from '../types';

interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  totalTemplates: number;
  totalGenerations: number;
  feedback: { new: number; in_progress: number; resolved: number };
}

type StatusFilter = 'all' | 'new' | 'in_progress' | 'resolved';

export function AdminPage() {
  const { user } = useAuthStore();
  const toast = useToast();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editPlan, setEditPlan] = useState<string>('');
  const [editExpiry, setEditExpiry] = useState('');

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

  const loadData = async () => {
    try {
      const [s, fb, u] = await Promise.all([
        api.getAdminStats(),
        api.getAdminFeedback(includeArchived),
        api.getAdminUsers(),
      ]);
      setStats(s);
      setFeedbacks(fb);
      setUsers(u);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [includeArchived]);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.updateFeedbackStatus(id, status);
      setFeedbacks((prev) =>
        prev.map((fb) => (fb.id === id ? { ...fb, status: status as Feedback['status'] } : fb))
      );
      toast.success('Statut mis à jour');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleArchive = async (id: number) => {
    try {
      const result = await api.toggleFeedbackArchive(id);
      if (!includeArchived) {
        setFeedbacks((prev) => prev.filter((fb) => fb.id !== id));
      } else {
        setFeedbacks((prev) =>
          prev.map((fb) => (fb.id === id ? { ...fb, is_archived: result.is_archived ? 1 : 0 } : fb))
        );
      }
      toast.success(result.is_archived ? 'Archivé' : 'Désarchivé');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteAdminFeedback(deleteId);
      setFeedbacks((prev) => prev.filter((fb) => fb.id !== deleteId));
      toast.success('Supprimé');
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeleteId(null);
  };

  const startEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setEditPlan(u.subscription_plan ?? '');
    setEditExpiry(u.subscription_expires_at ? u.subscription_expires_at.substring(0, 10) : '');
  };

  const saveUserSubscription = async () => {
    if (!editingUser) return;
    try {
      await api.updateUserSubscription(editingUser.id, {
        subscription_plan: editPlan || null,
        subscription_expires_at: editExpiry || null,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, subscription_plan: editPlan || null, subscription_expires_at: editExpiry || null }
            : u
        )
      );
      toast.success('Abonnement mis à jour');
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.display_name && u.display_name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filtered = feedbacks.filter(
    (fb) => statusFilter === 'all' || fb.status === statusFilter
  );

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Administration</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0 0', fontSize: 15 }}>
            Gérez les utilisateurs, surveillez l'activité et répondez aux retours.
          </p>
        </div>
      </div>

      {/* ── Stats Cards ──────────────────────────────────── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          <StatCard label="Utilisateurs" value={stats.totalUsers} />
          <StatCard label="Abonnés" value={stats.activeSubscribers} accent />
          <StatCard label="Modèles" value={stats.totalTemplates} />
          <StatCard label="Générations" value={stats.totalGenerations} />
        </div>
      )}

      {/* ── Users Section ────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Utilisateurs</h3>
          <input
            className="input"
            style={{ width: 220, padding: '6px 12px', fontSize: 13 }}
            placeholder="Rechercher par email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 40, fontSize: 14 }}>
            Aucun utilisateur trouvé.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--color-border)',
                  opacity: u.deleted_at ? 0.4 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{u.email}</span>
                      {u.display_name && (
                        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>({u.display_name})</span>
                      )}
                      {u.role === 'admin' && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--color-warning)', color: '#1d1d1f', padding: '1px 6px', borderRadius: 100 }}>ADMIN</span>
                      )}
                      {u.deleted_at && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--color-delete)', color: '#fff', padding: '1px 6px', borderRadius: 100 }}>SUPPRIMÉ</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
                      <span>Générations: {u.generations_used} / {u.generations_remaining !== null ? 20 - u.generations_remaining : '∞'}</span>
                      {u.subscription_plan && <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>Forfait {u.subscription_plan}</span>}
                      {!u.subscription_plan && <span>Gratuit</span>}
                      {u.subscription_expires_at && <span>Expire le {new Date(u.subscription_expires_at).toLocaleDateString('fr-FR')}</span>}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
                    onClick={() => startEditUser(u)}
                  >
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Feedback Section ─────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Feedback</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ width: 'auto', padding: '6px 32px 6px 10px', fontSize: 13 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Tous les statuts</option>
              <option value="new">Nouveau</option>
              <option value="in_progress">En cours</option>
              <option value="resolved">Résolu</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Inclure archivés
            </label>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 40, fontSize: 14 }}>
            Aucun feedback trouvé.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((fb) => (
              <div
                key={fb.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--color-border)',
                  opacity: fb.is_archived ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className={`badge badge-${fb.status === 'new' ? 'new' : fb.status === 'in_progress' ? 'in-progress' : 'resolved'}`}>
                        {STATUS_LABELS[fb.status]}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 100 }}>
                        {FEEDBACK_TYPE_LABELS[fb.type]}
                      </span>
                      {fb.is_archived ? (
                        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Archivé</span>
                      ) : null}
                    </div>
                    <h4 style={{ fontSize: 14, marginBottom: 2 }}>{fb.subject}</h4>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>{fb.content}</p>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>
                      {fb.email || 'Utilisateur inconnu'}
                      {fb.display_name ? ` — ${fb.display_name}` : ''}
                      {' · '}
                      {new Date(fb.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    <select
                      className="input"
                      style={{ width: 'auto', padding: '4px 28px 4px 8px', fontSize: 12 }}
                      value={fb.status}
                      onChange={(e) => handleStatusChange(fb.id, e.target.value)}
                    >
                      <option value="new">Nouveau</option>
                      <option value="in_progress">En cours</option>
                      <option value="resolved">Résolu</option>
                    </select>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 8px', fontSize: 13 }}
                      onClick={() => handleToggleArchive(fb.id)}
                      title={fb.is_archived ? 'Désarchiver' : 'Archiver'}
                    >
                      {fb.is_archived ? '📤' : '📥'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 8px', fontSize: 13, color: 'var(--color-delete)' }}
                      onClick={() => setDeleteId(fb.id)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <ConfirmModal
          title="Supprimer ce feedback ?"
          message="Cette action est irréversible."
          confirmText="Supprimer"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem' }}>Modifier l'abonnement</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              {editingUser.email}
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Forfait</label>
                <select
                  className="input"
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                >
                  <option value="">Gratuit</option>
                  <option value="Standard">Standard (29€/mo)</option>
                  <option value="Pro">Pro (49€/mo)</option>
                  <option value="Elite">Elite (99€/mo)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Date d'expiration</label>
                <input
                  type="date"
                  className="input"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(null)}>Annuler</button>
                <button className="btn btn-primary btn-sm" onClick={saveUserSubscription}>Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .admin-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        textAlign: 'center',
        borderColor: accent ? 'var(--color-accent)' : undefined,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ? 'var(--color-accent)' : 'var(--color-text)', lineHeight: 1.2 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
