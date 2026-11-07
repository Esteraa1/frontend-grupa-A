import { useEffect, useState } from 'react';
import { api, today } from './api';

const statusLabels = { OCZEKUJE_NA_PLATNOSC: 'Oczekuje na płatność', OPLACONA: 'Opłacona', ANULOWANA: 'Anulowana', ZAKONCZONA: 'Zakończona' };
const isFuture = reservation => new Date(`${reservation.data}T${reservation.godz_od}:00`) > new Date();
const isFinished = reservation => new Date(`${reservation.data}T${reservation.godz_do}:00`) <= new Date();
const duration = reservation => {
  const [startHour, startMinute] = reservation.godz_od.split(':').map(Number);
  const [endHour, endMinute] = reservation.godz_do.split(':').map(Number);
  return (endHour - startHour) * 60 + endMinute - startMinute;
};

function ReservationEditor({ reservation, services, onSaved, onClose }) {
  const [form, setForm] = useState({ usluga_id: reservation.usluga_id, data: reservation.data, godz_od: '' });
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!form.data || !form.usluga_id) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ usluga_id: form.usluga_id, data: form.data, reservation_id: reservation.id });
    api(`/availability?${query}`, { signal: controller.signal }).then(data => { setSlots(data); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [form.data, form.usluga_id, reservation.id, retry]);
  function change(key, value) {
    setForm(previous => ({ ...previous, [key]: value, godz_od: '' }));
    setSlots([]); setError(''); setLoading(Boolean(value));
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onSaved(await api(`/reservations/${encodeURIComponent(reservation.id)}`, { method: 'PATCH', body: JSON.stringify(form) })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <form className="login-form reservation-editor" onSubmit={submit}>
    <h3>Zmień wizytę</h3>
    <p>Obecny termin: {reservation.data}, {reservation.godz_od}–{reservation.godz_do}.</p>
    <label className="field">Masaż<select required value={form.usluga_id} onChange={e => change('usluga_id', e.target.value)}>{services.filter(s => s.aktywna !== false).map(s => <option key={s.id} value={s.id}>{s.nazwa} · {s.czas_trwania_min} min · {s.cena} zł</option>)}</select></label>
    {reservation.status === 'OPLACONA' && <p>Zmiana opłaconej wizyty jest możliwa dla usług o tej samej cenie.</p>}
    <label className="field">Data<input type="date" min={today()} required value={form.data} onChange={e => change('data', e.target.value)}/></label>
    <label className="field">Godzina<select required disabled={loading || !slots.length} value={form.godz_od} onChange={e => setForm(previous => ({ ...previous, godz_od: e.target.value }))}><option value="">{loading ? 'Sprawdzanie terminów…' : 'Wybierz godzinę'}</option>{slots.map(slot => <option key={slot.godz_od} value={slot.godz_od}>{slot.godz_od}–{slot.godz_do}</option>)}</select></label>
    {form.data && !loading && !error && !slots.length && <p role="status">Brak wolnych terminów. Wybierz inną datę.</p>}
    {error && <><p className="modal-warning" role="alert">{error}</p><button type="button" className="back-link retry-button" onClick={() => { setError(''); setLoading(true); setRetry(value => value + 1); }}>Odśwież dostępność</button></>}
    <div className="flow-actions"><button className="button button-dark" disabled={busy || loading || !form.godz_od}>{busy ? 'Zapisywanie…' : 'Zapisz wizytę'}</button><button type="button" className="button button-outline" disabled={busy} onClick={onClose}>Wróć</button></div>
  </form>;
}

function SectionNotice({ notice }) {
  if (!notice) return null;
  return <p className={notice.error ? 'modal-warning' : 'account-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>;
}

export default function UserPanel({ user, onUserChange, services }) {
  const [profile, setProfile] = useState({ imie: user.imie, nazwisko: user.nazwisko, email: user.email, telefon: user.telefon });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [notices, setNotices] = useState({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api('/reservations', { signal: controller.signal }).then(data => {
      if (!Array.isArray(data)) throw new Error('Nieprawidłowa odpowiedź serwera przy pobieraniu rezerwacji.');
      setReservations(data); setLoadError(''); setLoading(false);
    })
      .catch(err => { if (err.name !== 'AbortError') { setLoadError(err.status === 404 ? 'Serwer nie udostępnia listy rezerwacji. Uruchom aktualną wersję backendu demonstracyjnego.' : err.message); setLoading(false); } });
    return () => controller.abort();
  }, [reload, user.id]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setReload(value => value + 1); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  function notify(section, text, error = false) {
    setNotices(previous => ({ ...previous, [section]: text ? { text, error } : null }));
  }
  function invalid(event, section) {
    const field = event.currentTarget.querySelector(':invalid');
    if (field) notify(section, field.validationMessage, true);
  }
  async function action(section, callback, success) {
    setBusy(true); notify(section, '');
    try { await callback(); notify(section, success); }
    catch (err) { notify(section, err.message, true); }
    finally { setBusy(false); }
  }
  function saveProfile(event) {
    event.preventDefault();
    action('profile', async () => { const updated = await api('/auth/me', { method: 'PATCH', body: JSON.stringify(profile) }); onUserChange(updated); setProfile({ imie: updated.imie, nazwisko: updated.nazwisko, email: updated.email, telefon: updated.telefon }); }, 'Dane zostały zapisane.');
  }
  function savePassword(event) {
    event.preventDefault();
    if (password.newPassword !== password.confirmation) { notify('password', 'Nowe hasła muszą być takie same.', true); return; }
    action('password', async () => { await api('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: password.currentPassword, newPassword: password.newPassword }) }); setPassword({ currentPassword: '', newPassword: '', confirmation: '' }); }, 'Hasło zostało zmienione.');
  }
  function cancel(reservation) {
    if (!window.confirm(`Czy na pewno anulować rezerwację ${reservation.id}?`)) return;
    action('reservations', async () => { await api(`/reservations/${encodeURIComponent(reservation.id)}`, { method: 'DELETE' }); setReservations(previous => previous.map(item => item.id === reservation.id ? { ...item, status: 'ANULOWANA' } : item)); setEditing(''); }, 'Rezerwacja została anulowana.');
  }
  async function copyId() {
    try { await navigator.clipboard.writeText(user.customerId); setCopyMessage('Skopiowano ID klienta'); }
    catch { setCopyMessage('Nie udało się skopiować ID. Zaznacz i skopiuj je ręcznie.'); }
  }
  return <section className="form-page flow-page user-panel">
    <a className="back-link" href="#start">← Strona główna</a><h1>Moje konto</h1>
    <section className="account-section"><h2>Moje rezerwacje</h2><SectionNotice notice={notices.reservations}/><a className="button button-outline" href="#/rezerwacja" onClick={() => sessionStorage.removeItem(`soma-booking-${user.id}`)}>Umów nową wizytę</a>
      {loading ? <p role="status">Ładowanie rezerwacji…</p> : loadError ? <><p className="modal-warning" role="alert">{loadError}</p><button className="back-link retry-button" onClick={() => { setLoading(true); setLoadError(''); setReload(value => value + 1); }}>Spróbuj ponownie</button></> : reservations.length === 0 ? <p>Brak rezerwacji</p> : reservations.map(reservation => {
        const service = services.find(item => String(item.id) === reservation.usluga_id);
        const editable = isFuture(reservation) && !['ANULOWANA', 'ZAKONCZONA'].includes(reservation.status);
        const label = reservation.status === 'ANULOWANA' ? statusLabels.ANULOWANA : isFinished(reservation) ? 'Zakończona' : !isFuture(reservation) ? 'W trakcie' : statusLabels[reservation.status] || reservation.status;
        return <article className="reservation-card" key={reservation.id}><h3>{service?.nazwa || 'Usługa niedostępna'}</h3><dl className="flow-summary"><div><dt>Numer rezerwacji</dt><dd>{reservation.id}</dd></div><div><dt>Termin</dt><dd>{reservation.data} · {reservation.godz_od}–{reservation.godz_do}</dd></div><div><dt>Czas trwania</dt><dd>{duration(reservation)} min</dd></div><div><dt>Status</dt><dd>{label}</dd></div></dl>
          {editable && <div className="flow-actions"><button className="button button-outline" disabled={busy} onClick={() => setEditing(editing === reservation.id ? '' : reservation.id)}>Zmień wizytę</button>{reservation.status !== 'OPLACONA' ? <><a className="button button-outline" href="#/rezerwacja" onClick={() => sessionStorage.setItem(`soma-booking-${user.id}`, reservation.id)}>Przejdź do płatności</a><button className="button button-outline" disabled={busy} onClick={() => cancel(reservation)}>Anuluj rezerwację</button></> : <p>Opłacona wizyta wymaga obsługi zwrotu — skontaktuj się ze studiem.</p>}</div>}
          {editing === reservation.id && editable && <ReservationEditor key={reservation.id} reservation={reservation} services={services} onClose={() => setEditing('')} onSaved={updated => { setReservations(previous => previous.map(item => item.id === updated.id ? updated : item)); setEditing(''); notify('reservations', 'Rezerwacja została zmieniona.'); }}/>} 
        </article>;
      })}
    </section>
    <SectionNotice notice={notices.profile}/>
    <section className="account-section"><h2>Informacje o koncie</h2>
      <div className="customer-id"><div><span>ID klienta</span><strong>{user.customerId || 'ID klienta niedostępne'}</strong></div><button type="button" className="button button-outline" onClick={copyId} disabled={!user.customerId}>Kopiuj ID</button></div>
      {copyMessage && <p role="status">{copyMessage}</p>}
      {user.data_urodzenia && <p>Data urodzenia: {user.data_urodzenia}</p>}
      <form className="login-form account-fields" onSubmit={saveProfile} onInvalid={event => invalid(event, 'profile')}>
        <label className="field">Imię<input required maxLength={80} autoComplete="given-name" value={profile.imie} onChange={e => setProfile({ ...profile, imie: e.target.value })}/></label>
        <label className="field">Nazwisko<input required maxLength={80} autoComplete="family-name" value={profile.nazwisko} onChange={e => setProfile({ ...profile, nazwisko: e.target.value })}/></label>
        <label className="field">E-mail<input type="email" required maxLength={200} autoComplete="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}/></label>
        <label className="field">Telefon<input type="tel" required maxLength={25} pattern="(?:[0-9 ]|\+|\(|\)|-){7,25}" autoComplete="tel" value={profile.telefon} onChange={e => setProfile({ ...profile, telefon: e.target.value })}/></label>
        <div><button className="button button-dark" disabled={busy}>Zapisz dane</button></div>
      </form>
    </section>
    <SectionNotice notice={notices.password}/>
    <section className="account-section"><h2>Zmiana hasła</h2><form className="login-form" onSubmit={savePassword} onInvalid={event => invalid(event, 'password')}>
      <label className="field">Aktualne hasło<input type="password" required maxLength={200} autoComplete="current-password" value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })}/></label>
      <label className="field">Nowe hasło<input type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })}/></label>
      <label className="field">Potwierdź nowe hasło<input type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={password.confirmation} onChange={e => setPassword({ ...password, confirmation: e.target.value })}/></label>
      <div><button className="button button-dark" disabled={busy}>Zmień hasło</button></div>
    </form></section>

  </section>;
}
