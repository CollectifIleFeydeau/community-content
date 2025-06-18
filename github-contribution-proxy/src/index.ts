/**
 * Proxy sécurisé pour l'API GitHub - Collectif Feydeau
 * 
 * Ce Worker sert de proxy entre le frontend et l'API GitHub pour créer des issues
 * sans exposer le token d'authentification GitHub dans le code client.
 */

// Interface pour l'environnement avec le token GitHub
interface Env {
  GITHUB_TOKEN: string;
}

// Interface pour les données de contribution
interface ContributionData {
  title: string;
  body: string;
  labels?: string[];
}

// Interface pour les données de suppression d'issue
interface DeleteIssueData {
  issueNumber: string;
}

// Interface pour les données de like/unlike
interface LikeIssueData {
  issueNumber: string;
  sessionId: string;
  action: 'like' | 'unlike';
}

// Interface pour les données de création de contribution
interface CreateContributionData {
  entry: {
    id: string;
    type: string;
    displayName: string;
    content: string;
    description: string;
    createdAt: string;
    timestamp: number;
    likes: number;
    moderation: string;
  };
  sessionId: string;
}

export default {
  // Fonction principale qui traite toutes les requêtes
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log(`Requête reçue: ${request.method} ${request.url}`);
    
    // Définir les en-têtes CORS pour toutes les réponses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    };

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (request.method === "OPTIONS") {
      console.log("Traitement d'une requête OPTIONS (preflight CORS)");
      return new Response(null, {
        status: 204, // No Content
        headers: corsHeaders
      });
    }

    // Vérifier que c'est une requête POST
    if (request.method !== "POST") {
      return new Response("Méthode non autorisée", { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      console.log("Traitement d'une requête POST");
      
      // Déterminer le type d'opération en fonction de l'URL
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Récupérer les données de la requête
      const requestData = await request.json();
      let githubResponse;
      
      // Traiter les différents types de requêtes
      if (path === "/create-contribution") {
        // Gestion de la création de contribution
        const contributionData = requestData as CreateContributionData;
        
        // Valider les données
        if (!contributionData.entry || !contributionData.sessionId) {
          return new Response("Données invalides: entry et sessionId requis", { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        const entry = contributionData.entry;
        
        // Valider que les champs essentiels ne sont pas vides
        if (!entry.displayName || entry.displayName.trim() === '') {
          return new Response("Données invalides: displayName requis et ne peut pas être vide", { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        // La description est optionnelle, donc on accepte qu'elle soit vide
        const description = entry.description?.trim() || 'Aucune description fournie';
        
        console.log(`Création d'une contribution GitHub: ${entry.displayName} (${entry.type})`);
        
        // Formater le titre de l'issue
        const title = `${entry.type}: ${entry.displayName}`;
        
        // Formater le corps de l'issue avec toutes les métadonnées
        const body = `**Type:** ${entry.type}
**Nom d'affichage:** ${entry.displayName}
**Description:** ${description}
**Contenu:** ${entry.content}
**Créé le:** ${entry.createdAt}
**Timestamp:** ${entry.timestamp}
**Likes:** ${entry.likes}
**Modération:** ${entry.moderation}
**ID:** ${entry.id}
**Session:** ${contributionData.sessionId}`;
        
        // Définir les labels appropriés selon le type de contribution
        const labels = ["contribution"];
        if (entry.type) {
          labels.push(entry.type.toLowerCase());
        }
        if (entry.moderation === 'pending') {
          labels.push("moderation-pending");
        }
        
        try {
          // Créer l'issue GitHub
          githubResponse = await fetch(
            "https://api.github.com/repos/CollectifIleFeydeau/community-content/issues",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${env.GITHUB_TOKEN}`,
                "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
              },
              body: JSON.stringify({
                title: title,
                body: body,
                labels: labels
              })
            }
          );
          
          if (!githubResponse.ok) {
            console.error(`Erreur lors de la création de la contribution: ${githubResponse.status}`);
            const errorBody = await githubResponse.text();
            console.error(`Détail de l'erreur: ${errorBody}`);
            
            return new Response(`Erreur lors de la création de la contribution: ${githubResponse.status}\n${errorBody}`, {
              status: githubResponse.status,
              headers: corsHeaders
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
          console.error(`Erreur lors de la création de la contribution: ${errorMessage}`);
          
          return new Response(`Erreur lors de la création de la contribution: ${errorMessage}`, {
            status: 500,
            headers: corsHeaders
          });
        }
        
      } else if (path === "/like-issue") {
        // Gestion des likes
        const likeData = requestData as LikeIssueData;
        
        // Valider les données
        if (!likeData.issueNumber || !likeData.sessionId || !likeData.action) {
          return new Response("Données invalides: numéro d'issue, sessionId et action requis", { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        console.log(`${likeData.action === 'like' ? 'Like' : 'Unlike'} de l'issue GitHub #${likeData.issueNumber} par ${likeData.sessionId}`);
        
        try {
          // 1. Récupérer l'issue actuelle pour obtenir les données existantes
          const issueResponse = await fetch(
            `https://api.github.com/repos/CollectifIleFeydeau/community-content/issues/${likeData.issueNumber}`,
            {
              headers: {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${env.GITHUB_TOKEN}`,
                "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
              }
            }
          );
          
          if (!issueResponse.ok) {
            return new Response(`Erreur lors de la récupération de l'issue: ${issueResponse.status}`, {
              status: issueResponse.status,
              headers: corsHeaders
            });
          }
          
          const issue = await issueResponse.json() as { body?: string };
          
          // 2. Extraire les données de likes existantes du corps de l'issue
          const body = issue.body || '';
          let likesCount = 0;
          let likedBy: string[] = [];
          
          // Rechercher les métadonnées de likes dans le corps de l'issue
          const likesMatch = body.match(/\*\*Likes:\*\*\s*(\d+)/);
          if (likesMatch && likesMatch[1]) {
            likesCount = parseInt(likesMatch[1], 10);
          }
          
          const likedByMatch = body.match(/\*\*LikedBy:\*\*\s*(.+)/);
          if (likedByMatch && likedByMatch[1]) {
            likedBy = likedByMatch[1].split(',').map((id: string) => id.trim());
          }
          
          // 3. Mettre à jour les données de likes en fonction de l'action
          if (likeData.action === 'like') {
            if (!likedBy.includes(likeData.sessionId)) {
              likedBy.push(likeData.sessionId);
              likesCount++;
            }
          } else { // unlike
            likedBy = likedBy.filter(id => id !== likeData.sessionId);
            if (likesCount > 0) likesCount--;
          }
          
          // 4. Construire le nouveau corps de l'issue avec les données de likes mises à jour
          let newBody = body;
          
          // Mettre à jour ou ajouter le nombre de likes
          if (likesMatch) {
            newBody = newBody.replace(/\*\*Likes:\*\*\s*\d+/, `**Likes:** ${likesCount}`);
          } else {
            // Ajouter à la fin du corps
            newBody += `\n\n**Likes:** ${likesCount}`;
          }
          
          // Mettre à jour ou ajouter la liste des utilisateurs qui ont liké
          if (likedByMatch) {
            newBody = newBody.replace(/\*\*LikedBy:\*\*\s*.+/, `**LikedBy:** ${likedBy.join(', ')}`);
          } else if (likedBy.length > 0) {
            // Ajouter à la fin du corps
            newBody += `\n**LikedBy:** ${likedBy.join(', ')}`;
          }
          
          // 5. Mettre à jour l'issue avec le nouveau corps
          githubResponse = await fetch(
            `https://api.github.com/repos/CollectifIleFeydeau/community-content/issues/${likeData.issueNumber}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${env.GITHUB_TOKEN}`,
                "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
              },
              body: JSON.stringify({
                body: newBody
              })
            }
          );
          
          // 6. Préparer la réponse avec les données mises à jour
          if (githubResponse.ok) {
            return new Response(JSON.stringify({
              success: true,
              likes: likesCount,
              likedBy: likedBy,
              isLikedByCurrentUser: likedBy.includes(likeData.sessionId)
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          }
        } catch (error) {
          console.error(`Erreur lors de la gestion du like: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
          return new Response(`Erreur lors de la gestion du like: ${error instanceof Error ? error.message : 'Erreur inconnue'}`, {
            status: 500,
            headers: corsHeaders
          });
        }
      } else if (path === "/delete-issue") {
        // Suppression d'une issue
        const deleteData = requestData as DeleteIssueData;
        
        // Valider les données
        if (!deleteData.issueNumber) {
          return new Response("Données invalides: numéro d'issue requis", { 
            status: 400,
            headers: corsHeaders
          });
        }
        
        console.log(`Suppression de l'issue GitHub #${deleteData.issueNumber}`);
        
        try {
          // Vérifier d'abord si l'issue existe
          const checkResponse = await fetch(
            `https://api.github.com/repos/CollectifIleFeydeau/community-content/issues/${deleteData.issueNumber}`,
            {
              headers: {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${env.GITHUB_TOKEN}`,
                "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
              }
            }
          );
          
          if (!checkResponse.ok) {
            console.error(`Erreur lors de la vérification de l'issue #${deleteData.issueNumber}: ${checkResponse.status}`);
            const errorBody = await checkResponse.text();
            console.error(`Détail de l'erreur: ${errorBody}`);
            
            return new Response(`Erreur lors de la vérification de l'issue: ${checkResponse.status}\n${errorBody}`, {
              status: checkResponse.status,
              headers: corsHeaders
            });
          }
          
          // Préparer la requête vers l'API GitHub pour fermer l'issue
          githubResponse = await fetch(
            `https://api.github.com/repos/CollectifIleFeydeau/community-content/issues/${deleteData.issueNumber}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${env.GITHUB_TOKEN}`,
                "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
              },
              body: JSON.stringify({
                state: "closed"
              })
            }
          );
          
          if (!githubResponse.ok) {
            console.error(`Erreur lors de la fermeture de l'issue #${deleteData.issueNumber}: ${githubResponse.status}`);
            const errorBody = await githubResponse.text();
            console.error(`Détail de l'erreur: ${errorBody}`);
            
            return new Response(`Erreur lors de la fermeture de l'issue: ${githubResponse.status}\n${errorBody}`, {
              status: githubResponse.status,
              headers: corsHeaders
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
          console.error(`Erreur lors de la suppression de l'issue #${deleteData.issueNumber}: ${errorMessage}`);
          
          return new Response(`Erreur lors de la suppression de l'issue: ${errorMessage}`, {
            status: 500,
            headers: corsHeaders
          });
        }
      } else {
        // Création d'une issue (comportement par défaut)
        const data = requestData as ContributionData;
        
        // Valider les données
        if (!data.title || !data.body) {
          return new Response("Données invalides: titre et corps requis", { 
            status: 400,
            headers: corsHeaders
          });
        }

        console.log(`Création d'une issue GitHub: ${data.title}`);
        
        // Préparer la requête vers l'API GitHub
        githubResponse = await fetch(
          "https://api.github.com/repos/CollectifIleFeydeau/community-content/issues",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/vnd.github.v3+json",
              "Authorization": `token ${env.GITHUB_TOKEN}`,
              "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
            },
            body: JSON.stringify({
              title: data.title,
              body: data.body,
              labels: data.labels || []
            })
          }
        );
      }

      // Récupérer la réponse de GitHub
      const githubData = await githubResponse.json();
      console.log(`Réponse de GitHub: ${githubResponse.status}`);
      
      // Retourner la réponse avec les en-têtes CORS
      return new Response(JSON.stringify(githubData), {
        status: githubResponse.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    } catch (error: unknown) {
      // Gérer les erreurs
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      console.error(`Erreur: ${errorMessage}`);
      return new Response(`Erreur: ${errorMessage}`, { 
        status: 500,
        headers: corsHeaders
      });
    }
  },
};
