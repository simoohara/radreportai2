import { useState, useRef } from 'react';
import * as mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import { useTemplateStore } from '../stores/templateStore';
import { MODALITIES } from '../types';
import { api } from '../services/api';

interface ImportTemplateModalProps {
  onClose: () => void;
  onImportSuccess?: (name: string) => void;
}

export function ImportTemplateModal({ onClose, onImportSuccess }: ImportTemplateModalProps) {
  const [modality, setModality] = useState<string>(MODALITIES[0]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addTemplate = useTemplateStore((state) => state.addTemplate);

  const handleImport = async () => {
    const files = Array.from(fileInputRef.current?.files || []);
    if (files.length === 0) {
      setError('Veuillez sélectionner au moins un fichier.');
      return;
    }

    if (files.length > 10) {
      setError('Veuillez sélectionner un maximum de 10 fichiers à la fois.');
      return;
    }

    setIsLoading(true);
    setError('');
    let importedCount = 0;

    for (const file of files) {
      setStatus(`Lecture du fichier ${file.name}...`);
      try {
        let content = '';
        if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          content = result.value;
        } else {
          content = await file.text();
        }

        const name = file.name.replace(/\.[^/.]+$/, "");
        
        setStatus(`Formatage de ${file.name} par l'IA...`);
        const formattedResponse = await api.formatTemplate(content);
        const formattedContent = formattedResponse.content || content; // Fallback to raw content if error

        await addTemplate({
          modality,
          name,
          content: DOMPurify.sanitize(formattedContent)
        });
        importedCount++;
      } catch (err: any) {
        console.error(`Erreur d'importation pour ${file.name}:`, err);
      }
    }

    setIsLoading(false);
    setStatus('');

    if (importedCount === 0) {
      setError("Erreur lors de l'importation. Aucun fichier importé.");
    } else {
      if (onImportSuccess) onImportSuccess(`${importedCount} modèle(s)`);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importer un modèle</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Modalité</label>
            <select className="input" value={modality} onChange={e => setModality(e.target.value)}>
              {MODALITIES.map(mod => <option key={mod} value={mod}>{mod}</option>)}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>Fichiers (.txt ou .docx, max 10)</label>
            <input 
              type="file" 
              multiple
              className="input" 
              ref={fileInputRef} 
              accept=".txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ padding: '8px' }}
            />
          </div>

          {status && <div style={{ color: 'var(--color-accent)', fontSize: '13px' }}>{status}</div>}
          {error && <div style={{ color: 'var(--color-delete)', fontSize: '13px' }}>{error}</div>}
        </div>

        <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={isLoading}>
            {isLoading ? 'Importation...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
