# Mise à jour v22 — les lecteurs disparaissent des sélecteurs de personne

## Le principe

Un lecteur ne peut rien modifier. Lui attribuer une entreprise, une tâche ou
une relance n'avait donc aucun sens, et cela allongeait chaque liste pour
rien.

Tous les sélecteurs de personne ne proposent désormais que les éditeurs, à
savoir les administrateurs, les team leaders et les membres.

## Ce qui change concrètement

Les listes concernées :

- Responsable d'une entreprise, dans le formulaire et dans le changement
  rapide depuis la liste
- Présenté par, sur un contact. Cette liste-là proposait encore tout le monde
- Assignée à, sur une tâche et sur une relance
- Responsable d'une visite
- Les filtres « Tous les responsables » de la liste des entreprises et de la
  vue prospection, qui proposaient eux aussi tous les comptes
- Le sélecteur d'auteur du compte rendu

Vérifié avant de livrer : aucune entreprise, tâche, relance ni fiche contact
n'est aujourd'hui rattachée à un lecteur. Personne ne verra donc un champ se
vider parce que la personne a disparu de la liste.

## Comment c'est fait

La règle est écrite une seule fois, dans le contexte de l'application, et
non recopiée dans chaque écran. Les écrans qui filtraient déjà à la main
passent par la même liste, ce qui supprime au passage une demi-douzaine de
filtres dupliqués. Si la définition d'un éditeur change un jour, il n'y aura
qu'un endroit à modifier.

## Base de données

Aucune modification.

## Déploiement

```bash
cd ~/dst-crm
unzip -o ~/Downloads/dst-crm-v22.zip
git add -A
git commit -m "Seuls les editeurs apparaissent dans les selecteurs de personne"
git push
```
