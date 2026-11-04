import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const child = spawn(process.execPath, ['server/demo.mjs'], { env: { ...process.env, PORT: '3017' }, stdio: ['ignore', 'pipe', 'inherit'] });
try {
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Server failed to start'); })]);
  let cookie = '';
  async function request(path, method = 'GET', body, expected = 200) {
    const response = await fetch(`http://127.0.0.1:3017/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  await request('/availability?usluga_id=1', 'GET', null, 401);
  const user = await request('/auth/register', 'POST', { imie: 'Test', nazwisko: 'Testowy', data_urodzenia: '2015-01-01', email: 'flow@example.com', telefon: '123456789', haslo: 'Test-flow-123' });
  assert.ok(user.id); assert.equal(user.hash, undefined);
  await request('/auth/logout', 'POST');
  await request('/auth/login', 'POST', { login: 'flow@example.com', haslo: 'wrong' }, 401);
  await request('/auth/login', 'POST', { login: user.id, haslo: 'Test-flow-123' });
  assert.equal((await request('/auth/me')).user.id, user.id);
  const date = new Date(); date.setDate(date.getDate() + 2);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  const data = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const selection = { usluga_id: '2', data };
  const query = new URLSearchParams(selection);
  const slots = await request(`/availability?${query}`);
  assert.equal(slots.at(-1).godz_od, '17:30'); assert.equal(slots.at(-1).godz_do, '19:00');
  const payload = { ...selection, godz_od: '16:30', request_id: 'first' };
  const reservation = await request('/reservations', 'POST', payload, 201);
  assert.match(reservation.id, /^[A-Z0-9]{10}$/);
  assert.match(reservation.id, /[A-Z]/);
  assert.match(reservation.id, /[0-9]/);
  assert.equal('gabinet_id' in reservation, false);
  assert.equal('masazysta_id' in reservation, false);
  assert.equal((await request(`/reservations/${reservation.id}`)).id, reservation.id);
  assert.equal((await request('/reservations', 'POST', payload)).id, reservation.id);
  assert.ok(!(await request(`/availability?${query}`)).some(s => s.godz_od === '17:30'));
  await request('/reservations', 'POST', { ...payload, request_id: 'overlap', godz_od: '17:30' }, 409);
  await request(`/reservations/${reservation.id}`, 'DELETE');
  assert.ok((await request(`/availability?${query}`)).some(s => s.godz_od === '17:30'));
  const second = await request('/reservations', 'POST', { ...payload, request_id: 'second', godz_od: '17:30' }, 201);
  assert.notEqual(second.id, reservation.id);
  assert.match(second.id, /^[A-Z0-9]{10}$/);
  await request('/reservations', 'POST', { ...payload, usluga_id: '1', request_id: 'different-service', godz_od: '18:00' }, 409);
  await request(`/reservations/${second.id}/payment`, 'POST', { wynik: 'odrzucona' }, 400);
  const paid = await request(`/reservations/${second.id}/payment`, 'POST', { wynik: 'udana' });
  assert.equal(paid.status, 'OPLACONA'); assert.equal(paid.powiadomienie, 'NIEWYSLANE');
  assert.equal((await request(`/reservations/${second.id}/payment`, 'POST', { wynik: 'udana' })).id, second.id);
  await request('/auth/logout', 'POST');
  await request(`/reservations/${second.id}`, 'GET', null, 401);
  await request('/auth/login', 'POST', { login: user.email, haslo: 'Test-flow-123' });
  const ids = new Set([reservation.id, second.id]);
  for (let i = 0; i < 30; i++) {
    const next = await request('/reservations', 'POST', { ...payload, godz_od: '09:00', request_id: `unique-${i}` }, 201);
    assert.match(next.id, /^[A-Z0-9]{10}$/);
    assert.ok(!ids.has(next.id)); ids.add(next.id);
    await request(`/reservations/${next.id}`, 'DELETE');
  }
  console.log('PASS: registration, login, availability, overlap, idempotency, cancellation, payment retry, ownership');
} finally { child.kill(); }
