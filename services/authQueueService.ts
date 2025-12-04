import PQueue from 'p-queue';
import { logger } from '../lib/logger';

/**
 * AuthQueueService - Prevents race conditions in authentication operations
 * 
 * Uses PQueue to serialize authentication state updates and prevent
 * concurrent operations from corrupting the authentication state.
 * 
 * Critical for preventing issues when multiple components try to:
 * - Login/logout simultaneously
 * - Update user profiles concurrently
 * - Initialize authentication state
 * - Handle auth state changes
 */
class AuthQueueService {
  private authQueue: PQueue;
  private stateQueue: PQueue;

  constructor() {
    // Auth operations queue - serialize login/logout operations
    this.authQueue = new PQueue({
      concurrency: 1, // Only one auth operation at a time
      interval: 100, // 100ms interval between operations
      intervalCap: 1, // Only one operation per interval
      // Allow slower auth operations (Supabase signup + email) without failing the queue
      timeout: 30000, // 30 second timeout for auth operations
    });

    // State update queue - serialize state changes
    this.stateQueue = new PQueue({
      concurrency: 1, // Only one state update at a time
      interval: 50, // 50ms interval for faster state updates
      intervalCap: 1,
      timeout: 20000, // allow state updates to settle before timing out
    });

    this.setupQueueEventHandlers();
  }

  /**
   * Setup event handlers for queue monitoring and error handling
   */
  private setupQueueEventHandlers(): void {
    // Auth queue handlers
    this.authQueue.on('active', () => {
      logger.debug('Auth operation started');
    });

    this.authQueue.on('idle', () => {
      logger.debug('All auth operations completed');
    });

    this.authQueue.on('error', (error) => {
      logger.error('Auth queue error:', error);
    });

    // State queue handlers
    this.stateQueue.on('active', () => {
      logger.debug('Auth state update started');
    });

    this.stateQueue.on('idle', () => {
      logger.debug('All auth state updates completed');
    });

    this.stateQueue.on('error', (error) => {
      logger.error('Auth state queue error:', error);
    });
  }

  /**
   * Execute an authentication operation in the auth queue
   * Use this for login, logout, token refresh, etc.
   */
  async executeAuthOperation<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const name = operationName || 'unknown_auth_operation';
    
    try {
      logger.debug(`Queuing auth operation: ${name}`);
      
      const result = await this.authQueue.add(async () => {
        logger.debug(`Executing auth operation: ${name}`);
        const startTime = Date.now();
        
        try {
          const result = await operation();
          const duration = Date.now() - startTime;
          logger.debug(`Auth operation ${name} completed in ${duration}ms`);
          return result;
        } catch (error) {
          logger.error(`Auth operation ${name} failed:`, error);
          throw error;
        }
      });

      return result;
    } catch (error) {
      logger.error(`Auth operation ${name} queue execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute a state update operation in the state queue
   * Use this for updating authentication state, user profile, etc.
   */
  async executeStateUpdate<T>(
    operation: () => Promise<T> | T,
    operationName?: string
  ): Promise<T> {
    const name = operationName || 'unknown_state_update';
    
    try {
      logger.debug(`Queuing state update: ${name}`);
      
      const result = await this.stateQueue.add(async () => {
        logger.debug(`Executing state update: ${name}`);
        const startTime = Date.now();
        
        try {
          const result = await operation();
          const duration = Date.now() - startTime;
          logger.debug(`State update ${name} completed in ${duration}ms`);
          return result;
        } catch (error) {
          logger.error(`State update ${name} failed:`, error);
          throw error;
        }
      });

      return result;
    } catch (error) {
      logger.error(`State update ${name} queue execution failed:`, error);
      throw error;
    }
  }

  /**
   * Clear all pending operations (use with caution)
   */
  clearAll(): void {
    logger.warn('Clearing all pending auth operations');
    this.authQueue.clear();
    this.stateQueue.clear();
  }

  /**
   * Get queue statistics for monitoring
   */
  getQueueStats(): {
    auth: {
      pending: number;
      running: number;
      size: number;
    };
    state: {
      pending: number;
      running: number;
      size: number;
    };
  } {
    return {
      auth: {
        pending: this.authQueue.pending,
        running: this.authQueue.pending,
        size: this.authQueue.size,
      },
      state: {
        pending: this.stateQueue.pending,
        running: this.stateQueue.pending,
        size: this.stateQueue.size,
      },
    };
  }

  /**
   * Wait for all operations to complete
   */
  async waitForIdle(): Promise<void> {
    await Promise.all([
      this.authQueue.onIdle(),
      this.stateQueue.onIdle()
    ]);
  }
}

// Create singleton instance
export const authQueueService = new AuthQueueService();

// Export class for testing purposes
export { AuthQueueService };
