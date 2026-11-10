import fs from 'fs';
import path from 'path';

const routesDir = 'artifacts/api-server/src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'health.ts');

const allEndpoints = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
  
  // Match router.<method>(path, ...middlewares, handler)
  // handles single-line and multi-line
  const regex = /router\.(get|post|put|delete|patch)\s*\(\s*(['"][^'"]+['"]|`[^`]+`)([\s\S]*?)(?=\n\s*(?:router\.(?:get|post|put|delete|patch)|export default))/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const endpoint = match[2].replace(/['"`]/g, '');
    const definition = match[3];
    
    // Calculate line number
    const line = content.substring(0, match.index).split('\n').length;
    
    // Check for permissions in the middleware definitions before the actual handler
    const hasRequirePermission = definition.includes('requirePermission');
    const hasSuperAdmin = definition.includes('requireSuperAdmin') || definition.includes('super_admin') || definition.includes('isSystemAdmin');
    const hasAdmin = definition.includes('requireAdmin');
    const isPortalRoute = file.startsWith('portal-') || file === 'push-notifications.ts';
    const isPublicRoute = file === 'room-service-public.ts' || endpoint.startsWith('/public/') || endpoint.includes('mock-feed');
    const isAuthRoute = file === 'auth.ts';

    // Extract exact permission if available
    let permMatch = definition.match(/requirePermission\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/);
    let perm = permMatch ? `${permMatch[1]}.${permMatch[2]}` : null;

    allEndpoints.push({
      file,
      line,
      method,
      endpoint,
      perm,
      hasRequirePermission,
      hasSuperAdmin,
      hasAdmin,
      isPortalRoute,
      isPublicRoute,
      isAuthRoute,
      isProtected: hasRequirePermission || hasSuperAdmin || hasAdmin
    });
  }
}

console.log(`=== ACCURATE ENDPOINT RBAC AUDIT ===`);
console.log(`Total Endpoints parsed: ${allEndpoints.length}`);

const adminApiEndpoints = allEndpoints.filter(e => !e.isPortalRoute && !e.isPublicRoute && !e.isAuthRoute);
console.log(`Core Admin API Endpoints: ${adminApiEndpoints.length}`);

const protectedCount = adminApiEndpoints.filter(e => e.isProtected).length;
const unprotected = adminApiEndpoints.filter(e => !e.isProtected);

console.log(`Protected with RBAC/Admin: ${protectedCount}`);
console.log(`Open to ANY authenticated user (or missing permission check): ${unprotected.length}\n`);

// Group unprotected by file
const grouped = {};
for (const u of unprotected) {
  if (!grouped[u.file]) grouped[u.file] = [];
  grouped[u.file].push(u);
}

for (const [file, list] of Object.entries(grouped)) {
  console.log(`📌 ${file} (${list.length} endpoints):`);
  for (const item of list) {
    console.log(`   - [Line ${item.line}] ${item.method.padEnd(6)} ${item.endpoint}`);
  }
}
