export const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) => {
  if (!p) return "";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
};

export const initials = (p?: { first_name?: string | null; last_name?: string | null } | null) => {
  if (!p) return "?";
  const a = (p.first_name ?? "").trim()[0] ?? "";
  const b = (p.last_name ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
};

export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateShort = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

export const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
};

export const relative = (d?: string | null) => {
  if (!d) return "jamais";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 31) return `il y a ${j} j`;
  return fmtDate(d);
};

export const daysSince = (d?: string | null) => {
  if (!d) return Infinity;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
};

export const today = () => new Date().toISOString().slice(0, 10);

export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
};

export const download = (filename: string, content: string, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob(["﻿" + content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
