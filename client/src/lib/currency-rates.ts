export type ExchangeRatesResponse = {
  base: string;
  date: string;
  rates: Record<string, number>;
  source: string;
  cached: boolean;
};

export type CustomCurrency = {
  code: string;
  name: string;
  rate: number;
};

export type CustomCurrencyMap = Record<string, CustomCurrency>;

export function normalizeCurrency(currency?: string | null) {
  return (currency || "").trim().toUpperCase();
}

export function getManualRateMap(currencies: CustomCurrencyMap = {}) {
  return Object.values(currencies).reduce<Record<string, number>>((rates, currency) => {
    const code = normalizeCurrency(currency.code);
    if (code && Number.isFinite(Number(currency.rate)) && Number(currency.rate) > 0) {
      rates[code] = Number(currency.rate);
    }
    return rates;
  }, {});
}

export function hasCurrencyRate(currency: string, liveRates?: Record<string, number>, customCurrencies: CustomCurrencyMap = {}) {
  const code = normalizeCurrency(currency) || "USD";
  const manualRates = getManualRateMap(customCurrencies);
  return code === "USD" || Boolean(liveRates?.[code]) || Boolean(manualRates[code]);
}

export function getExchangeRateSymbols(currencies: Array<string | null | undefined>, base = "USD") {
  const normalizedBase = normalizeCurrency(base) || "USD";
  return Array.from(new Set(currencies.map(normalizeCurrency).filter(Boolean)))
    .filter((currency) => currency !== normalizedBase)
    .sort();
}

export async function fetchExchangeRates(symbols: string[], base = "USD"): Promise<ExchangeRatesResponse> {
  const params = new URLSearchParams({ base });
  if (symbols.length > 0) {
    params.set("symbols", symbols.join(","));
  }

  const response = await fetch(`/api/exchange-rates?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch exchange rates");
  }
  return response.json();
}

export async function fetchCustomCurrencyRates(): Promise<{ currencies: CustomCurrencyMap }> {
  const response = await fetch("/api/custom-currency-rates");
  if (!response.ok) {
    throw new Error("Failed to fetch custom currency rates");
  }
  return response.json();
}

export async function saveCustomCurrencyRates(currencies: CustomCurrencyMap): Promise<{ currencies: CustomCurrencyMap }> {
  const response = await fetch("/api/custom-currency-rates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currencies }),
  });
  if (!response.ok) {
    throw new Error("Failed to save custom currency rates");
  }
  return response.json();
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates?: Record<string, number>,
  customCurrencies: CustomCurrencyMap = {}
) {
  const from = normalizeCurrency(fromCurrency) || "USD";
  const to = normalizeCurrency(toCurrency) || "USD";
  if (from === to) return amount;
  if (!rates) return amount;

  const manualRates = getManualRateMap(customCurrencies);
  const fromRate = from === "USD" ? 1 : rates[from] || manualRates[from];
  const toRate = to === "USD" ? 1 : rates[to] || manualRates[to];
  if (!fromRate || !toRate) return amount;

  const amountInUsd = amount / fromRate;
  return amountInUsd * toRate;
}
