/**
 * Migration Script: Encrypt Existing API Keys
 * 
 * This script migrates existing plain text API keys in the database
 * to encrypted format using AES-256-CBC with HMAC authentication.
 * 
 * IMPORTANT: Run this migration AFTER setting up the API_KEY_ENCRYPTION_SECRET
 * environment variable and BEFORE deploying the new encryption code.
 */

import { supabase } from '../lib/supabase';
import { apiKeyEncryption } from '../services/apiKeyEncryptionService';

interface UserProfileRow {
  id: string;
  open_router_api_key: string | null;
  email?: string;
}

interface MigrationResult {
  totalProfiles: number;
  profilesWithApiKeys: number;
  alreadyEncrypted: number;
  successfullyEncrypted: number;
  errors: string[];
}

async function isApiKeyEncrypted(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  
  // Check if it looks like encrypted JSON
  if (apiKey.startsWith('{') && apiKey.includes('"encryptedData"')) {
    try {
      const parsed = JSON.parse(apiKey);
      return apiKeyEncryption.isValidEncryptionData(parsed);
    } catch {
      return false;
    }
  }
  
  return false;
}

async function encryptApiKeyForMigration(plainTextKey: string): Promise<string> {
  const encrypted = apiKeyEncryption.encryptApiKey(plainTextKey);
  return JSON.stringify(encrypted);
}

export async function migrateApiKeysToEncrypted(): Promise<MigrationResult> {
  console.log('🔐 Starting API Key Encryption Migration...');
  
  const result: MigrationResult = {
    totalProfiles: 0,
    profilesWithApiKeys: 0,
    alreadyEncrypted: 0,
    successfullyEncrypted: 0,
    errors: []
  };

  try {
    // Check if encryption secret is configured
    try {
      apiKeyEncryption.encryptApiKey('test');
    } catch (error) {
      throw new Error('API_KEY_ENCRYPTION_SECRET is not properly configured. Please set it before running migration.');
    }

    // Fetch all user profiles with API keys
    console.log('📊 Fetching user profiles...');
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, open_router_api_key, email')
      .not('open_router_api_key', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log('✅ No profiles with API keys found. Migration not needed.');
      return result;
    }

    result.totalProfiles = profiles.length;
    console.log(`📋 Found ${profiles.length} profiles with API keys`);

    // Process each profile
    for (const profile of profiles) {
      try {
        if (!profile.open_router_api_key) {
          continue;
        }

        result.profilesWithApiKeys++;
        
        // Check if already encrypted
        if (await isApiKeyEncrypted(profile.open_router_api_key)) {
          result.alreadyEncrypted++;
          console.log(`⏭️  Profile ${profile.id} (${profile.email || 'unknown'}) already encrypted`);
          continue;
        }

        // Encrypt the plain text API key
        const encryptedKey = await encryptApiKeyForMigration(profile.open_router_api_key);
        
        // Update the database
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            open_router_api_key: encryptedKey,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id);

        if (updateError) {
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        result.successfullyEncrypted++;
        console.log(`✅ Profile ${profile.id} (${profile.email || 'unknown'}) encrypted successfully`);

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorMsg = `Failed to encrypt API key for profile ${profile.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Verification step - try to decrypt a few random encrypted keys
    console.log('🔍 Performing verification...');
    const { data: verificationProfiles } = await supabase
      .from('user_profiles')
      .select('id, open_router_api_key')
      .not('open_router_api_key', 'is', null)
      .limit(3);

    let verificationSuccess = 0;
    if (verificationProfiles) {
      for (const profile of verificationProfiles) {
        try {
          if (profile.open_router_api_key) {
            const parsed = JSON.parse(profile.open_router_api_key);
            const decrypted = apiKeyEncryption.decryptApiKey(parsed);
            if (decrypted) {
              verificationSuccess++;
            }
          }
        } catch (error) {
          console.warn(`⚠️  Verification failed for profile ${profile.id}:`, error);
        }
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total profiles processed: ${result.totalProfiles}`);
    console.log(`   Profiles with API keys: ${result.profilesWithApiKeys}`);
    console.log(`   Already encrypted: ${result.alreadyEncrypted}`);
    console.log(`   Successfully encrypted: ${result.successfullyEncrypted}`);
    console.log(`   Verification successful: ${verificationSuccess}/${verificationProfiles?.length || 0}`);
    console.log(`   Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (result.successfullyEncrypted > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('   All API keys are now encrypted with AES-256-CBC + HMAC');
      console.log('   The application will automatically decrypt them when needed');
    }

    return result;

  } catch (error) {
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    console.error(`💥 ${errorMsg}`);
    throw error;
  }
}

/**
 * Dry run function to test migration without making changes
 */
export async function dryRunApiKeyMigration(): Promise<void> {
  console.log('🧪 DRY RUN: API Key Encryption Migration Analysis');
  
  try {
    // Check encryption setup
    try {
      const testEncryption = apiKeyEncryption.encryptApiKey('test-key');
      const testDecryption = apiKeyEncryption.decryptApiKey(testEncryption);
      console.log('✅ Encryption service is working correctly');
    } catch (error) {
      console.error('❌ Encryption service error:', error);
      return;
    }

    // Analyze current data
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, open_router_api_key, email')
      .not('open_router_api_key', 'is', null);

    if (error) {
      console.error('❌ Database query error:', error);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('✅ No profiles with API keys found');
      return;
    }

    let plainTextCount = 0;
    let encryptedCount = 0;
    let invalidCount = 0;

    for (const profile of profiles) {
      if (!profile.open_router_api_key) continue;

      if (await isApiKeyEncrypted(profile.open_router_api_key)) {
        encryptedCount++;
      } else if (profile.open_router_api_key.trim().length > 0) {
        plainTextCount++;
      } else {
        invalidCount++;
      }
    }

    console.log(`\n📊 Current State Analysis:`);
    console.log(`   Total profiles: ${profiles.length}`);
    console.log(`   Plain text API keys: ${plainTextCount} 🔴`);
    console.log(`   Encrypted API keys: ${encryptedCount} 🟢`);
    console.log(`   Invalid/empty keys: ${invalidCount} ⚪`);
    
    if (plainTextCount > 0) {
      console.log(`\n⚠️  ${plainTextCount} API keys need encryption!`);
      console.log(`   Run migrateApiKeysToEncrypted() to encrypt them`);
    } else {
      console.log(`\n✅ All API keys are already encrypted or no keys found`);
    }

  } catch (error) {
    console.error('💥 Dry run failed:', error);
  }
}

// Export for use in scripts or admin functions
export default {
  migrateApiKeysToEncrypted,
  dryRunApiKeyMigration
};