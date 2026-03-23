import crypto from "crypto";
import { getDb } from "../auth/userStore";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

const KEY_OWNER = "integration_github_owner";
const KEY_OWNER_KIND = "integration_github_owner_kind";
const KEY_TOKEN_ENC = "integration_github_token_enc";

export type GithubOwnerKind = "user" | "org";

function parseKeyMaterial(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set");
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const b = Buffer.from(raw, "base64");
  if (b.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64-encoded)",
    );
  }
  return b;
}

export function encryptSecret(plaintext: string): string {
  const key = parseKeyMaterial();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const key = parseKeyMaterial();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  try {
    parseKeyMaterial();
    return true;
  } catch {
    return false;
  }
}

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.get<{ value: string } | undefined>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM settings WHERE key = ?", key);
}

export async function getStoredGithubIntegration(): Promise<{
  owner: string | null;
  ownerKind: GithubOwnerKind;
  tokenPlain: string | null;
}> {
  const owner = await getSetting(KEY_OWNER);
  const kindRaw = await getSetting(KEY_OWNER_KIND);
  const ownerKind: GithubOwnerKind =
    kindRaw === "org" ? "org" : "user";
  const enc = await getSetting(KEY_TOKEN_ENC);
  let tokenPlain: string | null = null;
  if (enc && isEncryptionConfigured()) {
    try {
      tokenPlain = decryptSecret(enc);
    } catch {
      tokenPlain = null;
    }
  }
  return { owner: owner?.trim() || null, ownerKind, tokenPlain };
}

export async function getResolvedGithubCredentials(): Promise<{
  owner: string | null;
  ownerKind: GithubOwnerKind;
  token: string | null;
}> {
  const envToken = process.env.GITHUB_TOKEN?.trim() || null;
  const envUser = process.env.GITHUB_USERNAME?.trim() || null;
  const envOrg = process.env.GITHUB_ORG?.trim() || null;

  const stored = await getStoredGithubIntegration();

  const token = envToken || stored.tokenPlain;

  let owner: string | null = null;
  let ownerKind: GithubOwnerKind = "user";

  if (envOrg) {
    owner = envOrg;
    ownerKind = "org";
  } else if (envUser) {
    owner = envUser;
    ownerKind = "user";
  } else if (stored.owner) {
    owner = stored.owner;
    ownerKind = stored.ownerKind;
  }

  return { owner, ownerKind, token };
}

export async function getGithubIntegrationMasked(): Promise<{
  owner: string | null;
  ownerKind: GithubOwnerKind;
  hasToken: boolean;
  tokenLast4: string | null;
  encryptionConfigured: boolean;
  lastSyncAt: string | null;
}> {
  const stored = await getStoredGithubIntegration();
  const enc = await getSetting(KEY_TOKEN_ENC);
  const hasDbToken = Boolean(enc);
  const envToken = Boolean(process.env.GITHUB_TOKEN?.trim());
  const hasToken = envToken || (hasDbToken && isEncryptionConfigured());

  let tokenLast4: string | null = null;
  if (stored.tokenPlain && stored.tokenPlain.length >= 4) {
    tokenLast4 = stored.tokenPlain.slice(-4);
  } else if (envToken && process.env.GITHUB_TOKEN) {
    const t = process.env.GITHUB_TOKEN.trim();
    if (t.length >= 4) tokenLast4 = t.slice(-4);
  }

  const lastSyncAt = await getSetting("github_last_sync_at");

  return {
    owner: stored.owner,
    ownerKind: stored.ownerKind,
    hasToken,
    tokenLast4,
    encryptionConfigured: isEncryptionConfigured(),
    lastSyncAt,
  };
}

export type GithubIntegrationPut = {
  owner?: string;
  ownerKind?: GithubOwnerKind;
  token?: string | null;
  clearToken?: boolean;
};

export async function saveGithubIntegration(
  body: GithubIntegrationPut,
): Promise<void> {
  if (body.owner !== undefined) {
    const o = typeof body.owner === "string" ? body.owner.trim() : "";
    if (o) {
      await setSetting(KEY_OWNER, o);
    } else {
      await deleteSetting(KEY_OWNER);
    }
  }

  if (body.ownerKind === "org" || body.ownerKind === "user") {
    await setSetting(KEY_OWNER_KIND, body.ownerKind);
  }

  if (body.clearToken) {
    await deleteSetting(KEY_TOKEN_ENC);
  }

  if (body.token !== undefined && body.token !== null) {
    const t = String(body.token).trim();
    if (t.length > 0) {
      if (!isEncryptionConfigured()) {
        throw new Error(
          "CREDENTIALS_ENCRYPTION_KEY must be set on the server to store a token",
        );
      }
      await setSetting(KEY_TOKEN_ENC, encryptSecret(t));
    }
  }
}
