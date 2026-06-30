import { PublicLanding } from "@/components/PublicLanding";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function appendParam(query: URLSearchParams, key: string, value: string | string[] | undefined) {
  const firstValue = firstParam(value);
  if (firstValue) query.set(key, firstValue);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const code = firstParam(params.code);

  if (code) {
    const query = new URLSearchParams();
    appendParam(query, "code", params.code);
    appendParam(query, "shop_id", params.shop_id);
    appendParam(query, "shop_id_list", params.shop_id_list);
    appendParam(query, "shop_ids", params.shop_ids);
    appendParam(query, "main_account_id", params.main_account_id);
    appendParam(query, "merchant_id", params.merchant_id);
    appendParam(query, "state", params.state ?? params.random);
    redirect(`/api/shopee/auth/callback?${query.toString()}`);
  }

  return <PublicLanding />;
}
