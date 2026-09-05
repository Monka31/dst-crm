# Mettre ce projet sur GitHub et le brancher à Vercel

## 1. Pousser sur GitHub (Terminal sur votre Mac)

Si vous avez la CLI GitHub (`gh`) :

```bash
cd ~/Downloads && unzip -o dst-crm-source.zip -d dst-crm && cd dst-crm
git init -b main
git add -A
git commit -m "CRM Digital Study Trip — version initiale"
gh repo create dst-crm --private --source=. --push
```

Sinon : créez un dépôt vide nommé `dst-crm` sur https://github.com/new
(sans README, sans .gitignore), puis :

```bash
cd ~/Downloads && unzip -o dst-crm-source.zip -d dst-crm && cd dst-crm
git init -b main
git add -A
git commit -m "CRM Digital Study Trip — version initiale"
git remote add origin https://github.com/Monka31/dst-crm.git
git push -u origin main
```

## 2. Brancher le dépôt au projet Vercel existant

1. https://vercel.com/marco-09d4/dst-crm/settings/git
2. **Connect Git Repository** → GitHub → autorisez l'app GitHub de Vercel → choisissez `dst-crm`.

L'URL `https://dst-crm-brown.vercel.app` reste la même : on branche le dépôt au
projet existant, on n'en crée pas un nouveau.

## 3. (optionnel) Nettoyer

Une fois le premier déploiement depuis Git réussi :

- Settings → Build & Deployment → **Install Command** : retirer l'override
  `node bootstrap.mjs && npm install` et revenir au réglage automatique.
- Supprimer `bootstrap.mjs` du dépôt.
- Dans Supabase, `drop table public.build_files;` (elle ne servait que de relais
  pour le tout premier déploiement).

Ces trois points sont facultatifs : le build fonctionne même sans, car
`bootstrap.mjs` ne fait plus rien quand les sources sont déjà présentes.
