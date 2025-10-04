import { useProjects as useProjectsContext } from '../context/ProjectsContext'

/**
 * Hook for managing projects with Supabase backend
 * 
 * Provides access to project state and operations including:
 * - CRUD operations for projects
 * - Callsheet management 
 * - Loading states and error handling
 * - Batch operations for multiple projects
 * 
 * @returns ProjectContextType with all project operations and state
 */
export const useProjects = useProjectsContext

export default useProjects