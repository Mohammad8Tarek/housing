const fs = require('fs');
const file = 'src/routes/hosting-requests.ts';
let content = fs.readFileSync(file, 'utf8');
const rx = /let lockRes;\s+if \(user\.isSystemAdmin\) \{\s+lockRes = await client\.query\(\s+"SELECT (.*?)\s+FROM public\.hosting_requests WHERE id = \$1 FOR UPDATE",\s+\[requestId\],\s+\);\s+\} else \{\s+lockRes = await client\.query\(\s+"SELECT .*? FROM public\.hosting_requests WHERE id = \$1 AND property_id = ANY\(\$2::int\[\]\) FOR UPDATE",\s+\[requestId, user\.propertyIds\],\s+\);\s+\}/gs;
content = content.replace(rx, (match, fields) => {
  const f = fields.includes('property_id') ? fields : fields + ', property_id';
  return `const lockRes = await client.query(
            "SELECT ${f} FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
            [requestId],
          );`;
});
fs.writeFileSync(file, content);
