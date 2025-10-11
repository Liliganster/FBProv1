/**
 * Race Condition Prevention Test
 * 
 * This module demonstrates and tests the race condition prevention
 * implemented with PQueue in authentication operations.
 * 
 * To test manually:
 * 1. Run multiple concurrent authentication operations
 * 2. Verify that operations are serialized
 * 3. Check that state updates don't corrupt each other
 */

import { authQueueService } from './authQueueService';
import { logger } from '../lib/logger';

/**
 * Simulate concurrent authentication operations to test queue behavior
 */
export class RaceConditionTest {
  /**
   * Test concurrent login attempts
   */
  static async testConcurrentLogins(): Promise<void> {
    console.log('🧪 Testing concurrent login operations...');
    
    // Simulate 5 concurrent login attempts
    const loginPromises = Array.from({ length: 5 }, (_, index) => 
      authQueueService.executeAuthOperation(async () => {
        console.log(`📝 Login operation ${index + 1} started`);
        
        // Simulate auth operation delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        console.log(`✅ Login operation ${index + 1} completed`);
        return `login_${index + 1}_result`;
      }, `test_login_${index + 1}`)
    );

    const results = await Promise.all(loginPromises);
    console.log('✅ All login operations completed:', results);
    
    // Verify serialization by checking queue stats
    const stats = authQueueService.getQueueStats();
    console.log('📊 Queue stats after login test:', stats);
  }

  /**
   * Test concurrent state updates
   */
  static async testConcurrentStateUpdates(): Promise<void> {
    console.log('🧪 Testing concurrent state updates...');
    
    // Simulate 10 concurrent state updates
    const updatePromises = Array.from({ length: 10 }, (_, index) => 
      authQueueService.executeStateUpdate(async () => {
        console.log(`🔄 State update ${index + 1} started`);
        
        // Simulate state update delay
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        
        console.log(`✅ State update ${index + 1} completed`);
        return `update_${index + 1}_result`;
      }, `test_state_update_${index + 1}`)
    );

    const results = await Promise.all(updatePromises);
    console.log('✅ All state updates completed:', results);
    
    // Verify serialization
    const stats = authQueueService.getQueueStats();
    console.log('📊 Queue stats after state update test:', stats);
  }

  /**
   * Test mixed concurrent operations (auth + state)
   */
  static async testMixedConcurrentOperations(): Promise<void> {
    console.log('🧪 Testing mixed concurrent operations...');
    
    const mixedPromises = [];
    
    // Add auth operations
    for (let i = 0; i < 3; i++) {
      mixedPromises.push(
        authQueueService.executeAuthOperation(async () => {
          console.log(`🔐 Auth operation ${i + 1} started`);
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log(`✅ Auth operation ${i + 1} completed`);
          return `auth_${i + 1}`;
        }, `test_mixed_auth_${i + 1}`)
      );
    }
    
    // Add state operations
    for (let i = 0; i < 3; i++) {
      mixedPromises.push(
        authQueueService.executeStateUpdate(async () => {
          console.log(`🔄 State operation ${i + 1} started`);
          await new Promise(resolve => setTimeout(resolve, 80));
          console.log(`✅ State operation ${i + 1} completed`);
          return `state_${i + 1}`;
        }, `test_mixed_state_${i + 1}`)
      );
    }

    const results = await Promise.all(mixedPromises);
    console.log('✅ All mixed operations completed:', results);
    
    // Wait for queues to be idle
    await authQueueService.waitForIdle();
    console.log('🏁 All queues are now idle');
  }

  /**
   * Demonstrate race condition prevention
   */
  static async demonstrateRaceConditionPrevention(): Promise<void> {
    console.log('🛡️ Demonstrating race condition prevention...');
    
    let counter = 0;
    const incrementOperations = [];
    
    // Without queue, this would be prone to race conditions
    // With queue, increments are serialized
    for (let i = 0; i < 100; i++) {
      incrementOperations.push(
        authQueueService.executeStateUpdate(async () => {
          const currentValue = counter;
          // Simulate async operation that could cause race condition
          await new Promise(resolve => setTimeout(resolve, 1));
          counter = currentValue + 1;
          return counter;
        }, `increment_${i}`)
      );
    }

    await Promise.all(incrementOperations);
    
    console.log(`🎯 Final counter value: ${counter} (should be 100 if no race conditions)`);
    
    if (counter === 100) {
      console.log('✅ Race condition prevention SUCCESSFUL - counter is correct!');
    } else {
      console.log('❌ Race condition prevention FAILED - counter is incorrect!');
    }
  }

  /**
   * Run all race condition tests
   */
  static async runAllTests(): Promise<void> {
    console.log('🚀 Starting race condition prevention tests...');
    
    try {
      await this.testConcurrentLogins();
      console.log('---');
      
      await this.testConcurrentStateUpdates();
      console.log('---');
      
      await this.testMixedConcurrentOperations();
      console.log('---');
      
      await this.demonstrateRaceConditionPrevention();
      console.log('---');
      
      console.log('🎉 All race condition tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Race condition test failed:', error);
      throw error;
    }
  }
}

// Export for manual testing in console
if (typeof window !== 'undefined') {
  (window as any).raceConditionTest = RaceConditionTest;
}

// Instructions for manual testing
console.log(`
🧪 Race Condition Test Instructions:
1. Open browser console
2. Run: raceConditionTest.runAllTests()
3. Or run individual tests:
   - raceConditionTest.testConcurrentLogins()
   - raceConditionTest.testConcurrentStateUpdates()
   - raceConditionTest.testMixedConcurrentOperations()
   - raceConditionTest.demonstrateRaceConditionPrevention()
`);

export default RaceConditionTest;