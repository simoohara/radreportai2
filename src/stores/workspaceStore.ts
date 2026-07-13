import { create } from 'zustand';
import type { EditLevel } from '../types';

interface WorkspaceState {
  // Editor content
  editorContent: string;
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
  setNotes: (notes: string) => void;
  setEditLevel: (level: EditLevel) => void;
  setGeneratedReport: (report: string) => void;
  setIsGenerating: (val: boolean) => void;
  setIsRecording: (val: boolean) => void;
  setIsTranscribing: (val: boolean) => void;
  appendToNotes: (text: string) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  editorContent: '',
  notes: '',
  editLevel: 'equilibre',
  generatedReport: '',
  isGenerating: false,
  isRecording: false,
  isTranscribing: false,

  setEditorContent: (content) => set({ editorContent: content }),
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
      notes: '',
      editLevel: 'equilibre',
      generatedReport: '',
      isGenerating: false,
      isRecording: false,
      isTranscribing: false,
    }),
}));
