import { supabase } from '../lib/supabase'
import { 
  DbProject, 
  DbProjectInsert, 
  DbProjectUpdate,
  DbCallsheet,
  DbCallsheetInsert,
  DbCallsheetUpdate,
  DbTripLedger,
  DbTripLedgerInsert,
  DbTripLedgerBatch,
  DbTripLedgerBatchInsert
} from '../types/database'
import { Project, CallsheetFile, TripLedgerEntry, TripLedgerBatch } from '../types'

class DatabaseService {
  
  // ===== PROJECT OPERATIONS =====
  
  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          callsheets (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform to legacy Project format
      const projects: Project[] = data.map(project => ({
        id: project.id,
        name: project.name,
        producer: project.producer,
        ratePerKm: project.ratePerKm || undefined,
        ownerDriverId: project.ownerDriverId || undefined,
        callsheets: project.callsheets?.map((cs: DbCallsheet) => ({
          id: cs.id,
          name: cs.name,
          type: cs.type
        })) || []
      }))

      return projects
    } catch (error) {
      console.error('Error fetching user projects:', error)
      throw new Error('Failed to fetch projects')
    }
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, projectData: Omit<Project, 'id' | 'callsheets'>): Promise<Project> {
    try {
      const insertData: DbProjectInsert = {
        user_id: userId,
        name: projectData.name,
        producer: projectData.producer,
        ratePerKm: projectData.ratePerKm || null,
        ownerDriverId: projectData.ownerDriverId || null
      }

      const { data, error } = await supabase
        .from('projects')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      // Transform to legacy format
      const project: Project = {
        id: data.id,
        name: data.name,
        producer: data.producer,
        ratePerKm: data.ratePerKm || undefined,
        ownerDriverId: data.ownerDriverId || undefined,
        callsheets: []
      }

      return project
    } catch (error) {
      console.error('Error creating project:', error)
      throw new Error('Failed to create project')
    }
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, updates: Partial<Omit<Project, 'id' | 'callsheets'>>): Promise<Project> {
    try {
      const updateData: DbProjectUpdate = {
        updated_at: new Date().toISOString()
      }

      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.producer !== undefined) updateData.producer = updates.producer
      if (updates.ratePerKm !== undefined) updateData.ratePerKm = updates.ratePerKm || null
      if (updates.ownerDriverId !== undefined) updateData.ownerDriverId = updates.ownerDriverId || null

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .select(`
          *,
          callsheets (*)
        `)
        .single()

      if (error) throw error

      // Transform to legacy format
      const project: Project = {
        id: data.id,
        name: data.name,
        producer: data.producer,
        ratePerKm: data.ratePerKm || undefined,
        ownerDriverId: data.ownerDriverId || undefined,
        callsheets: data.callsheets?.map((cs: DbCallsheet) => ({
          id: cs.id,
          name: cs.name,
          type: cs.type
        })) || []
      }

      return project
    } catch (error) {
      console.error('Error updating project:', error)
      throw new Error('Failed to update project')
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      // First delete all associated callsheets
      const { error: callsheetsError } = await supabase
        .from('callsheets')
        .delete()
        .eq('project_id', projectId)

      if (callsheetsError) throw callsheetsError

      // Then delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting project:', error)
      throw new Error('Failed to delete project')
    }
  }

  /**
   * Delete multiple projects
   */
  async deleteMultipleProjects(projectIds: string[]): Promise<void> {
    try {
      // Delete all associated callsheets first
      const { error: callsheetsError } = await supabase
        .from('callsheets')
        .delete()
        .in('project_id', projectIds)

      if (callsheetsError) throw callsheetsError

      // Then delete the projects
      const { error } = await supabase
        .from('projects')
        .delete()
        .in('id', projectIds)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting multiple projects:', error)
      throw new Error('Failed to delete projects')
    }
  }

  // ===== CALLSHEET OPERATIONS =====

  /**
   * Add callsheets to a project
   */
  async addCallsheetsToProject(projectId: string, files: File[]): Promise<CallsheetFile[]> {
    try {
      const callsheets: CallsheetFile[] = []

      for (const file of files) {
        // For now, we'll store file metadata only
        // In a production environment, you'd want to upload files to Supabase Storage
        const callsheetData: DbCallsheetInsert = {
          project_id: projectId,
          name: file.name,
          type: file.type,
          file_data: {
            size: file.size,
            lastModified: file.lastModified
          }
        }

        const { data, error } = await supabase
          .from('callsheets')
          .insert(callsheetData)
          .select()
          .single()

        if (error) throw error

        callsheets.push({
          id: data.id,
          name: data.name,
          type: data.type
        })
      }

      return callsheets
    } catch (error) {
      console.error('Error adding callsheets to project:', error)
      throw new Error('Failed to add callsheets')
    }
  }

  /**
   * Delete a callsheet from a project
   */
  async deleteCallsheetFromProject(callsheetId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('callsheets')
        .delete()
        .eq('id', callsheetId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting callsheet:', error)
      throw new Error('Failed to delete callsheet')
    }
  }

  // ===== UTILITY OPERATIONS =====

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          callsheets (*)
        `)
        .eq('id', projectId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null
        }
        throw error
      }

      // Transform to legacy format
      const project: Project = {
        id: data.id,
        name: data.name,
        producer: data.producer,
        ratePerKm: data.ratePerKm || undefined,
        ownerDriverId: data.ownerDriverId || undefined,
        callsheets: data.callsheets?.map((cs: DbCallsheet) => ({
          id: cs.id,
          name: cs.name,
          type: cs.type
        })) || []
      }

      return project
    } catch (error) {
      console.error('Error fetching project:', error)
      throw new Error('Failed to fetch project')
    }
  }

  /**
   * Replace all projects for a user (for data import)
   */
  async replaceAllProjects(userId: string, projects: Project[]): Promise<void> {
    try {
      // Delete all existing projects (cascade will handle callsheets)
      await supabase
        .from('projects')
        .delete()
        .eq('user_id', userId)

      // Insert new projects
      for (const project of projects) {
        await this.createProject(userId, project)
      }
    } catch (error) {
      console.error('Error replacing all projects:', error)
      throw new Error('Failed to replace projects')
    }
  }

  /**
   * Delete all projects for a user
   */
  async deleteAllUserProjects(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting all user projects:', error)
      throw new Error('Failed to delete all projects')
    }
  }

  // ===== TRIP LEDGER OPERATIONS =====

  /**
   * Get all ledger entries for a user, ordered by timestamp
   */
  async getUserLedgerEntries(userId: string): Promise<TripLedgerEntry[]> {
    try {
      const { data, error } = await supabase
        .from('trip_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true })

      if (error) throw error

      // Transform to legacy TripLedgerEntry format
      return data.map(this.transformDbLedgerToLegacy)
    } catch (error) {
      console.error('Error fetching user ledger entries:', error)
      throw new Error('Failed to fetch ledger entries')
    }
  }

  /**
   * Add a new ledger entry
   */
  async addLedgerEntry(userId: string, entry: TripLedgerEntry): Promise<TripLedgerEntry> {
    try {
      const insertData: DbTripLedgerInsert = {
        user_id: userId,
        hash: entry.hash,
        previous_hash: entry.previousHash,
        timestamp: entry.timestamp,
        operation: entry.operation as any,
        source: entry.source as any,
        batch_id: entry.batchId || null,
        trip_id: entry.tripId,
        trip_snapshot: entry.tripSnapshot,
        correction_reason: entry.correctionReason || null,
        changed_fields: entry.changedFields || null,
        source_document_id: entry.sourceDocumentId || null,
        source_document_name: entry.sourceDocumentName || null,
        void_reason: entry.voidReason || null,
        previous_snapshot: entry.previousSnapshot || null
      }

      const { data, error } = await supabase
        .from('trip_ledger')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      return this.transformDbLedgerToLegacy(data)
    } catch (error) {
      console.error('Error adding ledger entry:', error)
      throw new Error('Failed to add ledger entry')
    }
  }

  /**
   * Add multiple ledger entries in a batch
   */
  async addLedgerEntries(userId: string, entries: TripLedgerEntry[]): Promise<TripLedgerEntry[]> {
    try {
      const insertData: DbTripLedgerInsert[] = entries.map(entry => ({
        user_id: userId,
        hash: entry.hash,
        previous_hash: entry.previousHash,
        timestamp: entry.timestamp,
        operation: entry.operation as any,
        source: entry.source as any,
        batch_id: entry.batchId || null,
        trip_id: entry.tripId,
        trip_snapshot: entry.tripSnapshot,
        correction_reason: entry.correctionReason || null,
        changed_fields: entry.changedFields || null,
        source_document_id: entry.sourceDocumentId || null,
        source_document_name: entry.sourceDocumentName || null,
        void_reason: entry.voidReason || null,
        previous_snapshot: entry.previousSnapshot || null
      }))

      const { data, error } = await supabase
        .from('trip_ledger')
        .insert(insertData)
        .select()

      if (error) throw error

      return data.map(this.transformDbLedgerToLegacy)
    } catch (error) {
      console.error('Error adding ledger entries:', error)
      throw new Error('Failed to add ledger entries')
    }
  }

  /**
   * Get ledger entries by batch ID
   */
  async getLedgerEntriesByBatch(batchId: string): Promise<TripLedgerEntry[]> {
    try {
      const { data, error } = await supabase
        .from('trip_ledger')
        .select('*')
        .eq('batch_id', batchId)
        .order('timestamp', { ascending: true })

      if (error) throw error

      return data.map(this.transformDbLedgerToLegacy)
    } catch (error) {
      console.error('Error fetching batch ledger entries:', error)
      throw new Error('Failed to fetch batch ledger entries')
    }
  }

  /**
   * Create a new ledger batch
   */
  async createLedgerBatch(userId: string, batch: TripLedgerBatch): Promise<TripLedgerBatch> {
    try {
      const insertData: DbTripLedgerBatchInsert = {
        batch_id: batch.batchId,
        user_id: userId,
        timestamp: batch.timestamp,
        source: batch.source as any,
        entry_count: batch.entryCount,
        first_entry_hash: batch.firstEntryHash,
        last_entry_hash: batch.lastEntryHash,
        source_documents: batch.sourceDocuments || null
      }

      const { data, error } = await supabase
        .from('trip_ledger_batches')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      return this.transformDbBatchToLegacy(data)
    } catch (error) {
      console.error('Error creating ledger batch:', error)
      throw new Error('Failed to create ledger batch')
    }
  }

  /**
   * Get all ledger batches for a user
   */
  async getUserLedgerBatches(userId: string): Promise<TripLedgerBatch[]> {
    try {
      const { data, error } = await supabase
        .from('trip_ledger_batches')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })

      if (error) throw error

      return data.map(this.transformDbBatchToLegacy)
    } catch (error) {
      console.error('Error fetching user ledger batches:', error)
      throw new Error('Failed to fetch ledger batches')
    }
  }

  /**
   * Replace all ledger entries for a user (for data migration)
   */
  async replaceAllLedgerEntries(userId: string, entries: TripLedgerEntry[]): Promise<void> {
    try {
      // Delete all existing ledger entries and batches
      await supabase.from('trip_ledger').delete().eq('user_id', userId)
      await supabase.from('trip_ledger_batches').delete().eq('user_id', userId)

      // Insert new entries if any
      if (entries.length > 0) {
        await this.addLedgerEntries(userId, entries)
      }
    } catch (error) {
      console.error('Error replacing all ledger entries:', error)
      throw new Error('Failed to replace ledger entries')
    }
  }

  /**
   * Delete all ledger entries for a user
   */
  async deleteAllUserLedgerEntries(userId: string): Promise<void> {
    try {
      // Delete ledger entries first (due to foreign key constraints)
      await supabase.from('trip_ledger').delete().eq('user_id', userId)
      await supabase.from('trip_ledger_batches').delete().eq('user_id', userId)
    } catch (error) {
      console.error('Error deleting all user ledger entries:', error)
      throw new Error('Failed to delete all ledger entries')
    }
  }

  // ===== TRANSFORMATION HELPERS =====

  /**
   * Transform database ledger entry to legacy format
   */
  private transformDbLedgerToLegacy(dbEntry: DbTripLedger): TripLedgerEntry {
    return {
      id: dbEntry.id,
      hash: dbEntry.hash,
      previousHash: dbEntry.previous_hash,
      timestamp: dbEntry.timestamp,
      operation: dbEntry.operation as any,
      source: dbEntry.source as any,
      userId: dbEntry.user_id,
      batchId: dbEntry.batch_id || undefined,
      tripId: dbEntry.trip_id,
      tripSnapshot: dbEntry.trip_snapshot,
      correctionReason: dbEntry.correction_reason || undefined,
      changedFields: dbEntry.changed_fields || undefined,
      sourceDocumentId: dbEntry.source_document_id || undefined,
      sourceDocumentName: dbEntry.source_document_name || undefined,
      voidReason: dbEntry.void_reason || undefined,
      previousSnapshot: dbEntry.previous_snapshot || undefined
    }
  }

  /**
   * Transform database batch to legacy format
   */
  private transformDbBatchToLegacy(dbBatch: DbTripLedgerBatch): TripLedgerBatch {
    return {
      batchId: dbBatch.batch_id,
      timestamp: dbBatch.timestamp,
      source: dbBatch.source as any,
      userId: dbBatch.user_id,
      entryCount: dbBatch.entry_count,
      firstEntryHash: dbBatch.first_entry_hash,
      lastEntryHash: dbBatch.last_entry_hash,
      sourceDocuments: dbBatch.source_documents || undefined
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService()
export default databaseService