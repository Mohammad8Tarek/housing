fetch('http://localhost:4001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'admin' })
}).then(r => r.json()).then(console.log).catch(console.error);
