import { useEffect, useState } from 'react';
import { api, today } from './api';

function Notice({ children }) { return children ? <p className="modal-warning" role="alert">{children}</p> : null; }

export function AccountPage({ register, onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (register && data.haslo !== data.powtorz) { setError('Hasła muszą być takie same.'); return; }
    delete data.powtorz;
    setBusy(true); setError('');
    try { onLogin(await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(data) })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="form-page login-page">
    <a className="back-link" href="#start">← Strona główna</a>
    <h1>{register ? 'Załóż konto' : 'Logowanie'}</h1>
    <p>Zaloguj się lub załóż konto, aby zarezerwować masaż.</p>
    <Notice>{error}</Notice>
    <form className="login-form" onSubmit={submit}>
      {register ? <>
        <label className="field">Imię<input name="imie" autoComplete="given-name" required maxLength={80}/></label>
        <label className="field">Nazwisko<input name="nazwisko" autoComplete="family-name" required maxLength={80}/></label>
        <label className="field">Data urodzenia<input name="data_urodzenia" type="date" max={today()} autoComplete="bday" required/></label>
        <label className="field">E-mail<input name="email" type="email" autoComplete="email" required maxLength={200}/></label>
        <label className="field">Telefon<input name="telefon" type="tel" autoComplete="tel" required maxLength={25}/></label>
      </> : <label className="field">ID klienta lub e-mail<input name="login" autoComplete="username" required maxLength={200}/></label>}
      <label className="field">Hasło<input name="haslo" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={200} required/></label>
      {register && <label className="field">Powtórz hasło<input name="powtorz" type="password" autoComplete="new-password" required maxLength={200}/></label>}
      <button className="button button-dark" disabled={busy}>{busy ? 'Proszę czekać…' : register ? 'Utwórz konto i przejdź dalej' : 'Zaloguj się'}</button>
    </form>
    <a className="back-link" href={register ? '#/logowanie' : '#/konto'}>{register ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}</a>
  </section>;
}

export function BookingFlow({ services, user, initialServiceId }) {
  const storageKey = `soma-booking-${user.id}`;
  const [resumeId] = useState(() => sessionStorage.getItem(storageKey));
  const [resuming, setResuming] = useState(Boolean(resumeId));
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ usluga_id: initialServiceId || '', data: '', godz_od: '', uwagi: '' });
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [reservation, setReservation] = useState(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const service = services.find(s => String(s.id) === form.usluga_id && s.aktywna !== false);
  const slot = slots.find(s => s.godz_od === form.godz_od);

  useEffect(() => {
    if (!resumeId) return;
    const controller = new AbortController();
    async function resume() {
      try {
        const saved = await api(`/reservations/${encodeURIComponent(resumeId)}`, { signal: controller.signal });
        if (saved.status === 'ANULOWANA') { sessionStorage.removeItem(storageKey); return; }
        setForm(saved); setReservation(saved); setStep(saved.status === 'OPLACONA' ? 4 : 3);
      } catch (err) {
        if (err.name !== 'AbortError') setError('Nie udało się przywrócić rezerwacji. Odśwież stronę, aby ponowić próbę.');
      } finally { if (!controller.signal.aborted) setResuming(false); }
    }
    resume();
    return () => controller.abort();
  }, [resumeId, storageKey]);

  useEffect(() => {
    if (!form.data || step !== 1) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ usluga_id: form.usluga_id, data: form.data });
    api(`/availability?${query}`, { signal: controller.signal }).then(data => {
      setSlots(data); setLoading(false); setError('');
    }).catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [form.usluga_id, form.data, step, retry]);

  function change(name, value) {
    setError('');
    setForm(previous => ({ ...previous, [name]: value, godz_od: '', ...(name === 'usluga_id' ? { data: '' } : {}) }));
    setSlots([]); setRequestId(crypto.randomUUID());
    if (name === 'data') setLoading(Boolean(value));
  }
  function go(next) {
    setError('');
    if (next === 1 && form.data) { setSlots([]); setLoading(true); setForm(f => ({ ...f, godz_od: '' })); }
    setStep(next);
  }
  async function confirm() {
    setBusy(true); setError('');
    try {
      const created = await api('/reservations', { method: 'POST', body: JSON.stringify({ ...form, request_id: requestId }) });
      sessionStorage.setItem(storageKey, created.id);
      setReservation(created); setStep(3);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function pay(wynik) {
    setBusy(true); setError('');
    try { setReservation(await api(`/reservations/${reservation.id}/payment`, { method: 'POST', body: JSON.stringify({ wynik }) })); setStep(4); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError('');
    try { await api(`/reservations/${reservation.id}`, { method: 'DELETE' }); sessionStorage.removeItem(storageKey); setReservation(null); setRequestId(crypto.randomUUID()); go(1); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const labels = ['Usługa', 'Termin', 'Potwierdzenie', 'Płatność'];
  if (resuming) return <p className="form-page" role="status">Przywracanie rezerwacji…</p>;
  return <section className="form-page flow-page">
    <a className="back-link" href="#oferta">← Oferta masaży</a>
    <h1>{step === 4 ? 'Wizyta zarezerwowana' : 'Rezerwacja masażu'}</h1>
    <ol className="flow-steps" aria-label="Etapy rezerwacji">{labels.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className={step >= i ? 'current' : ''}>{i + 1}. {label}</li>)}</ol>
    <Notice>{error}</Notice>
    {error && step === 1 && <button className="back-link retry-button" onClick={() => { setRetry(r => r + 1); setLoading(true); }}>Spróbuj ponownie</button>}
    {step === 0 && <form className="login-form" onSubmit={e => { e.preventDefault(); go(1); }}>
      <h2>Wybierz usługę</h2>
      <label className="field">Masaż<select required value={form.usluga_id} onChange={e => change('usluga_id', e.target.value)}><option value="">Wybierz masaż</option>{services.filter(s => s.aktywna !== false).map(s => <option key={s.id} value={s.id}>{s.nazwa} · {s.czas_trwania_min} min · {s.cena} zł</option>)}</select></label>
      <button className="button button-dark" disabled={!service}>Dalej</button>
    </form>}
    {step === 1 && <form className="login-form" onSubmit={e => { e.preventDefault(); go(2); }}>
      <h2>Wybierz termin</h2><p>Poniedziałek–sobota, 09:00–19:00. Masaż trwa {service?.czas_trwania_min} minut.</p>
      <label className="field">Data<input type="date" required min={today()} value={form.data} onChange={e => change('data', e.target.value)}/></label>
      <label className="field">Godzina<select required disabled={loading || !slots.length} value={form.godz_od} onChange={e => { setForm(f => ({ ...f, godz_od: e.target.value })); setRequestId(crypto.randomUUID()); }}><option value="">{loading ? 'Sprawdzanie terminów…' : 'Wybierz godzinę'}</option>{slots.map(s => <option key={s.godz_od} value={s.godz_od}>{s.godz_od}–{s.godz_do}</option>)}</select></label>
      {form.data && !loading && !error && !slots.length && <p role="status">Brak wolnych terminów. Wybierz inną datę.</p>}
      <label className="field">Uwagi (opcjonalnie)<textarea maxLength={400} rows={3} value={form.uwagi} onChange={e => setForm(f => ({ ...f, uwagi: e.target.value }))}/></label>
      <div className="flow-actions"><button type="button" className="button button-outline" onClick={() => go(0)}>Wstecz</button><button className="button button-dark" disabled={!slot || loading}>Podsumowanie</button></div>
    </form>}
    {step >= 2 && <dl className="flow-summary">
      <div><dt>Masaż</dt><dd>{service?.nazwa} · {service?.czas_trwania_min} min</dd></div>
      <div><dt>Termin</dt><dd>{form.data} · {reservation?.godz_od || slot?.godz_od}–{reservation?.godz_do || slot?.godz_do}</dd></div>
      <div><dt>Klient</dt><dd>{user.imie} {user.nazwisko} · {user.email}</dd></div>
      {form.uwagi && <div><dt>Uwagi</dt><dd>{form.uwagi}</dd></div>}
      <div><dt>Kwota</dt><dd>{reservation?.kwota ?? service?.cena} zł</dd></div>
    </dl>}
    {step === 2 && <><p>Sprawdź dane przed potwierdzeniem. Termin zostanie ponownie sprawdzony przy zapisie.</p><div className="flow-actions"><button className="button button-outline" disabled={busy} onClick={() => go(1)}>Zmień termin</button><button className="button button-dark" disabled={busy} onClick={confirm}>{busy ? 'Zapisywanie…' : 'Potwierdzam rezerwację'}</button></div></>}
    {step === 3 && <><h2>Płatność testowa</h2><p>Rezerwacja została utworzona i oczekuje na płatność. To symulacja — nie pobieramy pieniędzy ani danych karty.</p><div className="flow-actions"><button className="button button-dark" disabled={busy} onClick={() => pay('udana')}>Symuluj udaną płatność</button><button className="button button-outline" disabled={busy} onClick={() => pay('odrzucona')}>Symuluj odrzucenie</button><button className="button button-outline" disabled={busy} onClick={cancel}>Anuluj i zmień termin</button></div></>}
    {step === 4 && <><p role="status">Płatność testowa zakończona powodzeniem. Numer rezerwacji: {reservation.id}.</p><p>W wersji demonstracyjnej nie wysyłamy e-maili ani SMS-ów. Zapisz dane wizyty i przyjdź o wybranej godzinie.</p><a className="button button-dark" href="#start" onClick={() => sessionStorage.removeItem(storageKey)}>Wróć na stronę główną</a></>}
  </section>;
}
