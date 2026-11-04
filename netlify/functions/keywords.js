const { requireValidLicense } = require("./_lib/license");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function getSuggestions(query, hl = "ar") {
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&hl=${hl}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const text = await res.text();
    const data = JSON.parse(text);
    return Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

exports.handler = async (event) => {
  const auth = await requireValidLicense(event);
  if (!auth.ok) return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };

  const seed = (event.queryStringParameters?.seed || "").trim();
  const lang = event.queryStringParameters?.lang || "ar";
  if (!seed || seed.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: "أدخل كلمة أساسية (حرفان على الأقل)." }) };
  }

  const prefixes = lang === "ar"
    ? ["كيف", "ما هو", "لماذا", "أفضل", "طريقة", "شرح", "مقارنة"]
    : ["how", "what", "why", "best", "vs", "guide", "review"];

  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const queries = [
    seed,
    ...alphabet.map(l => `${seed} ${l}`),
    ...prefixes.map(p => `${p} ${seed}`),
  ];

  const allSuggestions = new Set();
  const BATCH = 5;

  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(q => getSuggestions(q, lang)));
    results.flat().forEach(s => {
      if (s) allSuggestions.add(s.trim());
    });
  }

  const suggestions = Array.from(allSuggestions).sort();

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      seed,
      count: suggestions.length,
      suggestions,
      note: "هذه كلمات بحث حقيقية من Google Autocomplete (بدون حجم البحث — للحصول على الحجم تحتاج Google Keyword Planner)."
    }),
  };
};