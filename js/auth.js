const LKEY = "seo_license";

async function verifyLicense(key) {
  const res = await fetch("/.netlify/functions/verify-license", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ license_key: key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "فشل التحقق.");
  localStorage.setItem(LKEY, key);
  return data;
}

function getLicense() { return localStorage.getItem(LKEY); }

function logout() {
  localStorage.removeItem(LKEY);
  window.location.href = "index.html";
}

function requireLicense() {
  if (!getLicense()) {
    window.location.replace("index.html");
    return false;
  }
  return true;
}

async function licensedFetch(fnPath) {
  const key = getLicense();
  if (!key) { window.location.replace("index.html"); throw new Error("لا يوجد مفتاح."); }
  const res = await fetch("/.netlify/functions/" + fnPath, {
    headers: { Authorization: "Bearer " + key },
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem(LKEY);
    window.location.replace("index.html");
    throw new Error("ترخيص غير صالح.");
  }
  return res;
}