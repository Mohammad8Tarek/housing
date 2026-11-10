import fs from 'fs';
import path from 'path';

const routesDir = 'artifacts/api-server/src/routes';
const files = [
  'whatsapp.ts',
  'hotek-config.ts',
  'hr-sync.ts',
  'room-inventory.ts',
  'workers.ts',
  'rooms.ts',
  'user-signature.ts',
  'maintenance.ts',
  'gate.ts',
  'properties.ts'
];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log(`\n=================== ${file} ===================`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*(['"][^'"]+['"]|`[^`]+`)/);
    if (match) {
      const method = match[1].toUpperCase();
      const endpoint = match[2].replace(/['"`]/g, '');
      const block = lines.slice(i, i + 8).join('\n');
      
      const hasPerm = block.includes('requirePermission') || 
                      block.includes('requireAnyPermission') || 
                      block.includes('requireSuperAdmin') || 
                      block.includes('requireAdmin') ||
                      block.includes('super_admin');
                      
      let permInfo = '❌ NO PERM CHECK';
      if (hasPerm) {
        const pMatch = block.match(/(requirePermission|requireAnyPermission)\([^)]+\)/);
        permInfo = pMatch ? `✅ ${pMatch[0]}` : '✅ Admin Protected';
      }
      
      console.log(`[Line ${i+1}] ${method.padEnd(6)} ${endpoint.padEnd(30)} ${permInfo}`);
    }
  }
}
