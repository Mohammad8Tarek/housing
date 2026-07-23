const fs = require('fs');

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // remove imports & hooks
  content = content.replace(/import \{ useToast \} from "@\/hooks\/use-toast";/g, 'import { toast } from "sonner";');
  content = content.replace(/^[ \t]*const \{ toast \} = useToast\(\);\r?\n/gm, '');

  // replace toast calls
  let count = 0;
  content = content.replace(/toast\(\{\s*title:\s*([\s\S]*?)(?:,\s*description:\s*([\s\S]*?))?(?:,\s*variant:\s*['"]destructive['"])?\s*\}\)/g, (match, title, desc) => {
    let isErr = match.includes('destructive');
    let out = isErr ? 'toast.error(' : 'toast.success(';
    out += title.trim().replace(/,$/, '');
    if (desc) {
      let d = desc.trim().replace(/,$/, '');
      out += ', {\n          description: ' + d + '\n        }';
    }
    out += ')';
    count++;
    return out;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Replaced ' + count + ' toasts in ' + filePath);
}

const files = [
  'src/pages/employees/detail.tsx',
  'src/pages/maintenance.tsx',
  'src/pages/maintenance-details.tsx',
  'src/pages/documents.tsx',
  'src/pages/properties.tsx'
];

files.forEach(migrateFile);
