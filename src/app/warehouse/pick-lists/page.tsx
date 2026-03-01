"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";

interface PickListCard {
  id: string;
  pickListNumber: string;
  status: string;
  deliveryOrder: {
    id: string;
    doNumber: string;
    salesOrder: { customer: { name: string } };
  };
  assignee: { id: string; name: string } | null;
  _count: { lines: number };
}

export default function WarehousePickListsPage() {
  const t = useTranslations("pickLists");
  const router = useRouter();
  const [items, setItems] = useState<PickListCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPickLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pick-lists?pageSize=200");
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items.filter((i: PickListCard) => i.status !== "READY_FOR_HANDOVER"));
      }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPickLists(); }, [fetchPickLists]);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-bold">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("noPickLists")}</p>
      ) : (
        items.map(pl => (
          <Card key={pl.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/warehouse/pick-lists/${pl.id}`)}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold">{pl.pickListNumber}</p>
                  <p className="text-xs text-muted-foreground">DO: {pl.deliveryOrder.doNumber}</p>
                  <p className="text-xs text-muted-foreground">{pl.deliveryOrder.salesOrder.customer.name}</p>
                </div>
                <StatusBadge status={pl.status.toLowerCase().replace(/_/g, "_")} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{pl._count.lines} items</Badge>
                {pl.assignee && <Badge variant="secondary" className="text-xs">{pl.assignee.name}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
