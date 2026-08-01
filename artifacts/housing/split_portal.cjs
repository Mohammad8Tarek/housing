const fs = require('fs');
const content = fs.readFileSync('src/pages/portal.tsx', 'utf8');
const lines = content.split('\n');
let imports = [];
let inImports = true;
let components = {};
let currentComp = '';

for (const line of lines) {
  if (inImports) {
    if (line.startsWith('function ') || line.startsWith('// ───')) {
      inImports = false;
    } else {
      imports.push(line);
      continue;
    }
  }
  if (line.startsWith('// ───')) {
    continue;
  }
  if (line.startsWith('function ')) {
    currentComp = line.split(' ')[1].split('(')[0];
    components[currentComp] = [];
  } else if (line.startsWith('export default function Portal() {')) {
    currentComp = 'Portal';
    components[currentComp] = [];
  }
  if (currentComp) {
    components[currentComp].push(line);
  }
}

fs.mkdirSync('src/pages/portal/components', { recursive: true });

for (const [name, lines] of Object.entries(components)) {
  if (name === 'Portal') {
    const importStatements = Object.keys(components)
      .filter(n => n !== 'Portal')
      .map(n => `import { ${n} } from './components/${n}';`)
      .join('\n');
    const compContent = lines.join('\n').replace('export default function Portal() {', 'export function PortalPage() {');
    fs.writeFileSync('src/pages/portal/PortalPage.tsx', imports.join('\n') + '\n' + importStatements + '\n' + compContent);
  } else {
    const compContent = lines.join('\n').replace(`function ${name}() {`, `export function ${name}() {`);
    fs.writeFileSync(`src/pages/portal/components/${name}.tsx`, '//@ts-nocheck\n' + imports.join('\n') + '\n' + compContent);
  }
}

fs.writeFileSync('src/pages/portal/index.tsx', "import { PortalPage } from './PortalPage';\nexport default PortalPage;\n");
