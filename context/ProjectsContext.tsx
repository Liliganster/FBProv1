import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { Project, ProjectsState } from '../types'
import { databaseService } from '../services/databaseService'
import { useAuth } from '../hooks/useAuth'
import useToast from '../hooks/useToast'

type ProjectAction = 
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'UPDATE_PROJECT'; project: Project }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'DELETE_MULTIPLE_PROJECTS'; ids: string[] }
  | { type: 'SET_EDITING_PROJECT'; project: Project | null }
  | { type: 'SET_SELECTED_PROJECT'; id: string | null }
  | { type: 'SET_ERROR'; error: string | null }

interface ProjectContextType extends ProjectsState {
  addProject: (project: Omit<Project, 'id' | 'callsheets'>) => Promise<void>
  updateProject: (id: string, project: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  deleteSelectedProjects: (projectIds: string[]) => Promise<void>
  fetchProjects: () => Promise<void>
  setEditingProject: (project: Project | null) => void
  setSelectedProject: (id: string | null) => void
  addCallsheetsToProject: (projectId: string, files: File[]) => Promise<void>
  deleteCallsheetFromProject: (projectId: string, callsheetId: string) => Promise<void>
  replaceAllProjects: (projects: Project[]) => Promise<void>
  deleteAllProjects: () => Promise<void>
}

const initialState: ProjectsState = {
  projects: [],
  editingProject: null,
  selectedProject: null,
  loading: false,
  error: null
}

function projectsReducer(state: ProjectsState, action: ProjectAction): ProjectsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading, error: null }
    
    case 'SET_PROJECTS':
      return { ...state, projects: action.projects, loading: false, error: null }
    
    case 'ADD_PROJECT':
      return { 
        ...state, 
        projects: [action.project, ...state.projects],
        loading: false,
        error: null
      }
    
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => p.id === action.project.id ? action.project : p),
        editingProject: state.editingProject?.id === action.project.id ? action.project : state.editingProject,
        loading: false,
        error: null
      }
    
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.id),
        selectedProject: state.selectedProject === action.id ? null : state.selectedProject,
        editingProject: state.editingProject?.id === action.id ? null : state.editingProject,
        loading: false,
        error: null
      }
    
    case 'DELETE_MULTIPLE_PROJECTS':
      return {
        ...state,
        projects: state.projects.filter(p => !action.ids.includes(p.id)),
        selectedProject: action.ids.includes(state.selectedProject || '') ? null : state.selectedProject,
        editingProject: action.ids.includes(state.editingProject?.id || '') ? null : state.editingProject,
        loading: false,
        error: null
      }
    
    case 'SET_EDITING_PROJECT':
      return { ...state, editingProject: action.project }
    
    case 'SET_SELECTED_PROJECT':
      return { ...state, selectedProject: action.id }
    
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }
    
    default:
      return state
  }
}

const ProjectsContext = createContext<ProjectContextType | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectsReducer, initialState)
  const { user } = useAuth()
  const { showToast } = useToast()

  const fetchProjects = useCallback(async () => {
    if (!user?.id) {
      dispatch({ type: 'SET_PROJECTS', projects: [] })
      return
    }

    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      const projects = await databaseService.getUserProjects(user.id)
      dispatch({ type: 'SET_PROJECTS', projects })
    } catch (error) {
      console.error('Error fetching projects:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast('Error fetching projects', 'error')
    }
  }, [user?.id, showToast])

  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'callsheets'>) => {
    if (!user?.id) {
      showToast('User not authenticated', 'error')
      return
    }

    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      const newProject = await databaseService.createProject(user.id, projectData)
      dispatch({ type: 'ADD_PROJECT', project: newProject })
      showToast('Project created successfully', 'success')
    } catch (error) {
      console.error('Error creating project:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast(errorMessage, 'error')
    }
  }, [user?.id, showToast])

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      const updatedProject = await databaseService.updateProject(id, updates)
      dispatch({ type: 'UPDATE_PROJECT', project: updatedProject })
      showToast('Project updated successfully', 'success')
    } catch (error) {
      console.error('Error updating project:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update project'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast(errorMessage, 'error')
    }
  }, [showToast])

  const deleteProject = useCallback(async (id: string) => {
    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      await databaseService.deleteProject(id)
      dispatch({ type: 'DELETE_PROJECT', id })
      showToast('Project deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting project:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete project'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast(errorMessage, 'error')
    }
  }, [showToast])

  const deleteSelectedProjects = useCallback(async (projectIds: string[]) => {
    if (projectIds.length === 0) return
    
    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      await databaseService.deleteMultipleProjects(projectIds)
      dispatch({ type: 'DELETE_MULTIPLE_PROJECTS', ids: projectIds })
      showToast(`${projectIds.length} project(s) deleted successfully`, 'success')
    } catch (error) {
      console.error('Error deleting projects:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete projects'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast(errorMessage, 'error')
    }
  }, [showToast])

  const addCallsheetsToProject = useCallback(async (projectId: string, files: File[]) => {
    try {
      const callsheets = await databaseService.addCallsheetsToProject(projectId, files)
      
      // Update the project with new callsheets
      const currentProject = state.projects.find(p => p.id === projectId)
      if (currentProject) {
        const updatedProject: Project = {
          ...currentProject,
          callsheets: [...(currentProject.callsheets || []), ...callsheets]
        }
        dispatch({ type: 'UPDATE_PROJECT', project: updatedProject })
      }
      
      showToast(`${callsheets.length} callsheet(s) added successfully`, 'success')
    } catch (error) {
      console.error('Error adding callsheets:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to add callsheets'
      showToast(errorMessage, 'error')
    }
  }, [state.projects, showToast])

  const deleteCallsheetFromProject = useCallback(async (projectId: string, callsheetId: string) => {
    try {
      await databaseService.deleteCallsheetFromProject(callsheetId)
      
      // Update the project by removing the callsheet
      const currentProject = state.projects.find(p => p.id === projectId)
      if (currentProject) {
        const updatedProject: Project = {
          ...currentProject,
          callsheets: (currentProject.callsheets || []).filter(cs => cs.id !== callsheetId)
        }
        dispatch({ type: 'UPDATE_PROJECT', project: updatedProject })
      }
      
      showToast('Callsheet deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting callsheet:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete callsheet'
      showToast(errorMessage, 'error')
    }
  }, [state.projects, showToast])

  const replaceAllProjects = useCallback(async (projects: Project[]) => {
    if (!user?.id) {
      showToast('User not authenticated', 'error')
      return
    }

    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      await databaseService.replaceAllProjects(user.id, projects)
      await fetchProjects() // Refresh from database
      showToast('All projects imported successfully', 'success')
    } catch (error) {
      console.error('Error replacing projects:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to import projects'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast(errorMessage, 'error')
    }
  }, [user?.id, fetchProjects, showToast])

  const deleteAllProjects = useCallback(async () => {
    if (!user?.id) {
      showToast('User not authenticated', 'error')
      return
    }

    dispatch({ type: 'SET_LOADING', loading: true })
    
    try {
      await databaseService.deleteAllUserProjects(user.id)
      dispatch({ type: 'SET_PROJECTS', projects: [] })
      showToast('All projects deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting all projects:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete all projects'
      dispatch({ type: 'SET_ERROR', error: errorMessage })
      showToast(errorMessage, 'error')
    }
  }, [user?.id, showToast])

  const setEditingProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_EDITING_PROJECT', project })
  }, [])

  const setSelectedProject = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_PROJECT', id })
  }, [])

  // Fetch projects when user changes
  React.useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const contextValue: ProjectContextType = {
    ...state,
    addProject,
    updateProject,
    deleteProject,
    deleteSelectedProjects,
    fetchProjects,
    setEditingProject,
    setSelectedProject,
    addCallsheetsToProject,
    deleteCallsheetFromProject,
    replaceAllProjects,
    deleteAllProjects
  }

  return (
    <ProjectsContext.Provider value={contextValue}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects() {
  const context = useContext(ProjectsContext)
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider')
  }
  return context
}