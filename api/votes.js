// dziennik.live — /api/votes
// Wyszukuje głosowanie w Sejmie powiązane z aktem prawnym
// i zwraca podsumowanie z podziałem na kluby parlamentarne

const SEJM_API = 'https://api.sejm.gov.pl/sejm/term10';

// Mapowanie klubów na nasze kolory
const KLUB_COLORS = {
  'KO': '#0EA5E9',
  'PiS': '#1E3A8A',
  'Polska2050-TD': '#EAB308',
  'PSL-TD': '#16A34A',
  'Lewica': '#EF4444',
  'Konfederacja': '#A855F7',
  'Republikanie': '#9333EA',
  'niez.': '#6B7280',
};

const KLUB_NAMES = {
  'KO': 'Koalicja Obywatelska',
  'PiS': 'Prawo i Sprawiedliwość',
  'Polska2050-TD': 'Polska 2050 (TD)',
  'PSL-TD': 'PSL (TD)',
  'Lewica': 'Lewica',
  'Konfederacja': 'Konfederacja',
  'Republikanie': 'Republikanie',
  'niez.': 'Niezrzeszeni',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, date } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });

  try {
    // 1. Znajdź posiedzenie Sejmu z okolic daty aktu
    // Akt jest publikowany kilka dni po głosowaniu — szukamy w oknie 30 dni przed
    const actDate = new Date(date);
    const fromDate = new Date(actDate);
    fromDate.setDate(fromDate.getDate() - 60);

    // Pobierz listę posiedzeń
    const proceedingsRes = await fetch(`${SEJM_API}/proceedings`);
    if (!proceedingsRes.ok) throw new Error('Cannot fetch proceedings');
    const proceedings = await proceedingsRes.json();

    // Znajdź wszystkie posiedzenia w oknie czasowym
    const candidates = proceedings.filter(p => {
      if (!p.dates || !p.dates.length) return false;
      return p.dates.some(d => {
        const pd = new Date(d);
        return pd >= fromDate && pd <= actDate;
      });
    });

    if (!candidates.length) {
      return res.status(200).json({ found: false, reason: 'no_proceedings' });
    }

    // 2. Dla każdego posiedzenia pobierz głosowania i znaj najlepiej pasujące po tytule
    const titleNormalized = normalizeTitle(title);
    let bestMatch = null;
    let bestScore = 0;

    for (const proc of candidates.slice(0, 5)) { // max 5 najnowszych posiedzeń
      for (const pdate of proc.dates) {
        const votingsRes = await fetch(`${SEJM_API}/votings/${proc.number}/${pdate}`);
        if (!votingsRes.ok) continue;
        const votings = await votingsRes.json();

        for (const v of votings) {
          const vTitle = normalizeTitle(v.title || '');
          const vTopic = normalizeTitle(v.topic || '');
          const score = Math.max(
            similarityScore(titleNormalized, vTitle),
            similarityScore(titleNormalized, vTopic)
          );

          // Tylko głosowania końcowe (nie poprawki)
          const isCalosc = /całość|w całości|przyjęcie ustawy/i.test(v.title + ' ' + v.topic);
          const finalScore = isCalosc ? score + 0.2 : score;

          if (finalScore > bestScore && finalScore > 0.4) {
            bestScore = finalScore;
            bestMatch = { ...v, proceeding: proc.number, date: pdate };
          }
        }
      }
    }

    if (!bestMatch) {
      return res.status(200).json({ found: false, reason: 'no_match' });
    }

    // 3. Pobierz szczegóły głosowania (głosy posłów)
    const detailRes = await fetch(
      `${SEJM_API}/votings/${bestMatch.proceeding}/${bestMatch.date}/${bestMatch.votingNumber}`
    );
    if (!detailRes.ok) throw new Error('Cannot fetch voting detail');
    const detail = await detailRes.json();

    // 4. Pogrupuj głosy po klubach
    const klubMap = {};
    const votes = detail.votes || [];

    for (const vote of votes) {
      const klub = vote.club || 'niez.';
      if (!klubMap[klub]) {
        klubMap[klub] = {
          klub,
          name: KLUB_NAMES[klub] || klub,
          color: KLUB_COLORS[klub] || '#6B7280',
          za: [],
          przeciw: [],
          wstrzymal: [],
          nieobecny: [],
        };
      }
      const target = {
        'YES': 'za',
        'NO': 'przeciw',
        'ABSTAIN': 'wstrzymal',
        'ABSENT': 'nieobecny',
      }[vote.vote] || 'nieobecny';

      klubMap[klub][target].push({
        name: `${vote.firstName || ''} ${vote.lastName || ''}`.trim(),
        id: vote.MP,
      });
    }

    // 5. Posortuj kluby — najpierw te z największą liczbą głosujących
    const klubs = Object.values(klubMap).sort((a, b) => {
      const aTotal = a.za.length + a.przeciw.length + a.wstrzymal.length;
      const bTotal = b.za.length + b.przeciw.length + b.wstrzymal.length;
      return bTotal - aTotal;
    });

    // 6. Podsumowanie ogólne
    const totals = {
      za: votes.filter(v => v.vote === 'YES').length,
      przeciw: votes.filter(v => v.vote === 'NO').length,
      wstrzymal: votes.filter(v => v.vote === 'ABSTAIN').length,
      nieobecny: votes.filter(v => v.vote === 'ABSENT').length,
    };

    return res.status(200).json({
      found: true,
      title: bestMatch.title,
      topic: bestMatch.topic,
      date: bestMatch.date,
      sitting: bestMatch.proceeding,
      number: bestMatch.votingNumber,
      score: bestScore,
      totals,
      klubs,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, found: false });
  }
}

// ── Helpery do porównywania tytułów ──────────────────────────

function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => 'acelnoszz'['ąćęłńóśźż'.indexOf(c)])
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(a, b) {
  if (!a || !b) return 0;
  // Zliczamy ile słów z a występuje w b (>3 znaki, żeby pominąć "się", "lub")
  const wordsA = a.split(' ').filter(w => w.length > 3);
  const wordsB = b.split(' ').filter(w => w.length > 3);
  if (!wordsA.length || !wordsB.length) return 0;

  const common = wordsA.filter(w => wordsB.includes(w)).length;
  return common / Math.max(wordsA.length, wordsB.length);
}
