var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/direct-deploy.ts
async function updateGitHubPagesDirect(entry, githubToken) {
  try {
    console.log("[DirectDeploy] D\xE9marrage du d\xE9ploiement direct pour:", entry.id);
    const currentFileResponse = await fetch(
      "https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json?ref=gh-pages",
      {
        headers: {
          "Authorization": `token ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Cloudflare-Worker-DirectDeploy"
        }
      }
    );
    if (!currentFileResponse.ok) {
      console.error("[DirectDeploy] Erreur r\xE9cup\xE9ration fichier:", currentFileResponse.status);
      return false;
    }
    const currentFileData = await currentFileResponse.json();
    const currentContent = JSON.parse(atob(currentFileData.content));
    if (!currentContent.entries) {
      currentContent.entries = [];
    }
    const existingIndex = currentContent.entries.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      currentContent.entries[existingIndex] = entry;
      console.log("[DirectDeploy] Entr\xE9e mise \xE0 jour:", entry.id);
    } else {
      currentContent.entries.unshift(entry);
      console.log("[DirectDeploy] Nouvelle entr\xE9e ajout\xE9e:", entry.id);
    }
    currentContent.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    const newContent = btoa(JSON.stringify(currentContent, null, 2));
    const commitResponse = await fetch(
      "https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json",
      {
        method: "PUT",
        headers: {
          "Authorization": `token ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "Cloudflare-Worker-DirectDeploy"
        },
        body: JSON.stringify({
          message: `\u{1F680} Direct deploy: Add ${entry.type} "${entry.displayName}" [${entry.id}]`,
          content: newContent,
          sha: currentFileData.sha,
          branch: "gh-pages"
        })
      }
    );
    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      console.error("[DirectDeploy] Erreur commit:", commitResponse.status, errorText);
      return false;
    }
    console.log("[DirectDeploy] \u2705 D\xE9ploiement direct r\xE9ussi pour:", entry.id);
    return true;
  } catch (error) {
    console.error("[DirectDeploy] Erreur:", error);
    return false;
  }
}
__name(updateGitHubPagesDirect, "updateGitHubPagesDirect");
async function removeFromGitHubPagesDirect(entryId, githubToken) {
  try {
    console.log("[DirectDeploy] D\xE9marrage de la suppression directe pour:", entryId);
    const currentFileResponse = await fetch(
      "https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json?ref=gh-pages",
      {
        headers: {
          "Authorization": `token ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Cloudflare-Worker-DirectDeploy"
        }
      }
    );
    if (!currentFileResponse.ok) {
      console.error("[DirectDeploy] Erreur r\xE9cup\xE9ration fichier:", currentFileResponse.status);
      return false;
    }
    const currentFileData = await currentFileResponse.json();
    const currentContent = JSON.parse(atob(currentFileData.content));
    if (!currentContent.entries) {
      console.log("[DirectDeploy] Aucune entr\xE9e trouv\xE9e");
      return true;
    }
    const entryIndex = currentContent.entries.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) {
      console.log("[DirectDeploy] Entr\xE9e non trouv\xE9e:", entryId);
      return true;
    }
    currentContent.entries[entryIndex].moderation = {
      status: "rejected",
      moderatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    console.log("[DirectDeploy] Entr\xE9e marqu\xE9e comme rejected:", entryId);
    currentContent.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    const newContent = btoa(JSON.stringify(currentContent, null, 2));
    const commitResponse = await fetch(
      "https://api.github.com/repos/CollectifIleFeydeau/1Hall1Artiste/contents/data/community-content.json",
      {
        method: "PUT",
        headers: {
          "Authorization": `token ${githubToken}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "Cloudflare-Worker-DirectDeploy"
        },
        body: JSON.stringify({
          message: `\u{1F5D1}\uFE0F Direct delete: Mark as rejected [${entryId}]`,
          content: newContent,
          sha: currentFileData.sha,
          branch: "gh-pages"
        })
      }
    );
    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      console.error("[DirectDeploy] Erreur commit suppression:", commitResponse.status, errorText);
      return false;
    }
    console.log("[DirectDeploy] \u2705 Suppression directe r\xE9ussie pour:", entryId);
    return true;
  } catch (error) {
    console.error("[DirectDeploy] Erreur suppression:", error);
    return false;
  }
}
__name(removeFromGitHubPagesDirect, "removeFromGitHubPagesDirect");

// src/index.ts
var src_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path === "/create-contribution" && request.method === "POST") {
        return await handleCreateContribution(request, env, corsHeaders);
      }
      if (path === "/delete-issue" && request.method === "POST") {
        return await handleDeleteIssue(request, env, corsHeaders);
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
async function handleCreateContribution(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { entry } = data;
    const useDirectDeploy = env.ENABLE_DIRECT_DEPLOY === "true";
    console.log(`[Worker] Mode d\xE9ploiement: ${useDirectDeploy ? "DIRECT" : "WORKFLOW"}`);
    const issueResponse = await createGitHubIssue(entry, env.GITHUB_TOKEN);
    if (!issueResponse.success) {
      return new Response(JSON.stringify({
        success: false,
        error: issueResponse.error
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (useDirectDeploy) {
      console.log("[Worker] \u{1F680} D\xE9ploiement direct activ\xE9");
      const directDeploySuccess = await updateGitHubPagesDirect(
        {
          ...entry,
          thumbnailUrl: entry.imageUrl
          // Utiliser la même URL pour thumbnail
        },
        env.GITHUB_TOKEN
      );
      if (directDeploySuccess) {
        console.log("[Worker] \u2705 D\xE9ploiement direct r\xE9ussi");
        return new Response(JSON.stringify({
          success: true,
          message: "Contribution cr\xE9\xE9e et d\xE9ploy\xE9e directement",
          issueNumber: issueResponse.issueNumber,
          deployMethod: "direct"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else {
        console.log("[Worker] \u26A0\uFE0F D\xE9ploiement direct \xE9chou\xE9, fallback sur workflow");
      }
    }
    console.log("[Worker] \u{1F4CB} Utilisation des workflows GitHub Actions");
    return new Response(JSON.stringify({
      success: true,
      message: "Contribution cr\xE9\xE9e avec succ\xE8s",
      issueNumber: issueResponse.issueNumber,
      deployMethod: useDirectDeploy ? "direct-fallback" : "workflow"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Worker] Erreur cr\xE9ation contribution:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Erreur interne du serveur"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleCreateContribution, "handleCreateContribution");
async function createGitHubIssue(entry, githubToken) {
  try {
    const title = `${entry.type}: ${entry.displayName}`;
    const body = `**Type:** ${entry.type}
**Nom d'affichage:** ${entry.displayName}
**Description:** ${entry.description || "Aucune description"}
**Contenu:** ${entry.content || ""}
${entry.imageUrl ? `**Image:** ${entry.imageUrl}` : ""}
**Timestamp:** ${entry.timestamp}
**ID:** ${entry.id}`;
    const response = await fetch("https://api.github.com/repos/CollectifIleFeydeau/community-content/issues", {
      method: "POST",
      headers: {
        "Authorization": `token ${githubToken}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
      },
      body: JSON.stringify({
        title,
        body,
        labels: ["contribution", entry.type.toLowerCase()]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `GitHub API Error: ${response.status} ${errorText}` };
    }
    const issueData = await response.json();
    return { success: true, issueNumber: issueData.number };
  } catch (error) {
    return { success: false, error: `Network error: ${error}` };
  }
}
__name(createGitHubIssue, "createGitHubIssue");
async function handleDeleteIssue(request, env, corsHeaders) {
  try {
    const requestData = await request.json();
    const { issueNumber } = requestData;
    const useDirectDeploy = env.ENABLE_DIRECT_DEPLOY === "true";
    console.log(`[Worker] Mode suppression: ${useDirectDeploy ? "DIRECT" : "WORKFLOW"}`);
    const response = await fetch(`https://api.github.com/repos/CollectifIleFeydeau/community-content/issues/${issueNumber}`, {
      method: "PATCH",
      headers: {
        "Authorization": `token ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Cloudflare-Worker-CollectifFeydeau"
      },
      body: JSON.stringify({
        state: "closed"
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        success: false,
        error: `Erreur ${response.status}: ${errorText}`
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (useDirectDeploy) {
      console.log("[Worker] \u{1F5D1}\uFE0F Suppression directe activ\xE9e");
      const entryId = `issue-${issueNumber}`;
      const directDeleteSuccess = await removeFromGitHubPagesDirect(entryId, env.GITHUB_TOKEN);
      if (directDeleteSuccess) {
        console.log("[Worker] \u2705 Suppression directe r\xE9ussie");
        return new Response(JSON.stringify({
          success: true,
          message: `Issue #${issueNumber} ferm\xE9e et supprim\xE9e directement`,
          deleteMethod: "direct"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } else {
        console.log("[Worker] \u26A0\uFE0F Suppression directe \xE9chou\xE9e, fallback sur workflow");
      }
    }
    console.log("[Worker] \u{1F4CB} Utilisation des workflows GitHub Actions");
    return new Response(JSON.stringify({
      success: true,
      message: `Issue #${issueNumber} ferm\xE9e avec succ\xE8s`,
      deleteMethod: useDirectDeploy ? "direct-fallback" : "workflow"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Worker] Erreur suppression:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Erreur interne du serveur"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleDeleteIssue, "handleDeleteIssue");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-kdPttX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-kdPttX/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
