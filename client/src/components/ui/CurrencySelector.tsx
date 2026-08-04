import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { CustomCurrencyMap, normalizeCurrency } from "@/lib/currency-rates";

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const currencies: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "EUR" },
  { code: "GBP", name: "British Pound", symbol: "GBP" },
  { code: "JPY", name: "Japanese Yen", symbol: "JPY" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CAD" },
  { code: "AUD", name: "Australian Dollar", symbol: "AUD" },
  { code: "CNY", name: "Chinese Yuan", symbol: "CNY" },
  { code: "SEK", name: "Swedish Krona", symbol: "SEK" },
  { code: "NOK", name: "Norwegian Krone", symbol: "NOK" },
  { code: "DKK", name: "Danish Krone", symbol: "DKK" },
  { code: "PLN", name: "Polish Zloty", symbol: "PLN" },
  { code: "CZK", name: "Czech Koruna", symbol: "CZK" },
  { code: "HUF", name: "Hungarian Forint", symbol: "HUF" },
  { code: "RUB", name: "Russian Ruble", symbol: "RUB" },
  { code: "INR", name: "Indian Rupee", symbol: "INR" },
  { code: "KRW", name: "South Korean Won", symbol: "KRW" },
  { code: "SGD", name: "Singapore Dollar", symbol: "SGD" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HKD" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZD" },
  { code: "RSD", name: "Serbian Dinar", symbol: "RSD" },
];

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  className?: string;
  compact?: boolean;
  customCurrencies?: CustomCurrencyMap;
  manualRateCurrencyCodes?: string[];
  onSaveCustomCurrencies?: (currencies: CustomCurrencyMap) => Promise<void> | void;
}

export function CurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  className = "",
  compact = false,
  customCurrencies = {},
  manualRateCurrencyCodes = [],
  onSaveCustomCurrencies,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftRate, setDraftRate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const customList = useMemo(
    () => Object.values(customCurrencies).map((currency) => ({
      code: normalizeCurrency(currency.code),
      name: currency.name || normalizeCurrency(currency.code),
      symbol: normalizeCurrency(currency.code),
      rate: Number(currency.rate),
      custom: true,
    })),
    [customCurrencies]
  );

  const mergedCurrencies = useMemo(() => {
    const customCodes = new Set(customList.map((currency) => currency.code));
    return [
      ...customList,
      ...currencies.filter((currency) => !customCodes.has(currency.code)),
    ];
  }, [customList]);

  const selectedCurrencyInfo = mergedCurrencies.find((currency) => currency.code === selectedCurrency);
  const selectedSymbol = selectedCurrencyInfo?.symbol;
  const manualRateSet = new Set(manualRateCurrencyCodes.map(normalizeCurrency));
  const filteredCurrencies = mergedCurrencies.filter((currency) =>
    currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
        setEditorOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current && !editorOpen) {
      searchInputRef.current.focus();
    }
  }, [editorOpen, isOpen]);

  const openEditor = (currency?: { code: string; name: string; rate?: number }) => {
    setEditingCode(currency?.code || null);
    setDraftCode(currency?.code || searchTerm.toUpperCase());
    setDraftName(currency?.name || "");
    setDraftRate(currency?.rate ? String(currency.rate) : "");
    setEditorOpen(true);
  };

  const saveCurrency = async () => {
    const code = normalizeCurrency(draftCode);
    const rate = Number(draftRate);
    if (!code || !Number.isFinite(rate) || rate <= 0) return;

    const nextCurrencies = { ...customCurrencies };
    if (editingCode && editingCode !== code) {
      delete nextCurrencies[editingCode];
    }
    nextCurrencies[code] = {
      code,
      name: draftName.trim() || code,
      rate,
    };

    setIsSaving(true);
    try {
      await onSaveCustomCurrencies?.(nextCurrencies);
      onCurrencyChange(code);
      setEditorOpen(false);
      setSearchTerm("");
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const removeCurrency = async () => {
    if (!editingCode) return;
    const nextCurrencies = { ...customCurrencies };
    delete nextCurrencies[editingCode];

    setIsSaving(true);
    try {
      await onSaveCustomCurrencies?.(nextCurrencies);
      if (selectedCurrency === editingCode) {
        onCurrencyChange("USD");
      }
      setEditorOpen(false);
      setSearchTerm("");
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCurrencySelect = (currency: Currency) => {
    onCurrencyChange(currency.code);
    setIsOpen(false);
    setSearchTerm("");
    setEditorOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-1 font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors cursor-pointer ${
          compact ? "text-xs" : "text-sm"
        }`}
        type="button"
      >
        {selectedSymbol && selectedSymbol !== selectedCurrency && <span>{selectedSymbol}</span>}
        <span>{selectedCurrency}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className={`absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[100] overflow-hidden ${editorOpen ? "w-[520px]" : "w-72"}`}>
          <div className="grid" style={{ gridTemplateColumns: editorOpen ? "280px 240px" : "1fr" }}>
            <div className="min-w-0">
              <div className="p-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search currencies..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <button
                  onClick={() => openEditor()}
                  className="w-full px-3 py-2 text-left hover:bg-green-50 text-green-700 border-b border-gray-100 flex items-center gap-2"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Add custom currency</div>
                    <div className="text-xs text-green-600">Set the rate: 1 USD = currency value</div>
                  </div>
                </button>

                {filteredCurrencies.length > 0 ? (
                  filteredCurrencies.map((currency) => {
                    const custom = customCurrencies[currency.code];
                    const manualEditable = Boolean(custom) || manualRateSet.has(currency.code);
                    return (
                      <div
                        key={currency.code}
                        className={`group flex w-full items-center justify-between transition-colors ${
                          currency.code === selectedCurrency ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <button
                          onClick={() => handleCurrencySelect(currency)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                          type="button"
                        >
                          <span className="font-medium text-xs text-gray-500 w-10 flex-shrink-0">
                            {currency.symbol !== currency.code ? currency.symbol : currency.code}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium">{currency.code}</div>
                            <div className="truncate text-xs text-gray-500">{currency.name}</div>
                          </div>
                        </button>
                        <div className="flex items-center pr-2">
                          {manualEditable && (
                            <button
                              type="button"
                              onClick={() => openEditor({ code: currency.code, name: custom?.name || currency.name, rate: custom?.rate })}
                              className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700"
                              title="Edit manual USD rate"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {currency.code === selectedCurrency && <div className="ml-1 h-2 w-2 rounded-full bg-blue-600" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">No currencies found</div>
                )}
              </div>
            </div>

            {editorOpen && (
              <div className="border-l border-gray-200 bg-gray-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{editingCode ? "Edit currency" : "Custom currency"}</div>
                    <div className="text-xs text-gray-500">Rate is stored in your profile.</div>
                  </div>
                  <button type="button" onClick={() => setEditorOpen(false)} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-600">
                    Code
                    <input
                      value={draftCode}
                      onChange={(event) => setDraftCode(event.target.value.toUpperCase())}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="AED"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    Name
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="UAE Dirham"
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">
                    1 USD equals
                    <input
                      value={draftRate}
                      onChange={(event) => setDraftRate(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="3.6725"
                      inputMode="decimal"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={saveCurrency}
                  disabled={isSaving || !draftCode || Number(draftRate) <= 0}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Save currency
                </button>
                {editingCode && customCurrencies[editingCode] && (
                  <button
                    type="button"
                    onClick={removeCurrency}
                    disabled={isSaving}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove currency
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
