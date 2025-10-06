import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { RouteTemplate } from '../types';
import { databaseService } from '../services/databaseService';
import { useAuth } from '../hooks/useAuth';
import useToast from '../hooks/useToast';

interface RouteTemplatesContextValue {
  templates: RouteTemplate[];
  loading: boolean;
  error: string | null;
  createTemplate: (data: Omit<RouteTemplate, 'id' | 'createdAt' | 'uses' | 'lastUsedAt'>) => Promise<RouteTemplate>;
  updateTemplate: (id: string, data: Partial<Omit<RouteTemplate, 'id'>>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  incrementUse: (id: string) => Promise<void>;
  importTemplates: (data: RouteTemplate[]) => Promise<void>;
  clearAll: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
}

const RouteTemplatesContext = createContext<RouteTemplatesContextValue | undefined>(undefined);

export const RouteTemplatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates from Supabase
  const refreshTemplates = useCallback(async () => {
    if (!user?.id) {
      setTemplates([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userTemplates = await databaseService.getUserRouteTemplates(user.id);
      setTemplates(userTemplates);
    } catch (err) {
      console.error('Error loading route templates:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
      setError(errorMessage);
      
      // Try to load from localStorage as fallback
      try {
        const localData = localStorage.getItem('route_templates_v1');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            setTemplates(parsed);
            console.warn('Using localStorage fallback for route templates');
          }
        }
      } catch (localError) {
        console.error('Failed to load from localStorage:', localError);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-migrate from localStorage on first load
  useEffect(() => {
    const migrateFromLocalStorage = async () => {
      if (!user?.id) return;

      try {
        const localData = localStorage.getItem('route_templates_v1');
        if (!localData) return;

        const localTemplates = JSON.parse(localData) as RouteTemplate[];
        if (!Array.isArray(localTemplates) || localTemplates.length === 0) return;

        // Check if we already have templates in Supabase
        const existingTemplates = await databaseService.getUserRouteTemplates(user.id);
        if (existingTemplates.length > 0) {
          console.log('Route templates already migrated to Supabase');
          return;
        }

        // Migrate templates to Supabase
        console.log(`Migrating ${localTemplates.length} route templates to Supabase...`);
        for (const template of localTemplates) {
          await databaseService.createRouteTemplate(user.id, {
            name: template.name,
            category: template.category,
            startLocation: template.startLocation,
            endLocation: template.endLocation,
            distance: template.distance,
            estimatedTimeMinutes: template.estimatedTimeMinutes,
            description: template.description
          });
        }

        // Clear localStorage after successful migration
        localStorage.removeItem('route_templates_v1');
        showToast(`Migrated ${localTemplates.length} route templates to cloud storage`, 'success');
        
        // Refresh to show migrated data
        await refreshTemplates();
      } catch (error) {
        console.error('Failed to migrate route templates:', error);
      }
    };

    migrateFromLocalStorage();
  }, [user?.id, showToast, refreshTemplates]);

  // Load templates on mount
  useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  const createTemplate = useCallback(async (data: Omit<RouteTemplate, 'id' | 'createdAt' | 'uses' | 'lastUsedAt'>): Promise<RouteTemplate> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      const newTemplate = await databaseService.createRouteTemplate(user.id, data);
      await refreshTemplates();
      showToast('Template created successfully', 'success');
      return newTemplate;
    } catch (err) {
      console.error('Error creating template:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshTemplates, showToast]);

  const updateTemplate = useCallback(async (id: string, data: Partial<Omit<RouteTemplate, 'id'>>): Promise<void> => {
    setLoading(true);
    try {
      await databaseService.updateRouteTemplate(id, data);
      await refreshTemplates();
      showToast('Template updated successfully', 'success');
    } catch (err) {
      console.error('Error updating template:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshTemplates, showToast]);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await databaseService.deleteRouteTemplate(id);
      await refreshTemplates();
      showToast('Template deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting template:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [refreshTemplates, showToast]);

  const incrementUse = useCallback(async (id: string): Promise<void> => {
    try {
      await databaseService.incrementTemplateUse(id);
      await refreshTemplates();
    } catch (err) {
      console.error('Error incrementing template use:', err);
      // Don't show toast for this - it's a silent operation
    }
  }, [refreshTemplates]);

  const importTemplates = useCallback(async (data: RouteTemplate[]): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      // Clear existing templates
      await databaseService.deleteAllUserRouteTemplates(user.id);
      
      // Import new templates
      for (const template of data) {
        await databaseService.createRouteTemplate(user.id, {
          name: template.name,
          category: template.category,
          startLocation: template.startLocation,
          endLocation: template.endLocation,
          distance: template.distance,
          estimatedTimeMinutes: template.estimatedTimeMinutes,
          description: template.description
        });
      }
      
      await refreshTemplates();
      showToast(`Imported ${data.length} templates`, 'success');
    } catch (err) {
      console.error('Error importing templates:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import templates';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshTemplates, showToast]);

  const clearAll = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    try {
      await databaseService.deleteAllUserRouteTemplates(user.id);
      await refreshTemplates();
      showToast('All templates cleared', 'success');
    } catch (err) {
      console.error('Error clearing templates:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear templates';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshTemplates, showToast]);

  const contextValue: RouteTemplatesContextValue = {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    incrementUse,
    importTemplates,
    clearAll,
    refreshTemplates
  };

  return (
    <RouteTemplatesContext.Provider value={contextValue}>
      {children}
    </RouteTemplatesContext.Provider>
  );
};

export const useRouteTemplatesContext = () => {
  const ctx = useContext(RouteTemplatesContext);
  if (!ctx) throw new Error('useRouteTemplatesContext must be used within RouteTemplatesProvider');
  return ctx;
};

