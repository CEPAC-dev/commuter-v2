(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/auth/signUpDriver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'NodeTest',
        phone: '+201000000005',
        password: 'password123',
        email: 'nodetest5@example.com',
        gender: 'male',
      }),
    });
    const text = await res.text();
    console.log('STATUS', res.status, text);
  } catch (err) {
    console.error(err);
  }
})();
