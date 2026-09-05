# DST CRM — Pôle Entreprise

CRM collaboratif de prospection pour le Digital Study Trip (ESSEC MS MMD).

- **App en ligne** : https://dst-crm-brown.vercel.app
- **Stack** : Next.js 15 + TypeScript + Tailwind · Supabase (Auth, Postgres, RLS, Realtime) · Vercel

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les 2 variables
npm run dev
```

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=https://wksfqslzhbijeakrbaal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_lIKg1G8jfzWboSTEVE2BLg_Ij5Z3Tbf
```

Ces deux valeurs sont publiques par conception : tout l'accès aux données est
contrôlé par les politiques Row Level Security de Supabase.

## Rôles

| Rôle | Peut |
|---|---|
| `admin` | tout : utilisateurs, invitations, pôles, paramètres, suppressions |
| `team_leader` | gérer les entreprises de son pôle, attribuer, planifier |
| `member` | ajouter entreprises/contacts/interactions, gérer les siennes |
| `viewer` | lecture seule (dashboard, avancement, planning, stats) |

## Déploiement

Le projet Vercel est `dst-crm`. Pour reprendre la main : pousser ce dossier
sur un dépôt GitHub, puis connecter ce dépôt au projet Vercel
(Settings → Git). Le déploiement deviendra automatique à chaque push, et la
table `public.build_files` de Supabase (utilisée comme relais temporaire pour
le premier déploiement) pourra être supprimée.
