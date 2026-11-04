const { requireValidLicense } = require("./_lib/license");
const { isPublicUrl } = require("./_lib/scraper");
const cheerio = require("cheerio");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_INTERNAL_LINKS = 40;

async function timedFetch(url, opts = {}) {
  const start = Date.now();
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.9" },
    ...opts,
  });
  return { res, ms: Date.now() - start };
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; }
  catch { return false; }
}

exports.handler = async (event) => {
  // 1) التحقق من الترخيص
  const auth = await requireValidLicense(event);
  if (!auth.ok) {
    return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
  }

  // 2) الرابط
  const url = event.queryStringParameters?.url;
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "url مطلوب." }) };
  }
  if (!isPublicUrl(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: "رابط داخلي أو غير صالح." }) };
  }

  // 3) جلب الصفحة الرئيسية
  let main;
  try {
    main = await timedFetch(url);
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: `فشل الجلب: ${err.message}` }) };
  }

  if (main.res.status >= 400) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        url,
        status_code: main.res.status,
        response_time_ms: main.ms,
        error: `الصفحة الرئيسية رجعت ${main.res.status}.`,
      }),
    };
  }

  const html = await main.res.text();
  const $ = cheerio.load(html);

  // 4) فحوصات الصفحة الرئيسية
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

  // 5) الروابط الداخلية
  const internalLinks = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, url).href;
      if (sameOrigin(abs, url)) internalLinks.add(abs.split("#")[0]);
    } catch { /* تجاهل */ }
  });

  const linksToCheck = Array.from(internalLinks).slice(0, MAX_INTERNAL_LINKS);
  const linkResults = [];

  // فحص بالتوازي على دفعات لتجنب إغراق الموقع
  const BATCH = 8;
  for (let i = 0; i < linksToCheck.length; i += BATCH) {
    const batch = linksToCheck.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (link) => {
        try {
          const { res, ms } = await timedFetch(link, { method: "HEAD" });
          // بعض السيرفرات ترفض HEAD — نعيد المحاولة بـ GET
          if (res.status === 405 || res.status === 501) {
            const g = await timedFetch(link, { method: "GET" });
            return { url: link, status: g.res.status, ms: g.ms };
          }
          return { url: link, status: res.status, ms };
        } catch (err) {
          return { url: link, status: 0, ms: 0, error: err.message };
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") linkResults.push(r.value);
    }
  }

  const broken = linkResults.filter((l) => l.status === 0 || l.status >= 400);
  const redirected = linkResults.filter((l) => l.status >= 300 && l.status < 400);

  // 6) بناء النتيجة
  const checks = [];
  if (!title) checks.push({ level: "err", msg: "وسم <title> مفقود." });
  else if (title.length > 60) checks.push({ level: "warn", msg: `طول <title> ${title.length} حرفاً (المستحسن ≤ 60).` });
  else if (title.length < 15) checks.push({ level: "warn", msg: `طول <title> ${title.length} حرفاً (المستحسن ≥ 15).` });

  if (!metaDesc) checks.push({ level: "warn", msg: "Meta Description مفقود." });
  else if (metaDesc.length > 160) checks.push({ level: "warn", msg: `Meta Description ${metaDesc.length} حرفاً (المستحسن ≤ 160).` });

  if (h1Count === 0) checks.push({ level: "err", msg: "لا يوجد <h1> في الصفحة." });
  if (h1Count > 1) checks.push({ level: "warn", msg: `يوجد ${h1Count} عناصر <h1> (المستحسن 1).` });
  if (!viewport) checks.push({ level: "warn", msg: "وسم Viewport مفقود — الموقع قد لا يكون متجاوباً." });
  if (!lang) checks.push({ level: "warn", msg: "سمة lang مفقودة على <html>." });
  if (imagesWithoutAlt > 0) checks.push({ level: "warn", msg: `${imagesWithoutAlt} صورة بدون alt.` });
  if (broken.length > 0) checks.push({ level: "err", msg: `${broken.length} رابط داخلي مكسور.` });
  if (main.ms > 3000) checks.push({ level: "warn", msg: `زمن استجابة الصفحة ${main.ms}ms (بطيء).` });
  else if (main.ms > 1000) checks.push({ level: "warn", msg: `زمن استجابة الصفحة ${main.ms}ms (متوسط).` });

  const summary =
    checks.some((c) => c.level === "err") ? "يوجد أخطاء حرجة" :
    checks.some((c) => c.level === "warn") ? "يوجد تحذيرات" : "جيد";

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      url,
      status_code: main.res.status,
      response_time_ms: main.ms,
      summary,
      title: { value: title, length: title.length },
      meta_description: { value: metaDesc, length: metaDesc.length },
      canonical,
      meta_robots: metaRobots,
      viewport,
      lang,
      headings: { h1: h1Count, h2: h2Count },
      images: { total: images.length, without_alt: imagesWithoutAlt },
      links: {
        internal_found: internalLinks.size,
        checked: linkResults.length,
        broken: broken,
        redirected: redirected,
      },
      checks,
    }),
  };
};