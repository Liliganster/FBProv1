/**
 * File Validation Service
 *
 * Provides comprehensive file validation including:
 * - Magic number (file signature) validation
 * - MIME type verification
 * - File size limits
 * - Extension whitelist
 *
 * This prevents malicious file uploads and ensures only allowed file types
 * can be processed by the application.
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

/**
 * Magic numbers (file signatures) for allowed file types
 * These are the first bytes of each file type
 */
const FILE_SIGNATURES = {
  // Images
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0], // JPEG JFIF
    [0xFF, 0xD8, 0xFF, 0xE1], // JPEG EXIF
    [0xFF, 0xD8, 0xFF, 0xE8], // JPEG SPIFF
  ],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]], // RIFF....WEBP

  // Documents
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'text/plain': [], // Text files don't have a specific signature
  'message/rfc822': [], // Email files (.eml)

  // Microsoft Office (legacy)
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // DOC, XLS, PPT
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],

  // Microsoft Office (modern - ZIP-based)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4B, 0x03, 0x04], // DOCX (ZIP)
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    [0x50, 0x4B, 0x03, 0x04], // XLSX (ZIP)
  ],
};

/**
 * Allowed MIME types whitelist
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'message/rfc822',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Allowed file extensions whitelist
 */
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.txt',
  '.eml',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
];

/**
 * Maximum file size (10MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/**
 * Read the first N bytes of a file
 */
async function readFileSignature(file: File, numBytes: number = 12): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const blob = file.slice(0, numBytes);

    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      resolve(Array.from(uint8Array));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Check if bytes match a signature pattern
 * null in pattern means "any byte"
 */
function matchesSignature(bytes: number[], signature: (number | null)[]): boolean {
  if (bytes.length < signature.length) return false;

  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== null && bytes[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Detect file type from magic number
 */
function detectFileType(bytes: number[]): string | null {
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      if (matchesSignature(bytes, signature)) {
        return mimeType;
      }
    }
  }

  return null;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Validate file size
 */
function validateFileSize(file: File): FileValidationResult {
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File is too large (${sizeMB} MB). Maximum size is ${maxMB} MB`
    };
  }

  return { valid: true };
}

/**
 * Validate file extension
 */
function validateFileExtension(filename: string): FileValidationResult {
  const extension = getFileExtension(filename);

  if (!extension) {
    return {
      valid: false,
      error: 'File has no extension'
    };
  }

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File extension "${extension}" is not allowed. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate MIME type
 */
function validateMimeType(file: File): FileValidationResult {
  // Normalize MIME type
  let mimeType = file.type.toLowerCase();

  // Handle jpg/jpeg alias
  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }

  if (!mimeType) {
    return {
      valid: false,
      error: 'File has no MIME type'
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `File type "${mimeType}" is not allowed`
    };
  }

  return { valid: true };
}

/**
 * Validate file using magic number (file signature)
 */
async function validateMagicNumber(file: File): Promise<FileValidationResult> {
  try {
    // Special handling for text files and emails
    if (file.type === 'text/plain' || file.name.endsWith('.txt') ||
      file.type === 'message/rfc822' || file.name.endsWith('.eml')) {
      // Text files don't have a specific magic number, so we skip this check
      return { valid: true };
    }

    // Read file signature
    const bytes = await readFileSignature(file);
    const detectedType = detectFileType(bytes);

    if (!detectedType) {
      return {
        valid: false,
        error: 'Unable to verify file type. File may be corrupted or have an invalid format.'
      };
    }

    // Normalize for comparison
    let declaredType = file.type.toLowerCase();
    if (declaredType === 'image/jpg') declaredType = 'image/jpeg';

    // For ZIP-based formats (DOCX, XLSX), they all have the same signature
    const isZipBased = declaredType.includes('openxmlformats') ||
      detectedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isZipBased && detectedType.includes('openxmlformats')) {
      // ZIP-based Office formats are OK
      return { valid: true, detectedType };
    }

    // For legacy Office formats, DOC/XLS have the same signature
    const isLegacyOffice = declaredType === 'application/msword' ||
      declaredType === 'application/vnd.ms-excel';

    if (isLegacyOffice && detectedType === 'application/msword') {
      // Legacy Office formats share signature
      return { valid: true, detectedType };
    }

    // Exact match required for other types
    if (detectedType !== declaredType) {
      return {
        valid: false,
        error: `File type mismatch. Declared: ${declaredType}, Detected: ${detectedType}`,
        detectedType
      };
    }

    return { valid: true, detectedType };

  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Main validation function - checks all security requirements
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  // 1. Check file size
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) return sizeCheck;

  // 2. Check file extension
  const extensionCheck = validateFileExtension(file.name);
  if (!extensionCheck.valid) return extensionCheck;

  // 3. Check MIME type
  const mimeCheck = validateMimeType(file);
  if (!mimeCheck.valid) return mimeCheck;

  // 4. Check magic number (file signature)
  const magicCheck = await validateMagicNumber(file);
  if (!magicCheck.valid) return magicCheck;

  // All checks passed
  return {
    valid: true,
    detectedType: magicCheck.detectedType
  };
}

/**
 * Validate multiple files at once
 */
export async function validateFiles(files: File[]): Promise<Map<string, FileValidationResult>> {
  const results = new Map<string, FileValidationResult>();

  const validations = files.map(async (file) => {
    const result = await validateFile(file);
    results.set(file.name, result);
  });

  await Promise.all(validations);
  return results;
}

/**
 * Get a summary of validation results
 */
export function getValidationSummary(results: Map<string, FileValidationResult>): {
  valid: number;
  invalid: number;
  errors: Array<{ filename: string; error: string }>;
} {
  let valid = 0;
  let invalid = 0;
  const errors: Array<{ filename: string; error: string }> = [];

  for (const [filename, result] of results.entries()) {
    if (result.valid) {
      valid++;
    } else {
      invalid++;
      if (result.error) {
        errors.push({ filename, error: result.error });
      }
    }
  }

  return { valid, invalid, errors };
}
