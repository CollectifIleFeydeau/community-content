/**
 * SCRIPT UNIFIÉ - Remplace tous les autres scripts de traitement
 * Traite les contributions GitHub Issues directement vers entries.json
 */
const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = 'CollectifFeydeau';
const REPO_NAME = 'community-content';

async function main() {
  console.log('🚀 Traitement unifié des contributions...');
  
  try {
    // 1. Récupérer toutes les issues avec le label "contribution"
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      labels: 'contribution',
      state: 'open'
    });
    
    console.log(`📋 ${issues.length} contributions trouvées`);
    
    if (issues.length === 0) {
      console.log('✅ Aucune nouvelle contribution à traiter');
      return;
    }
    
    // 2. Charger entries.json existant
    let entries = { entries: [] };
    const entriesPath = path.join(process.cwd(), 'entries.json');
    
    if (fs.existsSync(entriesPath)) {
      entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
    }
    
    // 3. Traiter chaque issue
    for (const issue of issues) {
      await processIssue(issue, entries);
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
    
    // 5. Fermer les issues traitées
    for (const issue of issues) {
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
    contribution.id = `contrib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    contribution.timestamp = issue.created_at;
    contribution.likes = 0;
    contribution.likedBy = [];
    contribution.moderation = {
      status: 'approved',
      moderatedAt: new Date().toISOString()
    };
    
    // Traiter l'image si c'est une photo
    if (contribution.type === 'photo' && contribution.imageData) {
      await processImage(contribution);
    }
    
    // Ajouter à entries
    entries.entries.unshift(contribution); // Ajouter au début (plus récent)
    
    console.log(`✅ Contribution ${contribution.id} traitée`);
    
  } catch (error) {
    console.error(`❌ Erreur traitement issue #${issue.number}:`, error);
  }
}

function parseIssueBody(body) {
  // Parser le format markdown de l'issue
  const contribution = {};
  
  // Extraire les champs avec regex pour plus de flexibilité
  const typeMatch = body.match(/\*\*Type:\*\*\s*([^\n]+)/);
  if (typeMatch) contribution.type = typeMatch[1].trim();
  
  const nameMatch = body.match(/\*\*Nom:\*\*\s*([^\n]+)/);
  if (nameMatch) contribution.displayName = nameMatch[1].trim();
  
  const locationMatch = body.match(/\*\*Lieu:\*\*\s*([^\n]+)/);
  if (locationMatch) contribution.locationId = locationMatch[1].trim();
  
  const eventMatch = body.match(/\*\*Événement:\*\*\s*([^\n]+)/);
  if (eventMatch) contribution.eventId = eventMatch[1].trim();
  
  // Chercher le contenu/description/témoignage (peut être multi-ligne)
  const contentMatch = body.match(/\*\*(?:Description|Contenu|Témoignage):\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]*)*)/);
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
  
  // Extraire l'image
  const imageMatch = body.match(/data:image\/[^;]+;base64,([^)]+)/);
  if (imageMatch) {
    contribution.imageData = imageMatch[1];
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

main();
