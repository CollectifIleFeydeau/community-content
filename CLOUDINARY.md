# 🌩️ Cloudinary Integration - Collectif Île Feydeau

## Vue d'ensemble

Le système de galerie communautaire utilise **Cloudinary** comme service principal de gestion d'images depuis 2025.

## Configuration Cloudinary

- **Account:** `dpatqkgsc`
- **Cloud Name:** `dpatqkgsc`
- **Upload Preset:** `collectif_photos`
- **URL API:** `https://api.cloudinary.com/v1_1/dpatqkgsc/image/upload`

## Architecture du système

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Cloudinary    │    │  Worker CF      │
│ (React Form)    │───▶│   (Images)      │───▶│ (GitHub Proxy)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GitHub Issues  │◀───│   Script Unifié │◀───│ GitHub Actions  │
│  (Métadonnées)  │    │  (Traitement)   │    │   (Trigger)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Flux de traitement

### 1. Upload Frontend
```javascript
// ContributionForm.tsx
const formData = new FormData();
formData.append('file', file);
formData.append('upload_preset', 'collectif_photos');
formData.append('cloud_name', 'dpatqkgsc');

const response = await fetch('https://api.cloudinary.com/v1_1/dpatqkgsc/image/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
const cloudinaryUrl = data.secure_url; // https://res.cloudinary.com/dpatqkgsc/...
```

### 2. Worker Cloudflare
```javascript
// Reçoit l'URL Cloudinary et crée une issue GitHub
const issueBody = `
**Type:** photo
**Nom d'affichage:** ${displayName}
**Description:** ${description}
**Image:** ${cloudinaryUrl}
`;
```

### 3. Script Unifié
```javascript
// unified-contribution-processor.js
// Détecte les URLs Cloudinary dans les issues
const cloudinaryMatch = body.match(/https:\/\/res\.cloudinary\.com\/[^\s\n)]+/);
if (cloudinaryMatch) {
  contribution.imageUrl = cloudinaryMatch[0];
  contribution.thumbnailUrl = cloudinaryMatch[0]; // Même URL
}
```

## Avantages de Cloudinary

✅ **Optimisation automatique** : Compression, redimensionnement, formats modernes  
✅ **CDN global** : Livraison rapide partout dans le monde  
✅ **Pas de stockage Git** : Évite les gros fichiers binaires dans les repos  
✅ **Transformations à la volée** : Miniatures, recadrage, effets  
✅ **Fiabilité** : Service managé, pas de maintenance  

## URLs d'exemple

- **Image originale:** `https://res.cloudinary.com/dpatqkgsc/image/upload/v1750364944/f6shgldrbhdhk2eg3xhk.png`
- **Miniature 300x300:** `https://res.cloudinary.com/dpatqkgsc/image/upload/c_fill,w_300,h_300/v1750364944/f6shgldrbhdhk2eg3xhk.png`
- **Optimisée WebP:** `https://res.cloudinary.com/dpatqkgsc/image/upload/f_webp,q_auto/v1750364944/f6shgldrbhdhk2eg3xhk.png`

## Rétrocompatibilité

Le système supporte encore les images base64 (ancien système) en fallback :
- **Priorité 1:** URLs Cloudinary
- **Fallback:** Images base64 (traitées avec Sharp)

## Monitoring

Les logs incluent des emojis pour identifier le système utilisé :
- 🌩️ = Cloudinary (système principal)
- 📷 = Base64 (système legacy)

## Configuration requise

1. **Preset Cloudinary** : `collectif_photos` doit être configuré en "unsigned"
2. **CORS** : Autoriser les domaines de l'app
3. **Transformations** : Configurer les tailles par défaut si nécessaire

## Dépannage

- **Upload échoue** : Vérifier le preset et les permissions CORS
- **Images ne s'affichent pas** : Vérifier les URLs dans entries.json
- **Performance lente** : Utiliser les transformations Cloudinary pour optimiser
