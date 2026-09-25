import fs from 'fs';
import path from 'path';

const routesDir = 'artifacts/api-server/src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'health.ts');

const results = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
  
  // Regex to match router.<method>(...
  // We can find all router.(get|post|put|delete|patch)
  const regex = /router\.(get|post|put|delete|patch)\s*\(\s*([^,]+),/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const rawPath = match[2].trim().replace(/['"`]/g, '');
    const index = match.index;
    const lineNumber = content.substring(0, index).split('\n').length;
    
    // Look at the arguments between the path and the final handler
    // Find the next 500 characters
    const chunk = content.substring(index, index + 500);
    
    const hasRequirePerm = chunk.includes('requirePermission');
    const hasRequireAnyPerm = chunk.includes('requireAnyPermission');
    const hasSuperAdmin = chunk.includes('requireSuperAdmin') || chunk.includes('super_admin');
    const hasAdmin = chunk.includes('requireAdmin');
    const hasRequireAuth = chunk.includes('requireAuth');
    const isWebhook = chunk.includes('x-api-key') || rawPath.includes('receive') || rawPath.includes('notify-');
    const isPortal = file.startsWith('portal-') || file === 'push-notifications.ts';
    const isPublic = file === 'room-service-public.ts' || rawPath.startsWith('/public/') || rawPath.includes('mock-feed');
    const isAuth = file === 'auth.ts';

    let permDetails = '';
    if (hasRequirePerm) {
      const m = chunk.match(/requirePermission\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/);
      if (m) permDetails = `requirePermission("${m[1]}", "${m[2]}")`;
    } else if (hasRequireAnyPerm) {
      const m = chunk.match(/requireAnyPermission\s*\(([\s\S]*?)\)/);
      if (m) permDetails = `requireAnyPermission(...)`;
    } else if (hasSuperAdmin) {
      permDetails = 'super_admin';
    }

    const isProtected = hasRequirePerm || hasRequireAnyPerm || hasSuperAdmin || hasAdmin;

    results.push({
      file,
      lineNumber,
      method,
      endpoint: rawPath,
      isProtected,
      isPortal,
      isPublic,
      isAuth,
      isWebhook,
      permDetails
    });
  }
}

const adminRoutes = results.filter(r => !r.isPortal && !r.isPublic && !r.isAuth);
const unprotected = adminRoutes.filter(r => !r.isProtected);

console.log(`Audited ${adminRoutes.length} Admin API routes.`);
console.log(`Protected: ${adminRoutes.length - unprotected.length}`);
console.log(`Unprotected / Open to any authenticated user: ${unprotected.length}\n`);

// Group by file
const grouped = {};
for (const u of unprotected) {
  if (!grouped[u.file]) grouped[u.file] = [];
  grouped[u.file].push(u);
}

for (const [file, list] of Object.entries(grouped)) {
  console.log(`📁 ${file} (${list.length} routes):`);
  for (const item of list) {
    console.log(`   - [Line ${item.lineNumber}] ${item.method.padEnd(6)} ${item.endpoint}`);
  }
}
