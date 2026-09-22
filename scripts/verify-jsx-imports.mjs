import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const TARGET_DIRS = [
  path.join(rootDir, "artifacts", "housing", "src"),
  path.join(rootDir, "artifacts", "employee-portal", "src"),
];

const REACT_GLOBALS = new Set([
  "Fragment", "React", "Suspense", "StrictMode", "Profiler"
]);

function getAllFiles(dir, extList, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
        getAllFiles(fullPath, extList, files);
      }
    } else if (entry.isFile() && extList.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractBindingIdentifiers(pattern, targetSet) {
  for (const element of pattern.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (ts.isIdentifier(element.name)) {
      targetSet.add(element.name.text);
    } else if (ts.isBindingPattern(element.name)) {
      extractBindingIdentifiers(element.name, targetSet);
    }
  }
}

function verifyTsxFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const declaredIdentifiers = new Set();
  const usedJsxComponents = [];

  function visit(node) {
    // 1. Collect import identifiers
    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;
      if (importClause) {
        if (importClause.name) {
          declaredIdentifiers.add(importClause.name.text);
        }
        if (importClause.namedBindings) {
          if (ts.isNamespaceImport(importClause.namedBindings)) {
            declaredIdentifiers.add(importClause.namedBindings.name.text);
          } else if (ts.isNamedImports(importClause.namedBindings)) {
            for (const el of importClause.namedBindings.elements) {
              declaredIdentifiers.add(el.name.text);
            }
          }
        }
      }
    }

    // 2. Collect local declarations (variables, parameters, functions, classes, etc.)
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        declaredIdentifiers.add(node.name.text);
      } else if (ts.isBindingPattern(node.name)) {
        extractBindingIdentifiers(node.name, declaredIdentifiers);
      }
    }
    if (ts.isParameter(node)) {
      if (ts.isIdentifier(node.name)) {
        declaredIdentifiers.add(node.name.text);
      } else if (ts.isBindingPattern(node.name)) {
        extractBindingIdentifiers(node.name, declaredIdentifiers);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      declaredIdentifiers.add(node.name.text);
    }
    if (ts.isClassDeclaration(node) && node.name) {
      declaredIdentifiers.add(node.name.text);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      declaredIdentifiers.add(node.name.text);
    }
    if (ts.isInterfaceDeclaration(node)) {
      declaredIdentifiers.add(node.name.text);
    }
    if (ts.isEnumDeclaration(node)) {
      declaredIdentifiers.add(node.name.text);
    }

    // 3. Collect JSX opening and self-closing tags
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) {
        const name = tag.text;
        // Only uppercase components (lowercase are intrinsic HTML elements)
        if (name[0] >= "A" && name[0] <= "Z") {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(tag.getStart(sourceFile));
          usedJsxComponents.push({
            name,
            line: line + 1,
            col: character + 1,
          });
        }
      } else if (ts.isPropertyAccessExpression(tag)) {
        // e.g. <DropdownMenu.Item /> or <motion.div />
        let root = tag.expression;
        while (ts.isPropertyAccessExpression(root)) {
          root = root.expression;
        }
        if (ts.isIdentifier(root)) {
          const name = root.text;
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(root.getStart(sourceFile));
          usedJsxComponents.push({
            name,
            line: line + 1,
            col: character + 1,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const errors = [];
  for (const comp of usedJsxComponents) {
    if (REACT_GLOBALS.has(comp.name)) continue;
    if (!declaredIdentifiers.has(comp.name)) {
      errors.push(comp);
    }
  }

  return errors;
}

function run() {
  console.log("🔍 Running AST-based JSX Import Verification across project...");
  let totalErrors = 0;
  let totalChecked = 0;

  for (const targetDir of TARGET_DIRS) {
    const files = getAllFiles(targetDir, [".tsx"]);
    totalChecked += files.length;

    for (const file of files) {
      const errors = verifyTsxFile(file);
      if (errors.length > 0) {
        const rel = path.relative(rootDir, file);
        console.error(`\n❌ In ${rel}:`);
        for (const err of errors) {
          console.error(`   Line ${err.line}:${err.col}: <${err.name}> is used in JSX but not imported or declared!`);
          totalErrors++;
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Checked ${totalChecked} TSX files using TypeScript AST.`);
  if (totalErrors === 0) {
    console.log("✅ 100% CLEAN: All JSX components across the entire codebase are properly imported!");
    process.exit(0);
  } else {
    console.error(`❌ Found ${totalErrors} missing JSX component imports.`);
    process.exit(1);
  }
}

run();
