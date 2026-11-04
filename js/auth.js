const { requireValidLicense } = require("./_lib/license");
const { isPublicUrl } = require("./_lib/scraper");
const cheerio = require("cheerio");
const { req } = require("curl-cffi");

const MAX_INTERNAL_LINKS = 40;

// دالة جلب محاكية للمتصفح
async function timedFetch(url, method = "GET") {
  const start = Date.now();
  try {
    const options = {
      impersonate: "chrome136",
      timeout: 15000,
      allowRedirects: false, // لفحص حالة إعادة التوجيه الفعلية
    };
    
    let res;
    if (method === "HEAD") {
      res = await req.head(url, options);
    } else {
      res = await req.get(url, options);
    }
    
    return { res, ms: Date.now() - start };
  } catch (err) {
    // إذا فشل الطلب (مثلاً بسبب رفض HEAD)، نرجع خطأ
    return { error: err.message, ms: Date.now() - start };
  }
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
  const main = await timedFetch(url, "GET");
  if (main.error) {
    return { statusCode: 502, body: JSON.stringify({ error: `فشل الجلب: ${main.error}` }) };
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

  const html = typeof main.res.data === "string" ? main.res.data : main.res.data.toString("utf-8");
  const $ = cheerio.load(html);

  // === كشف صفحات الحماية (Bot Detection) ===
  const pageTitle = ($("title").first().text() || "").toLowerCase();
  const pageBody = $("body").text().toLowerCase();
  const size = html.length;

  const blocked =
    ["robot check", "captcha", "access denied", "just a moment",
     "attention required", "checking your browser", "are you a robot",
     "cloudflare", "please verify"].some(sig =>
       pageTitle.includes(sig) || pageBody.includes(sig)
     ) || size < 5000;

  if (blocked) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        blocked: true,
        error: "الموقع رفض الطلب (حماية ضد الروبوتات). جرب موقعاً آخر.",
      }),
    };
  }

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

  // فحص بالتوازي على دفعات
  const BATCH = 8;
  for (let i = 0; i < linksToCheck.length; i += BATCH) {
    const batch = linksToCheck.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (link) => {
        let r = await timedFetch(link, "HEAD");
        // بعض السيرفرات ترفض HEAD — نعيد المحاولة بـ GET
        if (r.error || (r.res && (r.res.status === 405 || r.res.status === 501))) {
          r = await timedFetch(link, "GET");
        }
        
        if (r.error) return { url: link, status: 0, ms: r.ms, error: r.error };
        return { url: link, status: r.res.status, ms: r.ms };
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