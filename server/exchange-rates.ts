import fetch from "node-fetch";

type CachedRates = {
  base: string;
  symbolsKey: string;
  date: string;
  rates: Record<string, number>;
  fetchedAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
let cachedRates: CachedRates | null = null;

const normalizeCurrency = (currency?: string | null) => (currency || "").trim().toUpperCase();

export async function getLiveExchangeRates(baseCurrency = "USD", symbols: string[] = []) {
  const base = normalizeCurrency(baseCurrency) || "USD";
  const uniqueSymbols = Array.from(new Set(symbols.map(normalizeCurrency).filter(Boolean)))
    .filter((symbol) => symbol !== base)
    .sort();
  const symbolsKey = uniqueSymbols.join(",");
  const now = Date.now();

  if (
    cachedRates &&
    cachedRates.base === base &&
    cachedRates.symbolsKey === symbolsKey &&
    now - cachedRates.fetchedAt < CACHE_TTL_MS
  ) {
    return { ...cachedRates, cached: true, source: "Frankfurter" };
  }

  const url = new URL("https://api.frankfurter.dev/v2/rates");
  url.searchParams.set("base", base);
  if (uniqueSymbols.length > 0) {
    url.searchParams.set("quotes", uniqueSymbols.join(","));
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Exchange rate request failed with ${response.status}`);
  }

  const data = (await response.json()) as
    | Array<{ date?: string; quote?: string; rate?: number }>
    | { date?: string; rates?: Record<string, number>; quote?: string; rate?: number };

  const normalizedRates = Array.isArray(data)
    ? data.reduce<Record<string, number>>((rates, item) => {
        if (item.quote && typeof item.rate === "number") {
          rates[item.quote] = item.rate;
        }
        return rates;
      }, {})
    : data.rates || (data.quote && typeof data.rate === "number" ? { [data.quote]: data.rate } : {});
  const date = Array.isArray(data) ? data[0]?.date : data.date;
  const rates = { [base]: 1, ...normalizedRates };
  cachedRates = {
    base,
    symbolsKey,
    date: date || new Date().toISOString().slice(0, 10),
    rates,
    fetchedAt: now,
  };

  return { ...cachedRates, cached: false, source: "Frankfurter" };
}
