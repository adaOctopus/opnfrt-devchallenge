/**
 * Build script to compile TypeScript and prepare extension files
 * This script compiles TypeScript and adds importScripts for service worker compatibility
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building TypeScript extension...\n');

// Step 1: Compile TypeScript
console.log('📦 Compiling TypeScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation complete\n');
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

// Step 2: Add importScripts to background.js for service worker compatibility
console.log('🔧 Preparing background service worker...');
const backgroundPath = path.join(__dirname, 'extension', 'background.js');

if (fs.existsSync(backgroundPath)) {
  let backgroundContent = fs.readFileSync(backgroundPath, 'utf8');
  
  // Add importScripts at the top if not already present
  if (!backgroundContent.includes('importScripts')) {
    const importScripts = `// Import modules using importScripts (Chrome extension compatible)
importScripts(
  'modules/cdp/core.js',
  'modules/scrapers/virustotal.js',
  'modules/scrapers/ipinfo.js',
  'modules/scrapers/abuseipdb.js'
);

`;
    
    // Remove TypeScript import statements if any
    backgroundContent = backgroundContent.replace(/^import.*from.*;?\n/gm, '');
    backgroundContent = backgroundContent.replace(/^\/\/.*Type imports.*\n/gm, '');
    backgroundContent = backgroundContent.replace(/^declare.*\n/gm, '');
    
    // Add importScripts at the beginning
    const commentMatch = backgroundContent.match(/^\/\*\*[\s\S]*?\*\/\s*/);
    if (commentMatch) {
      backgroundContent = backgroundContent.replace(
        commentMatch[0],
        commentMatch[0] + '\n' + importScripts
      );
    } else {
      backgroundContent = importScripts + backgroundContent;
    }
    
    fs.writeFileSync(backgroundPath, backgroundContent, 'utf8');
    console.log('✅ Background service worker prepared\n');
  }
}

console.log('✨ Build complete! Extension ready in ./extension/');
console.log('\n📝 Next steps:');
console.log('   1. Load the extension from ./extension/ in Chrome');
console.log('   2. chrome://extensions/ → Enable Developer mode → Load unpacked');

