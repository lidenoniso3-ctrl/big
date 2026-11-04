const { callGumroad } = require("./_lib/license");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let licenseKey;
  try {
    ({ license_key: licenseKey } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON غير صالح." }) };
  }

  if (!licenseKey || licenseKey.trim().length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: "مفتاح مفقود أو قصير." }) };
  }

  try {
    // هنا فقط نرفع عدّاد الاستخدام
    const data = await callGumroad(licenseKey.trim(), { increment: true });

    if (!data.success) {
      return { statusCode: 403, body: JSON.stringify({ error: data.message || "مفتاح غير صالح." }) };
    }

    const p = data.purchase || {};
    if (p.refunded || p.chargebacked) {
      return { statusCode: 403, body: JSON.stringify({ error: "الترخيص مسترجع أو ملغى." }) };
    }

    const maxUses = parseInt(process.env.MAX_USES_PER_LICENSE || "5", 10);
    if (data.uses > maxUses) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: `تجاوز حد الأجهزة (${data.uses}/${maxUses}).` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        email: p.email || "",
        product_name: p.product_name || "",
        uses: data.uses,
        max_uses: maxUses,
      }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) };
  }
};