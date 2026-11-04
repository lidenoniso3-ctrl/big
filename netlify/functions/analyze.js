const { requireValidLicense } = require("./_lib/license");
const { isPublicUrl } = require("./_lib/scraper");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// قائمة ضخمة بكلمات التوقف (إنجليزية + عربية)
const STOP_WORDS = new Set([
  // English stop words
  "the","and","a","an","to","of","in","on","at","by","for","with","about","against","between","into","through","during","before","after","above","below","from","up","down","out","off","over","under","again","further","then","once","here","there","when","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same","so","than","too","very","can","will","just","should","now","i","me","my","we","our","you","your","he","him","his","she","her","it","its","they","them","their","what","which","who","whom","this","that","these","those","am","is","are","was","were","be","been","being","have","has","had","do","does","did","doing","would","could","ought","might","must","shall","may","first","second","also","new","one","two","three","four","five","get","got","make","made","say","said","go","went","see","seen","know","knew","take","took","come","came","much","many","hrs","mins","sec","per","via","etc","vs","if","or","but","as","uk","us","still","even","well","back","yet","ever","never","always","often","sometimes","really","like","want","need","use","used","using","able","going","goes","gone","done","takes","taken","gives","gave","given","find","finds","found","think","thinks","thought","tell","tells","told","ask","asks","asked","work","works","worked","seem","seems","seemed","feel","feels","felt","try","tries","tried","leave","leaves","left","call","calls","called","good","great","best","better","old","big","small","high","low","long","short","day","days","week","weeks","year","years","time","times","people","person","man","men","woman","women","child","children","way","ways","thing","things","part","parts","life","world","hand","hands","eye","eyes","place","case","point","fact","group","number","company","system","program","question","government","right","left","already","almost","along","among","around","because","become","becomes","became","behind","being","besides","beyond","bring","brings","brought","build","builds","built","buy","buys","bought","cause","causes","continue","continues","continued","different","early","either","end","ends","ended","enough","every","example","examples","follow","follows","followed","form","forms","four","had","having","hers","herself","himself","however","itself","keep","keeps","kept","known","large","last","later","least","less","let","lets","likely","look","looks","looked","making","myself","needed","next","others","ours","ourselves","perhaps","possible","put","puts","quite","rather","saw","several","show","shows","showed","shown","side","since","someone","something","sure","theirs","themselves","things","though","three","thus","today","together","toward","upon","uses","usually","wanted","ways","whether","while","whole","whose","within","without","word","words","worked","would","yes",

  // Arabic stop words
  "في","من","على","إلى","عن","مع","هذا","هذه","ذلك","تلك","التي","الذي","الذين","اللواتي","اللذان","اللتان","اللذين","اللتين","و","أو","ثم","لكن","بل","حتى","إذا","إن","أن","كان","كانت","يكون","تكون","هو","هي","هم","هن","أنا","أنت","نحن","قد","لقد","ما","لا","لم","لن","كل","بعض","غير","بين","عند","عندما","حيث","كيف","لماذا","متى","أين","أي","كما","لدى","أيضا","أيضاً","تم","يتم","وقد","وكان","وفي","ومن","وعلى","الآن","حول","خلال","بعد","قبل","تحت","فوق","أمام","خلف","جانب","ضد","نحو","دون","سوى","خاصة","خصوصا","مثلا","مثلاً","كذلك","إلا","ألا","لكي","كي","حين","حينما","بينما","طالما","كلما","بما","عما","فيما","مما","لكنما","إنما","كأن","كأنما","ليت","لعل","لولا","لو","لئن","إذ","إذما","إذاً","إذن","هنا","هناك","هنالك","ثمة","حيثما","أنى","أيان","كيفما","مهما","لمن","بمن","عمن","ممن","فيمن","منذ","وراء","بجانب","قرب","وسط","تجاه","إزاء","حيال","بشأن","بخصوص","قبلما","بعدما","لطالما"
]);

// دالة استخراج الكلمات المفتاحية
function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^\w\u0600-\u06FF-]/g, "").trim())
    .filter(w => w.length >= 3)
    .filter(w => !/^\d+$/.test(w))
    .filter(w => !STOP_WORDS.has(w));

  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const total = words.length || 1;

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: ((count / total) * 100).toFixed(2)
    }));
}

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

    // استخراج وسوم التواصل
    const ogTags = {};
    $('meta[property^="og:"]').each((_, el) => { ogTags[$(el).attr("property")] = $(el).attr("content"); });
    const twitterTags = {};
    $('meta[name^="twitter:"]').each((_, el) => { twitterTags[$(el).attr("name")] = $(el).attr("content"); });

    const schemaCount = $('script[type="application/ld+json"]').length;

    const images = $("img");
    const imagesWithoutAlt = images.filter((_, el) => !$(el).attr("alt")).length;

    // ✅ إزالة العناصر غير المفيدة قبل استخراج النص
    $("script, style, noscript, iframe, nav, footer, header, aside, form, button, select, textarea").remove();

    // ✅ استخراج النص فقط من وسوم المحتوى الحقيقي
    let text = "";
    ["p","h1","h2","h3","h4","h5","h6","li","strong","b","td","blockquote","article","main"].forEach(tag => {
      $(tag).each((_, el) => {
        text += " " + $(el).text();
      });
    });

    const keywords = extractKeywords(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

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
        word_count: wordCount,
        top_keywords: keywords,
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