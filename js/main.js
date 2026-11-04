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