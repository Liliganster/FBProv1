/**
 * AbortController Management Service
 * 
 * Centralized service for managing AbortControllers to prevent memory leaks
 * and ensure proper cleanup of async operations when components unmount.
 * 
 * Features:
 * - Automatic cleanup of AbortControllers
 * - Named controller groups for better organization
 * - Debug logging for tracking active controllers
 * - Graceful error handling
 */

import { logger } from '../lib/logger';

interface ControllerGroup {
  controllers: Map<string, AbortController>;
  createdAt: number;
}

class AbortControllerManager {
  private controllerGroups = new Map<string, ControllerGroup>();
  private globalControllers = new Map<string, AbortController>();
  
  /**
   * Create a new AbortController with optional grouping
   */
  create(name?: string, group?: string): AbortController {
    const controller = new AbortController();
    const controllerId = name || `controller_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (group) {
      if (!this.controllerGroups.has(group)) {
        this.controllerGroups.set(group, {
          controllers: new Map(),
          createdAt: Date.now()
        });
      }
      
      const groupData = this.controllerGroups.get(group)!;
      groupData.controllers.set(controllerId, controller);
      
      logger.debug(`AbortController created: ${controllerId} in group: ${group}`);
    } else {
      this.globalControllers.set(controllerId, controller);
      logger.debug(`AbortController created: ${controllerId} (global)`);
    }

    // Add cleanup listener
    controller.signal.addEventListener('abort', () => {
      logger.debug(`AbortController aborted: ${controllerId}`);
      this.remove(controllerId, group);
    });

    return controller;
  }

  /**
   * Get an existing controller by name
   */
  get(name: string, group?: string): AbortController | undefined {
    if (group) {
      return this.controllerGroups.get(group)?.controllers.get(name);
    }
    return this.globalControllers.get(name);
  }

  /**
   * Abort a specific controller
   */
  abort(name: string, group?: string, reason?: string): void {
    const controller = this.get(name, group);
    if (controller && !controller.signal.aborted) {
      controller.abort(reason);
      logger.debug(`AbortController manually aborted: ${name}${group ? ` (group: ${group})` : ''}`);
    }
  }

  /**
   * Abort all controllers in a group
   */
  abortGroup(group: string, reason?: string): void {
    const groupData = this.controllerGroups.get(group);
    if (!groupData) return;

    const count = groupData.controllers.size;
    groupData.controllers.forEach((controller, name) => {
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    });

    this.controllerGroups.delete(group);
    logger.debug(`Aborted ${count} controllers in group: ${group}`);
  }

  /**
   * Abort all global controllers
   */
  abortAll(reason?: string): void {
    const globalCount = this.globalControllers.size;
    this.globalControllers.forEach((controller, name) => {
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    });
    this.globalControllers.clear();

    const groupCount = this.controllerGroups.size;
    this.controllerGroups.forEach((groupData, groupName) => {
      this.abortGroup(groupName, reason);
    });

    logger.debug(`Aborted ${globalCount} global controllers and ${groupCount} groups`);
  }

  /**
   * Remove a controller from tracking (automatically called on abort)
   */
  private remove(name: string, group?: string): void {
    if (group) {
      const groupData = this.controllerGroups.get(group);
      if (groupData) {
        groupData.controllers.delete(name);
        if (groupData.controllers.size === 0) {
          this.controllerGroups.delete(group);
        }
      }
    } else {
      this.globalControllers.delete(name);
    }
  }

  /**
   * Get statistics about active controllers
   */
  getStats(): {
    global: number;
    groups: { name: string; count: number; age: number }[];
    total: number;
  } {
    const groups = Array.from(this.controllerGroups.entries()).map(([name, data]) => ({
      name,
      count: data.controllers.size,
      age: Date.now() - data.createdAt
    }));

    const totalGroupControllers = groups.reduce((sum, group) => sum + group.count, 0);

    return {
      global: this.globalControllers.size,
      groups,
      total: this.globalControllers.size + totalGroupControllers
    };
  }

  /**
   * Clean up old controllers (for maintenance)
   */
  cleanup(maxAge = 60000): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up old groups
    this.controllerGroups.forEach((groupData, groupName) => {
      if (now - groupData.createdAt > maxAge) {
        const count = groupData.controllers.size;
        this.abortGroup(groupName, 'Cleanup: Controller group too old');
        cleanedCount += count;
      }
    });

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} old controllers`);
    }
  }
}

// Create singleton instance
export const abortManager = new AbortControllerManager();

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    abortManager.cleanup();
  }, 5 * 60 * 1000);
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    abortManager.abortAll('Page unload');
  });
}

export { AbortControllerManager };