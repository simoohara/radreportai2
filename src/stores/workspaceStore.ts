import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EditLevel } from '../types';

interface WorkspaceState {
  // Editor content
  editorContent: string;
  originalEditorContent: string;
  notes: string;
  editLevel: EditLevel;
  
  // AI output
  generatedReport: string;
  isGenerating: boolean;
  
  // Transcription
  isRecording: boolean;
  isTranscribing: boolean;

  // Actions
  setEditorContent: (content: string) => void;
  setOriginalEditorContent: (content: string) => void;
  setNotes: (notes: string) => void;
  setEditLevel: (level: EditLevel) => void;
  setGeneratedReport: (report: string) => void;
  setIsGenerating: (val: boolean) => void;
  setIsRecording: (val: boolean) => void;
  setIsTranscribing: (val: boolean) => void;
  appendToNotes: (text: string) => void;
  reset: () => void;
}

const getAutoSaveSetting = () => {
  const stored = localStorage.getItem('radreportai-autosave');
  if (stored === null) return true; // Default to ON
  return stored === 'true';
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      editorContent: '',
      originalEditorContent: '',
      notes: '',
      editLevel: 'equilibre',
      generatedReport: '',
      isGenerating: false,
      isRecording: false,
      isTranscribing: false,

      setEditorContent: (content) => set({ editorContent: content }),
      setOriginalEditorContent: (content) => set({ originalEditorContent: content }),
      setNotes: (notes) => set({ notes }),
      setEditLevel: (level) => set({ editLevel: level }),
      setGeneratedReport: (report) => set({ generatedReport: report }),
      setIsGenerating: (val) => set({ isGenerating: val }),
      setIsRecording: (val) => set({ isRecording: val }),
      setIsTranscribing: (val) => set({ isTranscribing: val }),
      appendToNotes: (text) => {
        const current = get().notes;
        set({ notes: current ? `${current}\n${text}` : text });
      },
      reset: () =>
        set({
          editorContent: '',
          originalEditorContent: '',
          notes: '',
          editLevel: 'equilibre',
          generatedReport: '',
          isGenerating: false,
          isRecording: false,
          isTranscribing: false,
        }),
    }),
    {
      name: 'radreportai-workspace-storage',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (!getAutoSaveSetting()) return null;
          return localStorage.getItem(name);
        },
        setItem: (name, value) => {
          if (!getAutoSaveSetting()) {
            localStorage.removeItem(name);
            return;
          }
          localStorage.setItem(name, value);
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        editorContent: state.editorContent,
        originalEditorContent: state.originalEditorContent,
        notes: state.notes,
        editLevel: state.editLevel,
      }),
    }
  )
);
