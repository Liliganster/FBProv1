import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { RouteTemplate } from '../types';
import { v4 as uuid } from 'uuid';

interface RouteTemplatesContextValue {
  templates: RouteTemplate[];
  createTemplate: (data: Omit<RouteTemplate, 'id' | 'createdAt' | 'uses' | 'lastUsedAt'>) => RouteTemplate;
  updateTemplate: (id: string, data: Partial<Omit<RouteTemplate, 'id'>>) => void;
  deleteTemplate: (id: string) => void;
  incrementUse: (id: string) => void;
  importTemplates: (data: RouteTemplate[]) => void;
  clearAll: () => void;
}

const RouteTemplatesContext = createContext<RouteTemplatesContextValue | undefined>(undefined);

const STORAGE_KEY = 'route_templates_v1';

export const RouteTemplatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTemplates(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load route templates', e);
    }
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to persist route templates', e);
    }
  }, [templates]);

  const createTemplate: RouteTemplatesContextValue['createTemplate'] = useCallback((data) => {
    const tpl: RouteTemplate = {
      id: uuid(),
      name: data.name,
      category: data.category,
      startLocation: data.startLocation,
      endLocation: data.endLocation,
      distance: data.distance,
      estimatedTimeMinutes: data.estimatedTimeMinutes,
      description: data.description,
      uses: 0,
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => [...prev, tpl]);
    return tpl;
  }, []);

  const updateTemplate: RouteTemplatesContextValue['updateTemplate'] = useCallback((id, data) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, []);

  const deleteTemplate: RouteTemplatesContextValue['deleteTemplate'] = useCallback((id) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const incrementUse: RouteTemplatesContextValue['incrementUse'] = useCallback((id) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, uses: t.uses + 1, lastUsedAt: new Date().toISOString() } : t));
  }, []);

  const importTemplates: RouteTemplatesContextValue['importTemplates'] = useCallback((data) => {
    setTemplates(data);
  }, []);

  const clearAll: RouteTemplatesContextValue['clearAll'] = useCallback(() => {
    setTemplates([]);
  }, []);

  return (
    <RouteTemplatesContext.Provider value={{ templates, createTemplate, updateTemplate, deleteTemplate, incrementUse, importTemplates, clearAll }}>
      {children}
    </RouteTemplatesContext.Provider>
  );
};

export const useRouteTemplatesContext = () => {
  const ctx = useContext(RouteTemplatesContext);
  if (!ctx) throw new Error('useRouteTemplatesContext must be used within RouteTemplatesProvider');
  return ctx;
};
