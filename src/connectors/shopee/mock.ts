import type { ShopeeInventoryItem, ShopeeOrder, ShopeeProduct } from "@/types";

export const shopeeOrdersMock: ShopeeOrder[] = [
  {
    order_id: "shp_order_20260617_001",
    product_id: "shp_prod_001",
    sku: "ORG-COZ-MOD-001",
    quantity: 2,
    price: 39.9,
    order_status: "ready_to_ship",
    created_at: "2026-06-17T08:40:00-03:00",
  },
  {
    order_id: "shp_order_20260617_002",
    product_id: "shp_prod_002",
    sku: "SEL-PORT-002",
    quantity: 1,
    price: 22.8,
    order_status: "shipped",
    created_at: "2026-06-17T09:15:00-03:00",
  },
  {
    order_id: "shp_order_20260617_003",
    product_id: "shp_prod_003",
    sku: "SUP-CAR-003",
    quantity: 3,
    price: 29.9,
    order_status: "paid",
    created_at: "2026-06-17T10:05:00-03:00",
  },
];

export const shopeeProductsMock: ShopeeProduct[] = [
  {
    product_id: "shp_prod_001",
    title: "Organizador de Cozinha Modular",
    price: 39.9,
    stock: 164,
    sales_count: 1240,
  },
  {
    product_id: "shp_prod_002",
    title: "Mini Seladora Portatil para Embalagem",
    price: 22.8,
    stock: 24,
    sales_count: 430,
  },
  {
    product_id: "shp_prod_003",
    title: "Suporte Magnetico para Celular no Carro",
    price: 29.9,
    stock: 410,
    sales_count: 980,
  },
];

export const shopeeInventoryMock: ShopeeInventoryItem[] = [
  {
    product_id: "shp_prod_001",
    available_stock: 150,
    reserved_stock: 14,
  },
  {
    product_id: "shp_prod_002",
    available_stock: 21,
    reserved_stock: 3,
  },
  {
    product_id: "shp_prod_003",
    available_stock: 382,
    reserved_stock: 28,
  },
];
