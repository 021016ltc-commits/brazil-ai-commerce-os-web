import { randomUUID } from "node:crypto";
import { getClient } from "@/lib/database";
import { sealToken, openToken } from "@/lib/secureTokens";
import { currentTenantId } from "@/lib/tenantContext";
import type { ShopeeBindingPublicStatus, ShopeeBindingStatusValue, ShopeeShopBinding } from "@/types";

type BindingRow = {
  binding_id: string;
  tenant_id: string;
  shop_id: string;
  shop_name: string | null;
  region: string | null;
  partner_id: string;
  access_token: string;
  refresh_token: string;
  token_expire_at: string | null;
  binding_status: ShopeeBindingStatusValue;
  bound_at: string;
  updated_at: string;
  last_sync_at: string | null;
};

type SaveBindingInput = {
  shop_id: string;
  shop_name?: string | null;
  region?: string | null;
  partner_id: string;
  access_token: string;
  refresh_token: string;
  token_expire_at?: string | null;
  binding_status?: ShopeeBindingStatusValue;
};

function nowIso() {
  return new Date().toISOString();
}

function rowToBinding(row: BindingRow): ShopeeShopBinding {
  return {
    ...row,
    access_token: openToken(row.access_token),
    refresh_token: openToken(row.refresh_token),
  };
}

function configuredForOfficialBinding() {
  return Boolean(
    (process.env.SHOPEE_PARTNER_ID?.trim() || process.env.SHOPEE_CLIENT_ID?.trim() || process.env.SHOPEE_API_KEY?.trim()) &&
      (process.env.SHOPEE_PARTNER_KEY?.trim() || process.env.SHOPEE_CLIENT_SECRET?.trim() || process.env.SHOPEE_SECRET?.trim()),
  );
}

export async function ensureShopeeBindingStorage() {
  const client = await getClient();

  if (client.mode === "postgres") {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shopee_shop_bindings (
        binding_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'demo_tenant',
        shop_id TEXT NOT NULL,
        shop_name TEXT,
        region TEXT,
        partner_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expire_at TEXT,
        binding_status TEXT NOT NULL DEFAULT 'bound',
        bound_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_sync_at TEXT,
        UNIQUE(tenant_id, shop_id)
      )
    `);
    return client.mode;
  }

  if (client.mode === "sqlite") {
    await client.withSQLite((db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS shopee_shop_bindings (
          binding_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'demo_tenant',
          shop_id TEXT NOT NULL,
          shop_name TEXT,
          region TEXT,
          partner_id TEXT NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expire_at DATETIME,
          binding_status TEXT NOT NULL DEFAULT 'bound',
          bound_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          last_sync_at DATETIME,
          UNIQUE(tenant_id, shop_id)
        )
      `);
    }, false);
  }

  return client.mode;
}

export async function saveShopeeShopBinding(input: SaveBindingInput) {
  const client = await getClient();
  const tenantId = currentTenantId();
  const timestamp = nowIso();
  const payload = {
    binding_id: `shopee_binding_${randomUUID()}`,
    tenant_id: tenantId,
    shop_id: input.shop_id,
    shop_name: input.shop_name ?? null,
    region: input.region ?? "BR",
    partner_id: input.partner_id,
    access_token: sealToken(input.access_token),
    refresh_token: sealToken(input.refresh_token),
    token_expire_at: input.token_expire_at ?? null,
    binding_status: input.binding_status ?? "bound",
    bound_at: timestamp,
    updated_at: timestamp,
    last_sync_at: null,
  };

  await ensureShopeeBindingStorage();

  if (client.mode === "postgres") {
    const result = await client.query<BindingRow>(
      `INSERT INTO shopee_shop_bindings (
         binding_id, tenant_id, shop_id, shop_name, region, partner_id, access_token, refresh_token,
         token_expire_at, binding_status, bound_at, updated_at, last_sync_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (tenant_id, shop_id) DO UPDATE SET
         shop_name = EXCLUDED.shop_name,
         region = EXCLUDED.region,
         partner_id = EXCLUDED.partner_id,
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expire_at = EXCLUDED.token_expire_at,
         binding_status = EXCLUDED.binding_status,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        payload.binding_id,
        payload.tenant_id,
        payload.shop_id,
        payload.shop_name,
        payload.region,
        payload.partner_id,
        payload.access_token,
        payload.refresh_token,
        payload.token_expire_at,
        payload.binding_status,
        payload.bound_at,
        payload.updated_at,
        payload.last_sync_at,
      ],
    );
    return rowToBinding(result.rows[0]);
  }

  if (client.mode === "sqlite") {
    await client.withSQLite((db) => {
      db
        .prepare(
          `INSERT INTO shopee_shop_bindings (
             binding_id, tenant_id, shop_id, shop_name, region, partner_id, access_token, refresh_token,
             token_expire_at, binding_status, bound_at, updated_at, last_sync_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, shop_id) DO UPDATE SET
             shop_name = excluded.shop_name,
             region = excluded.region,
             partner_id = excluded.partner_id,
             access_token = excluded.access_token,
             refresh_token = excluded.refresh_token,
             token_expire_at = excluded.token_expire_at,
             binding_status = excluded.binding_status,
             updated_at = excluded.updated_at`,
        )
        .run(
          payload.binding_id,
          payload.tenant_id,
          payload.shop_id,
          payload.shop_name,
          payload.region,
          payload.partner_id,
          payload.access_token,
          payload.refresh_token,
          payload.token_expire_at,
          payload.binding_status,
          payload.bound_at,
          payload.updated_at,
          payload.last_sync_at,
        );
    }, false);
  }

  const binding = await getActiveShopeeShopBinding();
  if (!binding) throw new Error("Shopee binding was not saved.");
  return binding;
}

export async function getActiveShopeeShopBinding() {
  await ensureShopeeBindingStorage();
  const client = await getClient();
  const tenantId = currentTenantId();

  if (client.mode === "postgres") {
    const result = await client.query<BindingRow>(
      `SELECT *
         FROM shopee_shop_bindings
        WHERE tenant_id = $1 AND binding_status IN ('bound', 'expired')
        ORDER BY updated_at DESC
        LIMIT 1`,
      [tenantId],
    );
    return result.rows[0] ? rowToBinding(result.rows[0]) : null;
  }

  if (client.mode === "sqlite") {
    return client.withSQLite((db) => {
      const row = db
        .prepare(
          `SELECT *
             FROM shopee_shop_bindings
            WHERE tenant_id = ? AND binding_status IN ('bound', 'expired')
            ORDER BY updated_at DESC
            LIMIT 1`,
        )
        .get(tenantId) as BindingRow | undefined;
      return row ? rowToBinding(row) : null;
    });
  }

  return null;
}

export async function markShopeeBindingLastSync(shopId: string, syncedAt = nowIso()) {
  await ensureShopeeBindingStorage();
  const client = await getClient();
  const tenantId = currentTenantId();

  if (client.mode === "postgres") {
    await client.query(
      `UPDATE shopee_shop_bindings
          SET last_sync_at = $1, updated_at = $1, binding_status = 'bound'
        WHERE tenant_id = $2 AND shop_id = $3`,
      [syncedAt, tenantId, shopId],
    );
    return;
  }

  if (client.mode === "sqlite") {
    await client.withSQLite((db) => {
      db
        .prepare(
          `UPDATE shopee_shop_bindings
              SET last_sync_at = ?, updated_at = ?, binding_status = 'bound'
            WHERE tenant_id = ? AND shop_id = ?`,
        )
        .run(syncedAt, syncedAt, tenantId, shopId);
    }, false);
  }
}

export async function updateShopeeBindingTokens(params: {
  shop_id: string;
  access_token: string;
  refresh_token: string;
  token_expire_at?: string | null;
}) {
  await ensureShopeeBindingStorage();
  const client = await getClient();
  const tenantId = currentTenantId();
  const timestamp = nowIso();
  const sealedAccessToken = sealToken(params.access_token);
  const sealedRefreshToken = sealToken(params.refresh_token);

  if (client.mode === "postgres") {
    await client.query(
      `UPDATE shopee_shop_bindings
          SET access_token = $1,
              refresh_token = $2,
              token_expire_at = $3,
              binding_status = 'bound',
              updated_at = $4
        WHERE tenant_id = $5 AND shop_id = $6`,
      [sealedAccessToken, sealedRefreshToken, params.token_expire_at ?? null, timestamp, tenantId, params.shop_id],
    );
    return;
  }

  if (client.mode === "sqlite") {
    await client.withSQLite((db) => {
      db
        .prepare(
          `UPDATE shopee_shop_bindings
              SET access_token = ?,
                  refresh_token = ?,
                  token_expire_at = ?,
                  binding_status = 'bound',
                  updated_at = ?
            WHERE tenant_id = ? AND shop_id = ?`,
        )
        .run(sealedAccessToken, sealedRefreshToken, params.token_expire_at ?? null, timestamp, tenantId, params.shop_id);
    }, false);
  }
}

export async function markShopeeBindingStatus(shopId: string, status: ShopeeBindingStatusValue) {
  await ensureShopeeBindingStorage();
  const client = await getClient();
  const tenantId = currentTenantId();
  const timestamp = nowIso();

  if (client.mode === "postgres") {
    await client.query(
      `UPDATE shopee_shop_bindings SET binding_status = $1, updated_at = $2 WHERE tenant_id = $3 AND shop_id = $4`,
      [status, timestamp, tenantId, shopId],
    );
    return;
  }

  if (client.mode === "sqlite") {
    await client.withSQLite((db) => {
      db
        .prepare("UPDATE shopee_shop_bindings SET binding_status = ?, updated_at = ? WHERE tenant_id = ? AND shop_id = ?")
        .run(status, timestamp, tenantId, shopId);
    }, false);
  }
}

export async function getShopeeBindingStatus(authUrl: string | null = null): Promise<ShopeeBindingPublicStatus> {
  if (!configuredForOfficialBinding()) {
    return {
      configured: false,
      bound: false,
      status: "unbound",
      shop_id: null,
      shop_name: null,
      region: null,
      token_expire_at: null,
      last_sync_at: null,
      auth_url: null,
      message: "请先配置 Shopee Partner ID 和 Partner Key。",
    };
  }

  const binding = await getActiveShopeeShopBinding().catch(() => null);

  if (!binding) {
    return {
      configured: true,
      bound: false,
      status: "unbound",
      shop_id: null,
      shop_name: null,
      region: null,
      token_expire_at: null,
      last_sync_at: null,
      auth_url: authUrl,
      message: "尚未绑定 Shopee 店铺。",
    };
  }

  return {
    configured: true,
    bound: binding.binding_status === "bound" || binding.binding_status === "expired",
    status: binding.binding_status,
    shop_id: binding.shop_id,
    shop_name: binding.shop_name,
    region: binding.region,
    token_expire_at: binding.token_expire_at,
    last_sync_at: binding.last_sync_at,
    auth_url: authUrl,
    message: binding.binding_status === "bound" ? "Shopee 店铺已绑定。" : "Shopee 授权需要刷新。",
  };
}
