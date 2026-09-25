/** Génération d'un fichier .ics importable dans Google Agenda, Outlook ou Apple Calendrier. */

type Evenement = {
  id: string;
  titre: string;
  date: string | null;         // AAAA-MM-JJ
  debut: string | null;        // HH:MM(:SS)
  fin: string | null;
  lieu: string | null;
  description: string | null;
};

const echapper = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const horodatage = (date: string, heure: string | null, decalage = 0) => {
  const [a, m, j] = date.split("-").map(Number);
  const [h, mn] = (heure ?? "09:00").split(":").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j, h, mn));
  d.setUTCHours(d.getUTCHours() + decalage);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};

/**
 * Les horaires sont écrits en heure locale flottante (sans Z) : une visite à
 * 10 h à Amsterdam doit s'afficher à 10 h, quel que soit le fuseau du
 * téléphone qui importe le fichier.
 */
export function versIcs(evenements: Evenement[], nomCalendrier = "Visites DST"): string {
  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ESSEC DST CRM//FR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${echapper(nomCalendrier)}`,
  ];

  evenements.filter((e) => e.date).forEach((e) => {
    const debut = horodatage(e.date!, e.debut).slice(0, 15);
    const fin = e.fin
      ? horodatage(e.date!, e.fin).slice(0, 15)
      : horodatage(e.date!, e.debut, 1).slice(0, 15);
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@dst-crm`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART:${debut}`,
      `DTEND:${fin}`,
      `SUMMARY:${echapper(e.titre)}`,
    );
    if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
    if (e.description) lignes.push(`DESCRIPTION:${echapper(e.description)}`);
    lignes.push("END:VEVENT");
  });

  lignes.push("END:VCALENDAR");
  return lignes.join("\r\n");
}
