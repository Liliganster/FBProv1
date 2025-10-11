# API Key Encryption Implementation 🔐

## Overview
Implemented AES-256-CBC encryption with HMAC authentication for all API keys stored in the database to prevent exposure of sensitive credentials.

## 🚨 Security Issue Resolved

**Problem**: API keys were stored in plain text in Supabase database  
**Risk Level**: 🔴 Critical - Database breaches could expose all user API keys  
**Solution**: AES-256-CBC encryption with HMAC authentication

## ✅ Implementation Details

### Encryption Specifications
- **Algorithm**: AES-256-CBC (Advanced Encryption Standard)
- **Key Derivation**: PBKDF2 with SHA-256, 100,000 iterations
- **Authentication**: HMAC-SHA256 for tamper detection
- **IV**: Random 128-bit Initialization Vector per encryption
- **Salt**: Random 256-bit salt per encryption

### Security Features
- **Authenticated Encryption**: HMAC prevents tampering
- **Key Stretching**: PBKDF2 makes brute force attacks harder
- **Unique Per Encryption**: Each encryption uses random IV/salt
- **Forward Secrecy**: Compromising one key doesn't expose others
- **Backward Compatibility**: Handles both encrypted and legacy plain text keys

## 📁 Files Created/Modified

### New Files
- `services/apiKeyEncryptionService.ts` - Core encryption service
- `scripts/migrateApiKeyEncryption.ts` - Migration script
- `api/admin/migrate-api-keys.ts` - Admin migration endpoint
- `public/test-api-key-encryption.js` - Testing utilities
- `API_KEY_ENCRYPTION_IMPLEMENTATION.md` - This documentation

### Modified Files
- `services/databaseService.ts` - Encrypt/decrypt API keys on DB operations
- `.env.example` - Added encryption configuration

## 🔧 Configuration

### Environment Variables (Required)
```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_KEY_ENCRYPTION_SECRET=your_64_character_hex_string_here

# Optional - for running migrations
ADMIN_SECRET=your_admin_secret_here
```

### Generating Secure Keys
```bash
# Generate API key encryption secret
node -e "console.log('API_KEY_ENCRYPTION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate admin secret
node -e "console.log('ADMIN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

## 🔄 Migration Process

### 1. Pre-Migration Setup
```bash
# Set required environment variables
export API_KEY_ENCRYPTION_SECRET=your_generated_secret
export ADMIN_SECRET=your_admin_secret

# Backup your database
# (Follow your database backup procedures)
```

### 2. Dry Run Analysis
```bash
# Analyze current state without making changes
curl -H "Authorization: Bearer $ADMIN_SECRET" \
  "https://your-app.com/api/admin/migrate-api-keys?dryRun=true"
```

### 3. Run Migration
```bash
# Encrypt all existing plain text API keys
curl -X POST \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  "https://your-app.com/api/admin/migrate-api-keys"
```

### 4. Verification
- Check migration results in response
- Test that user API keys still work
- Verify no plain text keys remain in database

## 📊 Database Schema Changes

### Before (Plain Text)
```sql
open_router_api_key: "sk-1234567890abcdef" -- ❌ Plain text
```

### After (Encrypted)
```sql
open_router_api_key: "{\"encryptedData\":\"...\",\"salt\":\"...\",\"iv\":\"...\",\"hmac\":\"...\"}" -- ✅ Encrypted JSON
```

## 🔒 Encryption Process

### Encryption Flow
1. Generate random 256-bit salt
2. Derive key from master secret + salt using PBKDF2
3. Generate random 128-bit IV
4. Encrypt API key with AES-256-CBC
5. Generate HMAC of salt + IV + encrypted data
6. Store as JSON: `{encryptedData, salt, iv, hmac}`

### Decryption Flow
1. Parse stored JSON
2. Extract salt, IV, encrypted data, HMAC
3. Derive key from master secret + salt
4. Verify HMAC (prevent tampering)
5. Decrypt data with AES-256-CBC
6. Return original API key

## 🧪 Testing

### Browser Console Testing
```javascript
// Load test script
fetch('/test-api-key-encryption.js').then(r => r.text()).then(eval);

// Run comprehensive tests
window.apiKeyEncryptionTests.runAllTests();
```

### Manual Verification
```javascript
// Check if API keys are encrypted in database
fetch('/api/admin/migrate-api-keys?dryRun=true', {
  headers: { 'Authorization': 'Bearer ' + ADMIN_SECRET }
}).then(r => r.json()).then(console.log);
```

## 🚀 Production Deployment

### Deployment Checklist
- [ ] Set `API_KEY_ENCRYPTION_SECRET` in production environment
- [ ] Set `ADMIN_SECRET` for migration access
- [ ] Backup database before migration
- [ ] Run dry run migration in production
- [ ] Review dry run results
- [ ] Run actual migration
- [ ] Verify API keys work correctly
- [ ] Remove admin migration endpoint (security)
- [ ] Monitor for encryption/decryption errors

### Post-Deployment Security
1. **Remove Migration Endpoint**: Delete `/api/admin/migrate-api-keys.ts` after migration
2. **Secure Environment Variables**: Ensure secrets are not logged or exposed
3. **Monitor Errors**: Watch for encryption/decryption failures
4. **Regular Key Rotation**: Consider rotating encryption secret periodically

## 🔍 Monitoring & Troubleshooting

### Common Issues

#### 1. Environment Variable Not Set
```
Error: API_KEY_ENCRYPTION_SECRET environment variable is required
```
**Solution**: Set the encryption secret in environment variables

#### 2. Decryption Fails
```
Error: Failed to decrypt API key
```
**Possible Causes**:
- Wrong encryption secret
- Corrupted database data
- HMAC verification failure

#### 3. Migration Fails
**Check**:
- Database connectivity
- Supabase permissions
- Environment variables set correctly

### Logs to Monitor
- `[ApiKeyEncryption] Encryption failed`
- `[ApiKeyEncryption] Decryption failed`
- `[DatabaseService] Found unencrypted API key`

## 📈 Benefits Achieved

✅ **Data Protection**: API keys encrypted at rest  
✅ **Tamper Detection**: HMAC prevents data modification  
✅ **Forward Secrecy**: Each encryption uses unique IV/salt  
✅ **Backward Compatibility**: Handles legacy plain text keys  
✅ **Performance**: Minimal overhead for encryption/decryption  
✅ **Compliance**: Meets security best practices for credential storage  
✅ **Auditability**: Clear migration path and verification process  

## 🔮 Future Enhancements

### Potential Improvements
1. **Key Rotation**: Automated encryption key rotation
2. **Hardware Security**: HSM integration for key storage
3. **Audit Logging**: Log all encryption/decryption operations
4. **Multiple Keys**: Support different keys per tenant
5. **External Key Store**: AWS KMS, Azure Key Vault integration

### Migration to External Key Management
When ready to migrate to external key management:
1. Set up external service (AWS KMS, etc.)
2. Create new encryption service using external keys
3. Run another migration to re-encrypt with new keys
4. Update environment variables
5. Remove local encryption secrets

The current implementation provides a solid foundation that can be upgraded to enterprise-grade key management solutions when needed.

## 🆘 Emergency Procedures

### If Encryption Key is Lost
1. **Stop the application** to prevent data corruption
2. **Restore from backup** before encryption was enabled
3. **Generate new encryption secret**
4. **Re-run migration** with new secret
5. **Update production environment**

### If Database is Compromised
1. **Encrypted keys are safe** - attackers need encryption secret
2. **Rotate encryption secret** as precaution
3. **Re-encrypt all keys** with new secret
4. **Audit access logs** for unauthorized access
5. **Consider revoking/regenerating** user API keys

The encryption implementation significantly reduces the impact of database breaches and provides multiple layers of security for sensitive API credentials.