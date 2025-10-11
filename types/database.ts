/**
 * Database type definitions for Supabase
 * Generated from Supabase schema
 */

// Base types for database tables
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          name: string | null
          license_plate: string | null
          avatar_url: string | null
          uid: string | null
          address: string | null
          city: string | null
          country: string | null
          profile_picture: string | null
          color: string | null
          rate_per_km: number | null
          google_maps_api_key: string | null
          open_router_api_key: string | null
          open_router_model: string | null
          locked_until_date: string | null
          vehicle_type: Database['public']['Enums']['vehicle_type'] | null
          fuel_consumption: number | null
          fuel_price: number | null
          energy_consumption: number | null
          energy_price: number | null
          maintenance_cost_per_km: number | null
          parking_cost_per_km: number | null
          tolls_cost_per_km: number | null
          fines_cost_per_km: number | null
          misc_cost_per_km: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          name?: string | null
          license_plate?: string | null
          avatar_url?: string | null
          uid?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          profile_picture?: string | null
          color?: string | null
          rate_per_km?: number | null
          google_maps_api_key?: string | null
          open_router_api_key?: string | null
          open_router_model?: string | null
          locked_until_date?: string | null
          vehicle_type?: Database['public']['Enums']['vehicle_type'] | null
          fuel_consumption?: number | null
          fuel_price?: number | null
          energy_consumption?: number | null
          energy_price?: number | null
          maintenance_cost_per_km?: number | null
          parking_cost_per_km?: number | null
          tolls_cost_per_km?: number | null
          fines_cost_per_km?: number | null
          misc_cost_per_km?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          name?: string | null
          license_plate?: string | null
          avatar_url?: string | null
          uid?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          profile_picture?: string | null
          color?: string | null
          rate_per_km?: number | null
          google_maps_api_key?: string | null
          open_router_api_key?: string | null
          open_router_model?: string | null
          locked_until_date?: string | null
          vehicle_type?: Database['public']['Enums']['vehicle_type'] | null
          fuel_consumption?: number | null
          fuel_price?: number | null
          energy_consumption?: number | null
          energy_price?: number | null
          maintenance_cost_per_km?: number | null
          parking_cost_per_km?: number | null
          tolls_cost_per_km?: number | null
          fines_cost_per_km?: number | null
          misc_cost_per_km?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          producer: string
          rate_per_km: number | null
          owner_driver_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          producer?: string
          rate_per_km?: number | null
          owner_driver_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          producer?: string
          rate_per_km?: number | null
          owner_driver_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      expense_documents: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          trip_id: string | null
          category: Database['public']['Enums']['expense_category']
          amount: number
          currency: string | null
          description: string | null
          invoice_date: string | null
          filename: string
          url: string
          storage_path: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          trip_id?: string | null
          category: Database['public']['Enums']['expense_category']
          amount: number
          currency?: string | null
          description?: string | null
          invoice_date?: string | null
          filename: string
          url: string
          storage_path: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          trip_id?: string | null
          category?: Database['public']['Enums']['expense_category']
          amount?: number
          currency?: string | null
          description?: string | null
          invoice_date?: string | null
          filename?: string
          url?: string
          storage_path?: string
          created_at?: string
          updated_at?: string
        }
      }
      trip_ledger: {
        Row: {
          id: string
          created_at: string
          user_id: string
          hash: string
          previous_hash: string | null
          timestamp: string
          operation: 'CREATE' | 'AMEND' | 'VOID' | 'IMPORT_BATCH'
          source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          batch_id: string | null
          trip_id: string
          trip_snapshot: any // JSON field
          correction_reason: string | null
          changed_fields: string[] | null
          source_document_id: string | null
          source_document_name: string | null
          void_reason: string | null
          previous_snapshot: any | null // JSON field
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          hash: string
          previous_hash?: string | null
          timestamp: string
          operation: 'CREATE' | 'AMEND' | 'VOID' | 'IMPORT_BATCH'
          source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          batch_id?: string | null
          trip_id: string
          trip_snapshot: any
          correction_reason?: string | null
          changed_fields?: string[] | null
          source_document_id?: string | null
          source_document_name?: string | null
          void_reason?: string | null
          previous_snapshot?: any | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          hash?: string
          previous_hash?: string | null
          timestamp?: string
          operation?: 'CREATE' | 'AMEND' | 'VOID' | 'IMPORT_BATCH'
          source?: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          batch_id?: string | null
          trip_id?: string
          trip_snapshot?: any
          correction_reason?: string | null
          changed_fields?: string[] | null
          source_document_id?: string | null
          source_document_name?: string | null
          void_reason?: string | null
          previous_snapshot?: any | null
        }
      }
      trip_batches: {
        Row: {
          id: string
          batch_id: string
          user_id: string
          timestamp: string
          source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          entry_count: number
          first_entry_hash: string
          last_entry_hash: string
          source_documents: any | null
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          user_id: string
          timestamp: string
          source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          entry_count: number
          first_entry_hash: string
          last_entry_hash: string
          source_documents?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          user_id?: string
          timestamp?: string
          source?: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          entry_count?: number
          first_entry_hash?: string
          last_entry_hash?: string
          source_documents?: any | null
          created_at?: string
        }
      }
      callsheets: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          project_id: string
          user_id: string
          filename: string
          url: string
          // compat opcional: name (si todavía existe en la tabla real)
          name?: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          user_id: string
          filename: string
          url: string
          // permitir que código antiguo aún pueda mandar name
          name?: string | null
        }
        Update: {
          id?: string
          updated_at?: string
          project_id?: string
          user_id?: string
          filename?: string
          url?: string
          name?: string | null
        }
      }
      route_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          category: 'business' | 'commute' | 'client' | 'other'
          start_location: string
          end_location: string
          distance: number
          estimated_time_minutes: number | null
          description: string | null
          uses: number
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category: 'business' | 'commute' | 'client' | 'other'
          start_location: string
          end_location: string
          distance: number
          estimated_time_minutes?: number | null
          description?: string | null
          uses?: number
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category?: 'business' | 'commute' | 'client' | 'other'
          start_location?: string
          end_location?: string
          distance?: number
          estimated_time_minutes?: number | null
          description?: string | null
          uses?: number
          last_used_at?: string | null
          updated_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          user_id: string
          generation_date: string
          start_date: string
          end_date: string
          project_id: string
          project_name: string
          total_distance: number
          trips_data: any // JSON field for trips array
          user_profile_snapshot: any // JSON field
          signature: string | null
          first_trip_hash: string | null
          last_trip_hash: string | null
          ledger_verification: any | null // JSON field
          generation_timestamp: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          generation_date: string
          start_date: string
          end_date: string
          project_id: string
          project_name: string
          total_distance: number
          trips_data: any
          user_profile_snapshot: any
          signature?: string | null
          first_trip_hash?: string | null
          last_trip_hash?: string | null
          ledger_verification?: any | null
          generation_timestamp?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          generation_date?: string
          start_date?: string
          end_date?: string
          project_id?: string
          project_name?: string
          total_distance?: number
          trips_data?: any
          user_profile_snapshot?: any
          signature?: string | null
          first_trip_hash?: string | null
          last_trip_hash?: string | null
          ledger_verification?: any | null
          generation_timestamp?: string | null
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      trip_operation: 'CREATE' | 'AMEND' | 'VOID' | 'IMPORT_BATCH'
      trip_source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
      vehicle_type: 'combustion' | 'electric'
      route_category: 'business' | 'commute' | 'client' | 'other'
      expense_category: 'fuel' | 'maintenance'
    }
  }
}

// Type helpers
export type DbProfile = Database['public']['Tables']['user_profiles']['Row']
export type DbProject = Database['public']['Tables']['projects']['Row']
export type DbExpenseDocument = Database['public']['Tables']['expense_documents']['Row']
export type DbUserProfile = Database['public']['Tables']['user_profiles']['Row']
export type DbTripLedger = Database['public']['Tables']['trip_ledger']['Row']
export type DbTripLedgerBatch = Database['public']['Tables']['trip_batches']['Row']
export type DbCallsheet = Database['public']['Tables']['callsheets']['Row']
export type DbRouteTemplate = Database['public']['Tables']['route_templates']['Row']
export type DbReport = Database['public']['Tables']['reports']['Row']

export type DbProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type DbProjectInsert = Database['public']['Tables']['projects']['Insert']
export type DbExpenseDocumentInsert = Database['public']['Tables']['expense_documents']['Insert']
export type DbTripLedgerInsert = Database['public']['Tables']['trip_ledger']['Insert']
export type DbTripLedgerBatchInsert = Database['public']['Tables']['trip_batches']['Insert']
export type DbCallsheetInsert = Database['public']['Tables']['callsheets']['Insert']
export type DbRouteTemplateInsert = Database['public']['Tables']['route_templates']['Insert']
export type DbReportInsert = Database['public']['Tables']['reports']['Insert']

export type DbProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
export type DbProjectUpdate = Database['public']['Tables']['projects']['Update']
export type DbExpenseDocumentUpdate = Database['public']['Tables']['expense_documents']['Update']
export type DbTripLedgerUpdate = Database['public']['Tables']['trip_ledger']['Update']
export type DbTripLedgerBatchUpdate = Database['public']['Tables']['trip_batches']['Update']
export type DbCallsheetUpdate = Database['public']['Tables']['callsheets']['Update']
export type DbRouteTemplateUpdate = Database['public']['Tables']['route_templates']['Update']
export type DbReportUpdate = Database['public']['Tables']['reports']['Update']
