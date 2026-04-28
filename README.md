# dziennik.live

Darmowa aplikacja PWA do przeglądania Dziennika Ustaw RP na żywo,
z podsumowaniami AI w ludzkim języku i powiadomieniami push.

## Struktura

```
dziennik-live/
├── index.html           ← frontend PWA
├── manifest.json        ← konfiguracja PWA
├── sw.js                ← service worker (offline + push)
├── icons/               ← ikony aplikacji
│   ├── icon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
├── api/
│   └── summary.js       ← Vercel serverless function (Claude API)
├── vercel.json          ← konfiguracja Vercel
└── backend/             ← skrypty do pobierania aktów
    ├── fetch_acts.py
    ├── schema.sql
    ├── requirements.txt
    └── .env.example
```

## Wdrożenie — krok po kroku

### Krok 1: GitHub
1. Wejdź na `github.com` → New repository → `dziennik-live`
2. Upload files → wrzuć WSZYSTKIE pliki z tego folderu (oprócz `backend/`)
3. Commit

### Krok 2: Vercel
1. Wejdź na `vercel.com` → New Project
2. Import Git Repository → wybierz `dziennik-live`
3. Deploy (automatyczny)
4. Settings → Environment Variables → dodaj:
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
5. Deployments → Redeploy

Gotowe — dostajesz link `dziennik-live.vercel.app`.

### Krok 3: Zainstaluj aplikację na telefonie

**iPhone (Safari):**
- Otwórz `dziennik-live.vercel.app` w Safari
- Kliknij ikonę Udostępnij (□↑)
- "Do ekranu początkowego" → Dodaj

**Android (Chrome):**
- Otwórz link w Chrome
- Sam pojawi się prompt "Zainstaluj dziennik.live"
- Albo: menu (⋮) → "Zainstaluj aplikację"

### Krok 4: Backend — baza aktów (opcjonalnie, do podsumowań z kontekstem)

1. Załóż konto na `supabase.com` → New Project
2. SQL Editor → New Query → wklej `backend/schema.sql` → Run
3. Settings → API → skopiuj URL i anon/service_role key
4. `cd backend && cp .env.example .env` → uzupełnij klucze
5. `pip install -r requirements.txt`
6. `python fetch_acts.py --year 2025 --with-summaries`

## Koszty

- **Vercel**: darmowe (Hobby plan starczy dla 100k użytkowników/mies)
- **Supabase**: darmowe (500 MB)
- **Claude API**: ~0.01 USD / podsumowanie → 20 USD za cały Dziennik Ustaw 2025
- **GitHub**: darmowe

Razem: **~20 USD za kompletny backend z AI** przez pierwszy rok.

## Licencja

Projekt obywatelski. Kod open source, dane z oficjalnego API Sejmu RP.
