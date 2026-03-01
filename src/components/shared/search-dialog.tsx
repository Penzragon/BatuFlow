"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Package, Users, History, ShoppingCart, FileText, Truck, UserCircle, Receipt } from "lucide-react";

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";

/** Product search result from API. */
interface ProductResult {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
}

/** Customer search result from API. */
interface CustomerResult {
  id: string;
  name: string;
  phone: string | null;
  taxId: string | null;
}

/** Recent search record from API. */
interface RecentSearchRecord {
  id: string;
  query: string;
  createdAt: string;
}

/** Props for the SearchDialog component. */
interface SearchDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Global search dialog opened via Ctrl+K / Cmd+K.
 * Displays recent searches when empty, and grouped product/customer results when typing.
 * Clicking a result navigates to the detail page.
 */
export function SearchDialog({
  open,
  onOpenChange,
}: SearchDialogProps) {
  const router = useRouter();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [salesOrders, setSalesOrders] = useState<{ id: string; soNumber: string; customerName: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoiceNumber: string; customerName: string }[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<{ id: string; doNumber: string; customerName: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; nik: string | null; department: string | null }[]>([]);
  const [expenses, setExpenses] = useState<{ id: string; expenseNumber: string; description: string | null; referenceNo: string | null; status: string }[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Fetches recent searches from the API.
   */
  const fetchRecentSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/search/recent");
      if (!res.ok) return;
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setRecentSearches(json.data);
      }
    } catch {
      // Ignore fetch errors (e.g. offline)
    }
  }, []);

  /**
   * Fetches search results from the API.
   * Only runs when query has at least MIN_QUERY_LENGTH characters.
   */
  const fetchSearchResults = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setCustomers([]);
      setSalesOrders([]);
      setInvoices([]);
      setDeliveryOrders([]);
      setEmployees([]);
      setExpenses([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setProducts([]);
        setCustomers([]);
        setSalesOrders([]);
        setInvoices([]);
        setDeliveryOrders([]);
        setEmployees([]);
        setExpenses([]);
        return;
      }
      const json = await res.json();
      if (json?.success && json.data) {
        setProducts(json.data.products ?? []);
        setCustomers(json.data.customers ?? []);
        setSalesOrders(json.data.salesOrders ?? []);
        setInvoices(json.data.invoices ?? []);
        setDeliveryOrders(json.data.deliveryOrders ?? []);
        setEmployees(json.data.employees ?? []);
        setExpenses(json.data.expenses ?? []);
      }
    } catch {
      setProducts([]);
      setCustomers([]);
      setSalesOrders([]);
      setInvoices([]);
      setDeliveryOrders([]);
      setEmployees([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Handles keyboard shortcut Ctrl+K / Cmd+K. */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  /** Load recent searches when dialog opens. */
  useEffect(() => {
    if (open) {
      fetchRecentSearches();
    }
  }, [open, fetchRecentSearches]);

  /** Debounced search when query changes. */
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setProducts([]);
      setCustomers([]);
      setSalesOrders([]);
      setInvoices([]);
      setDeliveryOrders([]);
      setEmployees([]);
      setExpenses([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      fetchSearchResults(trimmed);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, fetchSearchResults]);

  /** Reset state when dialog closes. */
  useEffect(() => {
    if (!open) {
      setQuery("");
      setProducts([]);
      setCustomers([]);
      setSalesOrders([]);
      setInvoices([]);
      setDeliveryOrders([]);
      setEmployees([]);
      setExpenses([]);
    }
  }, [open]);

  const showRecent = query.trim().length < MIN_QUERY_LENGTH && recentSearches.length > 0;
  const hasSearchResults =
    products.length > 0 || customers.length > 0 || salesOrders.length > 0 || invoices.length > 0 ||
    deliveryOrders.length > 0 || employees.length > 0 || expenses.length > 0;
  const showSearchResults = query.trim().length >= MIN_QUERY_LENGTH && hasSearchResults;
  const isEmpty =
    !showRecent &&
    !showSearchResults &&
    !loading &&
    (query.trim().length >= MIN_QUERY_LENGTH || query.trim().length === 0);

  const handleSelectProduct = (id: string) => {
    onOpenChange(false);
    router.push(`/inventory/products/${id}`);
  };

  const handleSelectCustomer = (id: string) => {
    onOpenChange(false);
    router.push(`/sales/customers/${id}`);
  };

  const handleSelectRecent = (q: string) => {
    setQuery(q);
  };

  const handleSelectDeliveryOrder = (id: string) => {
    onOpenChange(false);
    router.push(`/sales/delivery-orders/${id}`);
  };

  const handleSelectEmployee = (id: string) => {
    onOpenChange(false);
    router.push(`/hr/employees/${id}`);
  };

  const handleSelectExpense = (id: string) => {
    onOpenChange(false);
    router.push(`/expenses/${id}`);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("searchPlaceholder")}
      description={tCommon("search")}
      className="max-w-2xl"
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput
        placeholder={t("searchPlaceholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {tCommon("loading")}
          </div>
        )}
        {!loading && showRecent && (
          <CommandGroup heading={t("recentSearches")}>
            {recentSearches.map((r) => (
              <CommandItem
                key={r.id}
                value={`recent-${r.id}`}
                onSelect={() => handleSelectRecent(r.query)}
                className="flex items-center gap-2"
              >
                <History className="size-4 shrink-0 text-muted-foreground" />
                <span>{r.query}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && showSearchResults && (
          <>
            {products.length > 0 && (
              <CommandGroup
                heading={t("products")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {products.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`product-${p.id}`}
                    onSelect={() => handleSelectProduct(p.id)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Package className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.sku}
                        {p.brand ? ` • ${p.brand}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {customers.length > 0 && (
              <CommandGroup
                heading={t("customers")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {customers.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`customer-${c.id}`}
                    onSelect={() => handleSelectCustomer(c.id)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Users className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.phone ?? c.taxId ?? "—"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {salesOrders.length > 0 && (
              <CommandGroup
                heading={t("salesOrders")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {salesOrders.map((so) => (
                  <CommandItem
                    key={so.id}
                    value={`so-${so.id}`}
                    onSelect={() => { onOpenChange(false); router.push(`/sales/orders/${so.id}`); }}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <ShoppingCart className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{so.soNumber}</span>
                      <span className="text-xs text-muted-foreground">{so.customerName}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {invoices.length > 0 && (
              <CommandGroup
                heading={t("invoices")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {invoices.map((inv) => (
                  <CommandItem
                    key={inv.id}
                    value={`inv-${inv.id}`}
                    onSelect={() => { onOpenChange(false); router.push(`/sales/invoices/${inv.id}`); }}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{inv.invoiceNumber}</span>
                      <span className="text-xs text-muted-foreground">{inv.customerName}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {deliveryOrders.length > 0 && (
              <CommandGroup
                heading={t("deliveryOrders")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {deliveryOrders.map((do_) => (
                  <CommandItem
                    key={do_.id}
                    value={`do-${do_.id}`}
                    onSelect={() => handleSelectDeliveryOrder(do_.id)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Truck className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{do_.doNumber}</span>
                      <span className="text-xs text-muted-foreground">{do_.customerName}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {employees.length > 0 && (
              <CommandGroup
                heading={t("employees")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {employees.map((emp) => (
                  <CommandItem
                    key={emp.id}
                    value={`emp-${emp.id}`}
                    onSelect={() => handleSelectEmployee(emp.id)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <UserCircle className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{emp.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {emp.nik ?? emp.department ?? "—"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {expenses.length > 0 && (
              <CommandGroup
                heading={t("expenses")}
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-2"
              >
                {expenses.map((ex) => (
                  <CommandItem
                    key={ex.id}
                    value={`exp-${ex.id}`}
                    onSelect={() => handleSelectExpense(ex.id)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Receipt className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{ex.expenseNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {ex.description ?? ex.referenceNo ?? "—"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
        {isEmpty && <CommandEmpty>{tCommon("noData")}</CommandEmpty>}
      </CommandList>
    </CommandDialog>
  );
}
