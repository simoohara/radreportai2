import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTemplateStore } from '../templateStore';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
  }
}));

describe('useTemplateStore', () => {
  beforeEach(() => {
    useTemplateStore.setState({ templates: [], isLoading: false, selectedTemplate: null, selectedModality: 'Radio' });
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const state = useTemplateStore.getState();
    expect(state.templates).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.selectedModality).toBe('Radio');
  });

  it('should set selected modality and clear selected template', () => {
    useTemplateStore.setState({ selectedTemplate: { id: 1 } as any });
    
    useTemplateStore.getState().setSelectedModality('IRM');
    
    const state = useTemplateStore.getState();
    expect(state.selectedModality).toBe('IRM');
    expect(state.selectedTemplate).toBeNull();
  });

  it('should load templates successfully', async () => {
    const mockTemplates = [
      { id: 1, name: 'T1', modality: 'Radio', content: 'C1', is_system: true, user_id: null, created_at: '', updated_at: '' },
      { id: 2, name: 'T2', modality: 'IRM', content: 'C2', is_system: true, user_id: null, created_at: '', updated_at: '' }
    ] as any;
    vi.mocked(api.getTemplates).mockResolvedValue(mockTemplates);

    const loadPromise = useTemplateStore.getState().loadTemplates();
    
    // While loading
    expect(useTemplateStore.getState().isLoading).toBe(true);
    
    await loadPromise;
    
    // After loading
    const state = useTemplateStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.templates).toEqual(mockTemplates);
  });

  it('should filter templates by modality', () => {
    const mockTemplates = [
      { id: 1, name: 'T1', modality: 'Radio', content: 'C1', is_system: true, user_id: null, created_at: '', updated_at: '' },
      { id: 2, name: 'T2', modality: 'IRM', content: 'C2', is_system: true, user_id: null, created_at: '', updated_at: '' }
    ] as any;
    useTemplateStore.setState({ templates: mockTemplates, selectedModality: 'IRM' });

    const filtered = useTemplateStore.getState().getFilteredTemplates();
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].modality).toBe('IRM');
  });
});
