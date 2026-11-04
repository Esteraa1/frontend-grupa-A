# Studio Soma — wstępna dokumentacja frontendu

Stan analizy: **3 listopada 2026 r.** Dokument opisuje aktualną implementację, nie docelowy zakres wcześniejszych diagramów. Podstawą są pliki aplikacji, konfiguracja, lokalny backend i testy. Przy przygotowaniu dokumentacji nie zmieniano kodu aplikacji ani nie wykonywano nowej rundy testów.

## 1. Opis projektu

Studio Soma to aplikacja internetowa do przeglądania oferty masaży i rezerwowania wizyt po zalogowaniu. Powstaje jako projekt zespołowy na studiach. Obecna wersja umożliwia przejście pełnego procesu z lokalnym backendem i płatnością demonstracyjną; nie stanowi gotowego systemu obsługi rzeczywistego salonu.

Interfejs ma prosty, responsywny układ, jasne tło, zielone akcenty oraz przyciemnione zdjęcie w sekcji głównej. Oferta jest publiczna. Konto jest wymagane do pobrania dostępności i zapisania rezerwacji. Nie wybiera się gabinetu ani masażysty — obowiązuje jeden wspólny kalendarz.

## 2. Wykorzystane technologie

| Technologia lub narzędzie | Zastosowanie |
|---|---|
| JavaScript, JSX i moduły ES | Logika aplikacji, komponenty oraz komunikacja z backendem. Projekt nie korzysta z TypeScript. |
| React i React DOM 19 | Komponenty funkcyjne, renderowanie widoków oraz lokalny stan przez hooki. Punkt wejścia używa StrictMode. |
| Vite 8 i plugin React | Serwer deweloperski, odświeżanie podczas pracy, budowanie oraz lokalny podgląd wersji wynikowej. |
| CSS | Własne style globalne i komponentowe, media queries, menu mobilne oraz ograniczenie animacji dla prefers-reduced-motion. Brak frameworka UI. |
| Fetch API i AbortController | Żądania JSON, przekazywanie sesji i anulowanie nieaktualnych żądań. |
| Hash adresu i sessionStorage | Przełączanie widoków bez biblioteki routera oraz zachowanie ID bieżącej rezerwacji w karcie przeglądarki. |
| Node.js: http, crypto | Lokalny serwer demonstracyjny, haszowanie haseł, sesje i generowanie identyfikatorów. Nie używa Express. |
| ESLint 10, reguły React Hooks i React Refresh | Statyczne sprawdzanie kodu frontendu i lokalnego backendu. |
| Node.js: assert, child_process, events | Skrypt testujący API na osobnym serwerze. |
| npm i package-lock.json | Instalacja zależności i uruchamianie skryptów projektu. |

W package.json pozostają json-server oraz paczki typów React. Obecny skrypt mock-api uruchamia własny serwer Node.js, nie JSON Server; paczki typów nie oznaczają użycia TypeScript. Zdjęcie główne jest pobierane z Unsplash, więc jego załadowanie zależy od zewnętrznego hosta. Favicon znajduje się lokalnie.

## 3. Struktura projektu

| Plik lub katalog | Odpowiedzialność |
|---|---|
| src/main.jsx | Uruchamia React, importuje App i globalne style. |
| src/App.jsx | Główny stan użytkownika i oferty, nawigacja na podstawie hash, sprawdzanie sesji. Zawiera Header, Hero, Services, Contact, Footer oraz pomocnicze Arrow i SectionIntro. |
| src/BookingFlow.jsx | AccountPage obsługuje logowanie i rejestrację; BookingFlow realizuje etapy rezerwacji, płatność, anulowanie i przywracanie wizyty. Notice wyświetla błędy. |
| src/api.js | Wspólna obsługa żądań, adres bazowy API, błędy odpowiedzi i pomocnicze wyznaczanie dzisiejszej daty. |
| src/bookingTimes.js | Oblicza proponowane godziny rozpoczęcia. Funkcję importuje backend; frontend wyświetla terminy otrzymane z API. |
| src/App.css, src/index.css | Style widoków, responsywność oraz wspólne reguły typografii i fokusu. |
| public/favicon.svg | Ikona strony. |
| server/demo.mjs | Lokalny backend: oferta, konta, sesje, dostępność, rezerwacje i symulacja płatności. |
| server/demo.test.mjs | Automatyczny test integracyjny API. |
| index.html | Dokument wejściowy po polsku i element, w którym renderowany jest React. |
| vite.config.js | Plugin React oraz proxy /api dla trybu dev i preview. |
| eslint.config.js | Reguły kontroli kodu. |
| package.json, package-lock.json | Skrypty, zależności i ich rozwiązane wersje. |
| db.json | Zachowane wcześniejsze dane. Obecny serwer ich nie odczytuje ani nie aktualizuje. |
| README.md | Skrócona instrukcja i kontrakt demonstracyjnego API. |
| TESTER_TASKS.md | Ogólne zadania testowe do przeniesienia do Miro. |

node_modules zawiera zainstalowane zależności, a dist wynik budowania. Oba katalogi są ignorowane przez Git. Nie ma centralnego magazynu stanu ani osobnej biblioteki routingu; stan jest przechowywany w komponentach React.

## 4. Funkcjonalności frontendu

### Widoki i nawigacja

| Adres lub sekcja | Działanie |
|---|---|
| /, #start | Strona główna z przyciskiem rozpoczęcia rezerwacji. |
| #oferta | Aktywne usługi z nazwą, opisem, ceną i czasem trwania. Filtry: wszystkie, do 60 minut, ponad 60 minut, voucher. |
| #kontakt | Warszawa, Polska; somawellness@example.com jako link pocztowy; przykładowe godziny salonu. |
| #/logowanie | Logowanie ID klienta lub e-mailem i hasłem. |
| #/konto | Rejestracja nowego konta. |
| #/rezerwacja | Cztery etapy rezerwacji i końcowe potwierdzenie. Dla osoby niezalogowanej wyświetla formularz logowania. |

Po zalogowaniu nawigacja zawiera „Wyloguj”, ale nie zawiera powitania. Link do logowania jest ukryty. Użytkownik już zalogowany, który otworzy adres logowania lub rejestracji, zobaczy stronę główną. Nie ma panelu historii rezerwacji ani publicznej listy rezerwacji testowych.

Oferta jest pobierana z serwera. Przy błędzie początkowego pobrania pozostaje katalog zastępczy i komunikat o niedostępności rezerwacji. Opisy mogą różnić się między ofertą zastępczą a odpowiedzią serwera: gdy API nie zwraca opisu, karta pokazuje tekst domyślny. Filtr „Voucher” działa lokalnie na polu dostepna_jako_voucher; nie obsługuje kodów ani rozliczania voucherów.

### Konto i walidacja

Rejestracja wymaga imienia, nazwiska, daty urodzenia, e-maila, telefonu, hasła i jego powtórzenia. Przeglądarka sprawdza wymagane pola, format e-maila, ograniczenia długości i datę nie późniejszą niż dzisiaj. Hasło przy rejestracji ma co najmniej 8 znaków, a frontend porównuje oba hasła. Uwagi do wizyty mają limit 400 znaków.

Backend dodatkowo sprawdza dane rejestracji, format telefonu, zajęty e-mail oraz dane logowania. Nie obowiązuje minimalny wiek. Utworzenie konta automatycznie rozpoczyna sesję. Po uwierzytelnieniu użytkownik wraca do rezerwacji, jeśli wcześniej wybrał konkretną usługę; w przeciwnym razie trafia do oferty.

Sesja używa ciasteczka HttpOnly, SameSite=Strict, o czasie ważności 8 godzin. Frontend sprawdza sesję przy uruchomieniu przez /auth/me i wysyła żądania z credentials: include. Hasła są haszowane na lokalnym serwerze, a nie przechowywane w sessionStorage.

### Proces rezerwacji

1. **Usługa:** wybór masażu; wybór z karty oferty wstępnie uzupełnia formularz.
2. **Termin:** data, dostępny przedział od–do i opcjonalne uwagi. Zmiana usługi czyści datę i godzinę, a zmiana daty czyści godzinę. Powrót do tego kroku ponownie pobiera dostępność i wymaga ponownego wyboru godziny.
3. **Potwierdzenie:** podsumowanie masażu, terminu, danych klienta, uwag i kwoty. Dopiero przycisk potwierdzenia tworzy rezerwację. Serwer ponownie sprawdza dostępność oraz ustala cenę i klienta.
4. **Płatność:** możliwość zasymulowania sukcesu lub odrzucenia. Nieudana próba pozwala ponowić płatność. Przycisk „Anuluj i zmień termin” anuluje nieopłaconą wizytę i wraca do wyboru terminu.

Po udanej symulacji pojawia się potwierdzenie z numerem wizyty. Rezerwacja otrzymuje status OCZEKUJE_NA_PLATNOSC, OPLACONA albo ANULOWANA. Nie ma wysyłki e-maili/SMS-ów, pobierania pieniędzy, pól karty ani zwrotów. W interfejsie nie można anulować opłaconej rezerwacji.

Numer rezerwacji jest generowany na backendzie: ma dokładnie 10 znaków A–Z i 0–9, zawiera literę i cyfrę. Serwer odrzuca kolizje z numerami wszystkich rezerwacji zachowanych w pamięci, także anulowanych. Ten numer jest używany w API, sessionStorage i potwierdzeniu. Oddzielny request_id jest UUID żądania, a nie numerem rezerwacji; ponowienie zapisu z tym samym request_id dla danego klienta zwraca istniejącą rezerwację.

### Dostępność i przywracanie wizyty

- Salon działa od poniedziałku do soboty, 09:00–19:00. W niedzielę lista jest pusta.
- Godziny startują od 09:00 w odstępach równych długości usługi. Dodawany jest również ostatni termin kończący się dokładnie o 19:00, jeśli nie wynika z regularnych odstępów. Dla 90 minut są to 09:00, 10:30, 12:00, 13:30, 15:00, 16:30 i 17:30, o ile pozostają wolne.
- Serwer usuwa przeszłe godziny dla dzisiejszej daty i blokuje nakładanie wszystkich nieanulowanych wizyt, niezależnie od usługi i klienta. Nie ma równoległych kalendarzy zasobów.
- W sessionStorage zapisywane jest wyłącznie ID bieżącej rezerwacji pod kluczem przypisanym do ID użytkownika. Po ponownym otwarciu procesu dane są pobierane z serwera i odtwarzany jest etap płatności lub potwierdzenie.
- Niezapisany formularz nie jest trwale przechowywany. Restart backendu usuwa rezerwację i sesję; samo ID w przeglądarce nie odtworzy danych. Anulowanie lub przycisk powrotu na końcowym potwierdzeniu usuwa zapisane ID.

### Komunikacja i obsługa błędów

api.js przekazuje komunikat serwera albo ogólny komunikat o błędzie. Formularze pokazują błędy, stany oczekiwania i blokują przyciski na czas operacji. Pobieranie terminów ma przycisk ponowienia po błędzie; AbortController przerywa poprzednie żądania przy zmianie zależności lub opuszczeniu widoku.

| API używane przez frontend | Cel |
|---|---|
| GET /api/services | Oferta usług. |
| POST /api/auth/register, POST /api/auth/login | Utworzenie konta lub logowanie. |
| GET /api/auth/me, POST /api/auth/logout | Sprawdzenie i zakończenie sesji. |
| GET /api/availability?usluga_id=…&data=YYYY-MM-DD | Dostępne przedziały godzinowe. |
| POST /api/reservations | Zapis usługi, daty, godziny, uwag i request_id. |
| GET /api/reservations/:id | Pobranie własnej rezerwacji do przywrócenia procesu. |
| DELETE /api/reservations/:id | Anulowanie bieżącej nieopłaconej rezerwacji. |
| POST /api/reservations/:id/payment | Wyłącznie demonstracyjny wynik płatności: udana lub odrzucona. |

Backend wymaga sesji dla dostępności i operacji na rezerwacjach oraz sprawdza właściciela wizyty. Kontrakt dotyczy lokalnego serwera; zgodność z przyszłym zewnętrznym backendem nie jest potwierdzona.

## 5. Uruchomienie projektu

Wymagane są Node.js, npm i współczesna przeglądarka. Przykładowe zgodne środowisko to Node.js 22.13 lub nowszy w gałęzi 22, albo Node.js 24. Wymagania sprawdzonych lokalnych paczek: Vite — ^20.19.0 lub >=22.12.0; ESLint — ^20.19.0, ^22.13.0 lub >=24. Projekt nie przypina wersji Node w osobnym pliku.

W katalogu frontend zainstaluj zależności:

```sh
npm ci
```

Uruchom backend w pierwszym terminalu:

```sh
npm run mock-api
```

W drugim terminalu uruchom frontend:

```sh
npm run dev
```

Otwórz adres wypisany przez Vite, zwykle http://localhost:5173. Backend domyślnie nasłuchuje na 127.0.0.1:3001. Port musi być wolny; nie uruchamiaj równolegle starego JSON Server na tym porcie. Do normalnej lokalnej pracy nie jest wymagany plik .env ani zewnętrzna baza danych.

Vite przekazuje /api do backendu zarówno w dev, jak i preview. VITE_API_URL może zastąpić bazowy adres /api, ale przy zmianie hosta trzeba uzgodnić cookies, CORS i reguły pochodzenia żądań z backendem. Sama zmiana tej zmiennej nie zapewnia zgodności innego serwera. PORT zmienia port lokalnego backendu; wymaga wtedy odpowiedniego dopasowania proxy. Lokalne daty są obliczane w strefie przeglądarki i procesu Node — kod nie wymusza Europe/Warsaw.

Przydatne polecenia:

```sh
npm run lint
npm run build
npm run preview
node server/demo.test.mjs
```

build tworzy dist, a preview udostępnia zbudowaną wersję lokalnie; do operacji kont i rezerwacji nadal potrzebny jest backend. Skrypt testowy sam uruchamia oddzielny serwer na porcie 3017. Produkcyjny hosting wymaga własnego przekazywania /api lub odpowiedniego serwera — proxy Vite nie jest częścią plików wynikowych.

## 6. Aktualny stan projektu

| Status | Zakres |
|---|---|
| Zaimplementowane w obecnej wersji | Strona główna i kontakt, filtry usług, formularze konta, sesja, cztery kroki rezerwacji, walidacja, komunikaty błędów, dostępność i blokowanie kolizji, krótkie numery, anulowanie nieopłaconej wizyty, przywracanie bieżącej rezerwacji i responsywne style. |
| Demonstracyjne | Stały katalog usług, konta/sesje/rezerwacje przechowywane w pamięci lokalnego procesu, jeden kalendarz oraz symulowane płatności. Restart serwera usuwa dane. |
| Wymagające dalszej integracji, niezrealizowane | Trwała baza danych, docelowy backend, rzeczywiste płatności, wysyłka e-mail/SMS i realizacja voucherów. Nie należy traktować ich jako działających funkcji. |

W aktualnym zakresie nie ma wyboru gabinetu i masażysty, historii wizyt, edycji profilu, odzyskiwania hasła ani panelu administracyjnego. Ich przyszłe wdrożenie nie jest potwierdzone przez kod. Z interfejsu usunięto również powitanie i komunikat demonstracyjny na stronach konta; nie zmienia to sposobu przechowywania danych przez serwer.

### Ograniczenia i obszary wymagające uwagi

- Nieopłacone wizyty blokują termin i nie wygasają automatycznie.
- Nie ma automatycznego odświeżania sesji ani globalnego przekierowania do logowania po każdej odpowiedzi 401; użytkownik może zobaczyć błąd operacji po wygaśnięciu sesji.
- Stare ID rezerwacji w sessionStorage może wskazywać dane, których serwer już nie przechowuje. Kod wyświetla wtedy komunikat o nieudanym przywracaniu.
- Unikalność numerów jest sprawdzana względem danych aktualnego procesu. Nie ma trwałego rejestru numerów pomiędzy restartami.
- Nie ma ustalonej polityki świąt ani jawnego wspólnego ustawienia strefy czasowej.
- Samo istnienie etykiet, fokusu, media queries i komunikatów ARIA nie potwierdza pełnej zgodności z normami dostępności.

Skrypt server/demo.test.mjs obejmuje rejestrację, logowanie, dostępność, kolizje między usługami, powtórzenie zapisu, format i różność numerów, anulowanie oraz płatność. Nie zastępuje testów interfejsu, dwóch niezależnych zalogowanych klientów ani pełnego przeglądu bezpieczeństwa. W repozytorium nie ma automatycznego zestawu testów UI.

Ogólne zadania testowe znajdują się w [TESTER_TASKS.md](TESTER_TASKS.md). Największej uwagi wymagają daty i kolizje, ponawianie operacji oraz zachowanie po odświeżeniu i utracie sesji.
