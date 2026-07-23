#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

console.log('\n🔍 فحص PWA Installation Requirements...\n');
console.log('=' .repeat(60));

// Checklist
const checks = [];

// 1. Check manifest.json
const manifestPath = path.join(projectRoot, 'public', 'manifest.json');
const hasManifest = fs.existsSync(manifestPath);
checks.push({
  name: 'manifest.json',
  status: hasManifest,
  path: manifestPath,
});

if (hasManifest) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const requiredFields = [
    'name',
    'short_name',
    'description',
    'start_url',
    'display',
    'theme_color',
    'background_color',
    'icons',
  ];

  requiredFields.forEach((field) => {
    const hasField = field in manifest;
    checks.push({
      name: `  └─ ${field}`,
      status: hasField,
      value: manifest[field],
    });
  });

  // Check icons
  if (manifest.icons && Array.isArray(manifest.icons)) {
    console.log(`\n✓ Icons found: ${manifest.icons.length}`);
    manifest.icons.forEach((icon, i) => {
      checks.push({
        name: `  └─ Icon ${i + 1}: ${icon.sizes}`,
        status: !!icon.src && !!icon.type,
        value: icon.src,
      });
    });
  }
}

// 2. Check index.html for meta tags
const htmlPath = path.join(projectRoot, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const metaTags = [
  'viewport',
  'theme-color',
  'mobile-web-app-capable',
  'apple-mobile-web-app-capable',
  'apple-mobile-web-app-status-bar-style',
];

metaTags.forEach((tag) => {
  const hasTag = htmlContent.includes(`name="${tag}"`) || htmlContent.includes(`content="${tag}"`);
  checks.push({
    name: `  └─ Meta: ${tag}`,
    status: hasTag,
  });
});

// Check manifest link
const hasManifestLink = htmlContent.includes('rel="manifest"');
checks.push({
  name: '  └─ Manifest Link',
  status: hasManifestLink,
});

// 3. Check offline.html
const offlinePath = path.join(projectRoot, 'public', 'offline.html');
const hasOffline = fs.existsSync(offlinePath);
checks.push({
  name: 'offline.html',
  status: hasOffline,
  path: offlinePath,
});

// 4. Check icons
const iconsDir = path.join(projectRoot, 'public', 'icons');
const icons = [];
if (fs.existsSync(iconsDir)) {
  icons.push(...fs.readdirSync(iconsDir));
}

checks.push({
  name: 'Icons Directory',
  status: icons.length >= 2,
  value: `Found: ${icons.join(', ')}`,
});

// 5. Check Service Worker (in dist)
const swPath = path.join(projectRoot, 'dist', 'sw.js');
const hasSW = fs.existsSync(swPath);
checks.push({
  name: 'Service Worker (dist/sw.js)',
  status: hasSW,
  value: hasSW ? 'Built' : 'Run: npm run build',
});

// 6. Check vite config
const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
const viteContent = fs.readFileSync(viteConfigPath, 'utf8');
const hasVitePWA = viteContent.includes('VitePWA');
checks.push({
  name: 'Vite PWA Plugin',
  status: hasVitePWA,
});

// Print results
console.log('\n📋 PWA Installation Checklist:\n');

let passCount = 0;
let failCount = 0;

checks.forEach((check) => {
  const icon = check.status ? '✅' : '❌';
  const status = check.status ? 'PASS' : 'FAIL';

  if (check.status) passCount++;
  else failCount++;

  console.log(`${icon} ${check.name.padEnd(40)} ${status}`);

  if (check.value) {
    console.log(`   Value: ${check.value.toString().substring(0, 50)}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Result: ${passCount} PASS / ${failCount} FAIL\n`);

if (failCount === 0) {
  console.log('🎉 تم! التطبيق جاهز 100% للتثبيت من أي متصفح!\n');
  console.log('الخطوات التالية:');
  console.log('1. npm run preview');
  console.log('2. افتح http://localhost:10000 على هاتفك');
  console.log('3. سترى رسالة التثبيت تلقائياً!\n');
  process.exit(0);
} else {
  console.log('⚠️  يوجد بعض المشاكل. يجب إصلاحها قبل التثبيت.\n');
  console.log('تلميحات:');
  if (!hasManifest) console.log('- تأكد من وجود public/manifest.json');
  if (!hasOffline) console.log('- تأكد من وجود public/offline.html');
  if (icons.length < 2) console.log('- أضف أيقونات في public/icons/');
  if (!hasSW) console.log('- قم بـ: npm run build لبناء Service Worker');
  console.log('\n');
  process.exit(1);
}
