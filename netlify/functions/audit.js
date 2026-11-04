const { requireValidLicense } = require("./_lib/license");
const { isPublicUrl } = require("./_lib/scraper");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function timedFetch(url, opts = {}) {
  const start = Date.now();
  const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA }, ...opts });
  return { res, ms: Date.now() - start };
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

exports.handler = async (event) => {
  const auth = await requireValidLicense(event);
  if (!auth.ok) return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };

  const url = event.queryStringParameters?.url;
  if (!url || !isPublicUrl(url)) return { statusCode: 400, body: JSON.stringify({ error: "رابط غير صالح." }) };

  let main;
  try { main = await timedFetch(url); } catch (err) { return { statusCode: 502, body: JSON.stringify({ error: `فشل الجلب: ${err.message}` }) }; }

  if (main.res.status >= 400) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, url, status_code: main.res.status, response_time_ms: main.ms, error: `الصفحة رجعت ${main.res.status}.` }) };
  }

  const html = await main.res.text();
  const $ = cheerio.load(html);

  const pageTitle = ($("title").first().text() || "").toLowerCase();
  const pageBody = $("body").text().toLowerCase();
  const blocked = ["robot check", "captcha", "access denied", "just a moment", "attention required", "checking your browser"].some(sig => pageTitle.includes(sig) || pageBody.includes(sig)) || html.length < 5000;
  if (blocked) return { statusCode: 200, body: JSON.stringify({ ok: false, blocked: true, error: "الموقع رفض الطلب (حماية ضد الروبوتات)." }) };

  const title = ($("title").first().text() || "").trim();
  const metaDesc = ($('meta[name="description"]').attr("content") || "").trim();
  const canonical = ($('link[rel="canonical"]').attr("href") || "").trim();
  const metaRobots = ($('meta[name="robots"]').attr("content") || "").trim();
  const viewport = ($('meta[name="viewport"]').attr("content") || "").trim();
  const lang = ($("html").attr("lang") || "").trim();
  const h1Count = $("h1").length;
  const h2Count = $("h2").length;
  const images = $("img");
  const imagesWithoutAlt = images.filter((_, el) => !$(el).attr("alt") || $(el).attr("alt").trim() === "").length;

  const internalLinks = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try { const abs = new URL(href, url).href; if (sameOrigin(abs, url)) internalLinks.add(abs.split("#")[0]); } catch {}
  });

  const linkResults = [];
  const BATCH = 8;
  const linksToCheck = Array.from(internalLinks).slice(0, 40);
  for (let i = 0; i < linksToCheck.length; i += BATCH) {
    const batch = linksToCheck.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (link) => {
      try {
        const { res, ms } = await timedFetch(link, { method: "HEAD" });
        return { url: link, status: res.status, ms };
      } catch (err) { return { url: link, status: 0, ms: 0, error: err.message }; }
    }));
    results.forEach(r => { if (r.status === "fulfilled") linkResults.push(r.value); });
  }

  const broken = linkResults.filter(l => l.status === 0 || l.status >= 400);
  const checks = [];
  if (!title) checks.push({ level: "err", msg: "وسم <title> مفقود." });
  if (!metaDesc) checks.push({ level: "warn", msg: "Meta Description مفقود." });
  if (h1Count === 0) checks.push({ level: "err", msg: "لا يوجد <h1>." });
  if (imagesWithoutAlt > 0) checks.push({ level: "warn", msg: `${imagesWithoutAlt} صورة بدون alt.` });
  if (broken.length > 0) checks.push({ level: "err", msg: `${broken.length} رابط مكسور.` });

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true, url, status_code: main.res.status, response_time_ms: main.ms,
      summary: checks.some(c => c.level === "err") ? "يوجد أخطاء" : checks.length > 0 ? "يوجد تحذيرات" : "جيد",
      title: { value: title, length: title.length }, meta_description: { value: metaDesc, length: metaDesc.length },
      canonical, meta_robots: metaRobots, viewport, lang, headings: { h1: h1Count, h2: h2Count },
      images: { total: images.length, without_alt: imagesWithoutAlt }, links: { internal_found: internalLinks.size, broken }, checks
    }),
  };
};