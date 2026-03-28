const sanitizeIssuer = (issuer: string) => issuer.replace(/\/$/, "");

function readRequired(name: string) {
  const value = process.env[name];

  if (!value) {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      if (name === "NEXTAUTH_URL") {
        return "http://localhost:8060";
      }
      return `test-${name.toLowerCase()}`;
    }
    throw new Error(`缺少必要环境变量: ${name}`);
  }

  return value;
}

export function getAuthentikConfig() {
  return {
    issuer: sanitizeIssuer(readRequired("AUTHENTIK_ISSUER")),
    clientId: readRequired("AUTHENTIK_CLIENT_ID"),
    clientSecret: readRequired("AUTHENTIK_CLIENT_SECRET"),
    logoutRedirectUrl:
      process.env.AUTHENTIK_LOGOUT_REDIRECT_URL ||
      `${readRequired("NEXTAUTH_URL").replace(/\/$/, "")}/login`,
    adminEmails: new Set(
      (process.env.AUTHENTIK_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  };
}

export async function getAuthentikLogoutUrl(idTokenHint?: string) {
  const config = getAuthentikConfig();
  const discoveryUrl = `${config.issuer}/.well-known/openid-configuration`;
  const response = await fetch(discoveryUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("无法获取 authentik OIDC 配置");
  }

  const oidcConfig = (await response.json()) as {
    end_session_endpoint?: string;
  };

  if (!oidcConfig.end_session_endpoint) {
    throw new Error("OIDC 配置中缺少 end_session_endpoint");
  }

  const url = new URL(oidcConfig.end_session_endpoint);
  url.searchParams.set(
    "post_logout_redirect_uri",
    config.logoutRedirectUrl
  );

  if (idTokenHint) {
    url.searchParams.set("id_token_hint", idTokenHint);
  }

  return url.toString();
}
