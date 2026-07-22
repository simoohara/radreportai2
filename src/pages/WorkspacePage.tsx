import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useTemplateStore } from '../stores/templateStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { ImportTemplateModal } from '../components/ImportTemplateModal';
import { copyReportToClipboard } from '../lib/copyHandler';
import { getKeywordsForTemplate } from '../lib/medicalKeywords';
import type { EditLevel, Template } from '../types';
import { MODALITIES, EDIT_LEVEL_LABELS } from '../types';

export function WorkspacePage() {
  const toast = useToast();
  const { user, checkAuth } = useAuthStore();
  const userId = user?.id;
  const {
    templates, isLoading: templatesLoading, selectedModality,
    selectedTemplate, loadTemplates, setSelectedModality, selectTemplate, removeTemplate,
  } = useTemplateStore();
  const {
    editorContent, originalEditorContent, notes, editLevel, isGenerating,
    isRecording, isTranscribing,
    setEditorContent, setOriginalEditorContent, setNotes, setEditLevel, setGeneratedReport,
    setIsGenerating, setIsRecording, setIsTranscribing, appendToNotes,
  } = useWorkspaceStore();

  const editorHtml = editorContent;
  const setEditorHtml = setEditorContent;
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTemplateSearch, setShowTemplateSearch] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [keywords, setKeywords] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [templateToEdit, setTemplateToEdit] = useState<Template | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Load templates on mount
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // A completion flag is a product preference only. No report, note, or patient
  // information is written to browser storage.
  useEffect(() => {
    if (!userId || templatesLoading) return;
    const key = `radreportai:onboarding:v1:${userId}`;
    if (localStorage.getItem(key) !== 'completed') {
      setGuideStep(0);
      setShowGuide(true);
    }
  }, [userId, templatesLoading]);

  useEffect(() => () => {
    isMountedRef.current = false;
    if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
    if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Load template content into editor
  const executeSelectTemplate = useCallback((template: Template) => {
    setSelectedModality(template.modality);
    selectTemplate(template);
    const sanitized = DOMPurify.sanitize(template.content);
    setEditorHtml(sanitized);
    setOriginalEditorContent(sanitized);
    setShowTemplateModal(false);
    setKeywords(getKeywordsForTemplate(template.name));
  }, [selectTemplate, setEditorHtml, setOriginalEditorContent, setSelectedModality]);

  const handleSelectTemplate = useCallback((template: Template) => {
    const isEditorDirty = originalEditorContent !== editorHtml;
    if (isEditorDirty) {
      setPendingTemplate(template);
      setShowTemplateModal(false);
      setShowTemplateSearch(false);
    } else {
      executeSelectTemplate(template);
    }
  }, [editorHtml, originalEditorContent, executeSelectTemplate]);

  // ─── Recording ────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || isTranscribing) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error("L'enregistrement audio n'est pas pris en charge par ce navigateur.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = supportedMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
        if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (!isMountedRef.current) return;
        setIsRecording(false);
        setRecordingSeconds(0);
        setIsTranscribing(true);

        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
          if (blob.size === 0) throw new Error('Aucun son n’a été enregistré.');
          if (blob.size > 10 * 1024 * 1024) {
            throw new Error('Enregistrement trop long. Limitez la dictée à 1 minute.');
          }
          const base64 = await blobToBase64(blob);
          // Merge template-specific keywords with user's personal difficult terms
          const allKeywords = [keywords, user?.custom_keywords].filter(Boolean).join(', ') || undefined;
          const { transcription } = await api.transcribe(base64, blob.type, allKeywords);
          if (transcription.trim()) appendToNotes(transcription.trim());
        } catch (err: any) {
          toast.error('Erreur de transcription: ' + err.message);
        }
        if (isMountedRef.current) setIsTranscribing(false);
      };

      recorder.onerror = () => {
        toast.error("L'enregistrement audio a échoué.");
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') {
          toast.info('Enregistrement arrêté automatiquement après 1 minute.');
          recorder.stop();
        }
      }, 1 * 60 * 1000);
    } catch {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const dictationMode = (localStorage.getItem('dictationMode') as 'push' | 'toggle') || 'toggle';

  useEffect(() => {
    if (dictationMode !== 'push') return;

    let isSpaceDown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || (activeElement as HTMLElement)?.isContentEditable;
        
        if (!isInput) {
          e.preventDefault();
          isSpaceDown = true;
          startRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isSpaceDown) {
        isSpaceDown = false;
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictationMode]);

  const handleMicMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (dictationMode === 'push') {
      e.preventDefault(); // Prevent text selection on mobile
      startRecording();
    }
  };

  const handleMicMouseUp = () => {
    if (dictationMode === 'push') {
      stopRecording();
    }
  };

  const handleMicClick = () => {
    if (dictationMode === 'toggle') {
      if (isRecording) stopRecording();
      else startRecording();
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    try {
      await removeTemplate(templateToDelete.id);
      if (selectedTemplate?.id === templateToDelete.id) {
        setEditorHtml('');
        setKeywords(null);
      }
      toast.success('Modèle supprimé.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTemplateToDelete(null);
    }
  };

  const completeGuide = useCallback(() => {
    if (user) localStorage.setItem(`radreportai:onboarding:v1:${user.id}`, 'completed');
    setShowGuide(false);
  }, [user]);

  const startFirstReport = useCallback(() => {
    completeGuide();
    setShowTemplateModal(true);
  }, [completeGuide]);

  // ─── Generate ─────────────────────────────────────────
  const handleGenerate = async () => {
    if (!editorHtml || !notes.trim()) {
      toast.warning('Veuillez charger un modèle et écrire des notes.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
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
      setOriginalEditorContent(cleaned);
      setGeneratedReport(cleaned);
      await checkAuth(); // refresh generation count
      toast.success('Rapport généré !');
    } catch (err: any) {
      if (err.message?.includes('402') || err.message?.includes('Payment')) {
        toast.warning('Vous avez épuisé vos générations gratuites.');
        setGenerationError('Vous avez épuisé vos générations gratuites.');
      } else {
        toast.error('Erreur : ' + err.message);
        setGenerationError(err.message || "La connexion a échoué. Veuillez vérifier votre réseau.");
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
      setOriginalEditorContent(cleaned);
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
  const templateSearchResults = searchTemplates(templates, templateQuery);

  return (
    <div className="workspace">
      {/* ─── Modality bar ─────────────────────────────── */}
      <div className="modality-bar">
        <div className="modality-group">
          {MODALITIES.map((mod) => (
            <button
              key={mod}
              className={`btn btn-sm ${selectedModality === mod ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSelectedModality(mod); setShowTemplateModal(true); }}
            >
              {mod}
            </button>
          ))}
        </div>
        <div className="modality-spacer" style={{ flex: 1 }} />
        <div className="modality-group">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowImportModal(true)}
            title="Importer un modèle"
          >
            📥 Importer
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowGenerateModal(true)}>
            ✨ Créer modèle
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setGuideStep(0); setShowGuide(true); }}
            title="Voir le guide de démarrage"
          >
            ? Guide
          </button>
        </div>
        {selectedTemplate && (
          <span className="current-template-label">
            📋 {selectedTemplate.name}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm workspace-search-btn"
          onClick={() => { setTemplateQuery(''); setShowTemplateSearch(true); }}
          title="Rechercher un modèle"
        >
          <span className="search-icon">🔎</span> <span className="search-text">Rechercher</span>
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
              onChange={(e) => {
                setNotes(e.target.value);
                if (generationError) setGenerationError(null);
              }}
            />
            {isTranscribing && (
              <div className="panel-overlay">
                <div className="spinner" />
                <span>Transcription...</span>
              </div>
            )}
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
              onMouseDown={handleMicMouseDown}
              onMouseUp={handleMicMouseUp}
              onMouseLeave={handleMicMouseUp}
              onTouchStart={handleMicMouseDown}
              onTouchEnd={handleMicMouseUp}
              onClick={handleMicClick}
              disabled={isTranscribing}
              title={dictationMode === 'push' ? 'Maintenez pour dicter' : (isRecording ? 'Arrêter la dictée' : 'Commencer la dictée')}
            >
              {isRecording ? '⏹️' : '🎙️'}
            </button>

            {/* Generate button */}
            <button
              className={`btn ${generationError ? 'btn-secondary' : 'btn-primary'} generate-btn`}
              onClick={handleGenerate}
              disabled={!canGenerate && !generationError}
            >
              {isGenerating ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Génération...
                </>
              ) : generationError ? (
                <>🔄 Réessayer</>
              ) : (
                <>✨ Générer</>
              )}
            </button>
          </div>
          <div className="footer-status">
            {isRecording
              ? `🔴 Enregistrement • ${formatRecordingTime(recordingSeconds)}`
              : isTranscribing
              ? '⏳ Transcription...'
              : `🎙️ Prêt ${dictationMode === 'push' ? '(Maintenez Espace pour dicter)' : ''} • ${user?.generations_remaining ?? 0} générations restantes`}
          </div>
        </div>

        {/* Right: Report */}
        <div className="panel report-panel">
          {generationError && (
            <div style={{
              background: 'var(--color-danger-transparent)',
              color: 'var(--color-danger)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--color-danger-transparent)'
            }}>
              <span>⚠️ La génération a échoué: {generationError}</span>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setGenerationError(null)}
                style={{ color: 'var(--color-danger)' }}
              >✕</button>
            </div>
          )}
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span className="panel-title">📄 Compte rendu</span>
              
              <div className="editor-toolbar">
                <div className="toolbar-group">
                  <button className="toolbar-btn" onClick={() => document.execCommand('undo', false)} title="Annuler" style={{ fontSize: '16px' }}>↺</button>
                  <button className="toolbar-btn" onClick={() => document.execCommand('redo', false)} title="Rétablir" style={{ fontSize: '16px' }}>↻</button>
                </div>
                <div className="toolbar-group">
                  <button className="toolbar-btn" onClick={() => document.execCommand('bold', false)} title="Gras" style={{ fontWeight: 'bold' }}>B</button>
                  <button className="toolbar-btn" onClick={() => document.execCommand('italic', false)} title="Italique" style={{ fontStyle: 'italic', fontFamily: 'serif', fontSize: '16px' }}>I</button>
                  <button className="toolbar-btn" onClick={() => document.execCommand('underline', false)} title="Souligné" style={{ textDecoration: 'underline' }}>U</button>
                </div>
              </div>
            </div>
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
            <ReportEditor value={editorHtml} onChange={setEditorHtml} />
            {isGenerating && (
              <div className="panel-overlay">
                <div className="spinner" />
                <span>Génération en cours...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingTemplate && (
        <ConfirmModal
          title="Changer de modèle ?"
          message="Vous avez des modifications non sauvegardées dans l'éditeur. Voulez-vous continuer et les perdre ?"
          confirmText="Continuer"
          cancelText="Annuler"
          danger={true}
          onConfirm={() => {
            executeSelectTemplate(pendingTemplate);
            setPendingTemplate(null);
          }}
          onCancel={() => setPendingTemplate(null)}
        />
      )}

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
                      <TemplateItem key={t.id} template={t} onSelect={handleSelectTemplate} isUser onDelete={setTemplateToDelete} onEdit={setTemplateToEdit} />
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
      {showImportModal && (
        <ImportTemplateModal 
          onClose={() => setShowImportModal(false)}
          onImportSuccess={(name) => {
            toast.success(`Modèle "${name}" importé avec succès !`);
          }}
        />
      )}

      {showTemplateSearch && (
        <TemplateSearchModal
          query={templateQuery}
          results={templateSearchResults}
          onQueryChange={setTemplateQuery}
          onClose={() => setShowTemplateSearch(false)}
          onSelect={(template) => {
            handleSelectTemplate(template);
            setShowTemplateSearch(false);
          }}
        />
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
            selectTemplate(null);
            setKeywords(null);
            setEditorHtml(DOMPurify.sanitize(content));
            setShowGenerateModal(false);
          }}
        />
      )}

      {templateToEdit && (
        <SaveTemplateModal
          currentHtml={templateToEdit.content}
          currentTemplate={templateToEdit}
          selectedModality={templateToEdit.modality}
          onClose={() => setTemplateToEdit(null)}
        />
      )}

      {templateToDelete && (
        <ConfirmModal
          title="Supprimer ce modèle ?"
          message={`Le modèle « ${templateToDelete.name} » sera supprimé définitivement.`}
          confirmText="Supprimer"
          danger
          onConfirm={handleDeleteTemplate}
          onCancel={() => setTemplateToDelete(null)}
        />
      )}

      {showGuide && (
        <WorkspaceGuide
          step={guideStep}
          onNext={() => setGuideStep((current) => current + 1)}
          onSkip={completeGuide}
          onStart={startFirstReport}
        />
      )}

      <style>{workspaceStyles}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function ReportEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Only write to the DOM for externally supplied content (template, AI output,
  // or restored workspace). Avoid replacing the DOM after every keystroke, which
  // would otherwise reset the caret in a contentEditable element.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (document.activeElement === editorRef.current) {
        return; // Prevent race condition resetting cursor while typing
      }
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleBlur = () => {
    if (!editorRef.current) return;
    const cleaned = DOMPurify.sanitize(editorRef.current.innerHTML);
    if (cleaned !== editorRef.current.innerHTML) editorRef.current.innerHTML = cleaned;
    onChange(cleaned);
  };

  return (
    <div
      ref={editorRef}
      className="report-editor"
      contentEditable
      role="textbox"
      aria-multiline="true"
      data-placeholder="Sélectionnez un modèle ou rédigez directement votre compte rendu..."
      suppressContentEditableWarning
      onInput={() => onChange(editorRef.current?.innerHTML || '')}
      onBlur={handleBlur}
    />
  );
}

const GUIDE_STEPS = [
  {
    icon: '👋',
    title: 'Bienvenue dans votre espace de travail',
    description: 'En moins d’une minute, vous pouvez passer de vos observations à un compte rendu structuré et prêt à être relu.',
  },
  {
    icon: '📋',
    title: '1. Chargez un modèle',
    description: 'Choisissez une modalité puis un modèle. Vous pouvez aussi rechercher tous les modèles avec le bouton Rechercher.',
  },
  {
    icon: '🎙️',
    title: '2. Dictez ou écrivez vos observations',
    description: 'Utilisez le microphone ou saisissez vos notes dans le panneau de gauche. La transcription reste modifiable avant la génération.',
  },
  {
    icon: '✨',
    title: '3. Générez, relisez et copiez',
    description: 'L’IA remplit la structure du modèle. Relisez toujours le résultat, ajustez-le si besoin, puis copiez-le dans votre PACS.',
  },
  {
    icon: '🎬',
    title: '4. Voir la démo en action',
    description: 'Découvrez comment créer un compte rendu de A à Z en moins d\'une minute.',
    videoId: 'E-_FlswC3NQ',
  },
] as const;

function WorkspaceGuide({
  step,
  onNext,
  onSkip,
  onStart,
}: {
  step: number;
  onNext: () => void;
  onSkip: () => void;
  onStart: () => void;
}) {
  const currentStep = GUIDE_STEPS[step] ?? GUIDE_STEPS[0];
  const isLastStep = step >= GUIDE_STEPS.length - 1;

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-content workspace-guide" role="dialog" aria-modal="true" aria-labelledby="workspace-guide-title">
        <div className="guide-progress" aria-label={`Étape ${step + 1} sur ${GUIDE_STEPS.length}`}>
          {GUIDE_STEPS.map((guide, index) => <span key={guide.title} className={index <= step ? 'active' : ''} />)}
        </div>
        <div className="guide-icon" aria-hidden="true">{currentStep.icon}</div>
        <p className="guide-step-count">Étape {step + 1} sur {GUIDE_STEPS.length}</p>
        <h2 id="workspace-guide-title">{currentStep.title}</h2>
        <p className="guide-description">{currentStep.description}</p>
        {'videoId' in currentStep && currentStep.videoId && (
          <div className="guide-video" style={{ marginTop: '16px', borderRadius: '8px', overflow: 'hidden' }}>
            <iframe
              width="100%"
              height="240"
              src={`https://www.youtube.com/embed/${currentStep.videoId}`}
              title="Démo RadReportAI"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        )}
        <p className="guide-disclaimer">⚠️ Vérifiez toujours le contenu généré avant de le signer.</p>
        <div className="modal-actions guide-actions">
          <button className="btn btn-ghost" onClick={onSkip}>Passer le guide</button>
          {isLastStep ? (
            <button className="btn btn-primary" onClick={onStart}>Choisir un modèle</button>
          ) : (
            <button className="btn btn-primary" onClick={onNext}>Suivant</button>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateItem({
  template,
  onSelect,
  isUser = false,
  onDelete,
  onEdit,
}: {
  template: Template;
  onSelect: (t: Template) => void;
  isUser?: boolean;
  onDelete?: (template: Template) => void;
  onEdit?: (template: Template) => void;
}) {
  return (
    <div className="template-item-row">
      <button className="template-item" onClick={() => onSelect(template)}>
        <span className="template-item-icon">{isUser ? '👤' : '⭐'}</span>
        <span className="template-item-name">{template.name}</span>
      </button>
      {isUser && onEdit && (
        <button className="btn btn-ghost btn-sm template-delete-btn" onClick={() => onEdit(template)} title={`Modifier ${template.name}`}>
          ✏️
        </button>
      )}
      {isUser && onDelete && (
        <button className="btn btn-ghost btn-sm template-delete-btn" onClick={() => onDelete(template)} title={`Supprimer ${template.name}`}>
          🗑️
        </button>
      )}
    </div>
  );
}

function TemplateSearchModal({
  query,
  results,
  onQueryChange,
  onClose,
  onSelect,
}: {
  query: string;
  results: Template[];
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (template: Template) => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-search-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>🔎 Rechercher un modèle</h2>
            <p className="template-search-hint">Nom, région, contenu ou modalité — ex. « scanner thorax », « IRM genou », « écho ».</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer la recherche">✕</button>
        </div>
        <input
          autoFocus
          className="input template-search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Rechercher dans tous les modèles..."
        />
        <div className="template-search-count">
          {query.trim() ? `${results.length} résultat${results.length === 1 ? '' : 's'}` : 'Tous les modèles'}
        </div>
        <div className="template-search-results">
          {results.map((template) => (
            <button key={template.id} className="template-search-item" onClick={() => onSelect(template)}>
              <span className="template-search-item-main">
                <span className="template-search-name">{template.name}</span>
                <span className="template-search-preview">{getTemplatePreview(template.content)}</span>
              </span>
              <span className="template-search-item-meta">
                <span className="template-modality-badge">{template.modality}</span>
                <span title={template.user_id === null ? 'Modèle système' : 'Votre modèle'}>{template.user_id === null ? '⭐' : '👤'}</span>
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="template-search-empty">
              Aucun modèle ne correspond à « {query} ».
            </div>
          )}
        </div>
      </div>
    </div>
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
          <h2>{currentTemplate?.user_id != null ? 'Mettre à jour' : 'Sauvegarder'} le modèle</h2>
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

const TEMPLATE_SEARCH_ALIASES: Record<string, string[]> = {
  tdm: ['scanner', 'tomodensitometrie', 'ct'],
  scanner: ['tdm', 'tomodensitometrie', 'ct'],
  tomodensitometrie: ['tdm', 'scanner', 'ct'],
  irm: ['mri', 'resonance magnetique'],
  mri: ['irm', 'resonance magnetique'],
  echo: ['echographie', 'ultrason', 'ultrasons'],
  echographie: ['echo', 'ultrason', 'ultrasons'],
  radio: ['radiographie', 'rayons x', 'xray'],
  radiographie: ['radio', 'rayons x', 'xray'],
};

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchTemplates(templates: Template[], query: string): Template[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [...templates].sort((a, b) => {
      const ownership = Number(b.user_id !== null) - Number(a.user_id !== null);
      return ownership || a.name.localeCompare(b.name, 'fr');
    });
  }

  const queryTerms = normalizedQuery.split(' ').filter(Boolean);
  const expandedTerms = [...new Set(queryTerms.flatMap((term) => [term, ...(TEMPLATE_SEARCH_ALIASES[term] || [])]))];

  return templates
    .map((template) => {
      const name = normalizeSearchText(template.name);
      const modality = normalizeSearchText(template.modality);
      const content = normalizeSearchText(template.content.replace(/<[^>]*>/g, ' '));
      let score = template.user_id !== null ? 1 : 0;

      if (name.includes(normalizedQuery)) score += 80;
      if (modality.includes(normalizedQuery)) score += 60;
      if (content.includes(normalizedQuery)) score += 12;

      for (const term of expandedTerms) {
        if (name.includes(term)) score += 18;
        if (modality.includes(term)) score += 16;
        if (content.includes(term)) score += 4;
      }

      return { template, score };
    })
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name, 'fr'))
    .map(({ template }) => template);
}

function getTemplatePreview(content: string): string {
  const preview = content
    .replace(/<br\s*\/?>(\s*)/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return preview.length > 110 ? `${preview.slice(0, 110)}…` : preview || 'Modèle sans aperçu';
}

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

function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// ─── Styles ──────────────────────────────────────────────

const workspaceStyles = `
.workspace {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  gap: 14px;
}

/* ─── Modality bar ────────────────────────── */
.modality-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-alt);
  box-shadow: var(--shadow-sm);
}

.modality-group {
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
  border: 1px solid var(--color-border);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── First-report guide ───────────────────── */
.workspace-guide {
  max-width: 470px;
  text-align: center;
}

.guide-progress {
  display: flex;
  gap: 6px;
  margin-bottom: 28px;
}

.guide-progress span {
  height: 4px;
  flex: 1;
  border-radius: 99px;
  background: var(--color-border);
}

.guide-progress span.active {
  background: var(--color-accent);
}

.guide-icon {
  font-size: 42px;
  margin-bottom: 10px;
}

.guide-step-count {
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.workspace-guide h2 {
  margin-bottom: 12px;
}

.guide-description {
  color: var(--color-text-secondary);
  line-height: 1.65;
}

.guide-disclaimer {
  margin-top: 20px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.guide-actions {
  align-items: center;
}

/* ─── Panels ──────────────────────────────── */
.workspace-panels {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  gap: 14px;
  min-height: 0;
}

.notes-panel {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
}

.report-panel {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
}

.workspace-footer {
  grid-column: 1 / 3;
  grid-row: 2 / 3;
}

.panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.panel:focus-within {
  border-color: color-mix(in srgb, var(--color-accent) 70%, var(--color-border));
  box-shadow: 0 0 0 3px var(--color-highlight-bg), var(--shadow-md);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toolbar-group {
  display: flex;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.toolbar-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: var(--font-primary);
  font-size: 15px;
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background: var(--color-surface);
  color: var(--color-text);
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
  padding: 20px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-primary);
  font-size: 15px;
  line-height: 1.75;
  resize: none;
  outline: none;
}

.notes-textarea::placeholder {
  color: var(--color-text-tertiary);
}

.report-editor {
  padding: 20px;
  min-height: 100%;
  outline: none;
  font-size: 15px;
  line-height: 1.75;
  overflow-y: auto;
  height: 100%;
}

.report-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-tertiary);
  pointer-events: none;
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
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  z-index: 10;
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
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--color-surface);
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
  background: var(--color-bg-alt);
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
  min-width: 148px;
  padding: 11px 24px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-accent) 24%, transparent);
}

/* ─── Template list ───────────────────────── */
.template-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.template-search-modal {
  max-width: 640px;
}

.template-search-hint {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.template-search-input {
  width: 100%;
  margin-top: 4px;
}

.template-search-count {
  margin: 12px 2px 8px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.template-search-results {
  display: grid;
  gap: 6px;
  max-height: min(52vh, 440px);
  overflow-y: auto;
}

.template-search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-primary);
}

.template-search-item:hover {
  border-color: var(--color-accent);
  background: var(--color-highlight-bg);
}

.template-search-item-main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.template-search-name {
  font-weight: 600;
  font-size: 14px;
}

.template-search-preview {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-search-item-meta {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
}

.template-modality-badge {
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.template-search-empty {
  padding: 28px;
  color: var(--color-text-tertiary);
  text-align: center;
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

.template-item-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.template-item-row .template-item {
  flex: 1;
}

.template-delete-btn {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
}

.template-delete-btn:hover {
  color: var(--color-danger);
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
  .workspace {
    height: auto;
    min-height: calc(100dvh - 32px);
    margin-top: 40px; /* Space for the hamburger menu */
  }

  .modality-bar {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    justify-content: center;
  }

  .modality-group {
    justify-content: center;
  }

  .modality-spacer {
    display: none;
  }

  .current-template-label {
    order: 10;
    width: 100%;
    max-width: none;
    text-align: center;
  }

  .workspace-search-btn {
    position: fixed;
    top: 24px;
    transform: translateY(-50%);
    right: 8px;
    z-index: 60;
    padding: 8px !important;
  }

  .workspace-search-btn .search-text {
    display: none;
  }

  .workspace-search-btn .search-icon {
    font-size: 18px;
  }

  .workspace-panels {
    display: flex;
    flex-direction: column;
    min-height: auto;
  }

  .notes-panel {
    min-height: 250px;
    flex: none;
  }

  .report-panel {
    min-height: 400px;
    flex: none;
  }

  .panel-header {
    padding: 10px 12px;
  }

  .notes-textarea,
  .report-editor {
    padding: 16px;
  }

  .workspace-footer {
    flex-direction: column;
    gap: 12px;
    margin: 0;
  }

  .footer-disclaimer,
  .footer-status {
    text-align: center;
  }

  .footer-controls {
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

  .edit-level-selector {
    order: 3;
    width: 100%;
  }

  .edit-level-btn {
    flex: 1;
  }
}
`;
