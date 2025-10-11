/**
 * Ownership Validation Service
 * 
 * Provides explicit ownership verification before database operations
 * to add an extra security layer beyond RLS policies.
 * 
 * This service verifies that users can only access/modify their own data
 * by explicitly checking ownership before performing operations.
 */

import { supabase } from '../lib/supabase';

export class OwnershipError extends Error {
  constructor(
    message: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly userId: string
  ) {
    super(message);
    this.name = 'OwnershipError';
  }
}

interface OwnershipValidationResult {
  isValid: boolean;
  ownerId?: string;
  error?: string;
}

class OwnershipValidationService {
  
  /**
   * Validate ownership of a project
   */
  async validateProjectOwnership(projectId: string, expectedUserId: string): Promise<OwnershipValidationResult> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('user_id')
        .eq('id', projectId)
        .single();

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify project ownership: ${error.message}`
        };
      }

      if (!data) {
        return {
          isValid: false,
          error: 'Project not found'
        };
      }

      return {
        isValid: data.user_id === expectedUserId,
        ownerId: data.user_id,
        error: data.user_id !== expectedUserId ? 'Access denied: You do not own this project' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of multiple projects
   */
  async validateMultipleProjectsOwnership(projectIds: string[], expectedUserId: string): Promise<OwnershipValidationResult> {
    if (projectIds.length === 0) {
      return { isValid: true };
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, user_id')
        .in('id', projectIds);

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify projects ownership: ${error.message}`
        };
      }

      if (!data || data.length !== projectIds.length) {
        return {
          isValid: false,
          error: 'Some projects not found'
        };
      }

      const invalidProjects = data.filter(project => project.user_id !== expectedUserId);
      if (invalidProjects.length > 0) {
        return {
          isValid: false,
          error: `Access denied: You do not own projects: ${invalidProjects.map(p => p.id).join(', ')}`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of a callsheet
   */
  async validateCallsheetOwnership(callsheetId: string, expectedUserId: string): Promise<OwnershipValidationResult> {
    try {
      const { data, error } = await supabase
        .from('callsheets')
        .select('user_id')
        .eq('id', callsheetId)
        .single();

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify callsheet ownership: ${error.message}`
        };
      }

      if (!data) {
        return {
          isValid: false,
          error: 'Callsheet not found'
        };
      }

      return {
        isValid: data.user_id === expectedUserId,
        ownerId: data.user_id,
        error: data.user_id !== expectedUserId ? 'Access denied: You do not own this callsheet' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of an expense document
   */
  async validateExpenseOwnership(expenseId: string, expectedUserId: string): Promise<OwnershipValidationResult> {
    try {
      const { data, error } = await supabase
        .from('expense_documents')
        .select('user_id')
        .eq('id', expenseId)
        .single();

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify expense ownership: ${error.message}`
        };
      }

      if (!data) {
        return {
          isValid: false,
          error: 'Expense document not found'
        };
      }

      return {
        isValid: data.user_id === expectedUserId,
        ownerId: data.user_id,
        error: data.user_id !== expectedUserId ? 'Access denied: You do not own this expense document' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of a trip ledger entry
   */
  async validateTripLedgerOwnership(entryId: string, expectedUserId: string): Promise<OwnershipValidationResult> {
    try {
      const { data, error } = await supabase
        .from('trip_ledger')
        .select('user_id')
        .eq('id', entryId)
        .single();

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify trip ledger ownership: ${error.message}`
        };
      }

      if (!data) {
        return {
          isValid: false,
          error: 'Trip ledger entry not found'
        };
      }

      return {
        isValid: data.user_id === expectedUserId,
        ownerId: data.user_id,
        error: data.user_id !== expectedUserId ? 'Access denied: You do not own this trip entry' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of multiple trip ledger entries
   */
  async validateMultipleTripLedgerOwnership(entryIds: string[], expectedUserId: string): Promise<OwnershipValidationResult> {
    if (entryIds.length === 0) {
      return { isValid: true };
    }

    try {
      const { data, error } = await supabase
        .from('trip_ledger')
        .select('id, user_id')
        .in('id', entryIds);

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify trip entries ownership: ${error.message}`
        };
      }

      if (!data || data.length !== entryIds.length) {
        return {
          isValid: false,
          error: 'Some trip entries not found'
        };
      }

      const invalidEntries = data.filter(entry => entry.user_id !== expectedUserId);
      if (invalidEntries.length > 0) {
        return {
          isValid: false,
          error: `Access denied: You do not own trip entries: ${invalidEntries.map(e => e.id).join(', ')}`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of a route template
   */
  async validateRouteTemplateOwnership(templateId: string, expectedUserId: string): Promise<OwnershipValidationResult> {
    try {
      const { data, error } = await supabase
        .from('route_templates')
        .select('user_id')
        .eq('id', templateId)
        .single();

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify route template ownership: ${error.message}`
        };
      }

      if (!data) {
        return {
          isValid: false,
          error: 'Route template not found'
        };
      }

      return {
        isValid: data.user_id === expectedUserId,
        ownerId: data.user_id,
        error: data.user_id !== expectedUserId ? 'Access denied: You do not own this route template' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate ownership of a report
   */
  async validateReportOwnership(reportId: string, expectedUserId: string): Promise<OwnershipValidationResult> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('user_id')
        .eq('id', reportId)
        .single();

      if (error) {
        return {
          isValid: false,
          error: `Failed to verify report ownership: ${error.message}`
        };
      }

      if (!data) {
        return {
          isValid: false,
          error: 'Report not found'
        };
      }

      return {
        isValid: data.user_id === expectedUserId,
        ownerId: data.user_id,
        error: data.user_id !== expectedUserId ? 'Access denied: You do not own this report' : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Ownership validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate that a user can only access their own profile
   */
  validateProfileOwnership(profileUserId: string, expectedUserId: string): OwnershipValidationResult {
    return {
      isValid: profileUserId === expectedUserId,
      ownerId: profileUserId,
      error: profileUserId !== expectedUserId ? 'Access denied: You can only access your own profile' : undefined
    };
  }

  /**
   * Generic ownership validator with error throwing
   */
  async validateOwnershipAndThrow(
    resourceType: string,
    resourceId: string,
    expectedUserId: string,
    validator: () => Promise<OwnershipValidationResult>
  ): Promise<void> {
    const result = await validator();
    
    if (!result.isValid) {
      console.error(`[OwnershipValidation] Access denied for user ${expectedUserId} to ${resourceType} ${resourceId}: ${result.error}`);
      throw new OwnershipError(
        result.error || 'Ownership validation failed',
        resourceType,
        resourceId,
        expectedUserId
      );
    }
  }

  /**
   * Validate user input to prevent tampering
   */
  validateUserConsistency(providedUserId: string, actualUserId: string): void {
    if (providedUserId !== actualUserId) {
      console.error(`[OwnershipValidation] User ID mismatch: provided=${providedUserId}, actual=${actualUserId}`);
      throw new OwnershipError(
        'User ID mismatch detected',
        'user',
        providedUserId,
        actualUserId
      );
    }
  }
}

// Singleton instance
export const ownershipValidation = new OwnershipValidationService();

// Export types for use in other modules
export type { OwnershipValidationResult };
export { OwnershipValidationService };