import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

export function SettingsPage() {
  const { user, logout, checkAuth } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const [customKeywords, setCustomKeywords] = useState('');
  const [keywordsSaving, setKeywordsSaving] = useState(false);
  const [keywordsDirty, setKeywordsDirty] = useState(false);

  const [dictationMode, setDictationMode] = useState<'push' | 'toggle'>(() => {
    return (localStorage.getItem('dictationMode') as 'push' | 'toggle') || 'toggle';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [autoSave, setAutoSave] = useState(() => {
    return localStorage.getItem('radreportai-autosave') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('dictationMode', dictationMode);
  }, [dictationMode]);

  // Load user's custom keywords on mount
  useEffect(() => {
    if (user?.custom_keywords) {
      setCustomKeywords(user.custom_keywords);
    }
  }, [user?.custom_keywords]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const handleSaveKeywords = async () => {
    setKeywordsSaving(true);
    try {
      const value = customKeywords.trim() || null;
      await api.updateKeywords(value);
      await checkAuth(); // refresh user data in store
      setKeywordsDirty(false);
      toast.success('Termes sauvegardés');
    } catch (err: any) {
      toast.error(err.message);
    }
    setKeywordsSaving(false);
  };

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
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Paramètres</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0 0', fontSize: 15 }}>
            Gérez vos préférences, votre compte et votre forfait.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: 24 }}>
        {/* COL 1: PREFERENCES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* PREFERENCES CARD */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--color-accent)' }}>⚙️</span> Préférences de travail
            </h3>

            {/* Theme */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Thème</h4>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                  {theme === 'dark' ? 'Mode sombre activé' : 'Mode clair activé'}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={toggleTheme}
                title="Changer de thème"
                style={{ borderRadius: 100, padding: '8px 16px' }}
              >
                <span aria-hidden="true" style={{ marginRight: 6 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
                {theme === 'dark' ? 'Clair' : 'Sombre'}
              </button>
            </div>

            {/* Dictation Mode */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Mode d'enregistrement</h4>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                    Comportement du bouton micro
                  </p>
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    style={{ width: 180, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    {dictationMode === 'push' ? 'Maintenir' : 'Cliquer'}
                    <span style={{ fontSize: '0.8em', opacity: 0.5 }}>▼</span>
                  </button>
                  
                  {isDropdownOpen && (
                    <>
                      <div 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }}
                        onClick={() => setIsDropdownOpen(false)}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 180,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        zIndex: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column'
                      }}>
                        <button
                          onClick={() => { setDictationMode('push'); setIsDropdownOpen(false); }}
                          style={{
                            padding: '12px 16px', textAlign: 'left',
                            background: dictationMode === 'push' ? 'var(--color-accent)' : 'transparent',
                            color: dictationMode === 'push' ? '#fff' : 'var(--color-text)',
                            border: 'none', cursor: 'pointer', fontSize: 13,
                            fontWeight: dictationMode === 'push' ? 600 : 400
                          }}
                        >
                          Maintenir (Push-to-talk)
                        </button>
                        <button
                          onClick={() => { setDictationMode('toggle'); setIsDropdownOpen(false); }}
                          style={{
                            padding: '12px 16px', textAlign: 'left',
                            background: dictationMode === 'toggle' ? 'var(--color-accent)' : 'transparent',
                            color: dictationMode === 'toggle' ? '#fff' : 'var(--color-text)',
                            border: 'none', cursor: 'pointer', fontSize: 13,
                            fontWeight: dictationMode === 'toggle' ? 600 : 400
                          }}
                        >
                          Cliquer (Activer)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Keywords */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px 0' }}>Mes termes difficiles</h4>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
                Termes médicaux complexes envoyés à l'IA lors de la transcription.
              </p>
              <textarea
                className="input"
                rows={3}
                placeholder="ex: spondylolisthésis, chondrocalcinose..."
                value={customKeywords}
                onChange={(e) => { setCustomKeywords(e.target.value); setKeywordsDirty(true); }}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveKeywords}
                  disabled={keywordsSaving || !keywordsDirty}
                >
                  {keywordsSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          </div>
          
          {/* PRIVACY CARD */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--color-accent)' }}>🔒</span> Confidentialité
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ paddingRight: 16 }}>
                <h4 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: 'var(--color-text)' }}>
                  Sauvegarde Automatique
                </h4>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                  Enregistre votre brouillon en cours. Désactivez cette option sur les ordinateurs partagés pour protéger les données patients.
                </p>
              </div>
              <button
                onClick={() => {
                  const nextVal = !autoSave;
                  setAutoSave(nextVal);
                  localStorage.setItem('radreportai-autosave', nextVal ? 'true' : 'false');
                  if (!nextVal) {
                    localStorage.removeItem('radreportai-workspace-storage');
                  }
                  toast.success(nextVal ? 'Sauvegarde automatique activée' : 'Sauvegarde automatique désactivée');
                }}
                aria-label="Toggle auto-save"
                style={{
                  position: 'relative',
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  background: autoSave ? 'var(--color-accent)' : 'var(--color-border)',
                  transition: 'background var(--transition-fast)',
                  flexShrink: 0,
                  marginTop: 4
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: autoSave ? 27 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left var(--transition-fast)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                />
              </button>
            </div>
          </div>

        </div>

        {/* COL 2: ACCOUNT & SUBSCRIPTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ACCOUNT CARD */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--color-accent)' }}>👤</span> Mon Profil
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: 'var(--color-surface-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--color-text)'
              }}>
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{user?.email}</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Utilisateur RadReport AI</p>
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Abonnement</h4>
                {user?.subscription_plan ? (
                  <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--color-accent)', color: '#fff', padding: '4px 10px', borderRadius: 100 }}>
                    {user.subscription_plan.toUpperCase()}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--color-surface-hover)', color: 'var(--color-text)', padding: '4px 10px', borderRadius: 100, border: '1px solid var(--color-border)' }}>
                    ESSAI GRATUIT
                  </span>
                )}
              </div>
              
              <div style={{ marginTop: 16 }}>
                {user?.subscription_plan === 'Elite' || user?.generations_remaining === null ? (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>
                      Générations illimitées.
                    </p>
                    {user?.subscription_expires_at && (
                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                        Valide jusqu'au {new Date(user.subscription_expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Générations restantes</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {user?.generations_remaining ?? 0} / {user?.subscription_plan === 'Pro' ? 2000 : user?.subscription_plan === 'Standard' ? 1000 : 20}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface)', overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{
                        height: '100%', 
                        width: `${(((user?.subscription_plan === 'Pro' ? 2000 : user?.subscription_plan === 'Standard' ? 1000 : 20) - (user?.generations_remaining ?? 0)) / (user?.subscription_plan === 'Pro' ? 2000 : user?.subscription_plan === 'Standard' ? 1000 : 20)) * 100}%`,
                        background: 'var(--color-accent)', borderRadius: 3, transition: 'width 0.3s'
                      }} />
                    </div>
                    {user?.subscription_expires_at && (
                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                        Renouvellement le {new Date(user.subscription_expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </>
                )}
              </div>
              
              <div style={{ marginTop: 24 }}>
                <Link to="/billing" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  {user?.subscription_plan ? 'Gérer mon abonnement' : 'Voir les forfaits'}
                </Link>
              </div>
            </div>
          </div>

          {/* DANGER ZONE CARD */}
          <div className="card" style={{ padding: 24, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> Zone Dangereuse
            </h3>
            
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px 0' }}>Déconnexion</h4>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
                Déconnectez-vous de l'appareil actuel.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>
                Se déconnecter
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 500, margin: '0 0 4px 0', color: '#ef4444' }}>Supprimer le compte</h4>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
                Action irréversible. Toutes vos données seront perdues.
              </p>
              <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)} style={{ width: '100%', justifyContent: 'center' }}>
                Supprimer mon compte
              </button>
            </div>
          </div>

        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer votre compte ?"
          message="Cette action est irréversible. Toutes vos données seront supprimées."
          confirmText="Supprimer définitivement"
          danger
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
