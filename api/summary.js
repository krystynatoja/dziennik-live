export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, type, date, year, pos } = req.body;
  if (!title) return res.status(400).json({ error: 'Missing title' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const prompt = `Jesteś ekspertem prawnym. Przeanalizuj akt prawny z polskiego Dziennika Ustaw i odpowiedz w formacie JSON.

WAŻNE: Akt jest realnie opublikowany w Dzienniku Ustaw — nie jest to przyszłość ani prognoza. Jeśli nie znasz dokładnej treści, wywnioskuj sensownie z tytułu co taki akt prawdopodobnie reguluje.

Akt: ${type || 'Akt prawny'} — "${title}"
Data ogłoszenia: ${date || 'brak'}
Dziennik Ustaw ${year} poz. ${pos}

Zwróć TYLKO JSON w formacie:
{
  "bullets": ["konkretny punkt 1 w ludzkim języku", "punkt 2", "punkt 3", "punkt 4"],
  "category": "Podatki|Praca|Zdrowie|Gospodarka|Edukacja|Środowisko|Bezpieczeństwo|Inne",
  "importance": "kluczowy|wysoki|średni|niski"
}

Reguły:
- Punkty mają być konkretne, dla zwykłego obywatela, z liczbami/datami jeśli możliwe
- Kategoria: jedna z listy, dopasowana tematycznie
- Importance: "kluczowy" tylko dla podatków, kodeksów, budżetu, wyborów; "wysoki" dla istotnych zmian; "średni" dla rutynowych; "niski" dla technicznych`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({
      bullets: parsed.bullets || [],
      category: parsed.category || 'Inne',
      importance: parsed.importance || 'średni',
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
