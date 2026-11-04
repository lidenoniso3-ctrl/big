/* =========================================
   كود كشط السيو (Scrape)
   ========================================= */
document.getElementById("scrapeBtn").addEventListener("click", async () => {
  const url = document.getElementById("scrapeUrlInput").value.trim();
  const msg = document.getElementById("scrapeMsg");
  const results = document.getElementById("scrapeResults");
  
  if (!url) {
    msg.className = "msg error";
    msg.textContent = "أدخل رابطاً أولاً.";
    return;
  }

  msg.className = "msg info";
  msg.innerHTML = '<span class="spinner"></span> جارٍ الكشط...';
  results.style.display = "none";

  try {
    const res = await licensedFetch("scrape?url=" + encodeURIComponent(url));
    const data = await res.json();
    
    if (!data.ok) throw new Error(data.error || "فشل الكشط.");
    
    msg.textContent = "";
    results.style.display = "block";
    
    // تعبئة البيانات
    document.getElementById("resTitle").textContent = data.title || "(لا يوجد)";
    document.getElementById("resTitleLength").textContent = data.title_length + " حرفاً";
    document.getElementById("resDesc").textContent = data.meta_description || "(لا يوجد)";
    
    // تنسيق عناوين H1
    const h1Html = data.h1_tags && data.h1_tags.length 
      ? "<ul class='h1-list'>" + data.h1_tags.map(h => `<li>${h}</li>`).join("") + "</ul>" 
      : "لا يوجد وسم H1";
    document.getElementById("resH1").innerHTML = h1Html;
    
    // تنسيق حالة الاستجابة
    const statusClass = data.status_code === 200 ? "ok" : "err";
    document.getElementById("resStatus").innerHTML = `<span class="badge ${statusClass}">${data.status_code}</span>`;
    
  } catch (err) {
    msg.className = "msg error";
    msg.textContent = err.message;
  }
});

/* =========================================
   كود الفحص التقني (Audit)
   ========================================= */
document.getElementById("auditBtn").addEventListener("click", async () => {
  const url = document.getElementById("auditUrlInput").value.trim();
  const msg = document.getElementById("auditMsg");
  const results = document.getElementById("auditResults");
  
  if (!url) {
    msg.className = "msg error";
    msg.textContent = "أدخل رابطاً أولاً.";
    return;
  }

  msg.className = "msg info";
  msg.innerHTML = '<span class="spinner"></span> جارٍ الفحص التقني...';
  results.style.display = "none";

  try {
    const res = await licensedFetch("audit?url=" + encodeURIComponent(url));
    const data = await res.json();
    
    if (!data.ok) throw new Error(data.error || "فشل الفحص.");
    
    msg.textContent = "";
    results.style.display = "block";
    
    // بناء واجهة النتائج
    let summaryClass = data.summary === "جيد" ? "ok" : data.summary === "يوجد تحذيرات" ? "warn" : "err";
    
    let html = `<h3>الملخص: <span class="badge ${summaryClass}">${data.summary}</span></h3>`;
    
    // إحصائيات سريعة
    html += `<div class="kv" style="margin-top: 15px;">
      <div class="k">زمن استجابة السيرفر</div>
      <div class="v">${data.response_time_ms} ms</div>
      
      <div class="k">عدد عناوين H1</div>
      <div class="v">${data.headings.h1}</div>
      
      <div class="k">عدد الروابط المكسورة</div>
      <div class="v" style="color: ${data.links.broken.length > 0 ? 'var(--err)' : 'var(--ok)'}">${data.links.broken.length}</div>
    </div>`;
    
    // الملاحظات والأخطاء
    if (data.checks && data.checks.length > 0) {
      html += `<h3 style="margin-top: 25px;">التوصيات والملاحظات:</h3><ul style="line-height: 1.8;">`;
      data.checks.forEach(c => {
        const icon = c.level === 'err' ? '🔴' : c.level === 'warn' ? '🟡' : '🟢';
        html += `<li>${icon} ${c.msg}</li>`;
      });
      html += `</ul>`;
    } else {
      html += `<p style="color: var(--ok); margin-top: 15px;">✅ لا توجد أخطاء أو تحذيرات تقنية! موقعك ممتاز.</p>`;
    }
    
    // عرض الروابط المكسورة إن وجدت
    if (data.links.broken && data.links.broken.length > 0) {
      html += `<h3 style="margin-top: 25px; color: var(--err);">الروابط المكسورة (404):</h3><ul>`;
      data.links.broken.forEach(l => {
        html += `<li><span class="badge err">${l.status || 'Error'}</span> <span dir="ltr" style="font-family: monospace;">${l.url}</span></li>`;
      });
      html += `</ul>`;
    }
    
    results.innerHTML = html;
    
  } catch (err) {
    msg.className = "msg error";
    msg.textContent = err.message;
  }
});
/* =========================================
   كود التحليل المتقدم (Advanced Analyze)
   ========================================= */
document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const url = document.getElementById("analyzeUrlInput").value.trim();
  const msg = document.getElementById("analyzeMsg");
  const results = document.getElementById("analyzeResults");
  
  if (!url) { msg.className = "msg error"; msg.textContent = "أدخل رابطاً."; return; }

  msg.className = "msg info";
  msg.innerHTML = '<span class="spinner"></span> جارٍ التحليل العميق...';
  results.style.display = "none";

  try {
    const res = await licensedFetch("analyze?url=" + encodeURIComponent(url));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "فشل التحليل.");
    
    msg.textContent = "";
    results.style.display = "block";
    
    let html = `<div class="kv">
      <div class="k">عدد الكلمات في الصفحة</div>
      <div class="v">${data.word_count} كلمة</div>
      
      <div class="k">البيانات المنظمة (Schema)</div>
      <div class="v">${data.schema_count > 0 ? '<span class="badge ok">مدعومة (' + data.schema_count + ')</span>' : '<span class="badge err">مفقودة</span>'}</div>
      
      <div class="k">ملف Robots.txt</div>
      <div class="v">${data.files.robots_txt === 200 ? '<span class="badge ok">موجود (200)</span>' : '<span class="badge err">مفقود (' + data.files.robots_txt + ')</span>'}</div>
      
      <div class="k">ملف Sitemap.xml</div>
      <div class="v">${data.files.sitemap_xml === 200 ? '<span class="badge ok">موجود (200)</span>' : '<span class="badge warn">مفقود (' + data.files.sitemap_xml + ')</span>'}</div>
      
      <div class="k">الصور بدون Alt</div>
      <div class="v">${data.images.without_alt > 0 ? '<span class="badge warn">' + data.images.without_alt + ' صورة</span>' : '<span class="badge ok">0</span>'}</div>
    </div>`;

    // جدول كثافة الكلمات
    html += `<h3 style="margin-top: 25px;">أهم الكلمات المفتاحية (Keyword Density):</h3>`;
    html += `<table style="width:100%; text-align:right; border-collapse: collapse; margin-top: 10px;">
      <tr style="border-bottom: 1px solid var(--border); color: var(--text-dim);">
        <th style="padding: 8px;">الكلمة</th>
        <th style="padding: 8px;">التكرار</th>
        <th style="padding: 8px;">الكثافة</th>
      </tr>`;
    data.top_keywords.forEach(k => {
      html += `<tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px;">${k.word}</td>
        <td style="padding: 8px;">${k.count}</td>
        <td style="padding: 8px;">${k.density}%</td>
      </tr>`;
    });
    html += `</table>`;

    // وسوم التواصل الاجتماعي
    html += `<h3 style="margin-top: 25px;">جاهزية التواصل الاجتماعي (Social):</h3>`;
    if (Object.keys(data.social.og).length > 0) {
      html += `<p style="color: var(--ok);">✅ وسوم Open Graph موجودة (جاهز لفيسبوك).</p>`;
    } else {
      html += `<p style="color: var(--warn);">⚠️ وسوم Open Graph مفقودة.</p>`;
    }
    if (Object.keys(data.social.twitter).length > 0) {
      html += `<p style="color: var(--ok);">✅ وسوم Twitter Cards موجودة.</p>`;
    } else {
      html += `<p style="color: var(--warn);">⚠️ وسوم Twitter Cards مفقودة.</p>`;
    }

    results.innerHTML = html;
    
  } catch (err) {
    msg.className = "msg error";
    msg.textContent = err.message;
  }
});
/* =========================================
   4) البحث عن كلمات مفتاحية (Keywords Discovery)
   ========================================= */
let currentKeywords = [];
let currentFilter = "all";

// دالة مساعدة لتصنيف الكلمة
function getKeywordCategory(kw) {
  const lower = kw.toLowerCase();
  
  // 1. نية شراء (Buyers): تحتوي على كلمات تدل على المقارنة أو الشراء
  if (/\b(best|top|cheap|paid|vs|comparison|review|alternative|buy|price|cost)\b/.test(lower)) return "buyers";
  
  // 2. نية تعلم (Learners): تحتوي على كلمات تدل على السؤال أو التعلم
  if (/\b(what|how|why|guide|tips|list|examples|learn|tutorial|meaning|definition)\b/.test(lower)) return "learners";
  
  // 3. المنصات (Platforms): تحتوي على أسماء منصات معروفة
  if (/\b(wordpress|shopify|youtube|etsy|instagram|tiktok|amazon|saas|b2b|agency|google|facebook|twitter)\b/.test(lower)) return "platforms";
  
  // 4. طويلة الذيل (Long-tail): أكثر من 4 كلمات
  if (lower.split(" ").length >= 4) return "longtail";
  
  return "other";
}

// دالة عرض الكلمات بناءً على التصنيف
function renderKeywords() {
  const container = document.getElementById("kwListContainer");
  container.innerHTML = "";
  
  let filtered = currentKeywords;
  
  if (currentFilter !== "all") {
    filtered = currentKeywords.filter(kw => getKeywordCategory(kw) === currentFilter);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim); grid-column: 1 / -1;">لا توجد كلمات في هذا التصنيف.</p>`;
    return;
  }

  filtered.forEach(s => {
    const div = document.createElement("div");
    div.style.cssText = "background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 0.9rem;";
    div.textContent = s;
    container.appendChild(div);
  });
}

document.getElementById("kwBtn").addEventListener("click", async () => {
  const seed = document.getElementById("kwSeedInput").value.trim();
  const lang = document.getElementById("kwLangSelect").value;
  const msg = document.getElementById("kwMsg");
  const results = document.getElementById("kwResults");

  if (!seed) {
    msg.className = "msg error";
    msg.textContent = "أدخل كلمة أساسية.";
    return;
  }

  msg.className = "msg info";
  msg.innerHTML = '<span class="spinner"></span> جارٍ البحث في Google...';
  results.style.display = "none";

  try {
    const res = await licensedFetch(`keywords?seed=${encodeURIComponent(seed)}&lang=${lang}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "فشل البحث.");

    msg.textContent = "";
    results.style.display = "block";
    
    currentKeywords = data.suggestions;
    currentFilter = "all"; // إعادة تعيين الفلتر
    
    // تحديث الأزرار (إزالة active من الكل)
    document.querySelectorAll("#kwTabs .tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelector('#kwTabs .tab-btn[data-filter="all"]').classList.add("active");

    document.getElementById("kwCount").innerHTML = `تم العثور على <strong style="color: var(--accent);">${data.count}</strong> كلمة.`;
    
    renderKeywords();

  } catch (err) {
    msg.className = "msg error";
    msg.textContent = err.message;
  }
});

// إضافة حدث النقر على أزرار التصنيف
document.querySelectorAll("#kwTabs .tab-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll("#kwTabs .tab-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentFilter = e.target.dataset.filter;
    renderKeywords();
  });
});

// تصدير CSV
document.getElementById("kwExportBtn").addEventListener("click", () => {
  if (currentKeywords.length === 0) return;
  const csvContent = "Keyword,Category\n" + currentKeywords.map(k => `"${k.replace(/"/g, '""')}","${getKeywordCategory(k)}"`).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `keywords_${Date.now()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});