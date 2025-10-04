/**
 * Database type definitions for Supabase
 * Generated from Supabase schema
 */

// Base types for database tables
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          full_name: string | null
          country: string | null
          ratePerKm: number | null
          homeAddress: string | null
          officeAddress: string | null
          googleMapsApiKey: string | null
          googleCalendarApiKey: string | null
          googleCalendarClientId: string | null
          googleCalendarPrimaryId: string | null
          openRouterApiKey: string | null
          openRouterModel: string | null
          lockedUntilDate: string | null
          vehicleType: 'combustion' | 'electric' | null
          fuelConsumption: number | null
          fuelPrice: number | null
          energyConsumption: number | null
          energyPrice: number | null
          maintenanceCostPerKm: number | null
          parkingCostPerKm: number | null
          tollsCostPerKm: number | null
          finesCostPerKm: number | null
          miscCostPerKm: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          email: string
          full_name?: string | null
          country?: string | null
          ratePerKm?: number | null
          homeAddress?: string | null
          officeAddress?: string | null
          googleMapsApiKey?: string | null
          googleCalendarApiKey?: string | null
          googleCalendarClientId?: string | null
          googleCalendarPrimaryId?: string | null
          openRouterApiKey?: string | null
          openRouterModel?: string | null
          lockedUntilDate?: string | null
          vehicleType?: 'combustion' | 'electric' | null
          fuelConsumption?: number | null
          fuelPrice?: number | null
          energyConsumption?: number | null
          energyPrice?: number | null
          maintenanceCostPerKm?: number | null
          parkingCostPerKm?: number | null
          tollsCostPerKm?: number | null
          finesCostPerKm?: number | null
          miscCostPerKm?: number | null
        }
        Update: {
          id?: string
          updated_at?: string
          email?: string
          full_name?: string | null
          country?: string | null
          ratePerKm?: number | null
          homeAddress?: string | null
          officeAddress?: string | null
          googleMapsApiKey?: string | null
          googleCalendarApiKey?: string | null
          googleCalendarClientId?: string | null
          googleCalendarPrimaryId?: string | null
          openRouterApiKey?: string | null
          openRouterModel?: string | null
          lockedUntilDate?: string | null
          vehicleType?: 'combustion' | 'electric' | null
          fuelConsumption?: number | null
          fuelPrice?: number | null
          energyConsumption?: number | null
          energyPrice?: number | null
          maintenanceCostPerKm?: number | null
          parkingCostPerKm?: number | null
          tollsCostPerKm?: number | null
          finesCostPerKm?: number | null
          miscCostPerKm?: number | null
        }
      }
      projects: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          name: string
          producer: string
          ratePerKm: number | null
          ownerDriverId: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          name: string
          producer: string
          ratePerKm?: number | null
          ownerDriverId?: string | null
        }
        Update: {
          id?: string
          updated_at?: string
          user_id?: string
          name?: string
          producer?: string
          ratePerKm?: number | null
          ownerDriverId?: string | null
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
      trip_ledger_batches: {
        Row: {
          id: string
          batch_id: string
          created_at: string
          user_id: string
          timestamp: string
          source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          entry_count: number
          first_entry_hash: string
          last_entry_hash: string
          source_documents: any | null // JSON field
        }
        Insert: {
          id?: string
          batch_id: string
          created_at?: string
          user_id: string
          timestamp: string
          source: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          entry_count: number
          first_entry_hash: string
          last_entry_hash: string
          source_documents?: any | null
        }
        Update: {
          id?: string
          batch_id?: string
          created_at?: string
          user_id?: string
          timestamp?: string
          source?: 'MANUAL' | 'AI_AGENT' | 'CSV_IMPORT' | 'BULK_UPLOAD'
          entry_count?: number
          first_entry_hash?: string
          last_entry_hash?: string
          source_documents?: any | null
        }
      }
      callsheets: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          project_id: string
          name: string
          type: string
          file_data: any | null // JSON field for file metadata
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          name: string
          type: string
          file_data?: any | null
        }
        Update: {
          id?: string
          updated_at?: string
          project_id?: string
          name?: string
          type?: string
          file_data?: any | null
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
    }
  }
}

// Type helpers
export type DbProfile = Database['public']['Tables']['profiles']['Row']
export type DbProject = Database['public']['Tables']['projects']['Row']
export type DbTripLedger = Database['public']['Tables']['trip_ledger']['Row']
export type DbTripLedgerBatch = Database['public']['Tables']['trip_ledger_batches']['Row']
export type DbCallsheet = Database['public']['Tables']['callsheets']['Row']

export type DbProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type DbProjectInsert = Database['public']['Tables']['projects']['Insert']
export type DbTripLedgerInsert = Database['public']['Tables']['trip_ledger']['Insert']
export type DbTripLedgerBatchInsert = Database['public']['Tables']['trip_ledger_batches']['Insert']
export type DbCallsheetInsert = Database['public']['Tables']['callsheets']['Insert']

export type DbProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type DbProjectUpdate = Database['public']['Tables']['projects']['Update']
export type DbTripLedgerUpdate = Database['public']['Tables']['trip_ledger']['Update']
export type DbTripLedgerBatchUpdate = Database['public']['Tables']['trip_ledger_batches']['Update']
export type DbCallsheetUpdate = Database['public']['Tables']['callsheets']['Update']