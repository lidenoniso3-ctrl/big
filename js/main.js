document.getElementById("scrapeBtn").addEventListener("click", async () => {
  const url = document.getElementById("urlInput").value.trim();
  const out = document.getElementById("resultBox");
  if (!url) { out.textContent = "أدخل رابطاً."; return; }

  out.textContent = "جارٍ الفحص...";
  try {
    const res = await licensedFetch("scrape?url=" + encodeURIComponent(url));
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.textContent = "خطأ: " + err.message;
  }
});