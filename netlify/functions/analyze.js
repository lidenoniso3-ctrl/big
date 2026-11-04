const { requireValidLicense } = require("./_lib/license");
const { isPublicUrl } = require("./_lib/scraper");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// كلمات إنجليزية وعربية شائعة يتم تجاهلها في حساب كثافة الكلمات
const STOP_WORDS = new Set(["في", "من", "على", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "التي", "الذي", "و", "أو", "ثم", "the", "and", "a", "to", "of", "in", "i", "is", "that", "it", "on", "you", "this", "for", "but", "with", "are", "have", "be"]);

exports.handler = async (event) => {
  const auth = await requireValidLicense(event);
  if (!auth.ok) return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };

  const url = event.queryStringParameters?.url;
  if (!url || !isPublicUrl(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: "رابط غير صالح." }) };
  }

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const domain = new URL(url).origin;

    // 1. استخراج Open Graph & Twitter
    const ogTags = {};
    $('meta[property^="og:"]').each((_, el) => { ogTags[$(el).attr("property")] = $(el).attr("content"); });
    const twitterTags = {};
    $('meta[name^="twitter:"]').each((_, el) => { twitterTags[$(el).attr("name")] = $(el).attr("content"); });

    // 2. استخراج البيانات المنظمة (Schema)
    const schemaCount = $('script[type="application/ld+json"]').length;

    // 3. تحليل الصور
    const images = $("img");
    const imagesWithoutAlt = images.filter((_, el) => !$(el).attr("alt")).length;

    // 4. حساب كثافة الكلمات
    // إزالة السكربتات والأنماط لقراءة النص فقط
    $("script, style, noscript, iframe").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const words = text.split(" ").filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
    
    const wordFreq = {};
    words.forEach(w => { 
      const cleanWord = w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      if(cleanWord) wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1; 
    });
    
    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word, count]) => ({ word, count, density: ((count / words.length) * 100).toFixed(2) }));

    // 5. فحص robots.txt و sitemap.xml
    const checkFile = async (path) => {
      try {
        const r = await fetch(domain + path, { method: "HEAD", headers: { "User-Agent": UA } });
        return r.status;
      } catch { return 0; }
    };
    
    const [robotsStatus, sitemapStatus] = await Promise.all([
      checkFile("/robots.txt"),
      checkFile("/sitemap.xml")
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        url,
        word_count: words.length,
        top_keywords: topKeywords,
        social: { og: ogTags, twitter: twitterTags },
        schema_count: schemaCount,
        images: { total: images.length, without_alt: imagesWithoutAlt },
        files: { robots_txt: robotsStatus, sitemap_xml: sitemapStatus }
      }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};