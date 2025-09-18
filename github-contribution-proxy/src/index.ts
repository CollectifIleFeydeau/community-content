/**
 * Worker Cloudflare avec Feature Flag pour déploiement direct
 */

import { updateGitHubPagesDirect, removeFromGitHubPagesDirect } from './direct-deploy';

interface Env {
  GITHUB_TOKEN: string;
  ENABLE_DIRECT_DEPLOY?: string; // Feature flag: "true" pour activer
}

interface CreateContributionData {
  entry: {
    id: string;
    type: string;
    displayName: string;
    content: string;
    imageUrl?: string;
    description?: string;
    timestamp: string;
    moderation: {
      status: 'approved' | 'pending' | 'rejected';
      moderatedAt: string | null;
    };
  };
  sessionId: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/create-contribution' && request.method === 'POST') {
        return await handleCreateContribution(request, env, corsHeaders);
      }

      if (path === '/delete-issue' && request.method === 'POST') {
        return await handleDeleteIssue(request, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  },
};

async function handleCreateContribution(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const data: CreateContributionData = await request.json();
    const { entry } = data;

    // 🚀 FEATURE FLAG: Déploiement direct
    const useDirectDeploy = env.ENABLE_DIRECT_DEPLOY === 'true';
    
    console.log(`[Worker] Mode déploiement: ${useDirectDeploy ? 'DIRECT' : 'WORKFLOW'}`);

    // 1. Créer l'issue GitHub (toujours fait)
    const issueResponse = await createGitHubIssue(entry, env.GITHUB_TOKEN);
    
    if (!issueResponse.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: issueResponse.error 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Si feature flag activée, déployer directement
    if (useDirectDeploy) {
      console.log('[Worker] 🚀 Déploiement direct activé');
      
      const directDeploySuccess = await updateGitHubPagesDirect(
        {
          ...entry,
          thumbnailUrl: entry.imageUrl // Utiliser la même URL pour thumbnail
        }, 
        env.GITHUB_TOKEN
      );

      if (directDeploySuccess) {
        console.log('[Worker] ✅ Déploiement direct réussi');
        return new Response(JSON.stringify({
          success: true,
          message: 'Contribution créée et déployée directement',
          issueNumber: issueResponse.issueNumber,
          deployMethod: 'direct'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log('[Worker] ⚠️ Déploiement direct échoué, fallback sur workflow');
      }
    }

    // 3. Fallback ou mode normal: utiliser les workflows
    console.log('[Worker] 📋 Utilisation des workflows GitHub Actions');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Contribution créée avec succès',
      issueNumber: issueResponse.issueNumber,
      deployMethod: useDirectDeploy ? 'direct-fallback' : 'workflow'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Worker] Erreur création contribution:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function createGitHubIssue(entry: any, githubToken: string): Promise<{ success: boolean; issueNumber?: number; error?: string }> {
  try {
    const title = `${entry.type}: ${entry.displayName}`;
    const body = `**Type:** ${entry.type}
**Nom d'affichage:** ${entry.displayName}
**Description:** ${entry.description || 'Aucune description'}
**Contenu:** ${entry.content || ''}
${entry.imageUrl ? `**Image:** ${entry.imageUrl}` : ''}
**Timestamp:** ${entry.timestamp}
**ID:** ${entry.id}`;

    const response = await fetch('https://api.github.com/repos/CollectifIleFeydeau/community-content/issues', {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker-CollectifFeydeau'
      },
      body: JSON.stringify({
        title,
        body,
        labels: ['contribution', entry.type.toLowerCase()]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `GitHub API Error: ${response.status} ${errorText}` };
    }

    const issueData = await response.json() as { number: number };
    return { success: true, issueNumber: issueData.number };

  } catch (error) {
    return { success: false, error: `Network error: ${error}` };
  }
}

async function handleDeleteIssue(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const requestData = await request.json() as { issueNumber: string };
    const { issueNumber } = requestData;

    // 🚀 FEATURE FLAG: Suppression directe
    const useDirectDeploy = env.ENABLE_DIRECT_DEPLOY === 'true';
    
    console.log(`[Worker] Mode suppression: ${useDirectDeploy ? 'DIRECT' : 'WORKFLOW'}`);

    // 1. Fermer l'issue GitHub (toujours fait)
    const response = await fetch(`https://api.github.com/repos/CollectifIleFeydeau/community-content/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker-CollectifFeydeau'
      },
      body: JSON.stringify({
        state: 'closed'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Erreur ${response.status}: ${errorText}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Si feature flag activée, supprimer directement
    if (useDirectDeploy) {
      console.log('[Worker] 🗑️ Suppression directe activée');
      
      // Extraire l'ID de l'entrée depuis le numéro d'issue
      const entryId = `issue-${issueNumber}`;
      
      const directDeleteSuccess = await removeFromGitHubPagesDirect(entryId, env.GITHUB_TOKEN);

      if (directDeleteSuccess) {
        console.log('[Worker] ✅ Suppression directe réussie');
        return new Response(JSON.stringify({
          success: true,
          message: `Issue #${issueNumber} fermée et supprimée directement`,
          deleteMethod: 'direct'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log('[Worker] ⚠️ Suppression directe échouée, fallback sur workflow');
      }
    }

    // 3. Fallback ou mode normal: utiliser les workflows
    console.log('[Worker] 📋 Utilisation des workflows GitHub Actions');

    return new Response(JSON.stringify({
      success: true,
      message: `Issue #${issueNumber} fermée avec succès`,
      deleteMethod: useDirectDeploy ? 'direct-fallback' : 'workflow'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Worker] Erreur suppression:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
