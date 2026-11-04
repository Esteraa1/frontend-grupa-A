# Studio Soma

Frontend aplikacji do rezerwacji masaży, zbudowany w React i wykorzystujący lokalny backend demonstracyjny Node.js.

## Instalacja i uruchomienie projektu

**Wymagania:**

1. **Node.js** - Środowisko uruchomieniowe JavaScript.
2. **npm** - Menedżer pakietów instalowany razem z Node.js
3. Przeglądarka internetowa 

Node.js należy zainstalować lokalnie. Nie jest on dołączony do repozytorium.

**Pobranie projektu:**

Sklonuj repozytorium z GitHuba lub pobierz je jako archiwum ZIP, a następnie otwórz terminal w głównym katalogu projektu (frontend).

**Instalacja zależności:**
```sh
npm ci
```
Polecenie instaluje zależności zdefiniowane w package.json, zgodnie z plikiem package-lock.json.

**Uruchamianie backendu demonstracyjnego:**

W pierwszym terminalu wykonaj:
```sh
npm run mock-api
```
Serwer demonstracyjny zostanie uruchomiony pod adresem: http://localhost:3001

**Uruchomienie frontendu:**

Otwórz drugi terminal w tym samym katalogu i wykonaj:
```sh
npm run dev
```

Aplikacja będzie dostępna pod adresem wskazanym przez Vite, domyślnie: http://localhost:5173

**Ważne:** Podczas korzystania z aplikacji oba serwery muszą być uruchomione jednocześnie.


## Przebieg

1. Logowanie ID/e-mailem lub utworzenie konta (imię, nazwisko, data urodzenia, e-mail, telefon, hasło).
2. Oferta i wybór masażu.
3. Data i wolny przedział godzinowy.
4. Podsumowanie oraz potwierdzenie rezerwacji.
5. Symulowana płatność: sukces lub odrzucenie z możliwością ponowienia.
6. Potwierdzenie wizyty. Nie wysyłamy e-maili ani SMS-ów.

Nie obowiązuje minimalny wiek. Data urodzenia musi być prawidłowa i nie może być przyszła.
Salon demonstracyjny działa od poniedziałku do soboty, 09:00–19:00. Godziny zależą od długości masażu, a dodatkowy ostatni termin kończy się o 19:00. Serwer blokuje nakładanie wizyt w jednym wspólnym kalendarzu i ponownie sprawdza termin podczas zapisu. Anulowanie nieopłaconej rezerwacji zwalnia termin.

## Ograniczenia demonstracji

Serwer `server/demo.mjs` działa wyłącznie lokalnie. Wszystkie dane przechowuje w pamięci — restart usuwa konta, rezerwacje i sesje. Używaj danych testowych. Hasła są haszowane na serwerze; sesja korzysta z ciasteczka HttpOnly. W przeglądarce zachowujemy jedynie ID bieżącej rezerwacji, aby można było wrócić do płatności po odświeżeniu.

Płatności są symulowane; nie podawaj danych kart. Integracja operatora płatności, e-mail/SMS i oznaczanie wykonanego masażu należą do docelowego backendu. Nieopłacone rezerwacje nie wygasają automatycznie w tej demonstracji.

## Kontrakt API do integracji

Domyślnie Vite przekazuje `/api` do http://127.0.0.1:3001. Adres bazowy można zmienić przez `VITE_API_URL`; dla sesji cookie zalecany jest ten sam origin/proxy.

- `GET /api/services` — lista usług; opcjonalnie `voucherOnly=true`.
- `POST /api/auth/register` — pola formularza, hasło w `haslo`; zwraca publiczne dane klienta, ustawia sesję.
- `POST /api/auth/login` — `login`, `haslo`; zwraca klienta i ustawia sesję.
- `GET /api/auth/me` — `{ user: klient lub null }`.
- `POST /api/auth/logout` — kończy sesję.
- `GET /api/availability?usluga_id=...&data=YYYY-MM-DD` — lista `{godz_od,godz_do}`.
- `POST /api/reservations` — `usluga_id`, `data`, `godz_od`, `uwagi`, `request_id`; klient i cena wynikają z danych serwera. Powtórzenie `request_id` nie tworzy drugiej rezerwacji. Numer rezerwacji (`id`) ma 10 znaków: wielkie litery i cyfry. Serwer sprawdza jego unikalność wśród wszystkich przechowywanych rezerwacji, również anulowanych.
- `GET /api/reservations/:id` — własna rezerwacja, do wznowienia płatności.
- `DELETE /api/reservations/:id` — anulowanie nieopłaconej rezerwacji.
- `POST /api/reservations/:id/payment` — WYŁĄCZNIE DEMO: `wynik` równy `udana` albo `odrzucona`. Produkcja wymaga operatora płatności i weryfikacji po stronie serwera.

Endpointy kont i płatności to proponowany kontrakt demonstracyjny, nie potwierdzony kontrakt zewnętrznego backendu. Błędy zwracają `{message}`. Czynności po zalogowaniu wymagają sesji; identyfikator klienta nie jest przyjmowany z formularza.

## Sprawdzenie

```sh
npm run build
node server/demo.test.mjs
```


## Technologie (Tech Stack)

| Technologia | Zastosowanie |
|-------------|--------------|
| **React 19** | User Interface (UI) |
| **JavaScript + JSX** | Component Logic |
| **Vite 8** | Development Server i Build Tool |
| **CSS** | Styling i Responsive Design |
| **Fetch API** | Komunikacja z Backendem |
| **Node.js** | Lokalny Backend demonstracyjny |
| **REST API** | Obsługa User Accounts, Services i Reservations |


