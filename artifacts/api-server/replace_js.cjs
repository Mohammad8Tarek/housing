const fs = require('fs');
const file = 'src/routes/hosting-requests.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
        if (!canAccessProperty(lockRes.rows[0].property_id, user.propertyIds, user.isSystemAdmin)) {
          await client.query("ROLLBACK");
          res.status(403).json({ success: false, message: "Cross-tenant access denied" });
          return;
        }
`;

content = content.replace(/if \(lockRes\.rows\.length === 0\) \{\s+await client\.query\("ROLLBACK"\);\s+res\s+\.status\(404\)\s+\.json\(\{ success: false, message: ".*?" \}\);\s+return;\s+\}/gs, (match) => {
  return match + replacement;
});

fs.writeFileSync(file, content);
