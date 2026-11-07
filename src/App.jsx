import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { api } from './api';
import { AccountPage, BookingFlow } from './BookingFlow';
import UserPanel from './UserPanel';

import HERO_IMAGE from './assets/2025-163-1.10b8aadf.jpg';

// Katalog awaryjny: umożliwia obejrzenie strony, nawet gdy serwer jest wyłączony.
// W tym trybie formularz nie zapisze rezerwacji.
const DEMO_SERVICES = [
  { id: '1', nazwa: 'Masaż relaksacyjny', opis: 'Delikatny rytuał, który rozluźnia napięcia i pozwala odzyskać wewnętrzny spokój.', czas_trwania_min: 60, cena: 180, aktywna: true, dostepna_jako_voucher: true },
  { id: '2', nazwa: 'Masaż gorącymi kamieniami', opis: 'Otulające ciepło kamieni i spokojne ruchy pomagają głęboko się odprężyć.', czas_trwania_min: 90, cena: 250, aktywna: true, dostepna_jako_voucher: true },
  { id: '3', nazwa: 'Masaż klasyczny', opis: 'Klasyczna praca z mięśniami dla rozluźnienia i regeneracji po intensywnym dniu.', czas_trwania_min: 45, cena: 200, aktywna: true, dostepna_jako_voucher: true },
  { id: '4', nazwa: 'Masaż aromaterapeutyczny', opis: 'Płynne, harmonijne ruchy i naturalne aromaty tworzą chwilę relaksu.', czas_trwania_min: 60, cena: 210, aktywna: true, dostepna_jako_voucher: true },
  { id: '5', nazwa: 'Rytuał dla dwojga', opis: 'Wspólna chwila wyciszenia i odpoczynku.', czas_trwania_min: 90, cena: 420, aktywna: true, dostepna_jako_voucher: true },
  { id: '6', nazwa: 'Masaż pleców i karku', opis: 'Skoncentrowana regeneracja miejsc, w których najczęściej gromadzi się napięcie.', czas_trwania_min: 30, cena: 120, aktywna: true, dostepna_jako_voucher: false }
];

function Arrow({ diagonal = false }) {
  return <span aria-hidden="true">{diagonal ? '↗' : '→'}</span>;
}

function SectionIntro({ title, children }) {
  return (
    <div className="section-intro">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function Header({ onBook, user, onLogout }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <header className="header">
        <a className="logo" href="#start" onClick={close} aria-label="Studio Soma – strona główna">soma<span className="logo-dot">.</span></a>
        <nav className={`nav ${open ? 'nav-open' : ''}`} aria-label="Nawigacja główna">
          {!user && <a href="#/logowanie" onClick={close}>Logowanie</a>}
          {user && <a href="#/moje-konto" onClick={close}>Moje konto</a>}
          {user && <button className="subtle-link" onClick={() => { close(); onLogout(); }}>Wyloguj</button>}
          <a href="#oferta" onClick={close}>Masaże</a>
          <a href="#kontakt" onClick={close}>Kontakt</a>
          <a className="nav-mobile-reservations" href="#/rezerwacja" onClick={close}>Umów wizytę</a>
        </nav>
        <div className="header-actions">
          <button className="button button-dark header-book" onClick={() => { close(); onBook(); }}>Umów wizytę <Arrow diagonal /></button>
          <button className="menu-toggle" aria-label={open ? 'Zamknij menu' : 'Otwórz menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}><span /><span /><span /></button>
        </div>
      </header>
    </>
  );
}

function Hero({ onBook }) {
  return (
    <section className="hero" id="start">
      <div className="hero-copy">
        <h1>Studio masażu<br />Soma</h1>
        <p>Wybierz masaż dla siebie i umów dogodny termin.</p>
        <div className="hero-buttons"><button className="button button-dark" onClick={() => onBook()}>Umów masaż <Arrow diagonal /></button><a className="text-link" href="#oferta">Poznaj nasze masaże <Arrow /></a></div>
      </div>
      <div className="hero-visual">
        <img src={HERO_IMAGE} alt="Relaksująca przestrzeń spa, delikatne światło i naturalne materiały" />
        <div className="hero-photo-tint" />
      </div>
    </section>
  );
}

function Services({ services, sourceLive, onBook }) {
  const [filter, setFilter] = useState('all');
  const filters = [{id: 'all', label: 'Wszystkie'}, {id:'short',label:'Do 60 minut'},{id:'long',label:'Ponad 60 minut'},{id:'voucher',label:'Voucher'}];
  const active = useMemo(() => services.filter(s => s.aktywna !== false).filter(s => filter === 'all' || (filter === 'short' && s.czas_trwania_min <= 60) || (filter === 'long' && s.czas_trwania_min > 60) || (filter === 'voucher' && s.dostepna_jako_voucher)), [services, filter]);
  return (
    <section className="section services-section" id="oferta">
      <div className="container">
        <div className="services-heading"><SectionIntro title="Oferta masaży">Sprawdź czas trwania i cenę, a następnie wybierz masaż.</SectionIntro></div>
        <div className="services-topline"><div className="filter-tabs" aria-label="Filtr usług">{filters.map(f => <button key={f.id} className={`filter-tab ${filter === f.id ? 'selected' : ''}`} aria-pressed={filter===f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div></div>
        {!sourceLive && <p className="services-offline">Rezerwacje są chwilowo niedostępne. Możesz przeglądać ofertę.</p>}
        <div className="services-grid">
          {active.length === 0 && <p>Brak usług w tej kategorii.</p>}
          {active.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-image"><span className="service-badge">{Number(service.czas_trwania_min) || 60} MIN</span></div>
              <div className="service-card-body"><div className="service-title-row"><h3>{service.nazwa}</h3><span className="service-price">{Number(service.cena).toFixed(0)} zł</span></div><p>{service.opis || 'Regenerujący rytuał dopasowany do Twoich potrzeb.'}</p><button className="card-action" onClick={() => onBook(String(service.id))}>Wybierz masaż <Arrow diagonal /></button></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (<section className="contact-section" id="kontakt"><div className="container contact-layout"><div><h2>Kontakt</h2><p>Studio masażu Soma</p></div><div className="contact-details"><div><span>GODZINY – PRZYKŁAD</span><strong>Pon.–sob. · 09:00–19:00</strong></div><div><span>LOKALIZACJA</span><strong>Warszawa, Polska</strong></div><div><span>KONTAKT</span><strong><a href="mailto:somawellness@example.com">somawellness@example.com</a></strong></div></div></div></section>);
}

function Footer() {
  return <footer className="footer"><div className="container footer-layout"><a className="footer-logo" href="#start">✳ soma<span>.</span></a><span>STUDIO WELLNESS · PROJEKT ZESPOŁU A</span><a href="#start">Powrót na górę ↑</a></div></footer>;
}

function App() {
  const [services, setServices] = useState(DEMO_SERVICES);
  const [online, setOnline] = useState(false);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(window.location.hash);
  const [initialServiceId, setInitialServiceId] = useState('');
  useEffect(() => {
    const navigate = () => {
      setPage(window.location.hash);
      requestAnimationFrame(() => {
        const id = window.location.hash.slice(1);
        const target = document.getElementById(id);
        if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      });
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    const titles = { '#/logowanie': 'Logowanie', '#/konto': 'Rejestracja konta', '#/rezerwacja': 'Rezerwacja', '#/moje-konto': 'Moje konto' };
    document.title = `${titles[page] || 'Studio masażu'} — Soma`;
  }, [page]);
  const loadServices = useCallback((signal) => {
    return api('/services', { signal }).then(data => {
      if (!Array.isArray(data)) throw new Error('Nieprawidłowa oferta');
      setServices(data); setOnline(true);
    }).catch(error => { if (error.name !== 'AbortError') setOnline(false); });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadServices(controller.signal);
    api('/auth/me', { signal: controller.signal }).then(data => setUser(data.user))
      .catch(() => {}).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [loadServices]);
  const openBook = useCallback((serviceId = '') => {
    setInitialServiceId(serviceId);
    window.location.hash = '/rezerwacja';
  }, []);
  function loggedIn(account) {
    setUser(account); setNotice('');
    loadServices();
    window.location.hash = page === '#/moje-konto' ? '/moje-konto' : (page === '#/rezerwacja' || initialServiceId) ? '/rezerwacja' : '/moje-konto';
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); setInitialServiceId(''); window.location.hash = 'start'; }
    catch (error) { setNotice(error.message); }
  }
  const accountPage = page === '#/logowanie' || page === '#/konto';
  return <>
    <Header onBook={openBook} user={user} onLogout={logout}/>
    {notice && <p className="modal-warning" role="alert">{notice}</p>}
    <main>
      {checking && (accountPage || page === '#/rezerwacja' || page === '#/moje-konto') ? <p className="form-page" role="status">Sprawdzanie logowania…</p>
        : (accountPage && !user) || ((page === '#/rezerwacja' || page === '#/moje-konto') && !user) ? <AccountPage key={page} register={page === '#/konto'} onLogin={loggedIn}/>
        : page === '#/moje-konto' ? <UserPanel key={user.id} user={user} onUserChange={setUser} services={services} />
        : page === '#/rezerwacja' ? <BookingFlow key={initialServiceId} services={services} user={user} initialServiceId={initialServiceId}/>
        : <><Hero onBook={openBook}/><Services services={services} sourceLive={online} onBook={openBook}/><Contact/></>}
    </main>
    <Footer/>
  </>;
}

export default App;
