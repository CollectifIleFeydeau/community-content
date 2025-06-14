# Collectif Feydeau - Contenu Communautaire

Ce dépôt stocke les contenus générés par les utilisateurs (photos et témoignages) pour l'application du Collectif Île Feydeau.

## Structure du dépôt

- `/images` : Stocke les images originales partagées par les utilisateurs
- `/thumbnails` : Stocke les versions miniatures des images pour l'affichage dans la galerie
- `entries.json` : Contient les métadonnées de toutes les contributions

## Format des données

Le fichier `entries.json` contient un tableau d'objets avec la structure suivante :

```json
{
  "entries": [
    {
      "id": "unique-id",
      "type": "photo|testimonial",
      "author": "Nom de l'auteur",
      "title": "Titre de la contribution",
      "description": "Description (pour les photos)",
      "content": "Contenu (pour les témoignages)",
      "imageUrl": "chemin/vers/image.jpg",
      "thumbnailUrl": "chemin/vers/miniature.jpg",
      "createdAt": "2025-06-14T12:00:00Z",
      "likes": 0,
      "eventId": "id-evenement-associe",
      "locationId": "id-lieu-associe"
    }
  ],
  "lastUpdated": "2025-06-14T14:00:00Z"
}
```

## Processus de modération

Les contributions des utilisateurs sont d'abord validées par un processus de modération avant d'être ajoutées à ce dépôt public.

## Utilisation dans l'application

L'application récupère ces données via l'URL brute de GitHub :
`https://raw.githubusercontent.com/CollectifIleFeydeau/community-content/main/`