async function test() {
  const res = await fetch('http://localhost:3000/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Customer',
      email: 'test' + Date.now() + '@example.com'
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
