# Synchronisation des contributions

Ce dépôt contient les contributions communautaires (photos et témoignages) pour le site du Collectif Île Feydeau.

## Fonctionnement

1. Les contributions sont soumises via le site web et créent des issues GitHub dans ce dépôt
2. Une GitHub Action (`sync-entries.yml`) s'exécute automatiquement à chaque modification d'issue
3. Cette action convertit les issues en entrées dans le fichier `entries.json`
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
- Pour supprimer définitivement une contribution, fermez l'issue correspondante

## Exécution manuelle

Pour forcer la synchronisation des issues avec le fichier `entries.json`, vous pouvez exécuter manuellement le workflow GitHub Action depuis l'onglet "Actions" du dépôt.
