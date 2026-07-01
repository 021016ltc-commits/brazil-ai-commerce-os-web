const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || "/opt/brazil-ai-commerce-os/proxy-data";
const BINDING_FILE = path.join(DATA_DIR, "shopee-bindings.json");
const BASE_URL = (process.env.SHOPEE_OPEN_API_BASE_URL || process.env.SHOPEE_API_BASE_URL || "https://partner.shopeemobile.com").replace(/\/$/, "");
const PARTNER_ID = String(process.env.SHOPEE_PARTNER_ID || process.env.SHOPEE_CLIENT_ID || process.env.SHOPEE_API_KEY || "").trim();
const PARTNER_KEY = String(process.env.SHOPEE_PARTNER_KEY || process.env.SHOPEE_CLIENT_SECRET || process.env.SHOPEE_SECRET || "").trim();
const PROXY_AUTH_TOKEN = String(process.env.PROXY_AUTH_TOKEN || "").trim();
const ORDER_WINDOW_DAYS = Math.max(1, Math.min(14, Number(process.env.SHOPEE_ORDER_SYNC_DAYS || 14)));
const ORDER_HISTORY_DAYS = Math.max(
  ORDER_WINDOW_DAYS,
  Math.min(730, Number(process.env.SHOPEE_ORDER_HISTORY_DAYS || process.env.SHOPEE_FULL_ORDER_SYNC_DAYS || 180)),
);
const MAX_SYNC_ITEMS = Math.max(50, Math.min(50000, Number(process.env.SHOPEE_FULL_SYNC_MAX_ITEMS || process.env.SHOPEE_MAX_SYNC_ITEMS || 10000)));
const PAGE_SIZE = Math.max(10, Math.min(100, Number(process.env.SHOPEE_PAGE_SIZE || 50)));
const SERVICE_VERSION = "2026-07-01.full-pagination-v2";

function nowIso() {
  return new Date().toISOString();
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readBindings() {
  try {
    return JSON.parse(fs.readFileSync(BINDING_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeBindings(bindings) {
  ensureDataDir();
  fs.writeFileSync(BINDING_FILE, JSON.stringify(bindings, null, 2));
}

function firstBinding() {
  return readBindings()[0] || null;
}

function saveBinding(binding) {
  const bindings = readBindings();
  const index = bindings.findIndex((item) => String(item.shop_id) === String(binding.shop_id));
  const next = {
    ...binding,
    shop_id: String(binding.shop_id),
    region: binding.region || "BR",
    status: "bound",
    updated_at: nowIso(),
  };
  if (index >= 0) bindings[index] = { ...bindings[index], ...next };
  else bindings.unshift({ created_at: nowIso(), ...next });
  writeBindings(bindings);
  return next;
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function auth(req) {
  if (!PROXY_AUTH_TOKEN) return true;
  return String(req.headers.authorization || "") === `Bearer ${PROXY_AUTH_TOKEN}`;
}

function assertConfigured() {
  if (!PARTNER_ID || !PARTNER_KEY) throw new Error("Shopee Partner ID or Partner Key is not configured.");
}

function sign(pathname, timestamp, accessToken, shopId) {
  const base = `${PARTNER_ID}${pathname}${timestamp}${accessToken || ""}${shopId || ""}`;
  return crypto.createHmac("sha256", PARTNER_KEY).update(base).digest("hex");
}

function signedUrl(pathname, query = {}, binding = null) {
  const timestamp = nowSeconds();
  const url = new URL(pathname, BASE_URL);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", String(timestamp));
  if (binding) {
    url.searchParams.set("access_token", binding.access_token);
    url.searchParams.set("shop_id", String(binding.shop_id));
  }
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  url.searchParams.set("sign", sign(pathname, timestamp, binding && binding.access_token, binding && binding.shop_id));
  return url;
}

async function fetchJson(url, init) {
  const target = url instanceof URL ? url : new URL(String(url));
  const requestOptions = init || {};
  const body = requestOptions.body || "";
  const headers = Object.assign({}, requestOptions.headers || {});
  if (body && !headers["Content-Length"]) headers["Content-Length"] = Buffer.byteLength(body);

  const result = await new Promise((resolve, reject) => {
    const client = target.protocol === "http:" ? http : https;
    const req = client.request(
      target,
      {
        method: requestOptions.method || "GET",
        headers,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let payload = {};
          if (raw) {
            try {
              payload = JSON.parse(raw);
            } catch {
              payload = { message: raw };
            }
          }
          resolve({ status: res.statusCode || 0, payload });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(45000, () => {
      req.destroy(new Error("Shopee request timed out."));
    });
    if (body) req.write(body);
    req.end();
  });

  if (result.status < 200 || result.status >= 300 || result.payload.error) {
    const error = new Error(String(result.payload.error || result.payload.message || `Shopee returned ${result.status}`));
    error.payload = result.payload;
    throw error;
  }
  return result.payload;
}

async function shopeeGet(pathname, query, binding) {
  assertConfigured();
  return fetchJson(signedUrl(pathname, query, binding), { method: "GET" });
}

async function shopeePost(pathname, body, binding) {
  assertConfigured();
  return fetchJson(signedUrl(pathname, {}, binding), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nestedArray(payload, key) {
  if (Array.isArray(payload[key])) return payload[key];
  if (payload.response && Array.isArray(payload.response[key])) return payload.response[key];
  return [];
}

function firstNumber(values, fallback = 0) {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return fallback;
}

function stockFromItem(item) {
  const stockInfo = asArray(item.stock_info_v2 && item.stock_info_v2.seller_stock)[0] || {};
  return firstNumber([item.stock, item.normal_stock, item.current_stock, stockInfo.stock, stockInfo.current_stock]);
}

function priceFromItem(item) {
  const priceInfo = asArray(item.price_info)[0] || {};
  return firstNumber([priceInfo.current_price, priceInfo.original_price, priceInfo.price, item.price]);
}

function normalizeProduct(item) {
  return {
    product_id: String(item.item_id || item.product_id || ""),
    title: String(item.item_name || item.title || item.name || ""),
    price: priceFromItem(item),
    stock: stockFromItem(item),
    sales_count: firstNumber([item.historical_sold, item.sold, item.sales_count]),
  };
}

function normalizeOrderLines(order) {
  const orderId = String(order.order_sn || order.order_id || "");
  const createdAt = order.create_time ? new Date(Number(order.create_time) * 1000).toISOString() : nowIso();
  const status = String(order.order_status || order.status || "unknown");
  const itemList = asArray(order.item_list);
  if (!itemList.length) {
    return [{
      order_id: orderId,
      product_id: "",
      sku: "",
      quantity: 1,
      price: firstNumber([order.total_amount, order.order_amount]),
      order_status: status,
      created_at: createdAt,
    }];
  }
  return itemList.map((item) => ({
    order_id: orderId,
    product_id: String(item.item_id || item.product_id || ""),
    sku: String(item.item_sku || item.model_sku || item.sku || ""),
    quantity: Math.max(1, firstNumber([item.model_quantity_purchased, item.item_quantity, item.quantity], 1)),
    price: firstNumber([item.model_discounted_price, item.model_original_price, item.item_price, order.total_amount]),
    order_status: status,
    created_at: createdAt,
  }));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function ensureFreshBinding(binding) {
  if (!binding || !binding.access_token) return binding;
  const expiresAt = Number(binding.expire_at || binding.token_expire_at || 0);
  if (!binding.refresh_token || !expiresAt || expiresAt - nowSeconds() > 600) return binding;

  const payload = await shopeePost("/api/v2/auth/access_token/get", {
    refresh_token: binding.refresh_token,
    partner_id: Number(PARTNER_ID),
    shop_id: Number(binding.shop_id),
  });
  const refreshed = saveBinding({
    ...binding,
    access_token: payload.access_token || binding.access_token,
    refresh_token: payload.refresh_token || binding.refresh_token,
    expire_at: payload.expire_in ? nowSeconds() + Number(payload.expire_in) : binding.expire_at,
    token_expire_at: payload.expire_in ? new Date((nowSeconds() + Number(payload.expire_in)) * 1000).toISOString() : binding.token_expire_at,
  });
  return refreshed;
}

async function activeBinding() {
  const binding = firstBinding();
  if (!binding) throw new Error("Shop authorization is not completed.");
  return ensureFreshBinding(binding);
}

async function fetchOrderSnsForWindow(binding, timeFrom, timeTo, orderSns) {
  let cursor = "";
  while (orderSns.length < MAX_SYNC_ITEMS) {
    const payload = await shopeeGet("/api/v2/order/get_order_list", {
      time_range_field: "create_time",
      time_from: timeFrom,
      time_to: timeTo,
      page_size: PAGE_SIZE,
      cursor,
    }, binding);
    const list = nestedArray(payload, "order_list");
    orderSns.push(...list.map((item) => String(item.order_sn || item.order_id || "")).filter(Boolean));
    const response = payload.response || {};
    const more = Boolean(response.more || payload.more);
    const nextCursor = String(response.next_cursor || payload.next_cursor || "");
    if (!more || !nextCursor) break;
    cursor = nextCursor;
  }
}

async function fetchOrders(binding) {
  const now = nowSeconds();
  const historyFrom = now - ORDER_HISTORY_DAYS * 24 * 60 * 60;
  const orderSns = [];
  let windowTo = now;

  while (windowTo > historyFrom && orderSns.length < MAX_SYNC_ITEMS) {
    const windowFrom = Math.max(historyFrom, windowTo - ORDER_WINDOW_DAYS * 24 * 60 * 60 + 1);
    await fetchOrderSnsForWindow(binding, windowFrom, windowTo, orderSns);
    windowTo = windowFrom - 1;
  }

  const uniqueOrderSns = Array.from(new Set(orderSns)).slice(0, MAX_SYNC_ITEMS);
  if (!uniqueOrderSns.length) return [];

  const detailPayloads = await Promise.all(chunk(uniqueOrderSns, 50).map((orderChunk) =>
    shopeeGet("/api/v2/order/get_order_detail", {
      order_sn_list: orderChunk.join(","),
      response_optional_fields: "item_list,total_amount,order_status,create_time,pay_time,update_time",
    }, binding)
  ));

  return detailPayloads
    .flatMap((payload) => nestedArray(payload, "order_list"))
    .flatMap(normalizeOrderLines)
    .filter((item) => item.order_id);
}

async function fetchProducts(binding) {
  const itemIds = [];
  let offset = 0;
  while (itemIds.length < MAX_SYNC_ITEMS) {
    const payload = await shopeeGet("/api/v2/product/get_item_list", {
      offset,
      page_size: PAGE_SIZE,
      item_status: "NORMAL",
    }, binding);
    const list = nestedArray(payload, "item");
    itemIds.push(...list.map((item) => String(item.item_id || item.product_id || "")).filter(Boolean));
    const response = payload.response || {};
    const hasNextPage = Boolean(response.has_next_page || payload.has_next_page);
    const nextOffset = Number(response.next_offset || payload.next_offset || offset + PAGE_SIZE);
    if (!hasNextPage || !Number.isFinite(nextOffset) || nextOffset <= offset) break;
    offset = nextOffset;
  }

  const uniqueItemIds = Array.from(new Set(itemIds)).slice(0, MAX_SYNC_ITEMS);
  if (!uniqueItemIds.length) return [];

  const detailPayloads = await Promise.all(chunk(uniqueItemIds, 50).map((itemChunk) =>
    shopeeGet("/api/v2/product/get_item_base_info", {
      item_id_list: itemChunk.join(","),
      response_optional_fields: "price_info,stock_info_v2,sales_info,item_name,item_sku,item_status,description,brand",
      need_tax_info: "false",
      need_complaint_policy: "false",
    }, binding)
  ));

  return detailPayloads
    .flatMap((payload) => nestedArray(payload, "item_list"))
    .map(normalizeProduct)
    .filter((item) => item.product_id);
}

function inventoryFromProducts(products) {
  return products.map((product) => ({
    product_id: product.product_id,
    available_stock: product.stock,
    reserved_stock: 0,
  }));
}

async function exchangeCodeForToken(code, shopId) {
  const payload = await shopeePost("/api/v2/auth/token/get", {
    code,
    partner_id: Number(PARTNER_ID),
    shop_id: Number(shopId),
  });
  return saveBinding({
    shop_id: String(shopId),
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expire_at: payload.expire_in ? nowSeconds() + Number(payload.expire_in) : null,
    token_expire_at: payload.expire_in ? new Date((nowSeconds() + Number(payload.expire_in)) * 1000).toISOString() : null,
    last_sync_at: null,
  });
}

function authUrl(redirectUrl, state) {
  assertConfigured();
  const url = signedUrl("/api/v2/shop/auth_partner", {
    redirect: redirectUrl,
    state,
  });
  return url.toString();
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true, readonly: true });

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        readonly: true,
        configured: Boolean(PARTNER_ID && PARTNER_KEY),
        version: SERVICE_VERSION,
        order_history_days: ORDER_HISTORY_DAYS,
        page_size: PAGE_SIZE,
        max_sync_items: MAX_SYNC_ITEMS,
        timestamp: nowIso(),
      });
    }

    if (!auth(req)) return json(res, 401, { error: "Unauthorized", readonly: true });

    if (url.pathname === "/auth/url" && req.method === "GET") {
      return json(res, 200, {
        authorization_url: authUrl(url.searchParams.get("redirect_url") || "", url.searchParams.get("state") || ""),
        readonly: true,
      });
    }

    if (url.pathname === "/auth/callback" && req.method === "GET") {
      const code = url.searchParams.get("code") || "";
      const shopId = url.searchParams.get("shop_id") || "";
      if (!code || !shopId) return json(res, 400, { error: "Missing code or shop_id.", readonly: true });
      const binding = await exchangeCodeForToken(code, shopId);
      const redirect = url.searchParams.get("redirect") || url.searchParams.get("redirect_url") || "";
      if (redirect) {
        const redirectUrl = new URL(redirect);
        redirectUrl.searchParams.set("shop_id", binding.shop_id);
        redirectUrl.searchParams.set("status", "bound");
        res.writeHead(302, { Location: redirectUrl.toString() });
        return res.end();
      }
      return json(res, 200, { bound: true, shop_id: binding.shop_id, readonly: true });
    }

    if (url.pathname === "/auth/token" && req.method === "POST") {
      const body = await readBody(req);
      const binding = await exchangeCodeForToken(String(body.code || ""), String(body.shop_id || ""));
      return json(res, 200, { bound: true, shop_id: binding.shop_id, readonly: true });
    }

    if (url.pathname === "/binding" && req.method === "GET") {
      const shops = readBindings();
      const shop = shops[0] || null;
      return json(res, 200, {
        bound: shops.length > 0,
        status: shop ? "bound" : "unbound",
        shop_id: shop && shop.shop_id,
        shops,
        readonly: true,
        message: shop ? "Shop authorization is bound through fixed IP proxy." : "Shop authorization is not completed.",
      });
    }

    if (url.pathname === "/binding/profile" && req.method === "PATCH") {
      const body = await readBody(req);
      const bindings = readBindings();
      const index = bindings.findIndex((item) => String(item.shop_id) === String(body.shop_id));
      if (index < 0) return json(res, 404, { error: "Shop binding not found.", readonly: true });
      bindings[index] = {
        ...bindings[index],
        shop_name: body.shop_name != null ? body.shop_name : (bindings[index].shop_name != null ? bindings[index].shop_name : null),
        owner_name: body.owner_name != null ? body.owner_name : (bindings[index].owner_name != null ? bindings[index].owner_name : null),
        notes: body.notes != null ? body.notes : (bindings[index].notes != null ? bindings[index].notes : null),
        updated_at: nowIso(),
      };
      writeBindings(bindings);
      return json(res, 200, { bound: true, status: "bound", shops: bindings, readonly: true });
    }

    if (url.pathname === "/orders" && req.method === "GET") {
      const binding = await activeBinding();
      const orders = await fetchOrders(binding);
      saveBinding({ ...binding, last_sync_at: nowIso() });
      return json(res, 200, { source: "shopee_api", orders, orders_count: orders.length, synced_at: nowIso(), readonly: true });
    }

    if (url.pathname === "/products" && req.method === "GET") {
      const binding = await activeBinding();
      const products = await fetchProducts(binding);
      saveBinding({ ...binding, last_sync_at: nowIso() });
      return json(res, 200, { source: "shopee_api", products, products_count: products.length, synced_at: nowIso(), readonly: true });
    }

    if (url.pathname === "/inventory" && req.method === "GET") {
      const binding = await activeBinding();
      const products = await fetchProducts(binding);
      const inventory = inventoryFromProducts(products);
      saveBinding({ ...binding, last_sync_at: nowIso() });
      return json(res, 200, { source: "shopee_api", inventory, inventory_count: inventory.length, synced_at: nowIso(), readonly: true });
    }

    if (url.pathname === "/sync" && req.method === "GET") {
      const binding = await activeBinding();
      const [orders, products] = await Promise.all([fetchOrders(binding), fetchProducts(binding)]);
      const inventory = inventoryFromProducts(products);
      saveBinding({ ...binding, last_sync_at: nowIso() });
      return json(res, 200, {
        source: "shopee_api",
        orders,
        products,
        inventory,
        orders_count: orders.length,
        products_count: products.length,
        inventory_count: inventory.length,
        synced_at: nowIso(),
        readonly: true,
      });
    }

    return json(res, 404, { error: "Not found", readonly: true });
  } catch (error) {
    return json(res, 500, {
      error: error && error.message ? error.message : "Proxy error",
      readonly: true,
    });
  }
}

http.createServer(handle).listen(PORT, () => {
  console.log(`Shopee read-only proxy listening on ${PORT}`);
});
