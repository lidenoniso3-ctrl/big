const cheerio = require("cheerio");
const { req } = require("curl-cffi"); // استيراد المكتبة

// ... (أبقِ دالة isPublicUrl كما هي) ...

async function scrapePage(url) {
  let response;
  try {
    // استخدام curl-cffi مع محاكاة كروم
    response = await req.get(url, {
      impersonate: "chrome136", // محاكاة متصفح كروم حديث
      timeout: 15000,
      allowRedirects: true,
      maxRedirects: 5,
    });
  } catch (err) {
    return { ok: false, error: `فشل الجلب: ${err.message}` };
  }

  const statusCode = response.status;
  const ctype = response.headers?.["content-type"] || "";

  if (!ctype.toLowerCase().includes("text/html")) {
    return { ok: false, status_code: statusCode, error: `Content-Type: ${ctype}` };
  }

  // curl-cffi يعيد البيانات في response.data (وليس text())
  const html = typeof response.data === "string" ? response.data : response.data.toString("utf-8");
  const $ = cheerio.load(html);

  // ... (باقي الكود لاستخراج title و meta و h1 يبقى كما هو دون تغيير) ...
  // (انسخه من الكود الأصلي هنا)

  const title = ($("title").first().text() || "").trim();
  const metaDescription =
    ($('meta[name="description"]').attr("content") ||
     $('meta[property="og:description"]').attr("content") || "").trim();

  const h1Tags = $("h1").map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get().filter(Boolean);

  const canonical = ($('link[rel="canonical"]').attr("href") || "").trim();
  const metaRobots = ($('meta[name="robots"]').attr("content") || "").trim();

  return {
    ok: true,
    requested_url: url,
    final_url: url, // قد لا يوفر curl-cffi الرابط النهائي بسهولة، يمكن تحسينه لاحقاً
    status_code: statusCode,
    title,
    title_length: title.length,
    meta_description: metaDescription,
    meta_description_length: metaDescription.length,
    h1_count: h1Tags.length,
    h1_tags: h1Tags,
    canonical,
    meta_robots: metaRobots,
  };
}

module.exports = { isPublicUrl, scrapePage };