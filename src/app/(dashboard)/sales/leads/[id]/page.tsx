"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, UserPlus, Plus, Phone, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Activity {
  id: string;
  type: string;
  subject: string;
  notes: string | null;
  activityAt: string;
  user: { name: string };
}

interface LeadDetail {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  assignedTo: string | null;
  customerId: string | null;
  value: number | null;
  notes: string | null;
  assignee: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  activities: Activity[];
}

export default function LeadDetailPage() {
  const t = useTranslations("leads");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activityType, setActivityType] = useState("CALL");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityNotes, setActivityNotes] = useState("");

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const json = await res.json();
      if (json.success) setLead(json.data);
      else toast.error(json.error ?? "Lead not found");
    } catch {
      toast.error("Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleConvert = async () => {
    try {
      const res = await fetch(`/api/leads/${id}/convert`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("convertSuccess"));
        if (json.data?.customerId) router.push(`/sales/customers/${json.data.customerId}`);
        else fetchLead();
      } else {
        toast.error(json.error ?? "Failed to convert");
      }
    } catch {
      toast.error("Failed to convert");
    }
  };

  const handleAddActivity = async () => {
    if (!activitySubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/customer-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: id,
          type: activityType,
          subject: activitySubject.trim(),
          notes: activityNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Activity added");
        setActivityDialogOpen(false);
        setActivitySubject("");
        setActivityNotes("");
        fetchLead();
      } else {
        toast.error(json.error ?? "Failed to add activity");
      }
    } catch {
      toast.error("Failed to add activity");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number | null) =>
    val != null
      ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val)
      : "-";

  if (loading || !lead) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sales/leads"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader
          title={lead.name}
          description={lead.company ?? undefined}
          actions={
            <>
              <Button variant="outline" onClick={() => setActivityDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addActivity")}
              </Button>
              {!lead.customerId && (
                <Button onClick={handleConvert}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("convertToCustomer")}
                </Button>
              )}
            </>
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={lead.status.toLowerCase()} />
              {lead.assignee && <span className="text-sm text-muted-foreground">→ {lead.assignee.name}</span>}
            </div>
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{lead.company}</span>
              </div>
            )}
            {lead.source && <p className="text-sm"><span className="text-muted-foreground">Source:</span> {lead.source}</p>}
            {lead.value != null && <p className="text-sm font-medium">{t("value")}: {formatCurrency(lead.value)}</p>}
            {lead.notes && <p className="text-sm text-muted-foreground">{lead.notes}</p>}
            {lead.customerId && lead.customer && (
              <p className="text-sm">
                Converted to customer:{" "}
                <Link href={`/sales/customers/${lead.customerId}`} className="text-primary hover:underline">
                  {lead.customer.name}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("activityLog")}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setActivityDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lead.activities?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            ) : (
              <ul className="space-y-3">
                {lead.activities?.map((a) => (
                  <li key={a.id} className="border-l-2 border-muted pl-3 py-1">
                    <p className="text-sm font-medium">{a.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type} · {a.user?.name} · {format(new Date(a.activityAt), "dd MMM yyyy HH:mm")}
                    </p>
                    {a.notes && <p className="text-xs mt-1">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addActivity")}</DialogTitle>
            <DialogDescription>Log a call, visit, note, or meeting.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALL">Call</SelectItem>
                  <SelectItem value="VISIT">Visit</SelectItem>
                  <SelectItem value="NOTE">Note</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input value={activitySubject} onChange={(e) => setActivitySubject(e.target.value)} placeholder="Brief subject" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddActivity} disabled={submitting}>Add Activity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
