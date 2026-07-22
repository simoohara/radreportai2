import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import type { Feedback } from '../types';
import { FEEDBACK_TYPE_LABELS, STATUS_LABELS } from '../types';

export function FeedbackPage() {
  const toast = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ type: 'suggestion', subject: '', content: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadFeedback = async () => {
    try {
      const data = await api.getFeedback();
      setFeedbacks(data);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFeedback(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateFeedback(editingId, { type: formData.type, subject: formData.subject, content: formData.content });
        toast.success('Feedback mis à jour !');
      } else {
        await api.submitFeedback(formData);
        toast.success('Feedback envoyé !');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ type: 'suggestion', subject: '', content: '' });
      loadFeedback();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteFeedback(id);
      toast.success('Supprimé');
      loadFeedback();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEdit = (fb: Feedback) => {
    setEditingId(fb.id);
    setFormData({ type: fb.type, subject: fb.subject, content: fb.content });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Feedback</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0 0', fontSize: 15 }}>
            Vos suggestions et rapports de bugs nous aident à nous améliorer.
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingId(null);
              setFormData({ type: 'suggestion', subject: '', content: '' });
            } else {
              setShowForm(true);
            }
          }}
        >
          {showForm ? 'Annuler' : '+ Nouveau feedback'}
        </button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom: 24 }} onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Type</label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="suggestion">Suggestion</option>
                <option value="bug">Bug</option>
                <option value="question">Question</option>
                <option value="billing">Facturation</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Sujet</label>
              <input
                className="input"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Résumé court"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Détails</label>
              <textarea
                className="input"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Décrivez votre feedback..."
                required
              />
            </div>
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Envoi...' : (editingId ? 'Mettre à jour' : 'Envoyer')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : feedbacks.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 40 }}>
          Aucun feedback envoyé.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {feedbacks.map((fb) => (
            <div key={fb.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span className={`badge badge-${fb.status === 'new' ? 'new' : fb.status === 'in_progress' ? 'in-progress' : 'resolved'}`}>
                      {STATUS_LABELS[fb.status]}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                      {FEEDBACK_TYPE_LABELS[fb.type]}
                    </span>
                  </div>
                  <h4 style={{ fontSize: 14 }}>{fb.subject}</h4>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{fb.content}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(fb)}>✏️</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-delete)' }} onClick={() => handleDelete(fb.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
