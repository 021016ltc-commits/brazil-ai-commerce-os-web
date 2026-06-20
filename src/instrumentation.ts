export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === undefined) {
    const { systemAutoStart } = await import("@/lib/runtime/systemBootstrap");
    await systemAutoStart("next_instrumentation");
  }
}
