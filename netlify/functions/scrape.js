const { requireValidLicense } = require("./_lib/license");
const { isPublicUrl, scrapePage } = require("./_lib/scraper");

exports.handler = async (event) => {
  // 1) التحقق من الترخيص — إلزامي
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

  // 3) الكشط
  try {
    const result = await scrapePage(url);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: `فشل الجلب: ${err.message}` }) };
  }
};