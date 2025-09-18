/**
 * Déploiement direct sur GitHub Pages (Feature Flag)
 * 
 * Cette fonction permet de mettre à jour directement gh-pages
 * sans passer par les workflows GitHub Actions
 */

interface DirectDeployEntry {
  id: string;
  type: string;
  displayName: string;
  content: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  timestamp: string;
  moderation: {
    status: 'approved' | 'pending' | 'rejected';
    moderatedAt: string | null;
  };
}

/**
 * Met à jour directement le fichier community-content.json sur gh-pages
 */
export async function updateGitHubPagesDirect(entry: DirectDeployEntry, githubToken: string): Promise<boolean> {
  try {
    console.log('[DirectDeploy] Démarrage du déploiement direct pour:', entry.id);
    
    // 1. Récupérer le fichier actuel depuis gh-pages
    const currentFileResponse = await fetch(
      'https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json?ref=gh-pages',
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker-DirectDeploy'
        }
      }
    );

    if (!currentFileResponse.ok) {
      console.error('[DirectDeploy] Erreur récupération fichier:', currentFileResponse.status);
      return false;
    }

    const currentFileData = await currentFileResponse.json() as { content: string; sha: string };
    
    // 2. Décoder et parser le contenu actuel
    const currentContent = JSON.parse(atob(currentFileData.content));
    
    // 3. Ajouter la nouvelle entrée au début
    if (!currentContent.entries) {
      currentContent.entries = [];
    }
    
    // Vérifier si l'entrée existe déjà
    const existingIndex = currentContent.entries.findIndex((e: any) => e.id === entry.id);
    if (existingIndex >= 0) {
      // Mettre à jour l'entrée existante
      currentContent.entries[existingIndex] = entry;
      console.log('[DirectDeploy] Entrée mise à jour:', entry.id);
    } else {
      // Ajouter nouvelle entrée
      currentContent.entries.unshift(entry);
      console.log('[DirectDeploy] Nouvelle entrée ajoutée:', entry.id);
    }
    
    // Mettre à jour le timestamp
    currentContent.lastUpdated = new Date().toISOString();
    
    // 4. Encoder le nouveau contenu
    const newContent = btoa(JSON.stringify(currentContent, null, 2));
    
    // 5. Commit sur gh-pages
    const commitResponse = await fetch(
      'https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json',
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker-DirectDeploy'
        },
        body: JSON.stringify({
          message: `🚀 Direct deploy: Add ${entry.type} "${entry.displayName}" [${entry.id}]`,
          content: newContent,
          sha: currentFileData.sha,
          branch: 'gh-pages'
        })
      }
    );

    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      console.error('[DirectDeploy] Erreur commit:', commitResponse.status, errorText);
      return false;
    }

    console.log('[DirectDeploy] ✅ Déploiement direct réussi pour:', entry.id);
    return true;
    
  } catch (error) {
    console.error('[DirectDeploy] Erreur:', error);
    return false;
  }
}

/**
 * Supprime directement une entrée du fichier community-content.json sur gh-pages
 */
export async function removeFromGitHubPagesDirect(entryId: string, githubToken: string): Promise<boolean> {
  try {
    console.log('[DirectDeploy] Démarrage de la suppression directe pour:', entryId);
    
    // 1. Récupérer le fichier actuel depuis gh-pages
    const currentFileResponse = await fetch(
      'https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json?ref=gh-pages',
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker-DirectDeploy'
        }
      }
    );

    if (!currentFileResponse.ok) {
      console.error('[DirectDeploy] Erreur récupération fichier:', currentFileResponse.status);
      return false;
    }

    const currentFileData = await currentFileResponse.json() as { content: string; sha: string };
    
    // 2. Décoder et parser le contenu actuel
    const currentContent = JSON.parse(atob(currentFileData.content));
    
    if (!currentContent.entries) {
      console.log('[DirectDeploy] Aucune entrée trouvée');
      return true; // Pas d'erreur, juste rien à supprimer
    }
    
    // 3. Trouver et marquer l'entrée comme "rejected"
    const entryIndex = currentContent.entries.findIndex((e: any) => e.id === entryId);
    
    if (entryIndex === -1) {
      console.log('[DirectDeploy] Entrée non trouvée:', entryId);
      return true; // Pas d'erreur, entrée déjà supprimée
    }
    
    // Marquer comme rejected au lieu de supprimer complètement
    currentContent.entries[entryIndex].moderation = {
      status: 'rejected',
      moderatedAt: new Date().toISOString()
    };
    
    console.log('[DirectDeploy] Entrée marquée comme rejected:', entryId);
    
    // Mettre à jour le timestamp
    currentContent.lastUpdated = new Date().toISOString();
    
    // 4. Encoder le nouveau contenu
    const newContent = btoa(JSON.stringify(currentContent, null, 2));
    
    // 5. Commit sur gh-pages
    const commitResponse = await fetch(
      'https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json',
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker-DirectDeploy'
        },
        body: JSON.stringify({
          message: `🗑️ Direct delete: Mark as rejected [${entryId}]`,
          content: newContent,
          sha: currentFileData.sha,
          branch: 'gh-pages'
        })
      }
    );

    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      console.error('[DirectDeploy] Erreur commit suppression:', commitResponse.status, errorText);
      return false;
    }

    console.log('[DirectDeploy] ✅ Suppression directe réussie pour:', entryId);
    return true;
    
  } catch (error) {
    console.error('[DirectDeploy] Erreur suppression:', error);
    return false;
  }
}
