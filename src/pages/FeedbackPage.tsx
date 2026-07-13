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

  useEffect(() => { loadFeedback(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitFeedback(formData);
      toast.success('Feedback envoyé !');
      setShowForm(false);
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

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2>Feedback</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
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
              {submitting ? 'Envoi...' : 'Envoyer'}
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
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(fb.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
