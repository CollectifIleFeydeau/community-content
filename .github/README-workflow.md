# Synchronisation des contributions

Ce dépôt contient les contributions communautaires (photos et témoignages) pour le site du Collectif Île Feydeau.

## Fonctionnement

1. Les contributions sont soumises via le site web et créent des issues GitHub dans ce dépôt
2. Plusieurs GitHub Actions s'exécutent pour traiter les contributions:
   - `process-contribution.yml`: Traite une contribution individuelle
   - `process-contributions.yml`: Traite l'ensemble des contributions en lot
   - `update-likes.yml`: Gère les mises à jour des likes
3. Ces actions convertissent les issues en entrées dans le fichier `entries.json` et traitent les médias
4. Le site web charge les contributions depuis ce fichier JSON

## Structure d'une issue de contribution

### Photo

Une issue de contribution photo contient :
- Un label `photo`
- Une image encodée en base64 dans le corps de l'issue
- Des métadonnées (description, contributeur, etc.)

### Témoignage

Une issue de contribution témoignage contient :
- Un label `testimonial`
- Le texte du témoignage dans le corps de l'issue
- Des métadonnées (contributeur, etc.)

## Modération

- Les issues ouvertes sont considérées comme des contributions approuvées
- Les issues fermées sont considérées comme des contributions rejetées
- Pour supprimer définitivement une contribution, utilisez l'interface d'administration du site ou fermez l'issue correspondante

## Exécution manuelle

Pour forcer le traitement des contributions, vous pouvez exécuter manuellement les workflows GitHub Actions depuis l'onglet "Actions" du dépôt:

- `process-contributions.yml` pour traiter toutes les contributions
- `process-contribution.yml` pour traiter une contribution spécifique (nécessite l'ID de la contribution)
- `update-likes.yml` pour mettre à jour les likes
