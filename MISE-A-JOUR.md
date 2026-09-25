# Mise à jour v24 — filtres conservés au retour, et colonne Interactions

## Les filtres survivent au retour arrière

C'était un vrai défaut de navigation. Depuis « mes entreprises », ouvrir une
fiche puis revenir en arrière ramenait la liste complète : le filtre par
responsable, la recherche en cours, le tri et la page étaient perdus à chaque
aller-retour.

Les filtres vivent désormais dans l'adresse de la page. Le bouton retour du
navigateur les restitue tout seul, sans code de restauration compliqué.

Ce qui est conservé : la recherche, le statut, le pôle, le responsable, la
priorité, le tri et le numéro de page.

Deux effets de bord agréables :

- une liste filtrée devient **partageable** : tu peux envoyer à quelqu'un le
  lien exact de ce que tu regardes
- le lien « mes entreprises » du tableau de bord se renormalise proprement en
  filtre par responsable

L'écriture dans l'URL se fait sans empiler d'historique, sinon chaque lettre
tapée dans la recherche aurait créé une entrée et le bouton retour serait
devenu inutilisable.

## Colonne Interactions

Une nouvelle colonne dans la liste des entreprises, juste après Contacts, qui
compte les interactions enregistrées.

Le zéro est affiché en gris pâle plutôt qu'en noir : une entreprise sans
interaction n'a jamais été travaillée, et cela doit sauter aux yeux quand on
parcourt la liste. Aujourd'hui, **150 de tes 271 entreprises sont dans ce
cas**.

Le compteur apparaît aussi dans la vue en tuiles, et une colonne
« Interactions » est ajoutée à l'export CSV.

La liste se rafraîchit désormais quand quelqu'un enregistre une interaction,
et plus seulement sur une entreprise ou un contact.

## Vérification

Le passage des filtres dans l'URL et leur relecture ont été testés sur dix
cas : filtre vide, filtre complet, lien « mes entreprises », page 4, page
invalide, tri par défaut, tri explicite, et une recherche avec accents et
esperluette.

## Base de données

Aucune modification.

## Déploiement

```bash
cd ~/dst-crm
unzip -o ~/Downloads/dst-crm-v24.zip
git add -A
git commit -m "Filtres conserves au retour arriere et colonne interactions"
git push
```
