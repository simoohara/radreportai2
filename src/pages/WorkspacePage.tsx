import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useTemplateStore } from '../stores/templateStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { copyReportToClipboard } from '../lib/copyHandler';
import { getKeywordsForTemplate } from '../lib/medicalKeywords';
import type { EditLevel, Template } from '../types';
import { MODALITIES, EDIT_LEVEL_LABELS } from '../types';

export function WorkspacePage() {
  const toast = useToast();
  const { user, checkAuth } = useAuthStore();
  const {
    templates, isLoading: templatesLoading, selectedModality,
    selectedTemplate, loadTemplates, setSelectedModality, selectTemplate,
  } = useTemplateStore();
  const {
    notes, editLevel, generatedReport, isGenerating,
    isRecording, isTranscribing,
    setNotes, setEditLevel, setGeneratedReport,
    setIsGenerating, setIsRecording, setIsTranscribing, appendToNotes,
  } = useWorkspaceStore();

  const [editorHtml, setEditorHtml] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [keywords, setKeywords] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load templates on mount
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Load template content into editor
  const handleSelectTemplate = useCallback((template: Template) => {
    selectTemplate(template);
    setEditorHtml(DOMPurify.sanitize(template.content));
    setShowTemplateModal(false);
    setKeywords(getKeywordsForTemplate(template.name));
  }, [selectTemplate]);

  // ─── Recording ────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsTranscribing(true);

        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const base64 = await blobToBase64(blob);
          const { transcription } = await api.transcribe(base64, keywords || undefined);
          appendToNotes(transcription);
        } catch (err: any) {
          toast.error('Erreur de transcription: ' + err.message);
        }
        setIsTranscribing(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  };

  // ─── Generate ─────────────────────────────────────────
  const handleGenerate = async () => {
    if (!editorHtml || !notes.trim()) {
      toast.warning('Veuillez charger un modèle et écrire des notes.');
      return;
    }

    setIsGenerating(true);
    try {
      const { text } = await api.generate({
        template: editorHtml,
        notes: notes.trim(),
        editLevel,
        modality: selectedModality,
      });
      const cleaned = DOMPurify.sanitize(
        text.replace(/```html/g, '').replace(/```/g, '').trim()
      );
      setEditorHtml(cleaned);
      setGeneratedReport(cleaned);
      await checkAuth(); // refresh generation count
      toast.success('Rapport généré !');
    } catch (err: any) {
      if (err.message?.includes('402') || err.message?.includes('Payment')) {
        toast.warning('Vous avez épuisé vos générations gratuites.');
      } else {
        toast.error('Erreur : ' + err.message);
      }
    }
    setIsGenerating(false);
  };

  // ─── Summarize ────────────────────────────────────────
  const handleSummarize = async () => {
    if (!editorHtml.trim()) return;
    setIsSummarizing(true);
    try {
      const { text } = await api.summarize(editorHtml);
      const cleaned = DOMPurify.sanitize(
        text.replace(/```html/g, '').replace(/```/g, '').trim()
      );
      setEditorHtml(cleaned);
      setGeneratedReport(cleaned);
      await checkAuth();
      toast.success('Rapport résumé !');
    } catch (err: any) {
      toast.error('Erreur : ' + err.message);
    }
    setIsSummarizing(false);
  };

  // ─── Copy ─────────────────────────────────────────────
  const handleCopy = async () => {
    if (!editorHtml.trim()) return;
    const result = await copyReportToClipboard(editorHtml);
    if (result === 'failed') {
      toast.error('La copie a échoué.');
    } else {
      toast.success(result === 'html' ? 'Rapport copié !' : 'Copié (texte brut)');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // ─── Can generate? ───────────────────────────────────
  const canGenerate = !!(
    editorHtml.trim() &&
    notes.trim() &&
    !isGenerating &&
    (user?.subscription_plan || (user?.generations_remaining ?? 0) > 0)
  );

  const filteredTemplates = templates.filter((t) => t.modality === selectedModality);
  const userTemplates = filteredTemplates.filter((t) => t.user_id !== null);
  const systemTemplates = filteredTemplates.filter((t) => t.user_id === null);

  return (
    <div className="workspace">
      {/* ─── Modality bar ─────────────────────────────── */}
      <div className="modality-bar">
        {MODALITIES.map((mod) => (
          <button
            key={mod}
            className={`btn btn-sm ${selectedModality === mod ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSelectedModality(mod); setShowTemplateModal(true); }}
          >
            {mod}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {selectedTemplate && (
          <span className="current-template-label">
            📋 {selectedTemplate.name}
          </span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowGenerateModal(true)}>
          ✨ Créer modèle
        </button>
      </div>

      {/* ─── Two-panel layout ────────────────────────── */}
      <div className="workspace-panels">
        {/* Left: Notes */}
        <div className="panel notes-panel">
          <div className="panel-header">
            <span className="panel-title">🎙️ Notes brutes</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setNotes(''); }}
              disabled={!notes}
            >
              Effacer
            </button>
          </div>
          <div className="panel-body">
            <textarea
              ref={notesRef}
              className="notes-textarea"
              placeholder="Écrivez ou dictez vos observations ici..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {isTranscribing && (
              <div className="panel-overlay">
                <div className="spinner" />
                <span>Transcription...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Report */}
        <div className="panel report-panel">
          <div className="panel-header">
            <span className="panel-title">📄 Compte rendu</span>
            <div className="panel-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleSummarize}
                disabled={!editorHtml.trim() || isSummarizing}
                title="Résumer"
              >
                {isSummarizing ? '⏳' : '📝'} Résumer
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowSaveModal(true)}
                disabled={!editorHtml.trim()}
                title="Sauvegarder"
              >
                💾
              </button>
              <button
                className={`btn btn-sm ${isCopied ? 'btn-primary' : 'btn-ghost'}`}
                onClick={handleCopy}
                disabled={!editorHtml.trim()}
                title="Copier"
              >
                {isCopied ? '✓ Copié' : '📋 Copier'}
              </button>
            </div>
          </div>
          <div className="panel-body">
            {editorHtml ? (
              <div
                ref={reportRef}
                className="report-editor"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: editorHtml }}
                onInput={() => {
                  if (reportRef.current) {
                    setEditorHtml(reportRef.current.innerHTML);
                  }
                }}
              />
            ) : (
              <div className="report-empty-state">
                <span className="empty-icon">📋</span>
                <p>Sélectionnez un modèle pour commencer</p>
                <p className="empty-hint">Cliquez sur une modalité ci-dessus</p>
              </div>
            )}
            {isGenerating && (
              <div className="panel-overlay">
                <div className="spinner" />
                <span>Génération en cours...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Footer control bar ──────────────────────── */}
      <div className="workspace-footer">
        <div className="footer-disclaimer">
          ⚠️ Vérifiez toujours le contenu généré par l'IA.
        </div>
        <div className="footer-controls">
          {/* Edit level selector */}
          <div className="edit-level-selector">
            {(['prudent', 'equilibre', 'ameliore'] as EditLevel[]).map((level) => (
              <button
                key={level}
                className={`edit-level-btn ${editLevel === level ? 'active' : ''}`}
                onClick={() => setEditLevel(level)}
              >
                {EDIT_LEVEL_LABELS[level]}
              </button>
            ))}
          </div>

          {/* Record button */}
          <button
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={isTranscribing}
            title={isRecording ? 'Arrêter' : 'Enregistrer'}
          >
            {isRecording ? '⏹️' : '🎙️'}
          </button>

          {/* Generate button */}
          <button
            className="btn btn-primary generate-btn"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {isGenerating ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Génération...
              </>
            ) : (
              <>✨ Générer</>
            )}
          </button>
        </div>
        <div className="footer-status">
          {isRecording
            ? '🔴 Enregistrement...'
            : isTranscribing
            ? '⏳ Transcription...'
            : `🎙️ Prêt • ${user?.generations_remaining ?? 0} générations restantes`}
        </div>
      </div>

      {/* ─── Template selector modal ─────────────────── */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>Modèles — {selectedModality}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>
            {templatesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="spinner" />
              </div>
            ) : (
              <div className="template-list">
                {userTemplates.length > 0 && (
                  <>
                    <div className="template-group-label">Vos modèles</div>
                    {userTemplates.map((t) => (
                      <TemplateItem key={t.id} template={t} onSelect={handleSelectTemplate} isUser />
                    ))}
                  </>
                )}
                {systemTemplates.length > 0 && (
                  <>
                    <div className="template-group-label">Modèles système</div>
                    {systemTemplates.map((t) => (
                      <TemplateItem key={t.id} template={t} onSelect={handleSelectTemplate} />
                    ))}
                  </>
                )}
                {filteredTemplates.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 32 }}>
                    Aucun modèle pour cette modalité.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Save template modal ─────────────────────── */}
      {showSaveModal && (
        <SaveTemplateModal
          currentHtml={editorHtml}
          currentTemplate={selectedTemplate}
          selectedModality={selectedModality}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* ─── Generate template modal ─────────────────── */}
      {showGenerateModal && (
        <GenerateTemplateModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(content) => {
            setEditorHtml(DOMPurify.sanitize(content));
            setShowGenerateModal(false);
          }}
        />
      )}

      <style>{workspaceStyles}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function TemplateItem({
  template,
  onSelect,
  isUser = false,
}: {
  template: Template;
  onSelect: (t: Template) => void;
  isUser?: boolean;
}) {
  return (
    <button className="template-item" onClick={() => onSelect(template)}>
      <span className="template-item-icon">{isUser ? '👤' : '⭐'}</span>
      <span className="template-item-name">{template.name}</span>
    </button>
  );
}

function SaveTemplateModal({
  currentHtml,
  currentTemplate,
  selectedModality,
  onClose,
}: {
  currentHtml: string;
  currentTemplate: Template | null;
  selectedModality: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { addTemplate, updateTemplate } = useTemplateStore();
  const [name, setName] = useState(currentTemplate?.name || '');
  const [modality, setModality] = useState(currentTemplate?.modality || selectedModality);
  const [saving, setSaving] = useState(false);

  // Strip AI highlights before saving
  const cleanContent = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentHtml;
    tempDiv.querySelectorAll('mark.ai-highlight').forEach((el) => {
      const fragment = document.createDocumentFragment();
      while (el.firstChild) fragment.appendChild(el.firstChild);
      el.parentNode?.replaceChild(fragment, el);
    });
    return tempDiv.innerHTML;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Le nom est requis.');
      return;
    }
    setSaving(true);
    try {
      const content = cleanContent();
      if (currentTemplate && currentTemplate.user_id !== null) {
        await updateTemplate(currentTemplate.id, { name: name.trim(), content, modality });
        toast.success('Modèle mis à jour !');
      } else {
        await addTemplate({ name: name.trim(), modality, content });
        toast.success('Modèle sauvegardé !');
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{currentTemplate?.user_id !== null ? 'Mettre à jour' : 'Sauvegarder'} le modèle</h2>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nom</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du modèle" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Modalité</label>
            <select className="input" value={modality} onChange={(e) => setModality(e.target.value)}>
              {MODALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerateTemplateModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (content: string) => void;
}) {
  const toast = useToast();
  const [modality, setModality] = useState('TDM');
  const [region, setRegion] = useState('');
  const [gender, setGender] = useState('');
  const [laterality, setLaterality] = useState('');
  const [indication, setIndication] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!region.trim()) {
      toast.warning('La région anatomique est requise.');
      return;
    }
    setGenerating(true);
    try {
      const { content } = await api.generateNormalTemplate({
        modality,
        region: region.trim(),
        gender: gender || undefined,
        laterality: laterality || undefined,
        indication: indication || undefined,
      });
      onGenerated(content);
      toast.success('Modèle généré !');
    } catch (err: any) {
      toast.error(err.message);
    }
    setGenerating(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ Générer un modèle normal</h2>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Modalité</label>
            <select className="input" value={modality} onChange={(e) => setModality(e.target.value)}>
              {MODALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Région anatomique *</label>
            <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="ex: cérébrale, thorax, genou..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Genre</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Non spécifié</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Latéralité</label>
              <select className="input" value={laterality} onChange={(e) => setLaterality(e.target.value)}>
                <option value="">Non spécifiée</option>
                <option value="droit">Droit</option>
                <option value="gauche">Gauche</option>
                <option value="bilatéral">Bilatéral</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Indication clinique</label>
            <input className="input" value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="ex: recherche de fracture" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !region.trim()}>
            {generating ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Génération...
              </>
            ) : (
              '✨ Générer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:audio/webm;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Styles ──────────────────────────────────────────────

const workspaceStyles = `
.workspace {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--header-height) - 48px);
  gap: 12px;
}

/* ─── Modality bar ────────────────────────── */
.modality-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.current-template-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 4px 12px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
}

/* ─── Panels ──────────────────────────────── */
.workspace-panels {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.panel-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.notes-textarea {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-primary);
  font-size: 14px;
  line-height: 1.7;
  resize: none;
  outline: none;
}

.notes-textarea::placeholder {
  color: var(--color-text-tertiary);
}

.report-editor {
  padding: 16px;
  min-height: 100%;
  outline: none;
  font-size: 14px;
  line-height: 1.7;
  overflow-y: auto;
  height: 100%;
}

.report-editor p {
  margin-bottom: 8px;
}

.report-editor strong {
  color: var(--color-accent);
}

.report-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-tertiary);
  text-align: center;
  gap: 8px;
  padding: 40px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.3;
}

.empty-hint {
  font-size: 13px;
  opacity: 0.6;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  z-index: 10;
}

/* ─── Footer ──────────────────────────────── */
.workspace-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.footer-disclaimer {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.footer-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
}

.footer-status {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  text-align: right;
}

/* ─── Edit level ──────────────────────────── */
.edit-level-selector {
  display: flex;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.edit-level-btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-primary);
}

.edit-level-btn:hover {
  color: var(--color-text);
  background: var(--color-border);
}

.edit-level-btn.active {
  background: var(--color-accent);
  color: white;
}

/* ─── Record button ───────────────────────── */
.record-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  font-size: 20px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.record-btn:hover {
  border-color: var(--color-accent);
  transform: scale(1.05);
}

.record-btn.recording {
  border-color: var(--color-recording);
  background: rgba(255, 69, 58, 0.15);
  animation: recording-pulse 1.5s ease-in-out infinite;
}

/* ─── Generate button ─────────────────────── */
.generate-btn {
  padding: 10px 24px;
  font-size: 15px;
  font-weight: 600;
}

/* ─── Template list ───────────────────────── */
.template-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.template-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-tertiary);
  padding: 12px 12px 4px;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: var(--font-primary);
  text-align: left;
  transition: background var(--transition-fast);
  width: 100%;
}

.template-item:hover {
  background: var(--color-surface);
}

.template-item-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
}

/* ─── Responsive ──────────────────────────── */
@media (max-width: 768px) {
  .workspace-panels {
    grid-template-columns: 1fr;
  }

  .workspace-footer {
    flex-direction: column;
    gap: 8px;
  }

  .footer-disclaimer,
  .footer-status {
    text-align: center;
  }

  .footer-controls {
    flex-wrap: wrap;
  }
}
`;
