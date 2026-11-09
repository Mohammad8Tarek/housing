import fs from 'fs';
import path from 'path';

const pagesDir = 'artifacts/housing/src/pages';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const tsxFiles = getFiles(pagesDir);
console.log(`Auditing ${tsxFiles.length} frontend page components...`);

const pageStats = [];

for (const file of tsxFiles) {
  const relPath = path.relative(pagesDir, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf-8');
  
  const hasGate = content.includes('PermissionGate');
  const hasUseAuth = content.includes('useAuth') || content.includes('hasPermission');
  const buttonMatches = content.match(/<Button/g) || [];
  const gateMatches = content.match(/<PermissionGate/g) || [];

  pageStats.push({
    file: relPath,
    buttonsCount: buttonMatches.length,
    gatesCount: gateMatches.length,
    hasGate,
    hasUseAuth
  });
}

// Pages with buttons but 0 PermissionGates
const unguardedPages = pageStats.filter(p => p.buttonsCount > 0 && p.gatesCount === 0);
console.log(`\nPages with buttons but ZERO <PermissionGate>: (${unguardedPages.length})`);
unguardedPages.forEach(p => {
  console.log(`   - ${p.file} (${p.buttonsCount} buttons, hasAuthCheck: ${p.hasUseAuth})`);
});
