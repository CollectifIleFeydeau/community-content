/**
 * Script de correction pour les témoignages avec contenu manquant
 */
const fs = require('fs-extra');
const path = require('path');

const entriesPath = path.join(process.cwd(), 'entries.json');

async function main() {
  console.log('🔧 Correction des témoignages...');
  
  // Charger entries.json
  if (!fs.existsSync(entriesPath)) {
    console.log('❌ entries.json non trouvé');
    return;
  }
  
  const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
  console.log(`📋 ${entries.entries.length} entrées trouvées`);
  
  let corrected = 0;
  
  for (const entry of entries.entries) {
    // Corriger les témoignages avec contenu invalide
    if (entry.type === 'testimonial' || !entry.imageUrl) {
      if (!entry.content || entry.content === '---' || entry.content.startsWith('**Créé le:**')) {
        // Essayer de récupérer le contenu depuis d'autres champs
        let newContent = '';
        
        if (entry.description && entry.description !== '---') {
          newContent = entry.description;
        } else if (entry.content && entry.content.includes('**Créé le:**')) {
          // Extraire le texte avant la date de création
          const parts = entry.content.split('**Créé le:**');
          if (parts[0].trim()) {
            newContent = parts[0].trim();
          }
        }
        
        if (!newContent) {
          // Contenu par défaut pour les témoignages sans texte
          newContent = `Témoignage partagé le ${new Date(entry.createdAt).toLocaleDateString('fr-FR')}`;
        }
        
        entry.content = newContent;
        entry.type = 'testimonial'; // S'assurer que c'est bien un témoignage
        corrected++;
        
        console.log(`✅ Corrigé: ${entry.id} -> "${newContent.substring(0, 50)}..."`);
      }
    }
    
    // Supprimer les images base64 pour réduire la taille du fichier
    if (entry.imageUrl && entry.imageUrl.startsWith('data:image/')) {
      console.log(`🗑️ Suppression image base64 pour ${entry.id}`);
      delete entry.imageUrl;
      delete entry.thumbnailUrl;
    }
  }
  
  // Limiter à 50 entrées maximum pour éviter un fichier trop gros
  if (entries.entries.length > 50) {
    console.log(`⚠️ Limitation: conservation des 50 entrées les plus récentes`);
    entries.entries = entries.entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
  }
  
  // Sauvegarder
  fs.writeFileSync(entriesPath, JSON.stringify(entries, null, 1));
  console.log(`💾 ${corrected} témoignages corrigés et fichier optimisé`);
}

main().catch(console.error);
