import { PublicLanding } from "@/components/PublicLanding";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const code = firstParam(params.code);
  const shopId = firstParam(params.shop_id);
  const state = firstParam(params.state) ?? firstParam(params.random);

  if (code && shopId) {
    const query = new URLSearchParams({ code, shop_id: shopId });
    if (state) query.set("state", state);
    redirect(`/api/shopee/auth/callback?${query.toString()}`);
  }

  return <PublicLanding />;
}
