"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, CheckCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";

interface HandoverLine {
  id: string;
  confirmed: boolean;
  deliveryOrder: { doNumber: string; salesOrder: { customer: { name: string } } };
}

interface HandoverCard {
  id: string;
  status: string;
  trip: { tripNumber: string };
  warehouseStaff: { name: string };
  driver: { name: string };
  lines: HandoverLine[];
}

export default function WarehouseHandoverPage() {
  const t = useTranslations("handovers");
  const [items, setItems] = useState<HandoverCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHandovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/handovers?pageSize=50&status=PENDING");
      const data = await res.json();
      if (data.success) {
        const detailed = await Promise.all(
          data.data.items.map(async (h: { id: string }) => {
            const dr = await fetch(`/api/handovers/${h.id}`);
            const dd = await dr.json();
            return dd.success ? dd.data : null;
          })
        );
        setItems(detailed.filter(Boolean));
      }
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHandovers(); }, [fetchHandovers]);

  const confirmLine = async (handoverId: string, lineId: string) => {
    try {
      const res = await fetch(`/api/handovers/${handoverId}/lines/${lineId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("lineConfirmed"));
      fetchHandovers();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const completeHandover = async (handoverId: string) => {
    try {
      const res = await fetch(`/api/handovers/${handoverId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("confirmedSuccess"));
      fetchHandovers();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-bold">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("noHandovers")}</p>
      ) : (
        items.map(h => {
          const allConfirmed = h.lines.every(l => l.confirmed);
          const confirmedCount = h.lines.filter(l => l.confirmed).length;
          return (
            <Card key={h.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold">{h.trip.tripNumber}</p>
                    <p className="text-xs text-muted-foreground">{h.warehouseStaff.name} → {h.driver.name}</p>
                  </div>
                  <StatusBadge status={h.status.toLowerCase()} />
                </div>
                <p className="text-xs text-muted-foreground">{confirmedCount}/{h.lines.length} confirmed</p>

                {h.lines.map(line => (
                  <div key={line.id} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <p className="text-sm font-medium">{line.deliveryOrder.doNumber}</p>
                      <p className="text-xs text-muted-foreground">{line.deliveryOrder.salesOrder.customer.name}</p>
                    </div>
                    {line.confirmed ? (
                      <Badge variant="default"><Check size={12} className="mr-1" />OK</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => confirmLine(h.id, line.id)}>
                        <Check size={12} className="mr-1" />{t("confirmLine")}
                      </Button>
                    )}
                  </div>
                ))}

                {allConfirmed && (
                  <Button className="w-full" size="sm" onClick={() => completeHandover(h.id)}>
                    <CheckCircle size={14} className="mr-1" />{t("confirmAll")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
