module.exports = {
  apps: [
    {
      name: "shopee-readonly-proxy",
      script: "server.js",
      cwd: "/opt/brazil-ai-commerce-os/services/shopee-readonly-proxy",
      env: {
        PORT: "8787",
        DATA_DIR: "/opt/brazil-ai-commerce-os/proxy-data",
        SHOPEE_OPEN_API_BASE_URL: "https://partner.shopeemobile.com",
        SHOPEE_ORDER_SYNC_DAYS: "14",
        SHOPEE_FULL_SYNC_MAX_ITEMS: "10000",
        SHOPEE_PAGE_SIZE: "50",
      },
    },
  ],
};
