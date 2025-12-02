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
  DbReportUpdate,
  DbExpenseDocument,
  DbExpenseDocumentInsert
} from '../types/database'
import { Project, CallsheetFile, TripLedgerEntry, TripLedgerBatch, UserProfile, RouteTemplate, Report, ExpenseDocument, ExpenseCategory } from '../types'
import { ownershipValidation, OwnershipError } from './ownershipValidationService'
import { withTimeout, TIMEOUT_CONFIGS, TimeoutError } from '../lib/timeoutHandler'

class DatabaseService {

  /**
   * Wrapper para queries de Supabase con timeout automático
   */
  private async withDbTimeout<T>(
    queryBuilder: any,
    operation: string,
    timeout: number = TIMEOUT_CONFIGS.DB_READ
  ): Promise<{ data: T | null; error: any }> {
    try {
      // Convert the query builder to a promise if it isn't already
      const query = typeof queryBuilder.then === 'function'
        ? queryBuilder
        : Promise.resolve(queryBuilder);

      return await withTimeout(query, { timeout, operation });
    } catch (error) {
      if (error instanceof TimeoutError) {
        console.error(`Database timeout: ${operation}`, error);
        return {
          data: null,
          error: {
            message: `Operation timed out after ${timeout}ms: ${operation}`,
            code: 'TIMEOUT',
            details: operation
          }
        };
      }
      throw error;
    }
  }

  // ===== API KEY ENCRYPTION HELPERS =====

  /**
   * Safely encrypt an API key for storage using Web Crypto API
   */
  private async encryptApiKeyAsync(apiKey: string | null | undefined): Promise<string | null> {
    if (!apiKey || apiKey.trim() === '') {
      return null;
    }

    try {
      const { apiKeyEncryptionService } = await import('./apiKeyEncryptionService');
      return await apiKeyEncryptionService.encryptApiKey(apiKey);
    } catch (error) {
      console.error('Encryption failed, storing plaintext:', error);
      return apiKey; // Fallback to plaintext if encryption fails
    }
  }

  /**
   * Safely decrypt an API key from storage using Web Crypto API
   */
  private async decryptApiKeyAsync(encryptedData: string | null | undefined): Promise<string | null> {
    if (!encryptedData) {
      return null;
    }

    // Try to detect if it's encrypted (has JSON structure with 'data' and 'iv')
    try {
      const parsed = JSON.parse(encryptedData);
      if (parsed.data && parsed.iv) {
        // It's encrypted, decrypt it
        const { apiKeyEncryptionService } = await import('./apiKeyEncryptionService');
        return await apiKeyEncryptionService.decryptApiKey(encryptedData);
      }
    } catch {
      // Not JSON or decryption failed, assume it's plaintext
    }

    // Return as-is (plaintext)
    return encryptedData;
  }


  
  // ===== PROJECT OPERATIONS =====
  
  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    try {
      const { data, error } = await this.withDbTimeout<any[]>(
        supabase
          .from('projects')
          .select(`
            *,
            callsheets (*)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        'Get user projects'
      )

      if (error) {
        console.warn('Database access error (possibly RLS policy issue):', error);
        // Return empty array if RLS blocks access - app should still work
        if (error.code === 'PGRST116' || error.code === '42501' || error.code === 'TIMEOUT') {
          console.warn('RLS policy blocking access or timeout, returning empty projects list');
          return [];
        }
        throw error;
      }

      // Check if data exists
      if (!data || data.length === 0) {
        return [];
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
            // Compatibilidad: si la columna real es filename
          name: (cs as any).filename ?? (cs as any).name,
          type: 'application/octet-stream' // Default type since column doesn't exist in DB
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
   * Update a project (with explicit ownership validation)
   */
  async updateProject(projectId: string, userId: string, updates: Partial<Omit<Project, 'id' | 'callsheets'>>): Promise<Project> {
    try {
      // Validate ownership before allowing update
      await ownershipValidation.validateOwnershipAndThrow(
        'project',
        projectId,
        userId,
        () => ownershipValidation.validateProjectOwnership(projectId, userId)
      );

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
          name: (cs as any).filename ?? (cs as any).name,
          type: 'application/octet-stream' // Default type since column doesn't exist in DB
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
   * Delete a project (with explicit ownership validation)
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    try {
      // Validate ownership before allowing deletion
      await ownershipValidation.validateOwnershipAndThrow(
        'project',
        projectId,
        userId,
        () => ownershipValidation.validateProjectOwnership(projectId, userId)
      );

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
   * Delete multiple projects (with explicit ownership validation)
   */
  async deleteMultipleProjects(projectIds: string[], userId: string): Promise<void> {
    try {
      // Validate ownership of all projects before deletion
      await ownershipValidation.validateOwnershipAndThrow(
        'projects',
        projectIds.join(','),
        userId,
        () => ownershipValidation.validateMultipleProjectsOwnership(projectIds, userId)
      );

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
      if (!files || files.length === 0) return []

      // Obtener user id actual
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw new Error('No se pudo obtener usuario autenticado')
      const userId = authData?.user?.id
      if (!userId) throw new Error('Usuario no autenticado')

      // Validate ownership before allowing callsheet addition to project
      await ownershipValidation.validateOwnershipAndThrow(
        'project',
        projectId,
        userId,
        () => ownershipValidation.validateProjectOwnership(projectId, userId)
      );

      // Validate files before upload (security check)
      const { validateFile } = await import('./fileValidationService');

      const validationResults = await Promise.all(
        files.map(async (file) => ({
          file,
          validation: await validateFile(file)
        }))
      );

      // Check for any invalid files
      const invalidFiles = validationResults.filter(r => !r.validation.valid);
      if (invalidFiles.length > 0) {
        const errorMessages = invalidFiles.map(r =>
          `${r.file.name}: ${r.validation.error}`
        ).join('; ');
        throw new Error(`File validation failed: ${errorMessages}`);
      }

      // Upload files to Supabase Storage and create database records
      const uploadResults = await Promise.all(
        validationResults.map(async ({ file }) => {
          // Generate unique file path
          const timestamp = Date.now()
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
          const filePath = `${userId}/${projectId}/${timestamp}_${sanitizedFileName}`

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('callsheets')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            throw new Error(`Failed to upload file ${file.name}: ${uploadError.message}`)
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('callsheets')
            .getPublicUrl(filePath)

          return {
            filePath,  // Keep for cleanup if needed
            fileType: file.type,  // Keep for return value
            dbRecord: {
              project_id: projectId,
              user_id: userId,
              filename: file.name,
              url: publicUrl
            }
          }
        })
      )

      // Insert records into database (only columns that exist)
      const callsheetsToInsert = uploadResults.map(r => r.dbRecord)
      
      const { data, error } = await supabase
        .from('callsheets')
        .insert(callsheetsToInsert)
        .select()

      if (error) {
        // If database insert fails, clean up uploaded files
        await Promise.all(
          uploadResults.map(r => 
            supabase.storage.from('callsheets').remove([r.filePath])
          )
        )
        throw new Error(`Failed to add callsheets: ${error.message}`)
      }

      return (data || []).map((d: any, index: number) => ({ 
        id: d.id, 
        name: d.filename ?? d.name, 
        type: uploadResults[index].fileType || 'application/octet-stream'
      }))
    } catch (error) {
      throw new Error((error as any)?.message || 'Failed to add callsheets')
    }
  }

  /**
   * Delete a callsheet from a project (with explicit ownership validation)
   */
  async deleteCallsheetFromProject(callsheetId: string, userId: string): Promise<void> {
    try {
      // Validate ownership before allowing deletion
      await ownershipValidation.validateOwnershipAndThrow(
        'callsheet',
        callsheetId,
        userId,
        () => ownershipValidation.validateCallsheetOwnership(callsheetId, userId)
      );

      // Get callsheet record to extract file path from URL
      const { data: callsheet, error: fetchError } = await supabase
        .from('callsheets')
        .select('url')
        .eq('id', callsheetId)
        .single()

      if (fetchError) throw fetchError

      // Extract file path from URL and delete from storage
      if (callsheet?.url) {
        try {
          // Extract path from Supabase storage URL
          // URL format: https://[project].supabase.co/storage/v1/object/public/callsheets/[path]
          const urlParts = callsheet.url.split('/callsheets/')
          if (urlParts.length > 1) {
            const filePath = decodeURIComponent(urlParts[1])
            
            const { error: storageError } = await supabase.storage
              .from('callsheets')
              .remove([filePath])

            // Don't throw on storage error, just log it - the file might already be deleted
            if (storageError) {
              console.warn('Could not delete file from storage:', storageError.message)
            }
          }
        } catch (urlError) {
          // If URL parsing fails, continue with database deletion
          console.warn('Could not parse storage URL:', urlError)
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('callsheets')
        .delete()
        .eq('id', callsheetId)

      if (error) throw error
    } catch (error) {
      throw new Error('Failed to delete callsheet')
    }
  }

  // ===== EXPENSE DOCUMENT OPERATIONS =====

  async getUserExpenses(userId: string): Promise<ExpenseDocument[]> {
    try {
      const { data, error } = await supabase
        .from('expense_documents')
        .select('*')
        .eq('user_id', userId)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.transformDbExpenseToLegacy);
    } catch (error) {
      console.error('Error fetching expense documents:', error);
      throw new Error('Failed to fetch expense documents');
    }
  }

  async addExpenseDocument(userId: string, payload: {
    projectId?: string | null;
    tripId?: string | null;
    category: ExpenseCategory;
    amount: number;
    currency?: string | null;
    description?: string | null;
    invoiceDate?: string | null;
    file: File;
  }): Promise<ExpenseDocument> {
    const {
      projectId = null,
      tripId = null,
      category,
      amount,
      currency = 'EUR',
      description = null,
      invoiceDate = null,
      file,
    } = payload;

    try {
      // Validate file before upload (security check)
      const { validateFile } = await import('./fileValidationService');
      const validation = await validateFile(file);

      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.error}`);
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const basePath = projectId || tripId || 'general';
      const storagePath = `${userId}/${basePath}/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('expenses')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload expense document: ${uploadError.message}`);
      }

      const { data: publicData } = supabase.storage
        .from('expenses')
        .getPublicUrl(storagePath);

      const insertPayload: DbExpenseDocumentInsert = {
        user_id: userId,
        project_id: projectId,
        trip_id: tripId,
        category,
        amount,
        currency,
        description,
        invoice_date: invoiceDate,
        filename: file.name,
        url: publicData.publicUrl,
        storage_path: storagePath,
      };

      const { data, error } = await supabase
        .from('expense_documents')
        .insert(insertPayload)
        .select()
        .single();

      if (error || !data) {
        await supabase.storage.from('expenses').remove([storagePath]);
        throw error || new Error('Failed to save expense document');
      }

      return this.transformDbExpenseToLegacy(data);
    } catch (error) {
      console.error('Error adding expense document:', error);
      throw error instanceof Error ? error : new Error('Failed to add expense document');
    }
  }

  async deleteExpenseDocument(expenseId: string, userId: string): Promise<void> {
    try {
      // Validate ownership before allowing deletion
      await ownershipValidation.validateOwnershipAndThrow(
        'expense',
        expenseId,
        userId,
        () => ownershipValidation.validateExpenseOwnership(expenseId, userId)
      );

      const { data: expense, error: fetchError } = await supabase
        .from('expense_documents')
        .select('storage_path')
        .eq('id', expenseId)
        .single();

      if (fetchError) throw fetchError;

      if (expense?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('expenses')
          .remove([expense.storage_path]);

        if (storageError) {
          console.warn('Unable to remove expense document from storage:', storageError.message);
        }
      }

      const { error } = await supabase
        .from('expense_documents')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting expense document:', error);
      throw new Error('Failed to delete expense document');
    }
  }

  async deleteAllUserExpenses(userId: string): Promise<void> {
    try {
      const { data: expenses, error: fetchError } = await supabase
        .from('expense_documents')
        .select('storage_path')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      const storagePaths = (expenses ?? [])
        .map(expense => expense.storage_path)
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('expenses')
          .remove(storagePaths);

        if (storageError) {
          console.warn('Unable to remove some expense documents from storage:', storageError.message);
        }
      }

      const { error: deleteError } = await supabase
        .from('expense_documents')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error('Error deleting all expense documents:', error);
      throw new Error('Failed to delete expenses');
    }
  }

  async deleteAllUserCallsheets(userId: string): Promise<void> {
    try {
      const { data: callsheets, error: fetchError } = await supabase
        .from('callsheets')
        .select('id, url')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      const storagePaths: string[] = [];
      (callsheets ?? []).forEach(callsheet => {
        if (!callsheet?.url) return;
        const parts = callsheet.url.split('/callsheets/');
        if (parts.length > 1) {
          const storagePath = decodeURIComponent(parts[1]);
          if (storagePath) {
            storagePaths.push(storagePath);
          }
        }
      });

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('callsheets')
          .remove(storagePaths);

        if (storageError) {
          console.warn('Unable to remove some callsheets from storage:', storageError.message);
        }
      }

      const { error: deleteError } = await supabase
        .from('callsheets')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
    } catch (error) {
      console.error('Error deleting all callsheets:', error);
      throw new Error('Failed to delete callsheets');
    }
  }

  async deleteUserAccountData(userId: string): Promise<void> {
    try {
      await this.deleteAllUserExpenses(userId);
      await this.deleteAllUserCallsheets(userId);
      await this.deleteAllUserLedgerEntries(userId);
      await this.deleteAllUserReports(userId);
      await this.deleteAllUserRouteTemplates(userId);
      await this.deleteAllUserProjects(userId);
      await this.deleteUserProfile(userId);
    } catch (error) {
      console.error('Error deleting user account data:', error);
      throw new Error('Failed to delete user account');
    }
  }

  // ===== UTILITY OPERATIONS =====

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string, userId: string): Promise<Project | null> {
    try {
      // Validate ownership before allowing access
      await ownershipValidation.validateOwnershipAndThrow(
        'project',
        projectId,
        userId,
        () => ownershipValidation.validateProjectOwnership(projectId, userId)
      );

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
          name: (cs as any).filename ?? (cs as any).name,
          type: 'application/octet-stream' // Default type since column doesn't exist in DB
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
  async getLedgerEntriesByBatch(batchId: string, userId: string): Promise<TripLedgerEntry[]> {
    try {
      // Validate that the batch belongs to the user before accessing entries
      await ownershipValidation.validateOwnershipAndThrow(
        'ledgerBatch',
        batchId,
        userId,
        () => ownershipValidation.validateTripLedgerOwnership(batchId, userId)
      );

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
   * Get user profile by user ID (inherently secure - users can only access their own profile)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Note: This method is inherently secure since it filters by userId parameter
      // The caller must ensure userId matches the authenticated user
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

      return await this.transformDbProfileToLegacy(data)
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
      const encryptedApiKey = await this.encryptApiKeyAsync(profileData.openRouterApiKey);

      const insertData: DbProfileInsert = {
        id: userId,
        email: profileData.email || null,
        full_name: profileData.fullName || null,
        name: profileData.name || null,
        license_plate: profileData.licensePlate || null,
        avatar_url: profileData.avatarUrl || null,
        uid: profileData.uid || null,
        address: profileData.address || null,
        city: profileData.city || null,
        country: profileData.country || null,
        plan: profileData.plan ?? 'free',
        profile_picture: profileData.profilePicture || null,
        color: profileData.color || null,
        rate_per_km: profileData.ratePerKm ?? null,
        google_maps_api_key: null,
        open_router_api_key: encryptedApiKey,
        open_router_model: profileData.openRouterModel || null,
        locked_until_date: profileData.lockedUntilDate || null,
        vehicle_type: profileData.vehicleType || null,
        fuel_consumption: profileData.fuelConsumption ?? null,
        fuel_price: profileData.fuelPrice ?? null,
        energy_consumption: profileData.energyConsumption ?? null,
        energy_price: profileData.energyPrice ?? null,
        maintenance_cost_per_km: profileData.maintenanceCostPerKm ?? null,
        parking_cost_per_km: profileData.parkingCostPerKm ?? null,
        tolls_cost_per_km: profileData.tollsCostPerKm ?? null,
        fines_cost_per_km: profileData.finesCostPerKm ?? null,
        misc_cost_per_km: profileData.miscCostPerKm ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      return await this.transformDbProfileToLegacy(data)
    } catch (error) {
      console.error('Error creating user profile:', error)
      throw new Error('Failed to create user profile')
    }
  }

  /**
   * Update user profile (with explicit ownership validation)
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // Validate that user can only update their own profile
      if (updates.id && updates.id !== userId) {
        ownershipValidation.validateUserConsistency(updates.id, userId);
      }

      // Security: block client-side plan escalations. Plans must be changed via backend/billing webhook.
      if (Object.prototype.hasOwnProperty.call(updates, 'plan')) {
        throw new Error('Plan updates must be performed via the billing backend');
      }

      const updateData: DbProfileUpdate = {
        updated_at: new Date().toISOString()
      }

      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.fullName !== undefined) updateData.full_name = updates.fullName
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.licensePlate !== undefined) updateData.license_plate = updates.licensePlate
      if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl
      if (updates.uid !== undefined) updateData.uid = updates.uid
      if (updates.address !== undefined) updateData.address = updates.address
      if (updates.city !== undefined) updateData.city = updates.city
      if (updates.country !== undefined) updateData.country = updates.country
      if (updates.profilePicture !== undefined) updateData.profile_picture = updates.profilePicture
      if (updates.color !== undefined) updateData.color = updates.color
      if (updates.ratePerKm !== undefined) updateData.rate_per_km = updates.ratePerKm
      if (updates.openRouterApiKey !== undefined) updateData.open_router_api_key = await this.encryptApiKeyAsync(updates.openRouterApiKey)
      if (updates.openRouterModel !== undefined) updateData.open_router_model = updates.openRouterModel
      if (updates.lockedUntilDate !== undefined) updateData.locked_until_date = updates.lockedUntilDate
      if (updates.vehicleType !== undefined) updateData.vehicle_type = updates.vehicleType
      if (updates.fuelConsumption !== undefined) updateData.fuel_consumption = updates.fuelConsumption
      if (updates.fuelPrice !== undefined) updateData.fuel_price = updates.fuelPrice
      if (updates.energyConsumption !== undefined) updateData.energy_consumption = updates.energyConsumption
      if (updates.energyPrice !== undefined) updateData.energy_price = updates.energyPrice
      if (updates.maintenanceCostPerKm !== undefined) updateData.maintenance_cost_per_km = updates.maintenanceCostPerKm
      if (updates.parkingCostPerKm !== undefined) updateData.parking_cost_per_km = updates.parkingCostPerKm
      if (updates.tollsCostPerKm !== undefined) updateData.tolls_cost_per_km = updates.tollsCostPerKm
      if (updates.finesCostPerKm !== undefined) updateData.fines_cost_per_km = updates.finesCostPerKm
      if (updates.miscCostPerKm !== undefined) updateData.misc_cost_per_km = updates.miscCostPerKm

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return await this.transformDbProfileToLegacy(data)
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
  private async transformDbProfileToLegacy(dbProfile: DbUserProfile): Promise<UserProfile> {
    return {
      id: dbProfile.id,
      email: dbProfile.email,
      fullName: dbProfile.full_name,
      name: dbProfile.name,
      licensePlate: dbProfile.license_plate,
      avatarUrl: dbProfile.avatar_url,
      uid: dbProfile.uid,
      address: dbProfile.address,
      city: dbProfile.city,
      country: dbProfile.country,
      profilePicture: dbProfile.profile_picture,
      color: dbProfile.color,
      ratePerKm: dbProfile.rate_per_km ?? null,
      googleMapsApiKey: null,
      openRouterApiKey: await this.decryptApiKeyAsync(dbProfile.open_router_api_key),
      openRouterModel: dbProfile.open_router_model,
      lockedUntilDate: dbProfile.locked_until_date,
      plan: (dbProfile as any).plan ?? null,
      vehicleType: dbProfile.vehicle_type ?? null,
      fuelConsumption: dbProfile.fuel_consumption ?? null,
      fuelPrice: dbProfile.fuel_price ?? null,
      energyConsumption: dbProfile.energy_consumption ?? null,
      energyPrice: dbProfile.energy_price ?? null,
      maintenanceCostPerKm: dbProfile.maintenance_cost_per_km ?? null,
      parkingCostPerKm: dbProfile.parking_cost_per_km ?? null,
      tollsCostPerKm: dbProfile.tolls_cost_per_km ?? null,
      finesCostPerKm: dbProfile.fines_cost_per_km ?? null,
      miscCostPerKm: dbProfile.misc_cost_per_km ?? null,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at
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
   * Update a route template (with explicit ownership validation)
   */
  async updateRouteTemplate(templateId: string, userId: string, updates: Partial<Omit<RouteTemplate, 'id'>>): Promise<RouteTemplate> {
    try {
      // Validate ownership before allowing update
      await ownershipValidation.validateOwnershipAndThrow(
        'route_template',
        templateId,
        userId,
        () => ownershipValidation.validateRouteTemplateOwnership(templateId, userId)
      );

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
   * Delete a route template (with explicit ownership validation)
   */
  async deleteRouteTemplate(templateId: string, userId: string): Promise<void> {
    try {
      // Validate ownership before allowing deletion
      await ownershipValidation.validateOwnershipAndThrow(
        'route_template',
        templateId,
        userId,
        () => ownershipValidation.validateRouteTemplateOwnership(templateId, userId)
      );

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
  async getReport(reportId: string, userId: string): Promise<Report | null> {
    try {
      // Validate ownership before allowing access
      await ownershipValidation.validateOwnershipAndThrow(
        'report',
        reportId,
        userId,
        () => ownershipValidation.validateReportOwnership(reportId, userId)
      );

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
   * Delete a report (with explicit ownership validation)
   */
  async deleteReport(reportId: string, userId: string): Promise<void> {
    try {
      // Validate ownership before allowing deletion
      await ownershipValidation.validateOwnershipAndThrow(
        'report',
        reportId,
        userId,
        () => ownershipValidation.validateReportOwnership(reportId, userId)
      );

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
   * Get only ledger entries created via AI to compute usage limits
   */
  async getAiLedgerEntries(userId: string): Promise<TripLedgerEntry[]> {
    try {
      const { data, error } = await supabase
        .from('trip_ledger')
        .select('*')
        .eq('user_id', userId)
        .eq('source', 'AI_AGENT')
        .in('operation', ['CREATE', 'IMPORT_BATCH']);

      if (error) {
        console.error('Error fetching AI ledger entries:', error);
        return [];
      }

      return (data || []).map(this.transformDbLedgerToLegacy);
    } catch (error) {
      console.error('Error fetching AI ledger entries (unexpected):', error);
      return [];
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

  private transformDbExpenseToLegacy(dbExpense: DbExpenseDocument): ExpenseDocument {
    const normalizedAmount = Number(dbExpense.amount);
    return {
      id: dbExpense.id,
      userId: dbExpense.user_id,
      projectId: dbExpense.project_id,
      tripId: dbExpense.trip_id,
      category: dbExpense.category,
      amount: Number.isNaN(normalizedAmount) ? 0 : normalizedAmount,
      currency: dbExpense.currency,
      description: dbExpense.description,
      invoiceDate: dbExpense.invoice_date,
      filename: dbExpense.filename,
      url: dbExpense.url,
      storagePath: dbExpense.storage_path,
      createdAt: dbExpense.created_at,
      updatedAt: dbExpense.updated_at
    };
  }
}

// Export singleton instance
export const databaseService = new DatabaseService()
export default databaseService
