"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Package,
  Users,
  Building2,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  CreditCard,
  Truck,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  DashboardData,
  StaffDashboardData,
  LowStockProduct,
  RecentActivityItem,
  DailySalesItem,
  TopProductItem,
  TopCustomerItem,
  PendingApprovals,
  TodayTripItem,
  SalespersonPerformanceItem,
} from "@/services/dashboard.service";

/** Action badge color mapping: CREATE=green, UPDATE=blue, DELETE=red */
function getActionBadgeClass(action: string): string {
  switch (action) {
    case "CREATE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "UPDATE":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "DELETE":
      return "bg-red-100 text-red-800 border-red-200";
    case "APPROVE":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "REJECT":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "EXPORT":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

/** Staff/Salesperson dashboard: my sales today, monthly target, open SOs, pending commission, recent activity */
function StaffDashboardView({
  data,
  userName,
  t,
  tCommon,
}: {
  data: StaffDashboardData;
  userName?: string;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const targetPct = data.myMonthlyTarget > 0
    ? Math.min(100, (data.myMonthlyActual / data.myMonthlyTarget) * 100)
    : (data.myMonthlyActual > 0 ? 100 : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcomeBack")}, {userName ?? "User"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your sales overview.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("mySalesToday")}</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.mySalesToday)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{t("myMonthlyTarget")}</p>
          <p className="text-lg font-bold mt-1">{formatCurrency(data.myMonthlyActual)} / {formatCurrency(data.myMonthlyTarget)}</p>
          <Progress value={targetPct} max={100} className="mt-2 h-2" />
        </Card>
        <Link href="/sales/orders">
          <Card className="p-6 cursor-pointer hover:bg-muted/50 transition-colors h-full">
            <p className="text-sm text-muted-foreground">{t("myOpenSOs")}</p>
            <p className="text-2xl font-bold mt-1">{data.myOpenSoCount}</p>
          </Card>
        </Link>
        <Link href="/sales/commissions">
          <Card className="p-6 cursor-pointer hover:bg-muted/50 transition-colors h-full">
            <p className="text-sm text-muted-foreground">{t("myPendingCommissions")}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data.myPendingCommission)}</p>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">{t("recentActivity")}</CardTitle>
          <Link href="/settings/audit-trail" className="text-sm text-primary hover:underline flex items-center gap-1">
            {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{tCommon("noData")}</p>
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map((item) => (
                <RecentActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DashboardClientProps {
  userName?: string;
  userRole?: string;
}

type DashboardResponse =
  | { view: "admin"; data: DashboardData }
  | { view: "staff"; data: StaffDashboardData };

/**
 * Dashboard client component with KPI cards and widgets.
 * Fetches data on mount from /api/dashboard. STAFF users see role-specific dashboard.
 */
export function DashboardClient({ userName, userRole }: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const tProducts = useTranslations("products");
  const tCommon = useTranslations("common");
  const [response, setResponse] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lowStockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error("Failed to load dashboard");
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? "Failed");
        setResponse(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const scrollToLowStock = () => {
    lowStockRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-destructive">
        {error}
      </div>
    );
  }

  if (!response) return null;

  if (response.view === "staff") {
    return (
      <StaffDashboardView
        data={response.data}
        userName={userName}
        t={t}
        tCommon={tCommon}
      />
    );
  }

  const data = response.data;
  const {
    stats,
    lowStockProducts,
    recentActivity,
    arAging,
    monthlySalesTrend = [],
    topProducts = [],
    topCustomers = [],
    pendingApprovals = { soCount: 0, expenseCount: 0, leaveCount: 0, total: 0 },
    todaysDeliveries = [],
    salespersonPerformance = [],
  } = data;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, notation: "compact" }).format(val);

  const yesterdaySales = "yesterdaySales" in stats ? stats.yesterdaySales : 0;
  const salesChangePct =
    yesterdaySales > 0
      ? ((stats.todaysSales - yesterdaySales) / yesterdaySales) * 100
      : null;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("welcomeBack")}, {userName ?? "User"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your BatuFlow ERP.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label={t("totalProducts")} value={stats.totalProducts} icon={Package} color="blue" />
        <KpiCard label={t("totalCustomers")} value={stats.totalCustomers} icon={Users} color="green" />
        <KpiCard label={t("totalWarehouses")} value={stats.totalWarehouses} icon={Building2} color="purple" />
        <KpiCard label={t("lowStockAlerts")} value={stats.lowStockCount} icon={AlertTriangle} color="amber" onClick={scrollToLowStock} clickable />
        <CurrencyKpiCard label={t("todaysSales")} value={stats.todaysSales} icon={DollarSign} color="blue" salesChangePct={salesChangePct} />
        <CurrencyKpiCard label={t("outstandingAR")} value={stats.outstandingAR} icon={CreditCard} color="amber" href="/sales/invoices" />
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts - ACTIVE */}
        <div ref={lowStockRef}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {t("lowStockAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {t("noLowStock")}
              </p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((product) => (
                  <LowStockRow key={product.id} product={product} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* AR Aging Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-600" />
                {t("arAgingSummary")}
              </span>
              <Link href="/sales/invoices/aging" className="text-sm text-primary hover:underline flex items-center gap-1">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {arAging && arAging.length > 0 ? (
              <div className="space-y-3">
                {arAging.map((bucket) => {
                  const maxVal = Math.max(...arAging.map((b) => b.amount), 1);
                  const pct = Math.max((bucket.amount / maxVal) * 100, 2);
                  return (
                    <div key={bucket.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{bucket.label}</span>
                        <span className="font-medium">{formatCurrency(bucket.amount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{tCommon("noData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Sales Trend */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              {t("monthlySalesTrend")}
            </CardTitle>
            <Link href="/sales/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
              {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {monthlySalesTrend && monthlySalesTrend.length > 0 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySalesTrend.map((d) => ({ ...d, day: d.date.slice(8, 10) }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`)} />
                    <Tooltip formatter={(v: number | undefined) => [v != null ? formatCurrency(v) : "0", t("todaysSales")]} labelFormatter={(l) => `Day ${l}`} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{tCommon("noData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Top 10 Products */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              {t("topProducts")}
            </CardTitle>
            <Link href="/inventory/products" className="text-sm text-primary hover:underline flex items-center gap-1">
              {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {topProducts && topProducts.length > 0 ? (
              <div className="space-y-2">
                {topProducts.slice(0, 10).map((p) => (
                  <Link
                    key={p.id}
                    href={`/inventory/products/${p.id}`}
                    className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50 transition-colors text-sm"
                  >
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{formatCurrency(p.revenue)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{tCommon("noData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Top 10 Customers */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-600" />
              {t("topCustomers")}
            </CardTitle>
            <Link href="/sales/customers" className="text-sm text-primary hover:underline flex items-center gap-1">
              {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {topCustomers && topCustomers.length > 0 ? (
              <div className="space-y-2">
                {topCustomers.slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/sales/customers/${c.id}`}
                    className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50 transition-colors text-sm"
                  >
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{formatCurrency(c.totalAmount)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{tCommon("noData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {t("pendingApprovals")}
            </CardTitle>
            {(pendingApprovals?.total ?? 0) > 0 && (
              <Link href="/sales/orders?status=WAITING_APPROVAL" className="text-sm text-primary hover:underline flex items-center gap-1">
                {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {pendingApprovals && pendingApprovals.total > 0 ? (
              <div className="space-y-2">
                {pendingApprovals.soCount > 0 && (
                  <Link href="/sales/orders?status=WAITING_APPROVAL" className="flex justify-between rounded-lg border p-2 hover:bg-muted/50 text-sm">
                    <span>{t("salesOrders")}</span>
                    <Badge variant="secondary">{pendingApprovals.soCount}</Badge>
                  </Link>
                )}
                {pendingApprovals.expenseCount > 0 && (
                  <Link href="/expenses" className="flex justify-between rounded-lg border p-2 hover:bg-muted/50 text-sm">
                    <span>{t("expenses")}</span>
                    <Badge variant="secondary">{pendingApprovals.expenseCount}</Badge>
                  </Link>
                )}
                {pendingApprovals.leaveCount > 0 && (
                  <Link href="/hr/leave" className="flex justify-between rounded-lg border p-2 hover:bg-muted/50 text-sm">
                    <span>{t("leave")}</span>
                    <Badge variant="secondary">{pendingApprovals.leaveCount}</Badge>
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("noPendingApprovals")}</p>
            )}
          </CardContent>
        </Card>

        {/* Today's Deliveries */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              {t("todaysDeliveries")}
            </CardTitle>
            <Link href="/delivery/trips" className="text-sm text-primary hover:underline flex items-center gap-1">
              {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {todaysDeliveries && todaysDeliveries.length > 0 ? (
              <div className="space-y-2">
                {todaysDeliveries.map((trip) => (
                  <Link
                    key={trip.id}
                    href={`/delivery/trips/${trip.id}`}
                    className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50 transition-colors text-sm"
                  >
                    <div>
                      <p className="font-medium">{trip.tripNumber}</p>
                      <p className="text-xs text-muted-foreground">{trip.driverName} · {trip.doCount} DO(s)</p>
                    </div>
                    <Badge variant="outline">{trip.status}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{t("noTripsToday")}</p>
            )}
          </CardContent>
        </Card>

        {/* Salesperson Performance */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              {t("salespersonPerformance")}
            </CardTitle>
            <Link href="/sales/analytics" className="text-sm text-primary hover:underline flex items-center gap-1">
              {t("viewAuditTrail")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {salespersonPerformance && salespersonPerformance.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salespersonPerformance.map((s) => ({ name: s.userName.length > 12 ? s.userName.slice(0, 11) + "…" : s.userName, sales: s.salesAmount, visits: s.visitCount }))} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`)} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | undefined) => [v != null ? formatCurrency(v) : "0", t("sales")]} />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">{tCommon("noData")}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity - at bottom, full width */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">
                {t("recentActivity")}
              </CardTitle>
              <Link
                href="/settings/audit-trail"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t("viewAuditTrail")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  {tCommon("noData")}
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <RecentActivityRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
  clickable,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "green" | "purple" | "amber";
  onClick?: () => void;
  clickable?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-emerald-500/10 text-emerald-600",
    purple: "bg-violet-500/10 text-violet-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <Card
      className={`flex flex-row items-center gap-4 p-6 ${clickable ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
      onClick={clickable ? onClick : undefined}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses[color]}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function CurrencyKpiCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  salesChangePct,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "green" | "purple" | "amber";
  href?: string;
  salesChangePct?: number | null;
}) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-emerald-500/10 text-emerald-600",
    purple: "bg-violet-500/10 text-violet-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    notation: "compact",
  }).format(value);

  const content = (
    <div className="flex items-center gap-4 w-full">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold">{formatted}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {salesChangePct != null && (
          <p className={`text-xs mt-0.5 ${salesChangePct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {salesChangePct >= 0 ? "+" : ""}{salesChangePct.toFixed(1)}% vs yesterday
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="flex flex-row items-center gap-4 p-6 cursor-pointer hover:bg-muted/50 transition-colors">
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="flex flex-row items-center gap-4 p-6">
      {content}
    </Card>
  );
}

function LowStockRow({ product }: { product: LowStockProduct }) {
  const t = useTranslations("dashboard");
  const tProducts = useTranslations("products");
  return (
    <Link
      href={`/inventory/products/${product.id}`}
      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
    >
      <div>
        <p className="font-medium text-sm">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {tProducts("sku")}: {product.sku}
        </p>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {t("currentStock")}: {product.currentStock}
        </span>
        <span>
          {tProducts("minStock")}: {product.minStock}
        </span>
      </div>
    </Link>
  );
}

function RecentActivityRow({ item }: { item: RecentActivityItem }) {
  const initial = item.userName.charAt(0).toUpperCase();
  const relativeTime = formatDistanceToNow(new Date(item.timestamp), {
    addSuffix: true,
  });
  const badgeClass = getActionBadgeClass(item.action);
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`text-xs ${badgeClass}`}>
            {item.action}
          </Badge>
          <span className="text-sm truncate">
            {item.entityLabel || item.entityType}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.userName} · {relativeTime}
        </p>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for dashboard while data is fetching.
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
