/**
 * Diagnostic tool to analyze PDF extraction
 * Usage: Run this to see what the AI is extracting from a problematic PDF
 */

import { extractUniversalStructured } from '../services/extractor-universal/index';
import * as fs from 'fs';
import * as path from 'path';

async function diagnosePDF(pdfPath: string) {
  console.log('========================================');
  console.log('🔍 PDF EXTRACTION DIAGNOSTIC TOOL');
  console.log('========================================\n');
  
  console.log(`📄 Analyzing PDF: ${path.basename(pdfPath)}\n`);
  
  try {
    // Read PDF file
    const buffer = fs.readFileSync(pdfPath);
    const file = new File([buffer], path.basename(pdfPath), { type: 'application/pdf' });
    
    console.log('🤖 Running extraction with AGENT mode...\n');
    
    // Extract with agent mode (includes OCR)
    const result = await extractUniversalStructured({
      mode: 'agent',
      input: { file },
      provider: 'auto',
      useCrewFirst: false
    });
    
    console.log('\n========================================');
    console.log('📊 EXTRACTION RESULTS');
    console.log('========================================\n');
    
    console.log('✅ Project Name:', result.projectName || '❌ EMPTY/NULL');
    console.log('📅 Date:', result.date || '❌ EMPTY');
    console.log('🏢 Production Companies:', result.productionCompanies?.length ? result.productionCompanies : '❌ NONE');
    console.log('📍 Locations:', result.locations?.length || 0);
    
    if (result.locations && result.locations.length > 0) {
      console.log('\nLocations list:');
      result.locations.forEach((loc, i) => {
        console.log(`  ${i + 1}. ${loc}`);
      });
    }
    
    console.log('\n========================================');
    console.log('🔍 ANALYSIS');
    console.log('========================================\n');
    
    // Check for common issues
    if (!result.projectName || !result.projectName.trim()) {
      console.log('❌ ISSUE: Project name is empty!');
      console.log('   This will cause "Proyecto Desconocido" in the UI\n');
      console.log('   Possible causes:');
      console.log('   1. AI couldn\'t find a clear project title in the PDF');
      console.log('   2. Project name was filtered out (looks like a company name)');
      console.log('   3. PDF has no text layer (OCR failed)\n');
      
      if (result.productionCompanies && result.productionCompanies.length > 0) {
        console.log('   💡 Suggestion: Check if production company name contains the project name');
        console.log(`      Production companies: ${result.productionCompanies.join(', ')}\n`);
      }
    } else {
      console.log(`✅ Project name extracted successfully: "${result.projectName}"`);
    }
    
    if (!result.date) {
      console.log('\n⚠️  WARNING: Date is empty!');
    }
    
    if (!result.locations || result.locations.length === 0) {
      console.log('\n⚠️  WARNING: No locations found!');
    }
    
    console.log('\n========================================');
    console.log('📋 RAW EXTRACTION DATA (JSON)');
    console.log('========================================\n');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n========================================');
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('========================================\n');
    
  } catch (error: any) {
    console.error('\n❌ ERROR during extraction:');
    console.error(error.message);
    console.error('\nFull error:', error);
  }
}

// Get PDF path from command line argument
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.log('Usage: node diagnose-pdf.js <path-to-pdf>');
  console.log('Example: node diagnose-pdf.js public/images/FUNDBOX_call_sheet_3.pdf');
  process.exit(1);
}

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ File not found: ${pdfPath}`);
  process.exit(1);
}

diagnosePDF(pdfPath).catch(console.error);
