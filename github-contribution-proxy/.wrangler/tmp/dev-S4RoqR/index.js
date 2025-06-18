var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var src_default = {
  // Fonction principale qui traite toutes les requêtes
  async fetch(request, env, ctx) {
    console.log(`Requ\xEAte re\xE7ue: ${request.method} ${request.url}`);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") {
      console.log("Traitement d'une requ\xEAte OPTIONS (preflight CORS)");
      return new Response(null, {
        status: 204,
        // No Content
        headers: corsHeaders
      });
    }
    if (request.method !== "POST") {
      return new Response("M\xE9thode non autoris\xE9e", {
        status: 405,
        headers: corsHeaders
      });
    }
    try {
      console.log("Traitement d'une requ\xEAte POST");
      const url = new URL(request.url);
      const path = url.pathname;
      const requestData = await request.json();
      let githubResponse;
      if (path === "/create-contribution") {
        const contributionData = requestData;
        if (!contributionData.entry || !contributionData.sessionId) {
          return new Response("Donn\xE9es invalides: entry et sessionId requis", {
            status: 400,
            headers: corsHeaders
          });
        }
        const entry = contributionData.entry;
        console.log(`Cr\xE9ation d'une contribution GitHub: ${entry.displayName} (${entry.type})`);
        const title = `${entry.type}: ${entry.displayName}`;
        const body = `**Type:** ${entry.type}
**Nom d'affichage:** ${entry.displayName}
**Description:** ${entry.description}
**Contenu:** ${entry.content}
**Cr\xE9\xE9 le:** ${entry.createdAt}
**Timestamp:** ${entry.timestamp}
**Likes:** ${entry.likes}
**Mod\xE9ration:** ${entry.moderation}
**ID:** ${entry.id}
**Session:** ${contributionData.sessionId}`;
        const labels = ["contribution"];
        if (entry.type) {
          labels.push(entry.type.toLowerCase());
        }
        if (entry.moderation === "pending") {
          labels.push("moderation-pending");
        }
        try {
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
                title,
                body,
                labels
              })
            }
          );
          if (!githubResponse.ok) {
            console.error(`Erreur lors de la cr\xE9ation de la contribution: ${githubResponse.status}`);
            const errorBody = await githubResponse.text();
            console.error(`D\xE9tail de l'erreur: ${errorBody}`);
            return new Response(`Erreur lors de la cr\xE9ation de la contribution: ${githubResponse.status}
${errorBody}`, {
              status: githubResponse.status,
              headers: corsHeaders
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
          console.error(`Erreur lors de la cr\xE9ation de la contribution: ${errorMessage}`);
          return new Response(`Erreur lors de la cr\xE9ation de la contribution: ${errorMessage}`, {
            status: 500,
            headers: corsHeaders
          });
        }
      } else if (path === "/like-issue") {
        const likeData = requestData;
        if (!likeData.issueNumber || !likeData.sessionId || !likeData.action) {
          return new Response("Donn\xE9es invalides: num\xE9ro d'issue, sessionId et action requis", {
            status: 400,
            headers: corsHeaders
          });
        }
        console.log(`${likeData.action === "like" ? "Like" : "Unlike"} de l'issue GitHub #${likeData.issueNumber} par ${likeData.sessionId}`);
        try {
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
            return new Response(`Erreur lors de la r\xE9cup\xE9ration de l'issue: ${issueResponse.status}`, {
              status: issueResponse.status,
              headers: corsHeaders
            });
          }
          const issue = await issueResponse.json();
          const body = issue.body || "";
          let likesCount = 0;
          let likedBy = [];
          const likesMatch = body.match(/\*\*Likes:\*\*\s*(\d+)/);
          if (likesMatch && likesMatch[1]) {
            likesCount = parseInt(likesMatch[1], 10);
          }
          const likedByMatch = body.match(/\*\*LikedBy:\*\*\s*(.+)/);
          if (likedByMatch && likedByMatch[1]) {
            likedBy = likedByMatch[1].split(",").map((id) => id.trim());
          }
          if (likeData.action === "like") {
            if (!likedBy.includes(likeData.sessionId)) {
              likedBy.push(likeData.sessionId);
              likesCount++;
            }
          } else {
            likedBy = likedBy.filter((id) => id !== likeData.sessionId);
            if (likesCount > 0) likesCount--;
          }
          let newBody = body;
          if (likesMatch) {
            newBody = newBody.replace(/\*\*Likes:\*\*\s*\d+/, `**Likes:** ${likesCount}`);
          } else {
            newBody += `

**Likes:** ${likesCount}`;
          }
          if (likedByMatch) {
            newBody = newBody.replace(/\*\*LikedBy:\*\*\s*.+/, `**LikedBy:** ${likedBy.join(", ")}`);
          } else if (likedBy.length > 0) {
            newBody += `
**LikedBy:** ${likedBy.join(", ")}`;
          }
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
          if (githubResponse.ok) {
            return new Response(JSON.stringify({
              success: true,
              likes: likesCount,
              likedBy,
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
          console.error(`Erreur lors de la gestion du like: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
          return new Response(`Erreur lors de la gestion du like: ${error instanceof Error ? error.message : "Erreur inconnue"}`, {
            status: 500,
            headers: corsHeaders
          });
        }
      } else if (path === "/delete-issue") {
        const deleteData = requestData;
        if (!deleteData.issueNumber) {
          return new Response("Donn\xE9es invalides: num\xE9ro d'issue requis", {
            status: 400,
            headers: corsHeaders
          });
        }
        console.log(`Suppression de l'issue GitHub #${deleteData.issueNumber}`);
        try {
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
            console.error(`Erreur lors de la v\xE9rification de l'issue #${deleteData.issueNumber}: ${checkResponse.status}`);
            const errorBody = await checkResponse.text();
            console.error(`D\xE9tail de l'erreur: ${errorBody}`);
            return new Response(`Erreur lors de la v\xE9rification de l'issue: ${checkResponse.status}
${errorBody}`, {
              status: checkResponse.status,
              headers: corsHeaders
            });
          }
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
            console.error(`D\xE9tail de l'erreur: ${errorBody}`);
            return new Response(`Erreur lors de la fermeture de l'issue: ${githubResponse.status}
${errorBody}`, {
              status: githubResponse.status,
              headers: corsHeaders
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
          console.error(`Erreur lors de la suppression de l'issue #${deleteData.issueNumber}: ${errorMessage}`);
          return new Response(`Erreur lors de la suppression de l'issue: ${errorMessage}`, {
            status: 500,
            headers: corsHeaders
          });
        }
      } else {
        const data = requestData;
        if (!data.title || !data.body) {
          return new Response("Donn\xE9es invalides: titre et corps requis", {
            status: 400,
            headers: corsHeaders
          });
        }
        console.log(`Cr\xE9ation d'une issue GitHub: ${data.title}`);
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
      const githubData = await githubResponse.json();
      console.log(`R\xE9ponse de GitHub: ${githubResponse.status}`);
      return new Response(JSON.stringify(githubData), {
        status: githubResponse.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      console.error(`Erreur: ${errorMessage}`);
      return new Response(`Erreur: ${errorMessage}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

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

// .wrangler/tmp/bundle-Z9kjPy/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-Z9kjPy/middleware-loader.entry.ts
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
