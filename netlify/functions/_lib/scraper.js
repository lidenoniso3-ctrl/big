const cheerio = require("cheerio");

function isPublicUrl(raw) {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (["localhost", "0.0.0.0", "::1", "[::1]"].includes(host)) return false;

    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a === 192 && b === 168) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function scrapePage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "ar,en;q=0.9",
    },
    redirect: "follow",
  });

  const ctype = res.headers.get("content-type") || "";
  if (!ctype.toLowerCase().includes("text/html")) {
    return { ok: false, status_code: res.status, error: `Content-Type: ${ctype}` };
  }

  const html = await res.text();
  const $ = cheerio.load(html);

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
    final_url: res.url,
    status_code: res.status,
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