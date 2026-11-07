import { createServer } from 'node:http';
import { randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { getBookingTimes } from '../src/bookingTimes.js';

// Local demonstration only. Accounts, sessions and appointments reset on restart.
const services = [
  ['Masaż relaksacyjny', 60, 180], ['Masaż gorącymi kamieniami', 90, 250],
  ['Masaż klasyczny', 45, 200], ['Masaż aromaterapeutyczny', 60, 210],
  ['Rytuał dla dwojga', 90, 420], ['Masaż pleców i karku', 30, 120],
].map(([nazwa, czas_trwania_min, cena], i) => ({ id: String(i + 1), nazwa, czas_trwania_min, cena, aktywna: true, dostepna_jako_voucher: i !== 5 }));
const users = [], reservations = [], sessions = new Map();
const loginAttempts = new Map();
const dummySalt = randomBytes(16).toString('hex');
const dummyHash = scryptSync('dummy-password', dummySalt, 64);
function ensureCustomerId(account) {
  if (!account.customerId) {
    do { account.customerId = `KL-${randomBytes(8).toString('hex').toUpperCase()}`; }
    while (users.some(other => other !== account && other.customerId === account.customerId));
  }
  return account.customerId;
}
function reservationId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id;
  do {
    id = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (!/[A-Z]/.test(id) || !/[0-9]/.test(id) || reservations.some(reservation => reservation.id === id));
  return id;
}
const publicUser = account => ({ id: account.id, customerId: ensureCustomerId(account), imie: account.imie, nazwisko: account.nazwisko, email: account.email, telefon: account.telefon, data_urodzenia: account.data_urodzenia });
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const time = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function availability(query, excludedId) {
  const service = services.find(s => s.id === query.usluga_id);
  if (!service) fail('Wybierz usługę.');
  if (!validDate(query.data) || query.data < localDate()) fail('Wybierz prawidłową datę wizyty.');
  if (new Date(`${query.data}T12:00:00`).getDay() === 0) return [];
  const now = new Date();
  return getBookingTimes(service.czas_trwania_min).filter(start => {
    if (query.data === localDate() && minutes(start) <= now.getHours() * 60 + now.getMinutes()) return false;
    return !reservations.some(r => r.id !== excludedId && r.status !== 'ANULOWANA' && r.data === query.data &&
      minutes(start) < minutes(r.godz_do) && minutes(start) + service.czas_trwania_min > minutes(r.godz_od));
  }).map(start => ({ godz_od: start, godz_do: time(minutes(start) + service.czas_trwania_min) }));
}
function editable(reservation) {
  if (reservation.status === 'ANULOWANA' || reservation.status === 'ZAKONCZONA' ||
      new Date(`${reservation.data}T${reservation.godz_od}:00`) <= new Date()) fail('Nie można zmienić ani anulować tej wizyty.');
}
function validProfile(body) {
  for (const key of ['imie', 'nazwisko', 'email', 'telefon']) if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > (key === 'telefon' ? 25 : key === 'email' ? 200 : 80)) fail('Uzupełnij prawidłowo wszystkie pola.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) fail('Podaj prawidłowy e-mail.');
  if (!/^[+\d ()-]{7,25}$/.test(body.telefon.trim())) fail('Podaj prawidłowy numer telefonu.');
}

const server = createServer(async (req, res) => {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.headers.origin && new URL(req.headers.origin).hostname !== 'localhost' && new URL(req.headers.origin).hostname !== '127.0.0.1') fail('Niedozwolone źródło żądania.', 403);
    const path = url.pathname.replace(/^\/api/, '');
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 16000) fail('Zbyt duże żądanie.', 413); }
    let body = {};
    if (raw) { try { body = JSON.parse(raw); } catch { fail('Nieprawidłowe dane.'); } }
    const token = /(?:^|;\s*)soma_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const session = sessions.get(token);
    const user = session?.expires > Date.now() ? users.find(u => u.id === session.userId) : null;
    const login = account => {
      if (token) sessions.delete(token);
      const key = randomBytes(32).toString('hex');
      sessions.set(key, { userId: account.id, expires: Date.now() + 8 * 3600000 });
      res.setHeader('Set-Cookie', `soma_session=${key}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);
      send(200, publicUser(account));
    };
    if (path === '/services' && req.method === 'GET') return send(200, services.filter(s => url.searchParams.get('voucherOnly') !== 'true' || s.dostepna_jako_voucher));
    if (path === '/auth/me' && req.method === 'GET') return send(200, { user: user ? publicUser(user) : null });
    if (path === '/auth/logout' && req.method === 'POST') {
      sessions.delete(token); res.setHeader('Set-Cookie', 'soma_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'); return send(200, { ok: true });
    }
    if (path === '/auth/register' && req.method === 'POST') {
      for (const key of ['imie', 'nazwisko', 'email', 'telefon', 'haslo', 'data_urodzenia']) if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 200) fail('Uzupełnij wszystkie pola.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) fail('Podaj prawidłowy e-mail.');
      if (!/^[+\d ()-]{7,25}$/.test(body.telefon)) fail('Podaj prawidłowy numer telefonu.');
      if (body.haslo.length < 8) fail('Hasło musi mieć przynajmniej 8 znaków.');
      if (!validDate(body.data_urodzenia) || body.data_urodzenia > localDate()) fail('Podaj prawidłową datę urodzenia.');
      const email = body.email.trim().toLowerCase();
      if (users.some(u => u.email === email)) fail('Konto z tym adresem już istnieje.');
      const salt = randomBytes(16).toString('hex');
      const account = { id: randomUUID(), imie: body.imie.trim(), nazwisko: body.nazwisko.trim(), telefon: body.telefon, data_urodzenia: body.data_urodzenia, email, salt, hash: scryptSync(body.haslo, salt, 64) };
      users.push(account); return login(account);
    }
    if (path === '/auth/login' && req.method === 'POST') {
      const address = req.socket.remoteAddress;
      const attempts = loginAttempts.get(address);
      if (attempts && attempts.until > Date.now() && attempts.count >= 10) fail('Zbyt wiele prób logowania. Spróbuj ponownie później.', 429);
      const identifier = typeof body.login === 'string' ? body.login.trim() : '';
      const account = users.find(u => u.email === identifier.toLowerCase() || ensureCustomerId(u) === identifier.toUpperCase() || u.id === identifier);
      const password = typeof body.haslo === 'string' && body.haslo.length <= 200 ? body.haslo : '';
      const valid = timingSafeEqual(account?.hash || dummyHash, scryptSync(password, account?.salt || dummySalt, 64));
      if (!account || !password || !valid) {
        const entry = attempts && attempts.until > Date.now() ? attempts : { count: 0, until: Date.now() + 15 * 60000 };
        entry.count++; loginAttempts.set(address, entry);
        fail('Nieprawidłowy identyfikator lub hasło.', 401);
      }
      loginAttempts.delete(address);
      return login(account);
    }
    if (!user) fail('Zaloguj się, aby kontynuować.', 401);
    if (path === '/auth/me' && req.method === 'PATCH') {
      validProfile(body);
      const email = body.email.trim().toLowerCase();
      if (users.some(u => u !== user && u.email === email)) fail('Konto z tym adresem już istnieje.');
      Object.assign(user, { imie: body.imie.trim(), nazwisko: body.nazwisko.trim(), email, telefon: body.telefon.trim() });
      return send(200, publicUser(user));
    }
    if (path === '/auth/password' && req.method === 'POST') {
      if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 200 || !timingSafeEqual(user.hash, scryptSync(body.currentPassword, user.salt, 64))) fail('Nieprawidłowe aktualne hasło.');
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 200) fail('Nowe hasło musi mieć od 8 do 200 znaków.');
      user.salt = randomBytes(16).toString('hex'); user.hash = scryptSync(body.newPassword, user.salt, 64);
      for (const [key, value] of sessions) if (value.userId === user.id && key !== token) sessions.delete(key);
      return send(200, { ok: true });
    }
    if (path === '/availability' && req.method === 'GET') {
      const query = Object.fromEntries(url.searchParams);
      let excludedId;
      if (query.reservation_id) {
        const own = reservations.find(r => r.id === query.reservation_id && r.klient_id === user.id);
        if (!own) fail('Nie znaleziono rezerwacji.', 404);
        editable(own); excludedId = own.id;
      }
      return send(200, availability(query, excludedId));
    }
    if (path === '/reservations' && req.method === 'GET') return send(200, reservations.filter(r => r.klient_id === user.id));
    if (path === '/reservations' && req.method === 'POST') {
      const existing = reservations.find(r => r.klient_id === user.id && r.request_id === body.request_id);
      if (existing) return send(200, existing);
      if (typeof body.request_id !== 'string' || !body.request_id) fail('Brak identyfikatora żądania.');
      const slot = availability(body).find(s => s.godz_od === body.godz_od);
      if (!slot) fail('Ten termin jest już niedostępny. Wybierz inny.', 409);
      const service = services.find(s => s.id === body.usluga_id);
      const reservation = { id: reservationId(), request_id: body.request_id, klient_id: user.id, usluga_id: service.id, data: body.data, ...slot, uwagi: String(body.uwagi || '').slice(0, 400), status: 'OCZEKUJE_NA_PLATNOSC', zrodlo: 'WWW', kwota: service.cena, data_utworzenia: new Date().toISOString() };
      reservations.push(reservation); return send(201, reservation);
    }
    const match = /^\/reservations\/([^/]+)(\/payment)?$/.exec(path);
    if (match) {
      const reservation = reservations.find(r => r.id === match[1] && r.klient_id === user.id);
      if (!reservation) fail('Nie znaleziono rezerwacji.', 404);
      if (match[2] && req.method === 'POST') {
        if (reservation.status === 'ANULOWANA') fail('Ta rezerwacja została anulowana.');
        if (reservation.status !== 'OPLACONA' && body.wynik === 'odrzucona') fail('Płatność testowa odrzucona. Możesz spróbować ponownie.');
        if (body.wynik !== 'udana') fail('Nieprawidłowy wynik płatności.');
        reservation.status = 'OPLACONA';
        return send(200, { ...reservation, demo: true, powiadomienie: 'NIEWYSLANE' });
      }
      if (req.method === 'PATCH' && !match[2]) {
        editable(reservation);
        const service = services.find(s => s.id === body.usluga_id && s.aktywna);
        if (!service) fail('Wybierz usługę.');
        if (reservation.status === 'OPLACONA' && service.cena !== reservation.kwota) fail('Zmiana ceny opłaconej wizyty wymaga obsługi dopłaty lub zwrotu.');
        const slot = availability(body, reservation.id).find(s => s.godz_od === body.godz_od);
        if (!slot) fail('Ten termin jest już niedostępny. Wybierz inny.', 409);
        Object.assign(reservation, { usluga_id: service.id, data: body.data, ...slot, kwota: service.cena });
        return send(200, reservation);
      }
      if (req.method === 'DELETE' && !match[2]) { editable(reservation); if (reservation.status === 'OPLACONA') fail('Opłacona wizyta wymaga obsługi zwrotu.'); reservation.status = 'ANULOWANA'; return send(200, { ok: true }); }
      if (req.method === 'GET' && !match[2]) return send(200, reservation);
    }
    fail('Nie znaleziono usługi.', 404);
  } catch (error) { send(error.status || 500, { message: error.status ? error.message : 'Błąd serwera demonstracyjnego.' }); }
});
server.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('Soma demo API: http://127.0.0.1:' + (process.env.PORT || 3001) + '/api (dane w pamięci, bez prawdziwych płatności)'));
