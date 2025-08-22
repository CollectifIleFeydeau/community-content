/**
 * Service pour la gestion des contributions communautaires
 * Ce service centralise les interactions avec l'API GitHub pour les contributions
 */

// URL du Worker Cloudflare qui sert de proxy pour les requêtes POST à l'API GitHub
const WORKER_URL = 'https://github-contribution-proxy.collectifilefeydeau.workers.dev';

// Fonction utilitaire pour obtenir le chemin de base en fonction de l'environnement
const getBasePath = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return '/1Hall1Artiste'; // Chemin de base sur GitHub Pages
  }
  return ''; // Chemin de base en local
};

// URL de base pour les données JSON (à adapter selon l'environnement)
const BASE_URL = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
  ? 'https://raw.githubusercontent.com/CollectifIleFeydeau/community-content/main'
  : '/data';

// URL de base pour les images (à adapter selon l'environnement)
const IMAGES_BASE_URL = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
  ? `https://collectifilefeydeau.github.io${getBasePath()}/images`
  : '/images';

// URL de base pour l'API GitHub (pour les requêtes GET publiques)
const API_URL = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
  ? 'https://api.github.com/repos/CollectifIleFeydeau/community-content'
  : typeof process !== 'undefined' && process.env.VITE_USE_API === 'true'
    ? 'https://api.github.com/repos/CollectifIleFeydeau/community-content'
    : '/api';

// Clés pour le stockage local
const COMMUNITY_ENTRIES_KEY = 'community_entries';

/**
 * Récupérer les entrées stockées localement ou renvoyer un tableau vide
 */
const getStoredEntries = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    
    const storedEntries = localStorage.getItem(COMMUNITY_ENTRIES_KEY);
    const entries = storedEntries ? JSON.parse(storedEntries) : [];
    
    return entries;
  } catch (error) {
    console.error('Erreur lors de la récupération des entrées locales:', error);
    return [];
  }
};

/**
 * Sauvegarder les entrées dans le stockage local
 */
const saveEntries = (entries) => {
  try {
    if (typeof localStorage === 'undefined') return;
    
    localStorage.setItem(COMMUNITY_ENTRIES_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des entrées locales:', error);
  }
};

/**
 * Récupère les entrées communautaires depuis le serveur ou le stockage local
 */
async function fetchCommunityEntries() {
  try {
    // En production ou si l'API est activée, récupérer les données depuis l'API GitHub
    if ((typeof window !== 'undefined' && window.location.hostname.includes('github.io')) || 
        (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') || 
        (typeof process !== 'undefined' && process.env.VITE_USE_API === 'true')) {
      
      // Récupérer les données depuis GitHub
      console.log(`[CommunityService] Récupération des données depuis ${BASE_URL}/entries.json`);
      const response = await fetch(`${BASE_URL}/entries.json`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Formater les données pour correspondre à notre structure
      const formattedEntries = data.entries.map(entry => ({
        ...entry
      }));
      
      // Sauvegarder les données dans le stockage local pour une utilisation hors ligne
      saveEntries(formattedEntries);
      
      return formattedEntries;
    }
    
    // En développement, utiliser les données du stockage local
    console.log('[CommunityService] Mode développement: utilisation des données locales');
    return getStoredEntries();
  } catch (error) {
    console.error('Erreur lors de la récupération des entrées communautaires:', error);
    
    // En cas d'erreur, essayer d'utiliser les données du stockage local
    const localEntries = getStoredEntries();
    if (localEntries.length > 0) {
      console.log('[CommunityService] Utilisation des données locales suite à une erreur');
      return localEntries;
    }
    
    throw error;
  }
}

/**
 * Supprime une contribution communautaire
 * @param entryId ID de la contribution à supprimer
 * @returns true si la suppression a réussi, false sinon
 */
async function deleteCommunityEntry(entryId) {
  try {
    console.log(`[CommunityService] Tentative de suppression de la contribution ${entryId}`);
    
    // Extraire le numéro d'issue si l'ID est au format "issue-X"
    let issueNumber = entryId;
    if (entryId.startsWith('issue-')) {
      issueNumber = entryId.replace('issue-', '');
    }
    
    console.log(`[CommunityService] Numéro d'issue extrait: ${issueNumber}`);
    
    // En production ou si l'API est activée, appeler l'API pour supprimer la contribution
    if ((typeof window !== 'undefined' && window.location.hostname.includes('github.io')) || 
        (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') || 
        (typeof process !== 'undefined' && process.env.VITE_USE_API === 'true')) {
      
      console.log(`[CommunityService] Utilisation du Worker Cloudflare pour supprimer l'issue GitHub`);
      
      // En production, utiliser le Worker Cloudflare comme proxy pour l'API GitHub
      const response = await fetch(`${WORKER_URL}/delete-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          issueNumber: issueNumber
        })
      });
      
      // Log de la réponse brute pour le débogage
      console.log(`[CommunityService] Réponse brute: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        console.error(`[CommunityService] Erreur HTTP lors de la suppression: ${response.status}`);
        let errorText = '';
        try {
          errorText = await response.text();
          console.error(`[CommunityService] Détail de l'erreur: ${errorText}`);
        } catch (textError) {
          console.error(`[CommunityService] Impossible de lire le corps de l'erreur:`, textError);
        }
        
        // Même en cas d'erreur, on supprime localement pour que l'UI soit cohérente
        removeEntryFromLocalStorage(entryId);
        return true; // On retourne true pour que l'UI se mette à jour
      }
      
      let responseData;
      try {
        responseData = await response.json();
        console.log(`[CommunityService] Réponse de l'API: ${JSON.stringify(responseData)}`);
      } catch (jsonError) {
        console.warn(`[CommunityService] Impossible de parser la réponse JSON:`, jsonError);
      }
      
      // Supprimer également de localStorage pour une mise à jour immédiate de l'UI
      removeEntryFromLocalStorage(entryId);
      
      // Mettre à jour le fichier entries.json via une autre requête au Worker
      // Cette étape est optionnelle car le Worker pourrait le faire directement,
      // mais cela permet de s'assurer que les données sont synchronisées
      try {
        console.log(`[CommunityService] Mise à jour du cache local après suppression`);
        // Forcer un rechargement des entrées depuis GitHub pour mettre à jour le cache local
        await fetchCommunityEntries();
      } catch (syncError) {
        console.error(`[CommunityService] Erreur lors de la synchronisation après suppression:`, syncError);
        // On ignore cette erreur car la suppression a déjà réussi
      }
      
      return true;
    }
    
    // En développement, supprimer la contribution du localStorage
    console.log(`[CommunityService] Mode développement: suppression locale uniquement`);
    return removeEntryFromLocalStorage(entryId);
  } catch (error) {
    console.error(`[CommunityService] Erreur lors de la suppression de la contribution ${entryId}:`, error);
    // Même en cas d'erreur, on essaie de supprimer localement
    removeEntryFromLocalStorage(entryId);
    return true; // On retourne true pour que l'UI se mette à jour
  }
}

/**
 * Fonction utilitaire pour supprimer une entrée du localStorage
 * @param entryId ID de l'entrée à supprimer
 * @returns true si la suppression a réussi, false sinon
 */
function removeEntryFromLocalStorage(entryId) {
  try {
    if (typeof localStorage === 'undefined') return true;
    
    // Récupérer les entrées actuelles
    const entries = getStoredEntries();
    
    // Filtrer l'entrée à supprimer
    const updatedEntries = entries.filter(entry => entry.id !== entryId);
    
    // Si aucune entrée n'a été supprimée, retourner false
    if (updatedEntries.length === entries.length) {
      console.warn(`[CommunityService] Aucune entrée trouvée avec l'ID ${entryId}`);
      return false;
    }
    
    // Sauvegarder les entrées mises à jour
    saveEntries(updatedEntries);
    
    console.log(`[CommunityService] Entrée ${entryId} supprimée du localStorage`);
    return true;
  } catch (error) {
    console.error(`[CommunityService] Erreur lors de la suppression de l'entrée ${entryId} du localStorage:`, error);
    return false;
  }
}

/**
 * Soumet une nouvelle contribution communautaire
 * @param {Object} params Paramètres de la soumission
 * @returns {Promise<Object>} La contribution créée
 */
async function submitContribution(params) {
  try {
    console.log(`[CommunityService] Soumission d'une nouvelle contribution de type ${params.type}`);    
    
    // Gérer l'upload d'image si présent
    let imageUrl = null;
    if (params.type === 'photo' && params.image) {
      console.log(`[CommunityService] Téléchargement de l'image associée`);      
      imageUrl = await uploadImage(params.image);
      console.log(`[CommunityService] Image téléchargée: ${imageUrl}`);
    }
    
    // En production ou si l'API est activée, envoyer la contribution au Worker Cloudflare
    if ((typeof window !== 'undefined' && window.location.hostname.includes('github.io')) || 
        (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') || 
        (typeof process !== 'undefined' && process.env.VITE_USE_API === 'true')) {
      
      console.log(`[CommunityService] Utilisation du Worker Cloudflare pour créer une issue GitHub`);
      
      // Préparer les données pour l'API
      const payload = {
        title: params.type === 'photo' ? 'Photo contribution' : 'Testimony contribution',
        body: JSON.stringify({
          ...params,
          imageUrl: imageUrl // Ajouter l'URL de l'image si elle a été téléchargée
        }),
        labels: [params.type]
      };
      
      // Envoyer la requête au Worker Cloudflare
      const response = await fetch(`${WORKER_URL}/create-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`[CommunityService] Erreur HTTP lors de la soumission: ${response.status}`);
        throw new Error(`Erreur lors de la soumission: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log(`[CommunityService] Réponse de l'API: ${JSON.stringify(responseData)}`);
      
      // Créer une entrée à partir de la réponse
      const newEntry = {
        id: `issue-${responseData.number}`,
        type: params.type,
        displayName: params.displayName || 'Anonyme',
        createdAt: new Date().toISOString(),
        likes: 0,
        moderation: {
          status: 'approved',
          moderatedAt: new Date().toISOString()
        }
      };
      
      // Ajouter les champs spécifiques selon le type
      if (params.type === 'photo') {
        newEntry.imageUrl = imageUrl;
        newEntry.description = params.description;
      } else if (params.type === 'testimonial') {
        newEntry.content = params.content;
      }
      
      // Ajouter l'entrée au stockage local pour une mise à jour immédiate de l'UI
      const entries = getStoredEntries();
      entries.push(newEntry);
      saveEntries(entries);
      
      return newEntry;
    }
    
    // En développement, créer une entrée locale
    console.log(`[CommunityService] Mode développement: création locale uniquement`);
    
    // Générer un ID unique pour l'entrée locale
    const localId = `local-${Date.now()}`;
    
    // Créer une nouvelle entrée
    const newEntry = {
      id: localId,
      type: params.type,
      displayName: params.displayName || 'Anonyme',
      createdAt: new Date().toISOString(),
      likes: 0,
      moderation: {
        status: 'approved',
        moderatedAt: new Date().toISOString()
      }
    };
    
    // Ajouter les champs spécifiques selon le type
    if (params.type === 'photo') {
      newEntry.imageUrl = imageUrl;
      newEntry.description = params.description;
    } else if (params.type === 'testimonial') {
      newEntry.content = params.content;
    }
    
    // Ajouter l'entrée au stockage local
    const entries = getStoredEntries();
    entries.push(newEntry);
    saveEntries(entries);
    
    return newEntry;
  } catch (error) {
    console.error('Erreur lors de la soumission de la contribution:', error);
    throw error;
  }
}

/**
 * Modère le contenu avant soumission
 * @param {string} text Texte à modérer
 * @returns {Promise<Object>} Résultat de la modération
 */
async function moderateContent(text) {
  try {
    console.log(`[CommunityService] Modération du contenu: ${text.substring(0, 50)}...`);
    
    // En production ou si l'API est activée, utiliser le Worker Cloudflare pour la modération
    if ((typeof window !== 'undefined' && window.location.hostname.includes('github.io')) || 
        (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') || 
        (typeof process !== 'undefined' && process.env.VITE_USE_API === 'true')) {
      
      console.log(`[CommunityService] Utilisation du Worker Cloudflare pour la modération`);
      
      // Envoyer la requête au Worker Cloudflare
      const response = await fetch(`${WORKER_URL}/moderate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
        console.error(`[CommunityService] Erreur HTTP lors de la modération: ${response.status}`);
        throw new Error(`Erreur lors de la modération: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log(`[CommunityService] Réponse de la modération: ${JSON.stringify(responseData)}`);
      
      return responseData;
    }
    
    // En développement, simuler une modération réussie
    console.log(`[CommunityService] Mode développement: modération simulée`);
    
    return {
      isApproved: true,
      reason: null
    };
  } catch (error) {
    console.error('Erreur lors de la modération du contenu:', error);
    throw error;
  }
}

/**
 * Télécharge une image sur le serveur
 * @param {File} file Fichier image à télécharger
 * @returns {Promise<string>} URL de l'image téléchargée
 */
async function uploadImage(file) {
  try {
    console.log(`[CommunityService] Téléchargement de l'image: ${file.name}`);
    
    // En production ou si l'API est activée, utiliser le Worker Cloudflare pour le téléchargement
    if ((typeof window !== 'undefined' && window.location.hostname.includes('github.io')) || 
        (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') || 
        (typeof process !== 'undefined' && process.env.VITE_USE_API === 'true')) {
      
      console.log(`[CommunityService] Utilisation du Worker Cloudflare pour le téléchargement`);
      
      // Créer un FormData pour envoyer le fichier
      const formData = new FormData();
      formData.append('image', file);
      
      // Envoyer la requête au Worker Cloudflare
      const response = await fetch(`${WORKER_URL}/upload-image`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        console.error(`[CommunityService] Erreur HTTP lors du téléchargement: ${response.status}`);
        throw new Error(`Erreur lors du téléchargement: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log(`[CommunityService] Réponse du téléchargement: ${JSON.stringify(responseData)}`);
      
      return responseData.url;
    }
    
    // En développement, simuler un téléchargement réussi avec une URL locale
    console.log(`[CommunityService] Mode développement: téléchargement simulé`);
    
    // Créer une URL locale pour le fichier
    const localUrl = URL.createObjectURL(file);
    console.log(`[CommunityService] URL locale créée: ${localUrl}`);
    
    return localUrl;
  } catch (error) {
    console.error('Erreur lors du téléchargement de l\'image:', error);
    throw error;
  }
}

// Exporter les fonctions pour utilisation dans d'autres modules
module.exports = {
  fetchCommunityEntries,
  deleteCommunityEntry,
  submitContribution,
  moderateContent,
  uploadImage,
  getBasePath,
  BASE_URL,
  IMAGES_BASE_URL,
  API_URL,
  WORKER_URL
};
