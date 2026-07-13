import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

export function SettingsPage() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      await logout();
      navigate('/');
      toast.success('Compte supprimé');
    } catch (err: any) {
      toast.error(err.message);
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ marginBottom: 24 }}>Paramètres</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Zone dangereuse</h3>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          La suppression de votre compte est irréversible. Tous vos modèles personnalisés seront supprimés.
        </p>
        <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
          Supprimer mon compte
        </button>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer votre compte ?"
          message="Cette action est irréversible. Toutes vos données seront supprimées."
          confirmText="Supprimer"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
