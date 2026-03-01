"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StockResult {
  id: string;
  sku: string;
  name: string;
  baseUom: string;
  minStock: number;
  maxStock: number;
  totalQty: number;
  warehouses: { warehouseId: string; warehouseName: string; qty: number }[];
}

export default function WarehouseStockLookupPage() {
  const t = useTranslations("warehousePortal");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/warehouse/stock-lookup?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) setResults(data.data);
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  };

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-bold">{t("stockLookup")}</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("searchProduct")}
          value={query}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {searching && <p className="text-sm text-center text-muted-foreground">Searching...</p>}

      {results.length === 0 && query.length >= 2 && !searching && (
        <p className="text-sm text-center text-muted-foreground py-4">{t("noResults")}</p>
      )}

      {results.map(r => (
        <Card key={r.id}>
          <CardContent className="pt-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.sku}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{r.totalQty} {r.baseUom}</p>
                {r.totalQty < r.minStock && r.minStock > 0 && (
                  <Badge variant="destructive" className="text-xs">Low</Badge>
                )}
              </div>
            </div>
            {r.warehouses.length > 0 && (
              <div className="mt-2 space-y-1">
                {r.warehouses.map(wh => (
                  <div key={wh.warehouseId} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{wh.warehouseName}</span>
                    <span className="font-medium">{wh.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
