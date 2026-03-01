"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  MapPin,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { HistoryDrawer } from "@/components/shared/history-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  isPrimary: boolean;
}

interface Customer {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  paymentTermsDays: number;
  salespersonId: string | null;
  region: string | null;
  tier: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  isActive: boolean;
  contacts: Contact[];
}

interface ContactForm {
  name: string;
  phone: string;
  email: string;
  position: string;
  isPrimary: boolean;
}

const emptyContactForm: ContactForm = {
  name: "",
  phone: "",
  email: "",
  position: "",
  isPrimary: false,
};

/**
 * Customer detail/edit page with tabbed layout.
 * Tabs: Details (form), Contacts (inline CRUD), Transaction History, History (audit).
 */
export default function CustomerDetailPage() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const ta = useTranslations("audit");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [salesOrders, setSalesOrders] = useState<{ id: string; soNumber: string; status: string; grandTotal: number; createdAt: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoiceNumber: string; status: string; grandTotal: number; amountPaid: number; createdAt: string }[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Detail form state
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    taxId: "",
    paymentTermsDays: 30,
    salespersonId: "",
    region: "",
    tier: "",
    gpsLatitude: "",
    gpsLongitude: "",
    isActive: true,
  });

  // Contact management
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);
  const [addingContact, setAddingContact] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);

  const fetchCustomer = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${id}`);
      const json = await res.json();
      if (json.success) {
        const c: Customer = json.data;
        setCustomer(c);
        setContacts(c.contacts);
        setForm({
          name: c.name,
          address: c.address || "",
          phone: c.phone || "",
          email: c.email || "",
          taxId: c.taxId || "",
          paymentTermsDays: c.paymentTermsDays,
          salespersonId: c.salespersonId || "",
          region: c.region || "",
          tier: c.tier || "",
          gpsLatitude: c.gpsLatitude?.toString() || "",
          gpsLongitude: c.gpsLongitude?.toString() || "",
          isActive: c.isActive,
        });
      } else {
        toast.error("Customer not found");
        router.push("/sales/customers");
      }
    } catch {
      toast.error("Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const fetchTransactions = useCallback(async () => {
    if (!id) return;
    setTransactionsLoading(true);
    try {
      const [soRes, invRes] = await Promise.all([
        fetch(`/api/sales-orders?customerId=${id}&pageSize=50`),
        fetch(`/api/invoices?customerId=${id}&pageSize=50`),
      ]);
      const soJson = await soRes.json();
      const invJson = await invRes.json();
      if (soJson.success) setSalesOrders(soJson.data.items ?? []);
      if (invJson.success) setInvoices(invJson.data.items ?? []);
    } catch {
      setSalesOrders([]);
      setInvoices([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && customer) fetchTransactions();
  }, [id, customer, fetchTransactions]);

  /** Saves the detail form to the API */
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || "",
        taxId: form.taxId || undefined,
        paymentTermsDays: form.paymentTermsDays,
        salespersonId: form.salespersonId || undefined,
        region: form.region || undefined,
        tier: form.tier || undefined,
        gpsLatitude: form.gpsLatitude ? parseFloat(form.gpsLatitude) : undefined,
        gpsLongitude: form.gpsLongitude ? parseFloat(form.gpsLongitude) : undefined,
        isActive: form.isActive,
      };

      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        toast.success("Customer updated");
        setCustomer(json.data);
      } else {
        toast.error(json.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /** Adds a new contact via the API */
  const handleAddContact = async () => {
    if (!contactForm.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    setContactSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name,
          phone: contactForm.phone || undefined,
          email: contactForm.email || "",
          position: contactForm.position || undefined,
          isPrimary: contactForm.isPrimary,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setContacts((prev) => [...prev, json.data]);
        setContactForm(emptyContactForm);
        setAddingContact(false);
        toast.success("Contact added");
      } else {
        toast.error(json.error || "Failed to add contact");
      }
    } catch {
      toast.error("Failed to add contact");
    } finally {
      setContactSaving(false);
    }
  };

  /** Saves edited contact via the API */
  const handleUpdateContact = async () => {
    if (!editingContactId || !contactForm.name.trim()) return;
    setContactSaving(true);
    try {
      const res = await fetch(
        `/api/customers/${id}/contacts/${editingContactId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactForm.name,
            phone: contactForm.phone || undefined,
            email: contactForm.email || "",
            position: contactForm.position || undefined,
            isPrimary: contactForm.isPrimary,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setContacts((prev) =>
          prev.map((c) => (c.id === editingContactId ? json.data : c))
        );
        setEditingContactId(null);
        setContactForm(emptyContactForm);
        toast.success("Contact updated");
      } else {
        toast.error(json.error || "Failed to update contact");
      }
    } catch {
      toast.error("Failed to update contact");
    } finally {
      setContactSaving(false);
    }
  };

  /** Deletes a contact via the API */
  const handleDeleteContact = async () => {
    if (!deleteContactId) return;
    setContactSaving(true);
    try {
      const res = await fetch(
        `/api/customers/${id}/contacts/${deleteContactId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        setContacts((prev) => prev.filter((c) => c.id !== deleteContactId));
        toast.success("Contact removed");
      } else {
        toast.error(json.error || "Failed to remove contact");
      }
    } catch {
      toast.error("Failed to remove contact");
    } finally {
      setContactSaving(false);
      setDeleteContactId(null);
    }
  };

  /** Starts editing a contact inline */
  const startEditContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setAddingContact(false);
    setContactForm({
      name: contact.name,
      phone: contact.phone || "",
      email: contact.email || "",
      position: contact.position || "",
      isPrimary: contact.isPrimary,
    });
  };

  const cancelContactEdit = () => {
    setEditingContactId(null);
    setAddingContact(false);
    setContactForm(emptyContactForm);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/sales/customers")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              {ta("history")}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">{t("editCustomer")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("contacts")}</TabsTrigger>
          <TabsTrigger value="transactions">
            {t("transactionHistory")}
          </TabsTrigger>
          <TabsTrigger value="history">{ta("history")}</TabsTrigger>
        </TabsList>

        {/* ─── Details Tab ─── */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>{t("editCustomer")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("name")} *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">{t("taxId")}</Label>
                  <Input
                    id="taxId"
                    value={form.taxId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxId: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTermsDays">{t("paymentTerms")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="paymentTermsDays"
                      type="number"
                      min={0}
                      value={form.paymentTermsDays}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          paymentTermsDays: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">{t("region")}</Label>
                  <Input
                    id="region"
                    value={form.region}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, region: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">{t("tier")}</Label>
                  <Input
                    id="tier"
                    value={form.tier}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tier: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salespersonId">Salesperson ID</Label>
                  <Input
                    id="salespersonId"
                    value={form.salespersonId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        salespersonId: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t("address")}</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              {/* GPS Coordinates */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Label>{t("gpsCoordinates")}</Label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gpsLatitude" className="text-xs text-muted-foreground">
                      Latitude
                    </Label>
                    <Input
                      id="gpsLatitude"
                      type="number"
                      step="any"
                      value={form.gpsLatitude}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          gpsLatitude: e.target.value,
                        }))
                      }
                      placeholder="-6.2088"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gpsLongitude" className="text-xs text-muted-foreground">
                      Longitude
                    </Label>
                    <Input
                      id="gpsLongitude"
                      type="number"
                      step="any"
                      value={form.gpsLongitude}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          gpsLongitude: e.target.value,
                        }))
                      }
                      placeholder="106.8456"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Map picker will be available when Google Maps API key is
                  configured.
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isActive: checked }))
                  }
                />
                <Label>
                  {form.isActive ? "Active" : "Inactive"}
                </Label>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? tc("loading") : tc("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Contacts Tab ─── */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("contacts")}</CardTitle>
              {!addingContact && !editingContactId && (
                <Button
                  size="sm"
                  onClick={() => {
                    setAddingContact(true);
                    setContactForm(emptyContactForm);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("phone")}</TableHead>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead className="w-24">{tc("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Inline add row */}
                    {addingContact && (
                      <TableRow className="bg-blue-50/50">
                        <TableCell>
                          <Input
                            value={contactForm.name}
                            onChange={(e) =>
                              setContactForm((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Name *"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={contactForm.phone}
                            onChange={(e) =>
                              setContactForm((f) => ({
                                ...f,
                                phone: e.target.value,
                              }))
                            }
                            placeholder="Phone"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={contactForm.email}
                            onChange={(e) =>
                              setContactForm((f) => ({
                                ...f,
                                email: e.target.value,
                              }))
                            }
                            placeholder="Email"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={contactForm.position}
                            onChange={(e) =>
                              setContactForm((f) => ({
                                ...f,
                                position: e.target.value,
                              }))
                            }
                            placeholder="Position"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={contactForm.isPrimary}
                            onCheckedChange={(checked) =>
                              setContactForm((f) => ({
                                ...f,
                                isPrimary: checked,
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={handleAddContact}
                              disabled={contactSaving}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={cancelContactEdit}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {contacts.map((contact) =>
                      editingContactId === contact.id ? (
                        <TableRow key={contact.id} className="bg-blue-50/50">
                          <TableCell>
                            <Input
                              value={contactForm.name}
                              onChange={(e) =>
                                setContactForm((f) => ({
                                  ...f,
                                  name: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={contactForm.phone}
                              onChange={(e) =>
                                setContactForm((f) => ({
                                  ...f,
                                  phone: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={contactForm.email}
                              onChange={(e) =>
                                setContactForm((f) => ({
                                  ...f,
                                  email: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={contactForm.position}
                              onChange={(e) =>
                                setContactForm((f) => ({
                                  ...f,
                                  position: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={contactForm.isPrimary}
                              onCheckedChange={(checked) =>
                                setContactForm((f) => ({
                                  ...f,
                                  isPrimary: checked,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={handleUpdateContact}
                                disabled={contactSaving}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelContactEdit}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contact.name}
                          </TableCell>
                          <TableCell>{contact.phone || "—"}</TableCell>
                          <TableCell>{contact.email || "—"}</TableCell>
                          <TableCell>{contact.position || "—"}</TableCell>
                          <TableCell>
                            {contact.isPrimary && (
                              <StatusBadge status="active" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => startEditContact(contact)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setDeleteContactId(contact.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}

                    {contacts.length === 0 && !addingContact && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-20 text-center text-muted-foreground"
                        >
                          No contacts yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Transaction History Tab ─── */}
        <TabsContent value="transactions">
          <div className="space-y-6">
            {transactionsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : salesOrders.length === 0 && invoices.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-12 w-12" />}
                title="Transaction History"
                description="No sales orders or invoices yet for this customer."
              />
            ) : (
              <>
                {salesOrders.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Sales Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SO Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesOrders.map((so) => (
                            <TableRow
                              key={so.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => router.push(`/sales/orders/${so.id}`)}
                            >
                              <TableCell className="font-medium text-primary">{so.soNumber}</TableCell>
                              <TableCell>{format(new Date(so.createdAt), "dd MMM yyyy")}</TableCell>
                              <TableCell><StatusBadge status={so.status} /></TableCell>
                              <TableCell className="text-right">
                                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(so.grandTotal)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                {invoices.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Invoices
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoices.map((inv) => {
                            const balance = inv.grandTotal - inv.amountPaid;
                            return (
                              <TableRow
                                key={inv.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => router.push(`/sales/invoices/${inv.id}`)}
                              >
                                <TableCell className="font-medium text-primary">{inv.invoiceNumber}</TableCell>
                                <TableCell>{format(new Date(inv.createdAt), "dd MMM yyyy")}</TableCell>
                                <TableCell><StatusBadge status={inv.status} /></TableCell>
                                <TableCell className="text-right">
                                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(inv.grandTotal)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={balance > 0 ? "text-destructive font-medium" : ""}>
                                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(balance)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ─── Audit History Tab ─── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {ta("history")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setHistoryOpen(true)}
              >
                <Clock className="mr-2 h-4 w-4" />
                Open Audit Trail
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        entityType="Customer"
        entityId={id}
        title={`${customer.name} — ${ta("history")}`}
      />

      {/* Delete Contact Dialog */}
      <AlertDialog
        open={!!deleteContactId}
        onOpenChange={(open) => !open && setDeleteContactId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this contact?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={contactSaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {contactSaving ? tc("loading") : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
