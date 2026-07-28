const fs = require('fs');
const replacement = COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/housing/package.json ./artifacts/housing/
COPY artifacts/employee-portal/package.json ./artifacts/employee-portal/
COPY interfaces/hr-sync/package.json ./interfaces/hr-sync/;

// Dockerfile.backend
let backend = fs.readFileSync('Dockerfile.backend', 'utf8');
backend = backend.replace(/COPY lib\/db\/package\.json \.\/lib\/db\/(.|\n)*COPY artifacts\/housing\/package\.json \.\/housing\//g, replacement);
fs.writeFileSync('Dockerfile.backend', backend);

// Dockerfile.frontend
let frontend = fs.readFileSync('Dockerfile.frontend', 'utf8');
frontend = frontend.replace(/COPY lib\/db\/package\.json \.\/lib\/db\/(.|\n)*COPY artifacts\/housing\/package\.json \.\/housing\//g, replacement);
fs.writeFileSync('Dockerfile.frontend', frontend);

// Dockerfile.portal
let portal = fs.readFileSync('Dockerfile.portal', 'utf8');
portal = portal.replace(/COPY lib\/db\/package\.json \.\/lib\/db\/(.|\n)*COPY artifacts\/employee-portal\/package\.json \.\/artifacts\/employee-portal\//g, replacement);
fs.writeFileSync('Dockerfile.portal', portal);
console.log('Dockerfiles patched successfully');
