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
  DbTripLedgerBatchInsert,
  DbUserProfile,
  DbProfileInsert,
  DbProfileUpdate,
  DbRouteTemplate,
  DbRouteTemplateInsert,
  DbRouteTemplateUpdate,
  DbReport,
  DbReportInsert,
  DbReportUpdate
} from '../types/database'
import { Project, CallsheetFile, TripLedgerEntry, TripLedgerBatch, UserProfile, RouteTemplate, Report } from '../types'

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

      if (error) {
        console.warn('Database access error (possibly RLS policy issue):', error);
        // Return empty array if RLS blocks access - app should still work
        if (error.code === 'PGRST116' || error.code === '42501') {
          console.warn('RLS policy blocking access, returning empty projects list');
          return [];
        }
        throw error;
      }

      // Transform to legacy Project format
      const projects: Project[] = data.map(project => ({
        id: project.id,
        userId: project.user_id,
        name: project.name,
        description: project.description ?? null,
        producer: project.producer ?? '',
        ratePerKm: project.rate_per_km ?? null,
        ownerDriverId: project.owner_driver_id ?? null,
        callsheets: project.callsheets?.map((cs: DbCallsheet) => ({
          id: cs.id,
          name: cs.name,
          type: cs.type
        })) || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at
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
  async createProject(userId: string, data: {
    name: string
    description?: string | null
    producer?: string
    ratePerKm?: number | null
    ownerDriverId?: string | null
  }) {
    const payload = {
      user_id: userId,
      name: data.name,
      description: data.description ?? null,
      producer: data.producer ?? '',
      rate_per_km: data.ratePerKm ?? null,
      owner_driver_id: data.ownerDriverId ?? null
    }

    const { data: inserted, error } = await supabase
      .from('projects')
      .insert([payload])
      .select('*')
      .single()

    if (error) {
      console.error('createProject error', error)
      throw error
    }

    return inserted
  }

  private mapProject(row: DbProject) {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      producer: row.producer,
      ratePerKm: row.rate_per_km,
      ownerDriverId: row.owner_driver_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as Project
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
        userId: data.user_id,
        name: data.name,
        description: data.description ?? null,
        producer: data.producer ?? '',
        ratePerKm: data.rate_per_km ?? null,
        ownerDriverId: data.owner_driver_id ?? null,
        callsheets: data.callsheets?.map((cs: DbCallsheet) => ({
          id: cs.id,
          name: cs.name,
          type: cs.type
        })) || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
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
        userId: data.user_id,
        name: data.name,
        description: data.description ?? null,
        producer: data.producer ?? '',
        ratePerKm: data.rate_per_km ?? null,
        ownerDriverId: data.owner_driver_id ?? null,
        callsheets: data.callsheets?.map((cs: DbCallsheet) => ({
          id: cs.id,
          name: cs.name,
          type: cs.type
        })) || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at
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
  await this.createProject(userId, { name: project.name })
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
      const err = error as any
      console.error('Error adding ledger entry (detailed):', {
        message: err?.message,
        name: err?.name,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        insertPayload: {
          user_id: userId,
          hash: entry.hash,
          previous_hash: entry.previousHash,
          timestamp: entry.timestamp,
          operation: entry.operation,
          source: entry.source,
          batch_id: entry.batchId,
          trip_id: entry.tripId
        }
      })
      throw new Error('Failed to add ledger entry: ' + (err?.message || 'unknown'))
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
        .from('trip_batches')
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
        .from('trip_batches')
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
  await supabase.from('trip_batches').delete().eq('user_id', userId)

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
  await supabase.from('trip_batches').delete().eq('user_id', userId)
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

  // ===== USER PROFILE OPERATIONS =====

  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null
        }
        throw error
      }

      return this.transformDbProfileToLegacy(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
      throw new Error('Failed to fetch user profile')
    }
  }

  /**
   * Create user profile
   */
  async createUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const insertData: DbProfileInsert = {
        id: userId,
        email: profileData.email || null,
        full_name: profileData.fullName || null,
        name: profileData.name || null,
        license_plate: profileData.licensePlate || null,
        avatar_url: profileData.avatarUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      return this.transformDbProfileToLegacy(data)
    } catch (error) {
      console.error('Error creating user profile:', error)
      throw new Error('Failed to create user profile')
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const updateData: DbProfileUpdate = {
        updated_at: new Date().toISOString()
      }

      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.fullName !== undefined) updateData.full_name = updates.fullName
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.licensePlate !== undefined) updateData.license_plate = updates.licensePlate
      if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return this.transformDbProfileToLegacy(data)
    } catch (error) {
      console.error('Error updating user profile:', error)
      throw new Error('Failed to update user profile')
    }
  }

  /**
   * Delete user profile
   */
  async deleteUserProfile(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting user profile:', error)
      throw new Error('Failed to delete user profile')
    }
  }

  /**
   * Transform database profile to legacy format
   */
  private transformDbProfileToLegacy(dbProfile: DbUserProfile): UserProfile {
    return {
      id: dbProfile.id,
      email: dbProfile.email,
      fullName: dbProfile.full_name,
      name: dbProfile.name,
      licensePlate: dbProfile.license_plate,
      avatarUrl: dbProfile.avatar_url,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at,
      // Fields not in DB but expected in UserProfile type
      uid: null,
      address: null,
      city: null,
      country: null,
      profilePicture: null,
      color: null,
      ratePerKm: null,
      googleMapsApiKey: null,
      googleCalendarApiKey: null,
      googleCalendarClientId: null,
      googleCalendarPrimaryId: null,
      openRouterApiKey: null,
      openRouterModel: null,
      lockedUntilDate: null,
      vehicleType: null,
      fuelConsumption: null,
      fuelPrice: null,
      energyConsumption: null,
      energyPrice: null,
      maintenanceCostPerKm: null,
      parkingCostPerKm: null,
      tollsCostPerKm: null,
      finesCostPerKm: null,
      miscCostPerKm: null
    }
  }

  // ===== ROUTE TEMPLATE OPERATIONS =====

  /**
   * Get all route templates for a user
   */
  async getUserRouteTemplates(userId: string): Promise<RouteTemplate[]> {
    try {
      const { data, error } = await supabase
        .from('route_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Route templates access error:', error)
        if (error.code === 'PGRST116' || error.code === '42501' || error.code === '42P01') {
          return []
        }
        throw error
      }

      return data.map(this.transformDbRouteTemplateToLegacy)
    } catch (error) {
      console.error('Error fetching route templates:', error)
      throw new Error('Failed to fetch route templates')
    }
  }

  /**
   * Create a route template
   */
  async createRouteTemplate(userId: string, template: Omit<RouteTemplate, 'id' | 'createdAt' | 'uses' | 'lastUsedAt'>): Promise<RouteTemplate> {
    try {
      const insertData: DbRouteTemplateInsert = {
        user_id: userId,
        name: template.name,
        category: template.category,
        start_location: template.startLocation,
        end_location: template.endLocation,
        distance: template.distance,
        estimated_time_minutes: template.estimatedTimeMinutes || null,
        description: template.description || null,
        uses: 0,
        last_used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('route_templates')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      return this.transformDbRouteTemplateToLegacy(data)
    } catch (error) {
      console.error('Error creating route template:', error)
      throw new Error('Failed to create route template')
    }
  }

  /**
   * Update a route template
   */
  async updateRouteTemplate(templateId: string, updates: Partial<Omit<RouteTemplate, 'id'>>): Promise<RouteTemplate> {
    try {
      const updateData: DbRouteTemplateUpdate = {
        updated_at: new Date().toISOString()
      }

      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.category !== undefined) updateData.category = updates.category
      if (updates.startLocation !== undefined) updateData.start_location = updates.startLocation
      if (updates.endLocation !== undefined) updateData.end_location = updates.endLocation
      if (updates.distance !== undefined) updateData.distance = updates.distance
      if (updates.estimatedTimeMinutes !== undefined) updateData.estimated_time_minutes = updates.estimatedTimeMinutes
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.uses !== undefined) updateData.uses = updates.uses
      if (updates.lastUsedAt !== undefined) updateData.last_used_at = updates.lastUsedAt

      const { data, error } = await supabase
        .from('route_templates')
        .update(updateData)
        .eq('id', templateId)
        .select()
        .single()

      if (error) throw error

      return this.transformDbRouteTemplateToLegacy(data)
    } catch (error) {
      console.error('Error updating route template:', error)
      throw new Error('Failed to update route template')
    }
  }

  /**
   * Delete a route template
   */
  async deleteRouteTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('route_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting route template:', error)
      throw new Error('Failed to delete route template')
    }
  }

  /**
   * Increment template usage count
   */
  async incrementTemplateUse(templateId: string): Promise<void> {
    try {
      const { data: template, error: fetchError } = await supabase
        .from('route_templates')
        .select('uses')
        .eq('id', templateId)
        .single()

      if (fetchError) throw fetchError

      const { error: updateError } = await supabase
        .from('route_templates')
        .update({
          uses: (template.uses || 0) + 1,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)

      if (updateError) throw updateError
    } catch (error) {
      console.error('Error incrementing template use:', error)
      throw new Error('Failed to increment template use')
    }
  }

  /**
   * Delete all route templates for a user
   */
  async deleteAllUserRouteTemplates(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('route_templates')
        .delete()
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting all route templates:', error)
      throw new Error('Failed to delete all route templates')
    }
  }

  /**
   * Transform database route template to legacy format
   */
  private transformDbRouteTemplateToLegacy(dbTemplate: DbRouteTemplate): RouteTemplate {
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      category: dbTemplate.category,
      startLocation: dbTemplate.start_location,
      endLocation: dbTemplate.end_location,
      distance: dbTemplate.distance,
      estimatedTimeMinutes: dbTemplate.estimated_time_minutes || undefined,
      description: dbTemplate.description || undefined,
      uses: dbTemplate.uses,
      lastUsedAt: dbTemplate.last_used_at || undefined,
      createdAt: dbTemplate.created_at
    }
  }

  // ===== REPORT OPERATIONS =====

  /**
   * Get all reports for a user
   */
  async getUserReports(userId: string): Promise<Report[]> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Reports access error:', error)
        if (error.code === 'PGRST116' || error.code === '42501' || error.code === '42P01') {
          return []
        }
        throw error
      }

      return data.map(this.transformDbReportToLegacy)
    } catch (error) {
      console.error('Error fetching reports:', error)
      throw new Error('Failed to fetch reports')
    }
  }

  /**
   * Create a report
   */
  async createReport(userId: string, report: Omit<Report, 'id'>): Promise<Report> {
    try {
      const insertData: DbReportInsert = {
        user_id: userId,
        generation_date: report.generationDate,
        start_date: report.startDate,
        end_date: report.endDate,
        project_id: report.projectId,
        project_name: report.projectName,
        total_distance: report.totalDistance,
        trips_data: report.trips,
        user_profile_snapshot: report.userProfileSnapshot,
        signature: report.signature || null,
        first_trip_hash: report.firstTripHash || null,
        last_trip_hash: report.lastTripHash || null,
        ledger_verification: report.ledgerVerification || null,
        generation_timestamp: report.generationTimestamp || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('reports')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      return this.transformDbReportToLegacy(data)
    } catch (error) {
      console.error('Error creating report:', error)
      throw new Error('Failed to create report')
    }
  }

  /**
   * Get a single report by ID
   */
  async getReport(reportId: string): Promise<Report | null> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      return this.transformDbReportToLegacy(data)
    } catch (error) {
      console.error('Error fetching report:', error)
      throw new Error('Failed to fetch report')
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting report:', error)
      throw new Error('Failed to delete report')
    }
  }

  /**
   * Delete all reports for a user
   */
  async deleteAllUserReports(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting all reports:', error)
      throw new Error('Failed to delete all reports')
    }
  }

  /**
   * Transform database report to legacy format
   */
  private transformDbReportToLegacy(dbReport: DbReport): Report {
    return {
      id: dbReport.id,
      generationDate: dbReport.generation_date,
      startDate: dbReport.start_date,
      endDate: dbReport.end_date,
      projectId: dbReport.project_id,
      projectName: dbReport.project_name,
      totalDistance: dbReport.total_distance,
      trips: dbReport.trips_data,
      userProfileSnapshot: dbReport.user_profile_snapshot,
      signature: dbReport.signature || undefined,
      firstTripHash: dbReport.first_trip_hash || undefined,
      lastTripHash: dbReport.last_trip_hash || undefined,
      ledgerVerification: dbReport.ledger_verification || undefined,
      generationTimestamp: dbReport.generation_timestamp || undefined
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService()
export default databaseService