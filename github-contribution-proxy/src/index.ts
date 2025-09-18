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
    moderation: string;
    imageUrl?: string; // Added imageUrl property
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
        
        // 🌩️ CLOUDINARY: Utiliser directement l'URL Cloudinary (plus besoin d'upload vers GitHub)
        // Les images sont hébergées sur Cloudinary, pas sur GitHub
        // Format URL: https://res.cloudinary.com/dpatqkgsc/image/upload/v{version}/{public_id}.{format}
        let imageUrl = entry.imageUrl;
        if (entry.type === 'photo' && entry.imageUrl) {
          console.log(`🌩️ Image URL Cloudinary reçue: ${imageUrl}`);
        }
        
        // Formater le titre de l'issue
        const title = `${entry.type}: ${entry.displayName}`;
        
        // Formater le corps de l'issue avec toutes les métadonnées
        let body = `**Type:** ${entry.type}
**Nom d'affichage:** ${entry.displayName}
**Description:** ${description}
**Contenu:** ${entry.content}`;

        // Pour les photos, ajouter l'image en premier pour qu'elle soit visible
        if (entry.type === 'photo' && imageUrl) {
          body = `![Photo](${imageUrl})

${body}`;
        }

        // Ajouter les métadonnées techniques
        body += `

---

**Créé le:** ${entry.createdAt}
**Timestamp:** ${entry.timestamp}
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
        
        // Succès - retourner l'ID de l'issue et l'URL de l'image
        const issueResult = await githubResponse.json() as { number: number };
        return new Response(JSON.stringify({
          success: true,
          message: "Contribution créée avec succès",
          issueNumber: issueResult.number,
          imageUrl: imageUrl !== entry.imageUrl ? imageUrl : undefined // Seulement si on a uploadé une nouvelle image
        }), {
          status: 200,
          headers: corsHeaders
        });
        
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
