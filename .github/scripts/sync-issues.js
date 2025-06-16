const fs = require('fs').promises;
const path = require('path');
const { Octokit } = require('@octokit/rest');

// Configuration
const REPO_OWNER = 'CollectifIleFeydeau';
const REPO_NAME = 'community-content';
const ENTRIES_FILE_PATH = 'entries.json';

// Initialiser Octokit avec le token GitHub fourni par l'action
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * Convertit une issue GitHub en entrée communautaire
 */
function convertIssueToEntry(issue) {
  // Déterminer le type d'entrée
  const isPhoto = issue.labels.some(label => label.name === 'photo');
  const isTestimonial = issue.labels.some(label => label.name === 'testimonial');
  
  if (!isPhoto && !isTestimonial) {
    console.log(`Issue #${issue.number} ignorée (pas de label photo/testimonial)`);
    return null;
  }
  
  const type = isPhoto ? 'photo' : 'testimonial';
  const body = issue.body || '';
  
  // Extraire les données selon le type
  let entry = {
    id: `issue-${issue.number}`,
    type,
    displayName: 'Anonyme',
    sessionId: '',
    createdAt: issue.created_at,
    timestamp: issue.created_at,
    likes: 0,
    likedBy: [],
    moderation: {
      status: issue.state === 'open' ? 'approved' : 'rejected',
      moderatedAt: issue.updated_at
    }
  };
  
  // Extraire le nom du contributeur
  const nameMatch = body.match(/\*\*Contributeur:\*\*\s*([^\n]+)/);
  if (nameMatch && nameMatch[1]) {
    entry.displayName = nameMatch[1];
  }
  
  if (type === 'photo') {
    // Extraire l'image
    const imageMatch = body.match(/!\[Image\]\((data:image\/[^;]+;base64,[^)]+)\)/);
    if (imageMatch && imageMatch[1]) {
      entry.imageUrl = imageMatch[1];
      entry.thumbnailUrl = imageMatch[1]; // Même image pour la miniature
    }
    
    // Extraire la description
    const descMatch = body.match(/\*\*Description:\*\*\s*([^\n]+)/);
    if (descMatch && descMatch[1]) {
      entry.description = descMatch[1];
    }
  } else {
    // Pour un témoignage, prendre tout le contenu avant les métadonnées
    const contentMatch = body.match(/([\s\S]+?)(?:\n\n---\n\n|$)/);
    if (contentMatch && contentMatch[1]) {
      entry.content = contentMatch[1].trim();
    } else {
      entry.content = body.trim();
    }
  }
  
  return entry;
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('Démarrage de la synchronisation des issues vers entries.json...');
    
    // Lire le fichier entries.json existant ou créer un nouveau
    let entriesData;
    try {
      const fileContent = await fs.readFile(ENTRIES_FILE_PATH, 'utf8');
      entriesData = JSON.parse(fileContent);
      console.log(`Fichier ${ENTRIES_FILE_PATH} lu avec succès. ${entriesData.entries.length} entrées existantes.`);
    } catch (error) {
      console.log(`Création d'un nouveau fichier ${ENTRIES_FILE_PATH}`);
      entriesData = {
        lastUpdated: new Date().toISOString(),
        entries: []
      };
    }
    
    // Récupérer toutes les issues (ouvertes et fermées)
    const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'all',
      per_page: 100
    });
    
    console.log(`${issues.length} issues récupérées depuis le dépôt.`);
    
    // Filtrer pour ne garder que les vraies issues (pas les pull requests)
    const realIssues = issues.filter(issue => !issue.pull_request);
    console.log(`${realIssues.length} issues (sans les pull requests).`);
    
    // Convertir les issues en entrées
    const entriesFromIssues = [];
    for (const issue of realIssues) {
      const entry = convertIssueToEntry(issue);
      if (entry) {
        entriesFromIssues.push(entry);
      }
    }
    
    console.log(`${entriesFromIssues.length} entrées créées à partir des issues.`);
    
    // Remplacer les entrées existantes par celles des issues
    // On garde uniquement les entrées qui ne sont pas issues d'issues GitHub
    const nonIssueEntries = entriesData.entries.filter(entry => !entry.id.startsWith('issue-'));
    
    // Fusionner les entrées
    entriesData.entries = [...nonIssueEntries, ...entriesFromIssues];
    entriesData.lastUpdated = new Date().toISOString();
    
    console.log(`Total de ${entriesData.entries.length} entrées après fusion.`);
    
    // Écrire le fichier mis à jour
    await fs.writeFile(ENTRIES_FILE_PATH, JSON.stringify(entriesData, null, 2), 'utf8');
    console.log(`Fichier ${ENTRIES_FILE_PATH} mis à jour avec succès.`);
    
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
    process.exit(1);
  }
}

// Exécuter la fonction principale
main();
