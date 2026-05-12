import crypto from "crypto";

const DINGTALK_AUTH_BASE = "https://login.dingtalk.com/oauth2/auth";
const DINGTALK_TOKEN_URL =
  "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
const DINGTALK_USER_INFO_URL =
  "https://api.dingtalk.com/v1.0/contact/users/me";

export function isDingtalkConfigured(): boolean {
  return !!(process.env.DINGTALK_CLIENT_ID && process.env.DINGTALK_CLIENT_SECRET);
}

function getClientId(): string {
  const id = process.env.DINGTALK_CLIENT_ID;
  if (!id) throw new Error("DINGTALK_CLIENT_ID 未配置");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.DINGTALK_CLIENT_SECRET;
  if (!secret) throw new Error("DINGTALK_CLIENT_SECRET 未配置");
  return secret;
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function getCallbackUrl(): string {
  const baseUrl = (
    process.env.NEXTAUTH_URL || "http://localhost:8060"
  ).replace(/\/$/, "");
  return `${baseUrl}/api/auth/dingtalk/callback`;
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    response_type: "code",
    client_id: getClientId(),
    scope: "openid",
    state,
    prompt: "consent",
  });
  return `${DINGTALK_AUTH_BASE}?${params.toString()}`;
}

interface UserAccessTokenResponse {
  accessToken: string;
  refreshToken: string;
  expireIn: number;
}

export async function getUserAccessToken(
  authCode: string
): Promise<UserAccessTokenResponse> {
  const response = await fetch(DINGTALK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: getClientId(),
      clientSecret: getClientSecret(),
      code: authCode,
      grantType: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `获取钉钉 access token 失败: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expireIn: data.expireIn,
  };
}

export interface DingtalkUserInfo {
  openId: string;
  unionId: string;
  nick: string;
  avatarUrl: string;
  mobile: string;
}

export async function getDingtalkUserInfo(
  accessToken: string
): Promise<DingtalkUserInfo> {
  const response = await fetch(DINGTALK_USER_INFO_URL, {
    headers: {
      "x-acs-dingtalk-access-token": accessToken,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `获取钉钉用户信息失败: ${response.status} ${text}`
    );
  }

  const data = await response.json();
  return {
    openId: data.openId,
    unionId: data.unionId ?? "",
    nick: data.nick ?? "",
    avatarUrl: data.avatarUrl ?? "",
    mobile: data.mobile ?? "",
  };
}

// --- Old DingTalk API (for workbench JS SDK authCode) ---

const DINGTALK_OLD_TOKEN_URL = "https://oapi.dingtalk.com/gettoken";
const DINGTALK_OLD_USER_INFO_URL =
  "https://oapi.dingtalk.com/topapi/v2/user/getuserinfo";
const DINGTALK_OLD_USER_DETAIL_URL =
  "https://oapi.dingtalk.com/topapi/v2/user/get";

async function getOldAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    appkey: getClientId(),
    appsecret: getClientSecret(),
  });
  const response = await fetch(`${DINGTALK_OLD_TOKEN_URL}?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取钉钉旧版 access_token 失败: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取钉钉旧版 access_token 失败: ${data.errmsg}`);
  }
  return data.access_token as string;
}

async function getOldUserId(
  accessToken: string,
  authCode: string
): Promise<string> {
  const response = await fetch(
    `${DINGTALK_OLD_USER_INFO_URL}?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: authCode }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取钉钉 userId 失败: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取钉钉 userId 失败: ${data.errmsg}`);
  }
  return data.result.userid as string;
}

async function getOldUserDetail(
  accessToken: string,
  userId: string
): Promise<DingtalkUserInfo> {
  const response = await fetch(
    `${DINGTALK_OLD_USER_DETAIL_URL}?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid: userId }),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`获取钉钉用户详情失败: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (data.errcode !== 0) {
    throw new Error(`获取钉钉用户详情失败: ${data.errmsg}`);
  }
  const result = data.result;
  return {
    openId: result.openId ?? "",
    unionId: result.unionid ?? "",
    nick: result.name ?? "",
    avatarUrl: result.avatar ?? "",
    mobile: result.mobile ?? "",
  };
}

/** Workbench flow: exchange JS SDK authCode via old DingTalk API */
export async function getWorkbenchUserInfo(
  authCode: string
): Promise<DingtalkUserInfo> {
  const accessToken = await getOldAccessToken();
  const userId = await getOldUserId(accessToken, authCode);
  return getOldUserDetail(accessToken, userId);
}
