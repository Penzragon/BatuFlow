# BatuFlow — Product Specification Document

> **Version:** 1.0  
> **Date:** March 1, 2026  
> **Status:** Living Document  
> **Related:** [PRD.md](../PRD.md) (Product Requirements Document)

---

## 1. Product Overview

### 1.1 Vision

**BatuFlow** is a lightweight ERP for small distribution and wholesale businesses. It digitizes the full sales-to-cash cycle (Sales Order → Delivery → AR Invoice → Payment), inventory, finance, HR, expenses, delivery, and warehouse operations in one system. Every change is auditable with field-level history.

### 1.2 Product Type

- **Category:** ERP for Distribution & Wholesale  
- **Deployment:** Single-company, 1–10 concurrent users  
- **Languages:** English (default), Bahasa Indonesia  
- **Platform:** Web (desktop-first); driver and warehouse views are mobile-optimized PWAs

### 1.3 Value Proposition

| Stakeholder   | Benefit |
|---------------|--------|
| **Owner/Admin** | One system for sales, stock, finance, HR, and delivery; full audit trail and reports. |
| **Sales**       | Visit check-in, SO creation with auto price tiers, commission tracking, CRM. |
| **Warehouse**   | Pick lists, goods receipt, stock opname, handover to driver — all in one place. |
| **Driver**      | Assigned trips, navigation links, delivery proof with photo + GPS. |
| **Finance**     | COA, journals, expenses, payroll, period closing, PPN and financial reports. |

---

## 2. Target Users & Roles

| Role             | Description | Primary Use Cases |
|------------------|-------------|-------------------|
| **Admin**        | System owner / IT | Full access: settings, users, roles, audit, import, all modules. |
| **Manager**      | Department head   | Approve orders/expenses/leave, view reports, override prices, audit trail. |
| **Staff**        | Sales / operator  | Create/edit own SOs, DOs, invoices; view assigned data; no approvals. |
| **Driver**       | Delivery personnel | View trips/DOs, update delivery status, upload proof photo; no pricing/finance. |
| **Warehouse Staff** | Floor operator | Receipts, pick & pack, opname, handover; view stock; no pricing/finance/HR. |

Roles are configurable; Admin can add custom roles and adjust permissions per module.

---

## 3. Feature Specifications

### 3.1 Sales & CRM

#### 3.1.1 Sales Visit Check-In

**Purpose:** Require physical presence at the customer store before creating a Sales Order.

**User flow:**
1. Salesperson selects customer → system opens camera.
2. Salesperson takes selfie at store.
3. System captures: GPS (lat/long), timestamp (watermarked on photo), customer name (watermarked).
4. Photo uploaded → Visit record created with status **Checked In**.

**Business rules:**
- Valid check-in **required** before creating any SO for that customer.
- One check-in per visit; multiple SOs allowed under same visit.
- Check-in **expires after 8 hours** (configurable); new visit requires new check-in.
- Optional distance warning if GPS &gt; 500 m from customer address (configurable, non-blocking).
- If camera or GPS unavailable → check-in blocked with clear error.

**Acceptance criteria:**
- [ ] Visit log stores: salesperson, customer, selfie path, GPS, timestamp, list of SOs.
- [ ] Manager can view visit history by salesperson or customer.
- [ ] Visit report: daily/weekly summary with map view of locations.
- [ ] Photos stored under `/uploads/visits/`, max 1 MB, server-side watermark.

---

#### 3.1.2 Customer Management

**Data model (key fields):** Name, address, phone, email, tax ID (NPWP), payment terms, grouping, contact persons.  
**GPS:** Latitude/longitude of store — manual entry, map picker, or first visit check-in. Used for navigation, visit validation, delivery maps.

**Acceptance criteria:**
- [ ] CRUD for customers; transaction history view per customer.
- [ ] GPS optional; support map picker and display in visit/delivery context.

---

#### 3.1.3 Sales Order (SO)

**Prerequisite:** Active visit check-in for the selected customer.

**Behavior:**
- Line items: product, qty, unit price, discount, tax.
- **Price tier** auto-applied by quantity (see Inventory § Product Master).
- Totals, PPN, grand total auto-calculated.
- Manager approval required for discount above threshold or manual price override.

**Status flow:** Draft → Confirmed → Partially Delivered → Fully Delivered → Closed / Cancelled.

**Acceptance criteria:**
- [ ] SO creation blocked without valid visit check-in for that customer.
- [ ] PDF/print for SO available.

---

#### 3.1.4 Delivery Order (DO)

**Behavior:**
- Created from confirmed SO (partial or full).
- On DO confirm → **Pick List** auto-created for warehouse.
- DO assignable to **Trip** only when pick & pack = **Ready for Handover**.
- Stock reduced on DO confirmation.
- Delivery proof photo linked on successful delivery.

**Status flow:** Draft → Confirmed → Picking → Packed → Ready for Handover → Assigned to Trip → Picked Up → On The Way → Delivered → Failed.

**Acceptance criteria:**
- [ ] Packing slip / surat jalan printable.
- [ ] Delivery date, driver (via trip), vehicle (via trip) tracked.

---

#### 3.1.5 AR Invoice

**Behavior:**
- Invoice from delivered DO (partial or full).
- Due date from customer payment terms.
- Payments linkable to invoices (partial and full).

**Status flow:** Draft → Issued → Partially Paid → Paid → Overdue.

**Reports:** Aging (current, 30, 60, 90, 120+ days).

**Acceptance criteria:**
- [ ] Aging report and payment matching available.

---

#### 3.1.6 Sales Commission

**Behavior:**
- Rules per salesperson: % of sales, % of gross profit, or tiered (e.g. 3% up to 100M, 5% above).
- Period: monthly or custom range.
- Commission calculated on **paid invoices** in period.
- Report per salesperson with drill-down to invoices; export Excel/PDF.

**Acceptance criteria:**
- [ ] Commission report and export match PRD rules.

---

#### 3.1.7 CRM

**Scope:** Lead/prospect pipeline, activity log per customer (calls, visits, notes), sales targets and achievement dashboard, visit frequency (last visit, visit count).

---

### 3.2 Inventory & Warehouse (Data)

#### 3.2.1 Product Master

**Fields:** SKU, name, description, category, brand, UOM, multiple UOM with conversion ratios.

**Capital cost (modal):**
- Full history: every change logged (date, source, previous value).
- Current cost on product card; history view (date, old/new cost, user, reason).
- Gross margin: `(sell price − capital cost) / sell price × 100%`.

**Price tiering by quantity:**
- Quantity-based price breaks (e.g. 1–10 pcs = X, 11–50 = Y, 51+ = Z).
- Unlimited tiers per product.
- SO line auto-selects tier by line quantity; Manager override allowed (audited).

**Other:** Sell price (base), min/max stock, optional image, active/inactive.

**Acceptance criteria:**
- [ ] Capital cost history and margin calculation correct.
- [ ] Tier price applied on SO line by qty; override logged.

---

#### 3.2.2 Warehouse / Location

- Single warehouse with multiple storage locations/zones.
- Default warehouse for transactions configurable.

---

#### 3.2.3 Stock Movements & Reports

- **In:** Goods receipt or manual adjustment.  
- **Out:** Delivery order or manual adjustment.  
- **Adjustment:** Reconciliation with notes and approval.  
- All movements create stock ledger entries.

**Reports:** Current stock by product/location, movement history (date/product/type), low stock alerts, stock valuation (weighted average).

---

### 3.3 Accounting & Finance

- **COA:** Indonesian distribution template; Asset, Liability, Equity, Revenue, COGS, Expense; customizable.
- **General Ledger:** Double-entry; auto entries from AR/AP (future), inventory (COGS), payroll, approved expenses; manual entries for adjustments.
- **Cash & Bank:** Receipts, disbursements, bank accounts, manual reconciliation.
- **Tax:** PPN on sales/purchases, tax invoice numbering, monthly PPN summary.
- **Reports:** Income Statement, Balance Sheet, Cash Flow, Trial Balance, GL detail — export Excel/PDF.
- **Period closing:** Monthly close (validate, lock); year-end with retained earnings.

---

### 3.4 HR & Payroll

- **Employee master:** Personal and employment data, salary structure, documents, active/resigned.
- **Attendance:** Daily log, clock-in/out, late/absent/half-day; monthly summary.
- **Leave:** Configurable types, balance per year, request → Manager approval, history.
- **Payroll:** Monthly run (salary + allowances − deductions − absences, BPJS, PPh 21); payslip PDF; journal auto-post to Accounting.

---

### 3.5 Expense Management

- **Categories:** Pre-set + configurable; each category maps to COA for auto posting.
- **Entry:** Date, category, amount, description, payment method, reference.
- **Workflow:** Draft → Submitted → Approved / Rejected (with reason). Approved → auto journal (debit expense, credit cash/bank).
- **Reports:** By category, period, user; trend; export Excel/PDF.

---

### 3.6 Delivery & Driver Management

#### 3.6.1 Vehicles & Trips

- **Vehicles:** Plate, type, capacity, status (available / in-use / maintenance).
- **Trip:** One driver + one vehicle; multiple DOs in status **Ready for Handover**. Status: Planned → In Progress → Completed. Trip sheet printable.

#### 3.6.2 Driver Assignment & Status

- Drivers = employees with Driver role. Each DO via trip; each trip one driver + one vehicle.
- Driver sees only own trips/DOs.
- Per-DO status (driver-updated): Pending → Picked Up → On The Way → Delivered / Failed. Delivered requires proof photo; Failed requires reason. All changes timestamped; Manager sees delivery board.

#### 3.6.3 Delivery Proof

- Photo at delivery; system captures GPS and watermarks timestamp, DO number, customer name. Stored and linked to DO. Failed: reason + optional note/photo.

#### 3.6.4 Driver Mobile View (PWA)

- **Path:** `/driver`. Mobile-optimized; login with employee credentials.
- **Features:** Today’s trips and DOs, customer address + link to Google Maps/Waze, status buttons (Picked Up → On The Way → Delivered/Failed), camera for proof, delivery history. Large touch targets, minimal UI.

**Acceptance criteria:**
- [ ] Driver can complete full flow: view trip → navigate → update status → upload proof.

---

### 3.7 Warehouse Operations

#### 3.7.1 Goods Receipt

- Manual entry: supplier, date, lines (product, expected qty, received qty, condition). Discrepancies flagged. On confirm: stock up, capital cost history updated if new cost, journal posted. Status: Draft → Verified → Confirmed.

#### 3.7.2 Pick & Pack

- Pick list auto-created from confirmed DO. Workflow: Created → Picking → Packed → Ready for Handover. Short-pick: flag line, notify Manager. Multiple DOs for same trip can be picked together. Pick list printable.

#### 3.7.3 Stock Opname

- Select products (by category/location or full). Enter physical count; system shows variance; confirm → auto-adjust stock, ledger entries; opname history stored.

#### 3.7.4 Handover to Driver

- WH staff selects trip, sees packed DOs, confirms items loaded; driver and WH both confirm (double acknowledgment). Handover record with trip, DOs, staff, driver, timestamp. If DO not ready, exclude from trip and notify Manager. After handover, trip → In Progress.

#### 3.7.5 Warehouse Mobile View (PWA)

- **Path:** `/warehouse`. Features: Goods receipt, pick lists (pick/pack), opname, handover, stock lookup. Mobile-first, large buttons, tablet/phone.

---

### 3.8 Audit Trail

- **Logged:** Create, update, delete, approve, reject, export on business records (SO, DO, invoice, product, customer, receipts, pick lists, expenses, trips, vehicles, employees, payroll, journals, COA, etc.).
- **Field-level:** For updates, old → new value per field; for create, initial values; for delete, full snapshot. Immutable; 5-year retention; async write (non-blocking). Soft delete only (no hard delete).
- **Views:** Global log (Admin/Manager) with filters (date, user, module, entity type, action, record). Record-level “History” on each record. Profile → My Activity for own actions. Export Excel/PDF.

---

### 3.9 Notifications

- **In-app:** Bell icon, unread count, panel with link to record; mark read; per-user preferences.
- **Triggers:** SO approval, expense submit/approve/reject, leave submit/approve/reject, low stock, AR overdue, payment reminders, invoice issued, delivery ETA/done, pick list assigned, trip assigned. See PRD §4.9.2 for full table.
- **WhatsApp:** Payment reminder, invoice (PDF), delivery; via Business API or gateway (e.g. Fonnte/Wablas). Templates with placeholders; log per customer; per-customer toggle.

---

### 3.10 Dashboard & KPIs

- **Admin/Manager:** Today’s sales, monthly sales trend, outstanding AR, AR aging, top 10 products/customers, low stock, pending approvals, today’s deliveries, salesperson performance, recent activity. All widgets click-through to list/detail.
- **Staff:** My sales today, monthly target progress, open SOs, pending commissions, recent activity.
- **Driver:** Today’s trips, deliveries completed, next delivery with navigate.
- **Warehouse:** Pending pick lists, pending handovers, low stock, today’s receipts.
- Data refresh on load (no real-time in v1).

---

### 3.11 Data Import

- **Admin only.** Types: Products, Customers, COA, Employees. Template download → fill → upload → validate (required fields, duplicates, types, references) → show valid/error rows → import valid only. Max 5,000 rows; transactional; audit log of import.

---

### 3.12 Global Search

- Top bar; shortcut `Ctrl+K` / `Cmd+K`. Debounced, min 2 characters. Results grouped by type (SO, customers, products, invoices, DOs, employees, expenses); max 5 per type + “View all”. Click → record detail. Respects RBAC. Recent searches (last 5). Identifiers only in v1 (no full-text on descriptions).

---

## 4. Core User Flows (Summary)

| Flow | Steps |
|------|--------|
| **Sales-to-cash** | Visit check-in → SO (with tier pricing) → DO → Pick & pack → Trip + handover → Driver deliver (proof) → AR Invoice → Payment → Commission |
| **Monthly close** | Review → Payroll → Reconcile bank → Trial balance → Close period |
| **Expense** | Staff enter → Submit → Manager approve/reject → If approved, journal posted |
| **Goods receipt** | WH enter/verify → Confirm → Stock + cost + journal |
| **Stock opname** | Select products → Enter counts → Confirm variances → Stock adjusted |

---

## 5. UI/UX Specification

### 5.1 Brand & Layout

- **Primary:** Blue (e.g. `#2563EB`). **Secondary:** Slate/gray. **Accent:** Amber/orange for CTAs/alerts. **Danger:** Red. **Success:** Green.
- **Font:** Inter (Google Fonts). Rounded corners (8–12px), light mode default.
- **Layout:** Collapsible sidebar (icons + labels), top bar (breadcrumb, search, notifications, language, user menu). Content with consistent padding and max-width.

### 5.2 Components

- **Design system:** shadcn/ui + Tailwind. Cards, rounded buttons (primary/secondary/destructive), sortable/filterable/paginated tables (TanStack Table), inline validation, modals/drawers, toasts (bottom-right), skeleton loaders, status badges (color-coded pills).
- **History:** Clock/history icon on records → slide-in with timeline and field diffs (red = old, green = new).
- **Print:** Dedicated styles for invoices, DOs, payslips, pick lists (no nav, monochrome).
- **Empty states:** Icon/illustration + short guidance text.

### 5.3 Responsive

- Desktop-first (1280px+). Sidebar collapses to icons at 768–1279px. Driver and warehouse: mobile-first, min 44px touch targets, bottom nav where applicable.

### 5.4 Typography Scale

- Page title 24px semibold; section 18px semibold; card 16px medium; body 14px; small/caption 12px; table/button 14px.

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Response time | Page load &lt; 2 s, API &lt; 500 ms |
| Concurrent users | Up to 10 |
| Data retention | Min 5 years financial data |
| Backup | Daily automated DB backup |
| Browsers | Chrome, Edge, Firefox (latest 2) |
| Security | HTTPS, bcrypt, session auth, CSRF |
| File storage | Local; images max 1 MB (compressed) |

---

## 7. Out of Scope (v1)

- Purchasing (PO → GR → AP)
- Multi-warehouse transfers
- Batch/serial tracking
- Customer credit limit
- E-Faktur integration
- Native mobile app
- Third-party API integrations (marketplace, shipping)
- Multi-company / multi-tenant
- Advanced BI
- Dark mode
- Real-time WebSocket
- Customer returns & credit notes

---

## 8. Glossary

| Term | Meaning |
|------|---------|
| SO | Sales Order |
| DO | Delivery Order / Surat Jalan |
| AR/AP | Accounts Receivable / Payable |
| PPN | Indonesian VAT (11%) |
| PPh 21 | Employee income tax |
| BPJS | Social security |
| COA | Chart of Accounts |
| UOM | Unit of Measure |
| NPWP | Tax ID |
| KTP/NIK | National ID |
| WH | Warehouse |
| PWA | Progressive Web App |
| RBAC | Role-Based Access Control |

---

## 9. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-01 | Initial product specification from PRD. |

---

*This document specifies the product behavior and user-facing features. For implementation details and data models, see [PRD.md](../PRD.md) and the codebase.*
