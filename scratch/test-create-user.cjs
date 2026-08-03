async function testCreateUser() {
  const loginRes = await fetch('https://sunrise-api-production-2410.up.railway.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'superadmin', password: 'password' })
  });
  
  const cookies = loginRes.headers.get('set-cookie');
  console.log('Login:', loginRes.status, await loginRes.text());
  
  const res = await fetch('https://sunrise-api-production-2410.up.railway.app/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      username: 'test_user_1234',
      password: 'Password123!',
      propertyId: 1,
      propertyIds: [1],
      roles: ['admin'],
      permissions: [],
      status: 'ACTIVE'
    })
  });
  
  const text = await res.text();
  console.log('STATUS:', res.status);
  console.log('RESPONSE:', text);
}

testCreateUser().catch(console.error);
