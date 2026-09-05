# Mise à jour v14 — tâches d'équipe corrigées

**Cette version remplace la v13, que tu peux ignorer si tu ne l'as pas encore
déployée.** Elle contient tout ce qu'elle apportait, avec les tâches d'équipe
refaites comme tu les voulais.

## Ce qui change par rapport à la v13

J'avais compris « une tâche pour chacun » alors que tu voulais **une seule
tâche que tout le monde voit**, un pense-bête dont quelqu'un se saisit ensuite.

Désormais, choisir **« Toute l'équipe — à prendre en charge »** crée **une
seule tâche, sans responsable**. Elle apparaît en tête de la page Mes tâches,
dans un encadré bleu **« À prendre en charge »**, pour tous les éditeurs.

- Bouton **« Je m'en charge »** : la tâche quitte la liste commune et devient
  la vôtre.
- Bouton **« Rendre à l'équipe »** sur une de vos tâches : elle repart dans la
  liste commune si vous ne pouvez finalement pas la traiter.
- La responsabilité se change aussi depuis la fenêtre de modification, dans les
  deux sens.

Testé en base sur le cycle complet : création sans responsable, prise en
charge, retour à l'équipe.

## Le reste de la v13, inchangé

**Modifier et supprimer une interaction** — un lien « Modifier » sous chaque
échange, dans l'historique d'une entreprise comme sur la fiche d'un contact.
Seuls l'auteur et un team leader peuvent modifier ; seuls l'auteur et un
administrateur peuvent supprimer.

**Tâches terminées en bas de liste**, la plus urgente d'abord à statut égal, et
trois boutons **À faire / Terminées / Toutes** avec leurs compteurs.

**Pièces jointes sur les modèles de messages** — plaquette, programme,
lettre de recommandation. Ajout réservé aux administrateurs, 10 Mo par fichier.
Un PDF ne se colle pas dans le corps d'un email : **Télécharger** pour le
joindre, **Copier le lien** pour insérer une adresse dans le texte. Ce lien est
public, n'y déposez rien de confidentiel.

## Base de données

Déjà appliqué : colonne `tasks.for_team` (la colonne `team_group` de la v13,
inutilisée, a été retirée), table `template_files` et compartiment de stockage
`documents`. Aucune donnée existante touchée.

## Déploiement

```bash
cd ~/dst-crm
unzip -o ~/Downloads/dst-crm-v14.zip
git add -A
git commit -m "Taches d equipe partagees, interactions modifiables, pieces jointes"
git push
```
