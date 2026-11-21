"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#080B12", color: "#F8FAFC", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Kutilmagan xatolik yuz berdi</h1>
          <p style={{ color: "#94A3B8" }}>Sahifani qayta yuklab ko‘ring.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#C9A45C", color: "#080B12", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
