import { create } from 'zustand';
import type { Template } from '../types';
import { api } from '../services/api';

interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  selectedModality: string;
  selectedTemplate: Template | null;

  loadTemplates: () => Promise<void>;
  setSelectedModality: (modality: string) => void;
  selectTemplate: (template: Template | null) => void;
  addTemplate: (data: { name: string; modality: string; content: string }) => Promise<Template>;
  updateTemplate: (id: number, data: { name?: string; content?: string; modality?: string }) => Promise<void>;
  removeTemplate: (id: number) => Promise<void>;
  getFilteredTemplates: () => Template[];
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  isLoading: false,
  selectedModality: 'Radio',
  selectedTemplate: null,

  loadTemplates: async () => {
    set({ isLoading: true });
    try {
      const templates = await api.getTemplates();
      set({ templates, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setSelectedModality: (modality) => {
    set({ selectedModality: modality, selectedTemplate: null });
  },

  selectTemplate: (template) => {
    set({ selectedTemplate: template });
  },

  addTemplate: async (data) => {
    const template = await api.createTemplate(data);
    set((state) => ({ templates: [...state.templates, template] }));
    return template;
  },

  updateTemplate: async (id, data) => {
    const updated = await api.updateTemplate(id, data);
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? updated : t)),
      selectedTemplate: state.selectedTemplate?.id === id ? updated : state.selectedTemplate,
    }));
  },

  removeTemplate: async (id) => {
    await api.deleteTemplate(id);
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      selectedTemplate: state.selectedTemplate?.id === id ? null : state.selectedTemplate,
    }));
  },

  getFilteredTemplates: () => {
    const { templates, selectedModality } = get();
    return templates.filter((t) => t.modality === selectedModality);
  },
}));
