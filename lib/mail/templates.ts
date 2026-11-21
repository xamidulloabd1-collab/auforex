import "server-only";

const BRAND = "AU Forex Academy";

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="uz">
<body style="margin:0;background:#080B12;font-family:Inter,Segoe UI,Arial,sans-serif;color:#F8FAFC">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#151D2B;border:1px solid #243047;border-radius:16px;padding:32px">
        <tr><td>
          <p style="margin:0 0 24px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#C9A45C;font-weight:700">${BRAND}</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#F8FAFC">${escapeHtml(title)}</h1>
          ${bodyHtml}
          <p style="margin:32px 0 0;font-size:12px;color:#94A3B8">0 dan natijagacha — birga!</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#C9A45C;color:#080B12;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${escapeHtml(label)}</a></p>
<p style="margin:0;font-size:12px;color:#94A3B8;word-break:break-all">Tugma ishlamasa, havolani brauzerga nusxalang:<br>${escapeHtml(url)}</p>`;
}

export function verificationEmail(name: string, url: string) {
  const title = "Email manzilingizni tasdiqlang";
  return {
    subject: `${BRAND}: email manzilingizni tasdiqlang`,
    html: layout(
      title,
      `<p style="margin:0;color:#CBD5E1;line-height:1.6">Assalomu alaykum, ${escapeHtml(name)}! Hisobingizni faollashtirish uchun quyidagi tugmani bosing. Havola 24 soat amal qiladi.</p>${button(url, "Emailni tasdiqlash")}`,
    ),
    text: `Assalomu alaykum, ${name}!\nHisobingizni faollashtirish uchun havola (24 soat amal qiladi):\n${url}`,
  };
}

export function passwordResetEmail(name: string, url: string) {
  const title = "Parolni tiklash";
  return {
    subject: `${BRAND}: parolni tiklash`,
    html: layout(
      title,
      `<p style="margin:0;color:#CBD5E1;line-height:1.6">Assalomu alaykum, ${escapeHtml(name)}! Parolni tiklash so‘rovi qabul qilindi. Yangi parol o‘rnatish uchun tugmani bosing. Havola 1 soat amal qiladi. Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.</p>${button(url, "Yangi parol o‘rnatish")}`,
    ),
    text: `Assalomu alaykum, ${name}!\nParolni tiklash havolasi (1 soat amal qiladi):\n${url}\nAgar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.`,
  };
}
