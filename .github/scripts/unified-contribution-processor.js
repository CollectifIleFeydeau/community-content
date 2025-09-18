/**
 * SCRIPT UNIFIÉ - Remplace tous les autres scripts de traitement
 * Traite les contributions GitHub Issues directement vers entries.json
 */
const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = 'CollectifIleFeydeau';
const REPO_NAME = 'community-content';

/**
 * Script unifié pour traiter les contributions communautaires
 * Remplace tous les anciens scripts (process-contribution.js, sync-issues.js, etc.)
 * 
 * CLOUDINARY INTEGRATION:
 * - Les images sont uploadées vers Cloudinary depuis le frontend
 * - Ce script récupère les URLs Cloudinary depuis les issues GitHub
 * - Pas de traitement d'image nécessaire (Cloudinary gère tout)
 * - Fallback vers base64 pour rétrocompatibilité
 * 
 * Fonctionnalités :
 * - Récupère les issues GitHub ouvertes
 * - Parse le contenu des contributions (texte + URLs Cloudinary)
 * - Traite les images base64 (ancien système uniquement)
 * - Met à jour entries.json avec URLs Cloudinary
 * - Ferme les issues traitées
 */

async function main() {
  console.log(' Traitement unifié des contributions...');
  
  try {
    // Debug: Vérifier le token et les permissions
    console.log('🔍 Vérification du token GitHub...');
    console.log(`Repository cible: ${REPO_OWNER}/${REPO_NAME}`);
    console.log(`Token présent: ${process.env.GITHUB_TOKEN ? 'OUI' : 'NON'}`);
    
    // Test d'accès au repository
    try {
      const { data: repo } = await octokit.rest.repos.get({
        owner: REPO_OWNER,
        repo: REPO_NAME
      });
      console.log(`✅ Repository trouvé: ${repo.full_name}`);
      console.log(`📊 Issues activées: ${repo.has_issues}`);
    } catch (repoError) {
      console.error('❌ Erreur accès repository:', repoError.message);
      console.error('💡 Vérifiez que le repository existe et que le token a les bonnes permissions');
      throw repoError;
    }
    
    // 1. Récupérer toutes les issues avec le label "contribution" (ouvertes ET fermées)
    console.log('📋 Recherche des issues avec label "contribution"...');
    
    let openIssues = [];
    let closedIssues = [];
    
    try {
      const { data: openData } = await octokit.rest.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        labels: 'contribution',
        state: 'open'
      });
      openIssues = openData;
      console.log(`✅ ${openIssues.length} contributions ouvertes trouvées`);
    } catch (openError) {
      console.error('❌ Erreur récupération issues ouvertes:', openError.message);
      // Continuer même si erreur
    }
    
    try {
      const { data: closedData } = await octokit.rest.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        labels: 'contribution',
        state: 'closed'
      });
      closedIssues = closedData;
      console.log(`✅ ${closedIssues.length} contributions fermées trouvées`);
    } catch (closedError) {
      console.error('❌ Erreur récupération issues fermées:', closedError.message);
      // Continuer même si erreur
    }
    
    // Debug: Lister toutes les issues pour voir ce qui existe
    try {
      const { data: allIssues } = await octokit.rest.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        state: 'all',
        per_page: 10
      });
      console.log(`🔍 Total issues dans le repository: ${allIssues.length}`);
      if (allIssues.length > 0) {
        console.log('📝 Exemples d\'issues trouvées:');
        allIssues.slice(0, 3).forEach(issue => {
          console.log(`  - #${issue.number}: "${issue.title}" [${issue.state}] Labels: ${issue.labels.map(l => l.name).join(', ')}`);
        });
      }
    } catch (debugError) {
      console.warn('⚠️ Impossible de lister toutes les issues:', debugError.message);
    }
    
    // 2. Charger entries.json existant
    let entries = { entries: [] };
    const entriesPath = path.join(process.cwd(), 'entries.json');
    
    if (fs.existsSync(entriesPath)) {
      entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
    }
    
    // 3. Traiter les issues ouvertes (nouvelles contributions)
    if (openIssues.length > 0) {
      console.log(`🔄 Traitement de ${openIssues.length} contributions ouvertes...`);
      for (const issue of openIssues) {
        await processIssue(issue, entries);
      }
    } else {
      console.log('ℹ️ Aucune contribution ouverte à traiter');
    }
    
    // 4. Marquer les issues fermées comme "rejected" dans entries.json
    if (closedIssues.length > 0) {
      console.log(`🗑️ Traitement de ${closedIssues.length} contributions fermées...`);
      for (const closedIssue of closedIssues) {
        await markIssueAsRejected(closedIssue, entries);
      }
    } else {
      console.log('ℹ️ Aucune contribution fermée à traiter');
    }
    
    // 4. Limiter le nombre d'entrées pour éviter un fichier trop volumineux
    if (entries.entries.length > 100) {
      console.log(`⚠️ Limitation: ${entries.entries.length} entrées trouvées, conservation des 100 plus récentes`);
      entries.entries = entries.entries
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100);
    }
    
    // 5. Sauvegarder entries.json (format compact pour réduire la taille)
    fs.writeFileSync(entriesPath, JSON.stringify(entries, null, 1));
    console.log('💾 entries.json mis à jour');
    
    // 6. Fermer les issues ouvertes traitées
    for (const issue of openIssues) {
      await octokit.rest.issues.update({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        issue_number: issue.number,
        state: 'closed',
        labels: ['contribution', 'processed']
      });
      console.log(`✅ Issue #${issue.number} fermée`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

async function processIssue(issue, entries) {
  try {
    console.log(`📝 Traitement issue #${issue.number}: ${issue.title}`);
    
    // Parser le contenu de l'issue
    const contribution = parseIssueBody(issue.body);
    
    // Fallback: extraire type et nom depuis le titre si pas trouvé dans le body
    if (!contribution.type || !contribution.displayName) {
      const titleMatch = issue.title.match(/^(\w+):\s*(.+)$/);
      if (titleMatch) {
        if (!contribution.type) contribution.type = titleMatch[1];
        if (!contribution.displayName) contribution.displayName = titleMatch[2];
      }
    }
    
    // Valeurs par défaut
    if (!contribution.displayName) contribution.displayName = 'Anonyme';
    if (!contribution.type) contribution.type = 'photo';
    
    // Utiliser l'ID basé sur le numéro d'issue pour permettre la suppression
    contribution.id = `issue-${issue.number}`;
    contribution.timestamp = issue.created_at;
    contribution.likes = 0;
    contribution.likedBy = [];
    contribution.moderation = {
      status: 'approved',
      moderatedAt: new Date().toISOString()
    };
    
    // 🌩️ CLOUDINARY: Traiter l'image si c'est une photo
    if (contribution.type === 'photo') {
      if (contribution.imageUrl) {
        // 🌩️ CLOUDINARY: URL Cloudinary - utiliser directement (pas de traitement nécessaire)
        // Cloudinary gère automatiquement le redimensionnement et l'optimisation
        console.log(`🌩️ Utilisation URL Cloudinary: ${contribution.imageUrl}`);
        contribution.thumbnailUrl = contribution.imageUrl; // Même URL pour thumbnail
      } else if (contribution.imageData) {
        // 📷 LEGACY: Base64 - traiter et sauvegarder (ancien système)
        console.log(`📷 Traitement image base64 (ancien système)`);
        await processImage(contribution);
      }
    }
    
    // Ajouter à entries
    entries.entries.unshift(contribution); // Ajouter au début (plus récent)
    
    console.log(`✅ Contribution ${contribution.id} traitée`);
    
  } catch (error) {
    console.error(`❌ Erreur traitement issue #${issue.number}:`, error);
  }
}

function parseIssueBody(body) {
  // Parser le format markdown de l'issue (format Worker Cloudflare)
  const contribution = {};
  
  // Extraire les champs avec regex pour correspondre au format Worker
  const typeMatch = body.match(/\*\*Type:\*\*\s*([^\n]+)/);
  if (typeMatch) contribution.type = typeMatch[1].trim();
  
  // Essayer d'abord "Nom d'affichage" puis "Nom" en fallback
  let nameMatch = body.match(/\*\*Nom d'affichage:\*\*\s*([^\n]+)/);
  if (!nameMatch) nameMatch = body.match(/\*\*Nom:\*\*\s*([^\n]+)/);
  if (nameMatch) contribution.displayName = nameMatch[1].trim();
  
  const locationMatch = body.match(/\*\*Lieu:\*\*\s*([^\n]+)/);
  if (locationMatch) contribution.locationId = locationMatch[1].trim();
  
  const eventMatch = body.match(/\*\*Événement:\*\*\s*([^\n]+)/);
  if (eventMatch) contribution.eventId = eventMatch[1].trim();
  
  // Chercher la description (format Worker)
  let contentMatch = body.match(/\*\*Description:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/);
  if (!contentMatch) {
    // Fallback vers autres formats
    contentMatch = body.match(/\*\*(?:Contenu|Témoignage):\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/);
  }
  if (contentMatch) {
    contribution.content = contentMatch[1].trim();
  }
  
  // Si pas de contenu trouvé avec les labels, prendre tout le texte après les métadonnées
  if (!contribution.content) {
    // Supprimer toutes les lignes qui commencent par **
    const textLines = body.split('\n').filter(line => !line.startsWith('**') && line.trim() !== '');
    if (textLines.length > 0) {
      contribution.content = textLines.join('\n').trim();
    }
  }
  
  // 🌩️ CLOUDINARY: Extraire l'image (Cloudinary en priorité, base64 en fallback)
  // Cloudinary est le système principal depuis 2025 - URLs format: https://res.cloudinary.com/dpatqkgsc/...
  const cloudinaryMatch = body.match(/https:\/\/res\.cloudinary\.com\/[^\s\n)]+/);
  if (cloudinaryMatch) {
    contribution.imageUrl = cloudinaryMatch[0];
    console.log(`🌩️ URL Cloudinary trouvée: ${contribution.imageUrl}`);
  } else {
    // 📷 LEGACY: Fallback vers base64 pour rétrocompatibilité (ancien système)
    const imageMatch = body.match(/data:image\/[^;]+;base64,([^)]+)/);
    if (imageMatch) {
      contribution.imageData = imageMatch[1];
      console.log(`📷 Image base64 trouvée (ancien système)`);
    }
  }
  
  console.log(`📝 Parsing issue body:`, body);
  console.log(`📝 Contenu extrait: "${contribution.content || 'AUCUN'}"`);
  console.log(`📝 Type extrait: "${contribution.type || 'AUCUN'}"`);
  console.log(`📝 Nom extrait: "${contribution.displayName || 'AUCUN'}"`);
  
  return contribution;
}

async function processImage(contribution) {
  try {
    const imageBuffer = Buffer.from(contribution.imageData, 'base64');
    
    // Créer les dossiers
    fs.ensureDirSync('images');
    fs.ensureDirSync('thumbnails');
    
    // Sauvegarder l'image originale
    const imagePath = path.join('images', `${contribution.id}.jpg`);
    await sharp(imageBuffer)
      .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(imagePath);
    
    // Créer la miniature
    const thumbnailPath = path.join('thumbnails', `${contribution.id}.jpg`);
    await sharp(imageBuffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);
    
    // URLs pour l'accès
    contribution.imageUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/raw/main/images/${contribution.id}.jpg`;
    contribution.thumbnailUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/raw/main/thumbnails/${contribution.id}.jpg`;
    
    // Supprimer les données base64 (plus besoin)
    delete contribution.imageData;
    
    console.log(`🖼️ Image ${contribution.id} traitée`);
    
  } catch (error) {
    console.error('❌ Erreur traitement image:', error);
    throw error;
  }
}

async function markIssueAsRejected(closedIssue, entries) {
  try {
    console.log(`🗑️ Marquage issue fermée #${closedIssue.number} comme "rejected"`);
    
    // Chercher l'entrée correspondante dans entries.json
    const issueId = `issue-${closedIssue.number}`;
    const entryIndex = entries.entries.findIndex(entry => entry.id === issueId);
    
    if (entryIndex !== -1) {
      // Marquer l'entrée comme "rejected"
      entries.entries[entryIndex].moderation = {
        status: 'rejected',
        moderatedAt: new Date().toISOString(),
        reason: 'Supprimée par un administrateur'
      };
      console.log(`✅ Entrée ${issueId} marquée comme "rejected"`);
    } else {
      console.log(`⚠️ Entrée ${issueId} non trouvée dans entries.json`);
    }
    
  } catch (error) {
    console.error(`❌ Erreur marquage issue fermée #${closedIssue.number}:`, error);
  }
}

main();
