const GUMROAD_URL = "https://api.gumroad.com/v2/licenses/verify";

async function callGumroad(licenseKey, { increment = false } = {}) {
  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) throw new Error("GUMROAD_PRODUCT_ID غير مضبوط في Netlify.");

  const body = new URLSearchParams({
    product_id: productId,
    license_key: licenseKey,
    increment_uses_count: increment ? "true" : "false",
  });

  const res = await fetch(GUMROAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Gumroad HTTP ${res.status}`);
  return res.json();
}

function extractKey(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  if (event.queryStringParameters?.license_key) return event.queryStringParameters.license_key;
  return null;
}

/**
 * يُستدعى في كل دالة محمية.
 * لا يثق بالواجهة أبداً — يعيد التحقق من Gumroad.
 */
async function requireValidLicense(event, { increment = false } = {}) {
  const key = extractKey(event);
  if (!key) return { ok: false, status: 401, error: "مفتاح الترخيص مطلوب." };

  const data = await callGumroad(key, { increment });
  if (!data.success) {
    return { ok: false, status: 403, error: data.message || "مفتاح غير صالح." };
  }

  const purchase = data.purchase || {};
  if (purchase.refunded) return { ok: false, status: 403, error: "الترخيص مسترجع." };
  if (purchase.chargebacked) return { ok: false, status: 403, error: "الترخيص ملغى (Chargeback)." };

  const maxUses = parseInt(process.env.MAX_USES_PER_LICENSE || "5", 10);
  if (data.uses > maxUses) {
    return {
      ok: false,
      status: 403,
      error: `تجاوز حد الأجهزة (${data.uses}/${maxUses}).`,
    };
  }

  return { ok: true, purchase, uses: data.uses };
}

module.exports = { requireValidLicense, callGumroad };