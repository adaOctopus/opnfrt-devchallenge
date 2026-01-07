/**
 * Build script to compile TypeScript and prepare extension files
 * This script compiles TypeScript and converts ES6 modules to Chrome extension compatible format
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

// Step 2: Convert ES6 modules to Chrome extension format
console.log('🔧 Converting modules for Chrome extension...');

function convertModuleToGlobal(filePath, globalName) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove export statements and convert to global namespace
  content = content.replace(/export\s+(class|function|const|let|var|async function)\s+(\w+)/g, '$1 $2');
  content = content.replace(/export\s*\{([^}]+)\}/g, (match, exports) => {
    // Extract export names
    const names = exports.split(',').map(s => s.trim().split(' as ')[0].trim());
    return names.map(name => {
      if (name.includes(':')) return ''; // Skip type exports
      return `\n// Export ${name} to global namespace\nif (typeof window !== 'undefined') { window.${globalName} = window.${globalName} || {}; window.${globalName}.${name} = ${name}; } else { self.${globalName} = self.${globalName} || {}; self.${globalName}.${name} = ${name}; }`;
    }).join('\n');
  });
  
  // Add global namespace assignment at the end for classes/functions
  const classMatches = content.match(/(?:export\s+)?(class|function|async function)\s+(\w+)/g);
  if (classMatches) {
    classMatches.forEach(match => {
      const nameMatch = match.match(/(?:export\s+)?(?:class|function|async function)\s+(\w+)/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (!content.includes(`self.${globalName}`) && !content.includes(`window.${globalName}`)) {
          const globalAssign = `\n\n// Export to global namespace\nif (typeof window !== 'undefined') { window.${globalName} = window.${globalName} || {}; window.${globalName}.${name} = ${name}; } else { self.${globalName} = self.${globalName} || {}; self.${globalName}.${name} = ${name}; }`;
          if (!content.includes(globalAssign)) {
            content += globalAssign;
          }
        }
      }
    });
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

// Convert core module
const corePath = path.join(__dirname, 'extension', 'modules', 'cdp', 'core.js');
if (fs.existsSync(corePath)) {
  let coreContent = fs.readFileSync(corePath, 'utf8');
  
  // Remove export keywords
  coreContent = coreContent.replace(/export\s+/g, '');
  
  // Add global namespace export at the end
  if (!coreContent.includes('self.CDP') && !coreContent.includes('window.CDP')) {
    coreContent += `
// Export to global namespace for Chrome extension compatibility
if (typeof window !== 'undefined') {
  window.CDP = { CDPContext, Page, createPage };
} else {
  self.CDP = { CDPContext, Page, createPage };
}
`;
  }
  
  fs.writeFileSync(corePath, coreContent, 'utf8');
}

// Convert scraper modules
const scrapers = [
  { file: 'virustotal.js', global: 'VirusTotalScraper' },
  { file: 'ipinfo.js', global: 'IPInfoScraper' },
  { file: 'abuseipdb.js', global: 'AbuseIPDBScraper' }
];

scrapers.forEach(({ file, global }) => {
  const scraperPath = path.join(__dirname, 'extension', 'modules', 'scrapers', file);
  if (fs.existsSync(scraperPath)) {
    let content = fs.readFileSync(scraperPath, 'utf8');
    
    // Remove export keywords and import statements
    content = content.replace(/export\s+/g, '');
    content = content.replace(/import\s+.*from\s+['"].*['"];?\n/g, '');
    
    // Fix createPage calls to use CDP global namespace
    content = content.replace(/\bcreatePage\(/g, 'CDP.createPage(');
    content = content.replace(/\bPage\b/g, 'CDP.Page');
    content = content.replace(/\bCDPContext\b/g, 'CDP.CDPContext');
    
    // Add global namespace export
    const funcName = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)?.[1] || 'scrape' + global.replace('Scraper', '');
    if (!content.includes(`self.${global}`) && !content.includes(`window.${global}`)) {
      content += `
// Export to global namespace
if (typeof window !== 'undefined') {
  window.${global} = { ${funcName} };
} else {
  self.${global} = { ${funcName} };
}
`;
    }
    
    fs.writeFileSync(scraperPath, content, 'utf8');
  }
});

// Step 3: Prepare background service worker
console.log('🔧 Preparing background service worker...');
const backgroundPath = path.join(__dirname, 'extension', 'background.js');

if (fs.existsSync(backgroundPath)) {
  let backgroundContent = fs.readFileSync(backgroundPath, 'utf8');
  
  // Remove import statements and export statements
  backgroundContent = backgroundContent.replace(/^import\s+.*from\s+['"].*['"];?\n/gm, '');
  backgroundContent = backgroundContent.replace(/^\/\/.*Type imports.*\n/gm, '');
  backgroundContent = backgroundContent.replace(/^declare\s+.*\n/gm, '');
  backgroundContent = backgroundContent.replace(/export\s+\{\s*\};?\s*\n?/g, ''); // Remove export {}
  backgroundContent = backgroundContent.replace(/export\s+/g, ''); // Remove any other exports
  
  // Always add importScripts at the very top (before any code)
  const importScripts = `// Import modules using importScripts (Chrome extension compatible)
importScripts(
  'modules/cdp/core.js',
  'modules/scrapers/virustotal.js',
  'modules/scrapers/ipinfo.js',
  'modules/scrapers/abuseipdb.js'
);

`;
  
  // Remove any existing importScripts
  backgroundContent = backgroundContent.replace(/\/\/ Import modules using importScripts[\s\S]*?importScripts\([^)]+\);\s*\n/g, '');
  
  // Add importScripts at the very beginning
  backgroundContent = importScripts + backgroundContent;
  
  fs.writeFileSync(backgroundPath, backgroundContent, 'utf8');
  console.log('✅ Background service worker prepared\n');
}

// Step 4: Fix popup.js - remove exports
const popupPath = path.join(__dirname, 'extension', 'popup', 'popup.js');
if (fs.existsSync(popupPath)) {
  let popupContent = fs.readFileSync(popupPath, 'utf8');
  popupContent = popupContent.replace(/^import\s+.*from\s+['"].*['"];?\n/gm, '');
  popupContent = popupContent.replace(/export\s+\{\s*\};?\s*\n?/g, ''); // Remove export {}
  popupContent = popupContent.replace(/export\s+/g, '');
  fs.writeFileSync(popupPath, popupContent, 'utf8');
}

// Step 5: Clean up all export {} statements in all JS files
function removeExportsFromFile(filePath) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/export\s+\{\s*\};?\s*\n?/g, '');
    content = content.replace(/export\s+/g, '');
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// Clean up all module files
const moduleFiles = [
  'extension/modules/cdp/core.js',
  'extension/modules/scrapers/virustotal.js',
  'extension/modules/scrapers/ipinfo.js',
  'extension/modules/scrapers/abuseipdb.js'
];

moduleFiles.forEach(file => {
  removeExportsFromFile(path.join(__dirname, file));
});

console.log('✨ Build complete! Extension ready in ./extension/');
console.log('\n📝 Next steps:');
console.log('   1. Load the extension from ./extension/ in Chrome');
console.log('   2. chrome://extensions/ → Enable Developer mode → Load unpacked');
