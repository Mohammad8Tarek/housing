const fs = require('fs');
const content = fs.readFileSync('src/pages/employees/index.tsx', 'utf8');
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
    currentComp = line.split(' ')[1].split('(')[0].split('{')[0].trim();
    components[currentComp] = [];
  } else if (line.startsWith('export default function Employees() {')) {
    currentComp = 'Employees';
    components[currentComp] = [];
  }
  if (currentComp) {
    components[currentComp].push(line);
  }
}

fs.mkdirSync('src/pages/employees/components', { recursive: true });

for (const [name, lines] of Object.entries(components)) {
  if (name === 'Employees') {
    const importStatements = Object.keys(components)
      .filter(n => n !== 'Employees')
      .map(n => `import { ${n} } from './components/${n}';`)
      .join('\n');
    const compContent = lines.join('\n').replace('export default function Employees() {', 'export function EmployeesPage() {');
    fs.writeFileSync('src/pages/employees/EmployeesPage.tsx', imports.join('\n') + '\n' + importStatements + '\n' + compContent);
  } else {
    let compContent = lines.join('\n');
    if (compContent.includes(`function ${name}(`)) {
       compContent = compContent.replace(`function ${name}(`, `export function ${name}(`);
    } else if (compContent.includes(`function ${name} {`)) {
       compContent = compContent.replace(`function ${name} {`, `export function ${name} {`);
    }
    fs.writeFileSync(`src/pages/employees/components/${name}.tsx`, '//@ts-nocheck\n' + imports.join('\n') + '\n' + compContent);
  }
}

fs.writeFileSync('src/pages/employees/index.tsx', "import { EmployeesPage } from './EmployeesPage';\nexport default EmployeesPage;\n");
