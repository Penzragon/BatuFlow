# BatuFlow — Product Requirements Document

> **Version:** 1.0
> **Date:** March 1, 2026
> **Status:** Draft
> **Product Type:** ERP for Distribution & Wholesale

---

## 1. Executive Summary

**BatuFlow** is a lightweight ERP system purpose-built for small distribution and wholesale businesses. It streamlines daily operations across seven core domains: **Sales & CRM**, **Inventory & Warehouse**, **Accounting & Finance**, **HR & Payroll**, **Expense Management**, **Delivery & Driver Management**, and **Warehouse Operations**. A system-wide **audit trail** tracks every action with full field-level change history for complete transparency. The platform includes in-app and WhatsApp notifications, role-specific dashboards with KPIs, bulk data import, and a global search bar for fast navigation.

The application targets single-company deployments with 1–10 concurrent users, running on a modern **Next.js + Node.js + PostgreSQL** stack. The UI will support both **English** and **Bahasa Indonesia**.

---

## 2. Goals & Objectives


| #   | Goal                                                               | Success Metric                                              |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| G1  | Digitize the full sales-to-cash cycle (SO → Delivery → AR Invoice) | 100% of sales flow paperless within 3 months of launch      |
| G2  | Provide real-time inventory visibility                             | Stock accuracy ≥ 98%                                        |
| G3  | Automate sales commission calculation                              | Commission reports generated automatically per period       |
| G4  | Centralize financial records                                       | Monthly closing completed within 2 business days            |
| G5  | Manage employee data and payroll                                   | Payslips generated on schedule each period                  |
| G6  | Track and control business expenses                                | All expenses categorized and approved digitally             |
| G7  | Ensure delivery accountability                                     | 100% of deliveries have photo proof and GPS tracking        |
| G8  | Maintain complete audit trail                                      | Every change traceable to a user with full field-level diff |


---

## 3. User Roles & Permissions

BatuFlow uses **role-based access control (RBAC)** with five default roles:


| Role                | Description                       | Typical Permissions                                                                                                       |
| ------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Admin**           | System owner / IT                 | Full access: settings, user management, all modules, audit logs, data import                                              |
| **Manager**         | Department head                   | Approve orders, view reports, manage team data, override prices, view audit trail                                         |
| **Staff**           | Day-to-day operator / Salesperson | Create/edit own transactions, view assigned data, no approval rights                                                      |
| **Driver**          | Delivery personnel                | View assigned trips & DOs, update delivery status, upload delivery proof photo, no access to pricing/finance              |
| **Warehouse Staff** | Warehouse floor operator          | Receive goods, pick & pack DOs, stock opname, handover to driver, view stock levels. No access to pricing, finance, or HR |


- Roles are configurable — Admin can add custom roles or adjust permissions per module.
- Every action is logged with user, timestamp, and IP for audit trail.
- Each user can view their own activity history via Profile → My Activity.

---

## 4. Module Specifications

### 4.1 Sales & CRM

**Purpose:** Manage the full sales cycle from visit check-in and lead/customer management through invoicing and commission tracking.

#### 4.1.0 Sales Visit Check-In

**Purpose:** Verify that a salesperson is physically present at the customer's store before creating any Sales Order. This ensures accountability and prevents fraudulent or remote order entry.

**Check-In Process:**

1. Salesperson selects the customer they are visiting
2. System activates the device camera — salesperson takes a **selfie** at the customer's store
3. System automatically captures:
  - **GPS coordinates** (latitude, longitude) at the moment of photo capture
  - **Timestamp** watermarked onto the photo (date + time, e.g., "01 Mar 2026 09:32 WIB")
  - **Customer name** watermarked onto the photo
4. Photo is uploaded and linked to a **Visit record**
5. Visit status: **Checked In**

**Rules & Constraints:**

- A valid check-in is **required** before creating any Sales Order for that customer
- One check-in per customer visit — multiple SOs can be created under the same visit
- Check-in expires after **8 hours** (configurable) — salesperson must check in again for a new visit
- GPS coordinates are compared against the customer's registered address (if lat/long stored) — optional distance warning if > 500m away (configurable threshold, non-blocking)
- If device camera or GPS is unavailable, the system blocks check-in and shows an error message

**Visit Log:**

- All visits recorded with: salesperson, customer, selfie photo, GPS coordinates, timestamp, list of SOs created during the visit
- Manager can view visit history per salesperson or per customer
- Visit report: daily/weekly summary of visits per salesperson with map view of locations visited

**Photo Storage:**

- Photos stored in local filesystem (`/uploads/visits/`)
- Compressed to max 1MB per image before storage
- Watermark applied server-side to prevent tampering

#### 4.1.1 Customer Management

- Customer master data: name, address, phone, email, tax ID (NPWP), payment terms
- Customer grouping/classification (e.g., by region, tier)
- Contact persons per customer
- Customer transaction history view
- **GPS coordinates:** latitude & longitude of the customer's store location
  - Can be entered manually, picked from a map pin (embedded Google Maps picker), or auto-captured during the first salesperson visit check-in
  - Used for: driver navigation, visit check-in distance validation, delivery route visualization

#### 4.1.2 Sales Order (SO)

- **Prerequisite:** An active visit check-in for the selected customer is required before creating an SO (see 4.1.0)
- Create SO with line items: product, qty, unit price, discount, tax
- System auto-applies **price tier** based on line item quantity (see 4.2.1 price tiering)
- Auto-calculate totals, taxes (PPN), and grand total
- SO statuses: **Draft → Confirmed → Partially Delivered → Fully Delivered → Closed / Cancelled**
- Manager approval required for discount above threshold or manual price override
- Print / export SO as PDF

#### 4.1.3 Delivery Order (DO)

- Generate DO from confirmed SO (partial or full delivery)
- When DO is confirmed, a **Pick List** is auto-generated for warehouse staff (see 4.7.2)
- DO cannot be assigned to a trip until pick & pack status is **Ready for Handover**
- DO is assigned to a **Trip** for delivery (see 4.6.2)
- DO statuses: **Draft → Confirmed → Picking → Packed → Ready for Handover → Assigned to Trip → Picked Up → On The Way → Delivered → Failed**
- DO reduces inventory stock on confirmation
- Delivery proof photo linked to DO upon successful delivery
- Track delivery date, driver (via trip), vehicle (via trip)
- Print packing slip / surat jalan

#### 4.1.4 Accounts Receivable (AR) Invoice

- Generate invoice from delivered DO (partial or full billing)
- Invoice statuses: **Draft → Issued → Partially Paid → Paid → Overdue**
- Auto-calculate due date based on customer payment terms
- Aging report (current, 30, 60, 90, 120+ days)
- Link payments to invoices (partial & full matching)

#### 4.1.5 Sales Commission

- Define commission rules per salesperson:
  - Percentage of sales amount
  - Percentage of gross profit
  - Tiered rates (e.g., 3% up to 100M, 5% above 100M)
- Commission period: monthly or custom date range
- Auto-calculate commission based on **paid invoices** within the period
- Commission report per salesperson with drill-down to invoice level
- Export commission report to Excel / PDF

#### 4.1.6 CRM Features

- Lead / prospect tracking (basic pipeline)
- Activity log per customer (calls, visits, notes)
- Sales target setting & achievement dashboard
- Visit frequency analytics per customer (how often visited, last visit date)

---

### 4.2 Inventory & Warehouse

**Purpose:** Track stock levels in real-time across products and warehouse locations.

#### 4.2.1 Product Master

- Product data: SKU, name, description, category, brand, unit of measure (UOM)
- Multiple UOM per product (e.g., pcs, box, carton) with conversion ratios
- **Capital cost (modal):** tracked with full history — every cost change is logged with date, source (manual entry or future purchase receipt), and previous value
  - Current capital cost is always visible on the product card
  - Capital cost history viewable per product (date, old cost, new cost, changed by, reason)
  - Gross margin auto-calculated: `(sell price − capital cost) / sell price × 100%`
- **Price tiering by quantity:** define quantity-based price breaks per product
  - Example: 1–10 pcs = Rp100.000, 11–50 pcs = Rp90.000, 51+ pcs = Rp80.000
  - Unlimited tiers per product
  - When creating a Sales Order, the system auto-selects the correct tier price based on line item quantity
  - Manager can override tier price (logged in audit trail)
- Sell price (default / base price for qty = 1)
- Min stock level, max stock level
- Product images (optional)
- Active / inactive flag

#### 4.2.2 Warehouse / Location

- Single warehouse with multiple storage locations/zones
- Default warehouse for transactions

#### 4.2.3 Stock Movements

- **Stock In:** from goods receipt or manual adjustment
- **Stock Out:** from delivery order or manual adjustment
- **Stock Adjustment:** reconciliation with notes and approval
- All movements create an auditable stock ledger entry

#### 4.2.4 Stock Reports

- Current stock on hand by product / location
- Stock movement history (filterable by date, product, type)
- Low stock alerts (below minimum level)
- Stock valuation report (weighted average cost)

---

### 4.3 Accounting & Finance

**Purpose:** Record all financial transactions, produce standard financial reports, and manage cash flow.

#### 4.3.1 Chart of Accounts (COA)

- Pre-configured COA template for Indonesian distribution businesses
- Customizable: add, edit, deactivate accounts
- Account types: Asset, Liability, Equity, Revenue, COGS, Expense

#### 4.3.2 General Ledger

- Double-entry bookkeeping
- Auto-generated journal entries from:
  - AR Invoices & payments
  - AP Invoices & payments (future: Purchasing module)
  - Inventory movements (COGS entries)
  - Payroll processing
  - Approved expenses
- Manual journal entries for adjustments

#### 4.3.3 Cash & Bank

- Record cash receipts and disbursements
- Bank account management
- Bank reconciliation (manual matching)

#### 4.3.4 Tax Management

- PPN (VAT) calculation on sales and purchases
- Tax invoice numbering (Faktur Pajak)
- Monthly PPN summary report

#### 4.3.5 Financial Reports

- **Income Statement** (Laba Rugi) — monthly, quarterly, yearly
- **Balance Sheet** (Neraca) — as of date
- **Cash Flow Statement** — by period
- **Trial Balance** — for period closing
- **General Ledger Detail** — per account, per period
- All reports exportable to Excel and PDF

#### 4.3.6 Period Closing

- Monthly closing process: validates all entries, locks the period
- Year-end closing with retained earnings transfer

---

### 4.4 HR & Payroll

**Purpose:** Manage employee records, attendance, leave, and payroll.

#### 4.4.1 Employee Master

- Personal data: name, ID number (KTP/NIK), address, phone, email, bank account
- Employment data: department, position, join date, employment type (permanent/contract)
- Salary structure: basic salary, allowances, deductions
- Document uploads (KTP, contracts, etc.)
- Active / resigned status

#### 4.4.2 Attendance

- Daily attendance log (manual entry or simple clock-in/clock-out)
- Attendance summary report per employee per month
- Late, absent, half-day tracking

#### 4.4.3 Leave Management

- Leave types: annual leave, sick leave, personal leave (configurable)
- Leave balance per employee per year
- Leave request → Manager approval workflow
- Leave history report

#### 4.4.4 Payroll

- Monthly payroll calculation:
  - Basic salary + allowances − deductions − absences
  - BPJS Kesehatan & Ketenagakerjaan calculations
  - PPh 21 (income tax) calculation — simplified
- Payslip generation (PDF, per employee)
- Payroll summary report
- Payroll journal auto-posted to Accounting

---

### 4.5 Expense Management

**Purpose:** Track, categorize, and approve all business expenses for accurate financial reporting and cost control.

#### 4.5.1 Expense Categories

- Pre-configured categories: Operational, Transportation, Utilities, Office Supplies, Marketing, Meals & Entertainment, Maintenance, Miscellaneous
- Admin can add, edit, or deactivate categories
- Each category maps to a COA account for automatic journal entry posting

#### 4.5.2 Expense Entry

- Record an expense: date, category, amount, description, payment method (cash/bank/petty cash)
- Attach reference number (e.g., receipt number, vendor name)
- Staff submits expenses; they start in **Draft** status

#### 4.5.3 Approval Workflow

- Expense statuses: **Draft → Submitted → Approved → Rejected**
- Staff creates and submits expenses
- Manager reviews and approves or rejects (with rejection reason)
- Approved expenses auto-post a journal entry to the linked COA account (debit expense, credit cash/bank)
- Rejected expenses can be revised and resubmitted

#### 4.5.4 Expense Reports

- **By category:** total spend per category for a given period
- **By period:** daily, weekly, monthly expense summary
- **By user:** who submitted, who approved
- **Trend analysis:** month-over-month expense comparison
- All reports exportable to Excel / PDF

---

### 4.6 Delivery & Driver Management

**Purpose:** Manage delivery drivers, vehicles, trip planning, and delivery proof to ensure reliable and trackable goods delivery.

#### 4.6.1 Vehicle Management

- Vehicle master data: plate number, vehicle type (truck, van, motorcycle), capacity (kg/volume), status (available/in-use/maintenance)
- Admin can add, edit, or deactivate vehicles
- Vehicle assignment history (which trips used which vehicle)

#### 4.6.2 Trip Management

- A **Trip** groups multiple Delivery Orders into a single route for one driver + one vehicle
- Create trip: select driver (from employees with Driver role), assign vehicle, add one or more confirmed DOs that are **Ready for Handover**
- Trip statuses: **Planned → In Progress → Completed**
- Trip sheet printable (list of DOs, customer addresses, items to deliver)
- Manager creates/plans trips; driver sees assigned trips in their view

#### 4.6.3 Driver Assignment

- Drivers are employees from the HR module with the **Driver** role
- Each DO is assigned to a trip; each trip has exactly one driver + one vehicle
- Driver sees only their own assigned trips and DOs
- Dashboard shows available drivers (not currently on an active trip)

#### 4.6.4 Delivery Status Tracking

- Status updates per DO within a trip, updated by the driver:
  - **Pending** — assigned to trip, not yet picked up
  - **Picked Up** — goods loaded from warehouse
  - **On The Way** — driver departed for this delivery
  - **Delivered** — successfully delivered (requires proof photo)
  - **Failed** — delivery failed (driver must provide reason: customer absent, address wrong, customer refused, etc.)
- Each status change is timestamped and logged
- Manager can monitor all active deliveries in a real-time delivery board

#### 4.6.5 Delivery Proof

- Upon successful delivery, driver must upload a **photo** of goods received at the customer's location
- System auto-captures:
  - **GPS coordinates** at the moment of photo upload
  - **Timestamp** watermarked on the photo
  - **DO number + customer name** watermarked on the photo
- Photo is stored and linked to the DO record
- Delivered DOs with proof photos are visible to admin/manager for verification
- If delivery fails, driver selects a failure reason and can optionally add a note/photo

#### 4.6.6 Driver Mobile View

- Separate **mobile-optimized web view** (responsive PWA) accessible at `/driver`
- Driver logs in with their employee credentials
- Features available in driver view:
  - Today's assigned trips with DO list
  - Customer address with link to Google Maps / Waze for navigation (uses customer GPS coordinates)
  - Status update buttons (Picked Up → On The Way → Delivered/Failed)
  - Camera for proof photo upload
  - Delivery history (past deliveries)
- Minimal UI — large buttons, simple flow, optimized for phone use

#### 4.6.7 Delivery Reports

- **Trip summary:** all trips for a period, driver, vehicle used, DOs delivered/failed
- **Driver performance:** deliveries per day, on-time rate, failure rate per driver
- **Delivery proof log:** all proof photos with DO reference, filterable by date/driver/customer
- Reports exportable to Excel / PDF

---

### 4.7 Warehouse Operations

**Purpose:** Provide warehouse staff with dedicated tools for goods receipt, order picking & packing, stock counting, and driver handover — ensuring accurate inventory and smooth delivery preparation.

#### 4.7.1 Goods Receipt

- Record incoming stock from suppliers (manual entry — purchasing module is future scope)
- Enter: supplier name, receipt date, list of items (product, expected qty, received qty, condition)
- WH staff verifies actual quantity and condition against what was expected
- Discrepancies (short/over/damaged) are flagged with notes
- On confirmation:
  - Stock is increased in the stock ledger
  - Product capital cost history is updated if a new cost is provided
  - Journal entry auto-posted (debit inventory, credit AP/temporary account)
- Goods receipt statuses: **Draft → Verified → Confirmed**
- Receipt history searchable by date, supplier, product

#### 4.7.2 Pick & Pack

- When a Delivery Order is confirmed, a **Pick List** is auto-generated
- Pick list contains: DO number, customer name, product, qty, warehouse location
- Workflow:
  1. **Pick List Created** — system generates from confirmed DO
  2. **Picking** — WH staff picks items from shelves, marks each line as picked
  3. **Packed** — all items picked and packed, WH staff confirms packing complete
  4. **Ready for Handover** — package is staged for driver pickup
- If an item is short (insufficient stock during picking):
  - WH staff flags the line as short-picked with actual qty
  - System notifies Manager — partial delimovery or hold decision required
- Multiple DOs can be picked simultaneously if assigned to the same trip
- Pick list printable (for clipboard use on warehouse floor)

#### 4.7.3 Stock Opname (Physical Inventory Count)

- WH staff can initiate an ad-hoc stock count at any time
- Process:
  1. Select products to count (by category, location, or full warehouse)
  2. Enter physical count per product
  3. System compares physical count vs. system stock
  4. Variances are displayed: product, system qty, counted qty, difference
  5. WH staff confirms adjustments — stock is auto-adjusted
- Each adjustment creates a stock ledger entry with type "Stock Opname" and the variance amount
- Opname history: who counted, when, variances found, adjustments made
- Supports partial counts (count selected products, not the entire warehouse)

#### 4.7.4 Goods Handover to Driver

- When a trip is about to depart, WH staff performs a **handover**
- WH staff selects the trip → sees all packed DOs and their items
- WH staff confirms each DO's items are loaded onto the vehicle
- Both WH staff and driver confirm the handover (double acknowledgment)
- Handover record: trip ID, DO list, WH staff who handed over, driver who received, timestamp
- If any DO is not ready (still picking/packing), it is excluded from the trip with a notification to Manager
- After handover, trip status moves to **In Progress** and driver can begin deliveries

#### 4.7.5 Warehouse Staff Mobile View

- Separate **mobile-optimized web view** (responsive PWA) accessible at `/warehouse`
- WH staff logs in with their employee credentials
- Features available:
  - **Goods Receipt:** enter/verify incoming stock
  - **Pick Lists:** view assigned pick lists, mark items as picked/packed
  - **Stock Opname:** count products and submit counts
  - **Handover:** confirm goods loaded to driver
  - **Stock Lookup:** quick search current stock level for any product
- Optimized for warehouse use: large buttons, simple lists, works on tablets and phones

#### 4.7.6 Warehouse Reports

- **Goods Receipt Log:** all receipts by date range, supplier, product
- **Pick & Pack Performance:** average pick time, items picked per day, short-pick rate
- **Stock Opname History:** count sessions with variance summaries
- **Handover Log:** all driver handovers with timestamp and completeness
- Reports exportable to Excel / PDF

---

### 4.8 Audit Trail

**Purpose:** Provide a comprehensive, tamper-proof log of all system activity so managers and admins can track who did what, when, and exactly what changed — ensuring accountability and transparency across the entire ERP.

#### 4.8.1 What Gets Logged

Every significant action is automatically recorded:


| Category                      | Actions Tracked                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Business Records**          | Create, update, delete on: Sales Orders, Delivery Orders, AR Invoices, Payments, Products, Customers, Goods Receipts, Pick Lists, Expenses, Trips, Vehicles, Employees, Payroll Runs, Journal Entries, COA accounts |
| **Approval Actions**          | Approve/reject on: Sales Orders (discount override), Expenses, Leave Requests, Stock Adjustments                                                                                                                    |
| **Role & Permission Changes** | User role assignment, role modification, permission updates                                                                                                                                                         |
| **Data Exports**              | Report generation & export (who exported what report, when, filters used)                                                                                                                                           |


#### 4.8.2 Field-Level Change Tracking

For every **update** action, the system records a full diff:

- **Old value → New value** for each changed field
- Example: Product "Widget A" updated
  ```
  Field           Old Value        New Value
  sell_price      Rp 100.000      Rp 120.000
  capital_cost    Rp 70.000       Rp 75.000
  min_stock       50               30
  Changed by: Admin (admin@batuflow.com)
  Changed at: 01 Mar 2026 14:32 WIB
  ```
- For **create** actions: all initial field values are recorded
- For **delete** actions: the full record snapshot is preserved before deletion

#### 4.8.3 Audit Log Entry Structure

Each audit log entry contains:


| Field          | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `timestamp`    | When the action occurred (server time, WIB)                                |
| `user_id`      | Who performed the action                                                   |
| `user_role`    | Role at the time of action (Admin, Manager, Staff, Driver, WH Staff)       |
| `ip_address`   | IP address of the user                                                     |
| `action`       | CREATE, UPDATE, DELETE, APPROVE, REJECT, EXPORT                            |
| `entity_type`  | What type of record (e.g., "sales_order", "product", "expense")            |
| `entity_id`    | ID of the affected record                                                  |
| `entity_label` | Human-readable identifier (e.g., SO number, product name)                  |
| `changes`      | JSON array of field-level changes: `[{ field, old_value, new_value }]`     |
| `metadata`     | Additional context (e.g., export filters, approval reason, rejection note) |


#### 4.8.4 Audit Trail Viewer

**Location:** Settings → Audit Trail (accessible from any module via a "History" button on individual records)

**Global Audit Log View (Admin & Manager):**

- Chronological list of all actions across the system
- Filters:
  - By **date range**
  - By **user** (who performed the action)
  - By **module** (Sales, Inventory, Finance, HR, Expenses, Delivery, Warehouse)
  - By **entity type** (product, sales_order, customer, etc.)
  - By **action type** (create, update, delete, approve, reject, export)
  - By **specific record** (search by SO number, product name, etc.)
- Each entry expandable to show full field-level diff
- Exportable to Excel / PDF

**Record-Level History (all users with access to the record):**

- Every record (SO, product, customer, expense, etc.) has a **"History" tab/button**
- Shows the complete timeline of changes for that specific record
- Example on a Sales Order:
  ```
  01 Mar 2026 09:15 — Created by Andi (Salesman)
  01 Mar 2026 09:45 — Updated by Andi (Salesman): qty line 1: 10 → 15
  01 Mar 2026 10:00 — Approved by Budi (Manager)
  01 Mar 2026 11:30 — Updated by Admin: discount line 2: 5% → 10%
  ```

**Personal Activity Log (each user):**

- Every user can view their **own** activity history via Profile → My Activity
- Shows only actions performed by that user
- Cannot be edited or deleted

#### 4.8.5 Audit Trail Rules

- **Immutable:** Audit log entries can never be edited or deleted — not even by Admin
- **Automatic:** Logging is handled at the service/middleware layer — developers cannot bypass it
- **Retention:** Audit logs retained for minimum **5 years** (aligned with financial data retention)
- **Performance:** Audit writes are asynchronous (non-blocking) to avoid slowing down user operations
- **Soft deletes:** Business records use soft delete (set `deleted_at` timestamp) — never hard deleted — so audit trail always has a valid reference

---

### 4.9 Notification System

**Purpose:** Keep users informed of important events via in-app notifications and WhatsApp messages, reducing missed actions and delays.

#### 4.9.1 In-App Notifications

- Notification bell icon in the top bar with unread count badge
- Notification panel (dropdown or slide-in) showing recent notifications
- Each notification: icon, title, short message, timestamp, link to related record
- Mark as read / mark all as read
- Notification preferences per user (toggle on/off per notification type)

#### 4.9.2 Notification Triggers


| Event                                                             | Recipients           | Channel                 |
| ----------------------------------------------------------------- | -------------------- | ----------------------- |
| Sales Order needs approval (discount override)                    | Manager              | In-app                  |
| Sales Order approved/rejected                                     | Staff who created it | In-app                  |
| Expense submitted for approval                                    | Manager              | In-app                  |
| Expense approved/rejected                                         | Staff who submitted  | In-app                  |
| Leave request submitted                                           | Manager              | In-app                  |
| Leave approved/rejected                                           | Employee             | In-app                  |
| Low stock alert (product below min level)                         | Manager, WH Staff    | In-app                  |
| AR Invoice overdue                                                | Admin, Manager       | In-app                  |
| Payment reminder (3 days before due, on due date, 7 days overdue) | Customer             | WhatsApp                |
| Invoice issued                                                    | Customer             | WhatsApp (PDF attached) |
| Delivery ETA / delivery completed                                 | Customer             | WhatsApp                |
| Pick list assigned to WH staff                                    | WH Staff             | In-app                  |
| Trip assigned to driver                                           | Driver               | In-app                  |


#### 4.9.3 WhatsApp Integration

- Integrated via **WhatsApp Business API** (or third-party gateway like Fonnte / Wablas for cost-efficiency)
- Templates for: invoice sharing (PDF), payment reminder, delivery notification
- Customer phone number from customer master data
- WhatsApp message log: track sent messages, delivery status, per customer
- Admin can configure message templates (with placeholders: `{customer_name}`, `{invoice_no}`, `{amount}`, `{due_date}`)
- WhatsApp sending can be toggled on/off per customer

---

### 4.10 Dashboard & KPIs

**Purpose:** Give each role an at-a-glance view of what matters most, with actionable widgets they can click into.

#### 4.10.1 Admin / Manager Dashboard


| Widget                      | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| **Today's Sales**           | Total sales amount today vs yesterday (with % change)                       |
| **Monthly Sales Trend**     | Line/bar chart of daily sales for the current month                         |
| **Outstanding AR**          | Total unpaid invoices amount, with count of overdue invoices                |
| **AR Aging Summary**        | Donut/bar chart: current, 30, 60, 90, 120+ days                             |
| **Top 10 Products**         | Best-selling products this month (by qty or revenue, toggleable)            |
| **Top 10 Customers**        | Highest-spending customers this month                                       |
| **Low Stock Alerts**        | Products below minimum stock level (clickable to product detail)            |
| **Pending Approvals**       | Count of items awaiting approval: SOs, expenses, leave requests (clickable) |
| **Today's Deliveries**      | Active trips: driver, status, number of DOs                                 |
| **Salesperson Performance** | Sales per salesperson this month (bar chart) with visit count               |
| **Recent Activity**         | Last 10 actions across the system (from audit trail)                        |


#### 4.10.2 Staff / Salesperson Dashboard


| Widget                     | Description                             |
| -------------------------- | --------------------------------------- |
| **My Sales Today**         | Personal sales amount today             |
| **My Monthly Target**      | Progress bar: sales vs target           |
| **My Open SOs**            | SOs in draft/confirmed status           |
| **My Pending Commissions** | Estimated commission for current period |
| **My Recent Activity**     | Last 10 personal actions                |


#### 4.10.3 Driver Dashboard (Mobile)


| Widget                   | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| **Today's Trips**        | Assigned trips with DO count and status              |
| **Deliveries Completed** | Count delivered vs total for today                   |
| **Next Delivery**        | Customer name, address, items — with navigate button |


#### 4.10.4 Warehouse Staff Dashboard (Mobile)


| Widget                     | Description                          |
| -------------------------- | ------------------------------------ |
| **Pending Pick Lists**     | Pick lists awaiting picking          |
| **Pending Handovers**      | Packed DOs ready for driver handover |
| **Low Stock Items**        | Products below min level             |
| **Today's Goods Receipts** | Incoming stock received today        |


*All dashboard widgets are clickable — they navigate to the relevant list/detail page.*
*Dashboard data refreshes on page load (no real-time WebSocket in v1).*

---

### 4.11 Data Import

**Purpose:** Allow initial bulk data setup via CSV/Excel upload, so users don't need to manually enter hundreds of records at go-live.

#### 4.11.1 Supported Imports


| Data Type             | Required Fields                 | Optional Fields                                         |
| --------------------- | ------------------------------- | ------------------------------------------------------- |
| **Products**          | SKU, name, UOM, sell price      | category, brand, capital cost, min stock, price tiers   |
| **Customers**         | Name, phone                     | address, tax ID, payment terms, salesperson, GPS coords |
| **Chart of Accounts** | Account code, name, type        | parent account                                          |
| **Employees**         | Name, NIK, department, position | join date, salary, bank account                         |


#### 4.11.2 Import Flow

1. User downloads a **template file** (Excel) for the data type
2. User fills in the template with their data
3. User uploads the file
4. System **validates** all rows:
  - Required field checks
  - Duplicate detection (e.g., duplicate SKU)
  - Data type validation (numbers, dates)
  - Reference validation (e.g., category exists)
5. Validation results shown: ✓ valid rows, ✗ error rows with specific error messages per row/cell
6. User can fix errors and re-upload, or proceed to import only valid rows
7. On confirm: records are created in bulk, audit trail logs the import action

#### 4.11.3 Rules

- Import is available to **Admin** role only
- Maximum **5,000 rows** per upload
- Import is transactional — if system error occurs mid-import, all changes are rolled back
- Downloadable templates include example data and field descriptions in a second sheet

---

### 4.12 Global Search

**Purpose:** Allow users to quickly find any record across all modules from a single search bar, without navigating to the specific module first.

#### 4.12.1 Search Bar

- Located in the **top bar**, always accessible (keyboard shortcut: `Ctrl+K` / `Cmd+K`)
- Instant results as user types (debounced, minimum 2 characters)
- Results grouped by entity type with icons:
  - Sales Orders (search by SO number, customer name)
  - Customers (search by name, phone, tax ID)
  - Products (search by SKU, name, brand)
  - Invoices (search by invoice number, customer name)
  - Delivery Orders (search by DO number)
  - Employees (search by name, NIK)
  - Expenses (search by description, reference)
- Click a result → navigate directly to the record detail page
- Show max **5 results per entity type**, with "View all" link to full search results page

#### 4.12.2 Search Behavior

- Searches across: record number/code, name, and key identifiers
- Results respect **role-based access** — users only see records they have permission to view
- Recent searches saved per user (last 5)
- No full-text search on descriptions/notes in v1 (search by identifiers only for performance)

---

## 5. Core Workflows

### 5.1 Sales-to-Cash (Primary Flow)

```
  Salesperson visits customer store
       ↓
  Visit Check-In — selfie + GPS + timestamp captured and uploaded
       ↓
  Sales Order (SO) — created under active visit, system auto-applies price tier based on qty
       ↓                Manager approves if manual price override or discount > threshold
       ↓
  Delivery Order (DO) — Staff creates from confirmed SO (partial/full)
       ↓
  Pick & Pack — WH staff picks items from shelves, packs, marks ready
       ↓
  Trip Planning — Manager groups ready DOs into a trip, assigns driver + vehicle
       ↓
  Handover — WH staff confirms goods loaded, driver acknowledges receipt
       ↓
  Driver Delivery — Driver picks up → on the way → delivers with proof photo
       ↓
  AR Invoice — Staff generates from delivered DO, sent to customer
       ↓
  Payment Receipt — Staff records payment, matches to invoice
       ↓
  Commission Calculated — System auto-calculates per salesperson on paid invoices
```

### 5.2 Monthly Closing Flow

```
  Review all transactions for the month
       ↓
  Run payroll → auto-post journal entries
       ↓
  Reconcile bank statements
       ↓
  Review trial balance
       ↓
  Close period (locks all entries for that month)
```

### 5.3 Expense Tracking Flow

```
  Staff records expense (date, category, amount, description)
       ↓
  Status: Draft → Staff submits
       ↓
  Manager reviews → Approves or Rejects (with reason)
       ↓
  If approved → Journal entry auto-posted (debit expense account, credit cash/bank)
       ↓
  Expense appears in reports & financial statements
```

### 5.4 Goods Receipt Flow

```
  Supplier delivers goods to warehouse
       ↓
  WH Staff creates Goods Receipt — enters supplier, items, expected vs actual qty
       ↓
  WH Staff verifies qty & condition — flags discrepancies
       ↓
  WH Staff confirms receipt → stock increased in ledger, capital cost updated
       ↓
  Journal entry auto-posted (debit inventory, credit AP/temp account)
```

### 5.5 Stock Opname Flow

```
  WH Staff initiates stock count (select products or full warehouse)
       ↓
  WH Staff enters physical counts per product
       ↓
  System shows variances (system qty vs counted qty)
       ↓
  WH Staff confirms → stock auto-adjusted, ledger entries created
       ↓
  Opname record saved for audit trail
```

---

## 6. Technical Architecture

### 6.1 Stack


| Layer            | Technology                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Frontend         | **Next.js 16+** (App Router, React Server Components)             |
| UI Library       | Tailwind CSS + shadcn/ui                                          |
| State Management | React Context / Zustand (minimal client state)                    |
| API              | Next.js API Routes / Route Handlers (REST)                        |
| Backend Runtime  | **Node.js 25+**                                                   |
| ORM              | **Prisma**                                                        |
| Database         | **PostgreSQL 18+**                                                |
| Authentication   | NextAuth.js (Credentials provider)                                |
| PDF Generation   | @react-pdf/renderer or Puppeteer                                  |
| i18n             | next-intl (English + Bahasa Indonesia)                            |
| File Storage     | Local filesystem (uploads folder)                                 |
| Camera & GPS     | Browser APIs (MediaDevices, Geolocation)                          |
| Image Processing | sharp (Node.js — watermark, compression)                          |
| PWA Support      | next-pwa (driver & warehouse mobile views as installable PWA)     |
| Maps Integration | Google Maps / Waze deep links for navigation                      |
| WhatsApp API     | Fonnte / Wablas (third-party WA gateway) or WhatsApp Business API |
| Search           | PostgreSQL trigram index (pg_trgm) for fast LIKE/ILIKE queries    |
| Async Logging    | Bull / BullMQ (Redis-backed queue for non-blocking audit writes)  |


### 6.2 Project Structure (Proposed)

```
batuflow/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, register
│   │   ├── (dashboard)/     # Main app layout
│   │   │   ├── sales/       # Sales & CRM pages
│   │   │   ├── inventory/   # Inventory pages
│   │   │   ├── finance/     # Accounting pages
│   │   │   ├── hr/          # HR & Payroll pages
│   │   │   ├── expenses/    # Expense management pages
│   │   │   ├── delivery/    # Delivery & trip management pages
│   │   │   └── settings/    # System settings
│   │   │       └── audit-trail/  # Audit trail viewer
│   │   ├── (driver)/        # Mobile-optimized driver view
│   │   ├── (warehouse)/     # Mobile-optimized warehouse staff view
│   │   └── api/             # API route handlers
│   ├── components/          # Shared UI components
│   ├── lib/                 # Utilities, db client, auth config
│   ├── services/            # Business logic layer
│   │   └── audit.service.ts # Centralized audit logging service
│   ├── types/               # TypeScript type definitions
│   └── i18n/                # Translation files (en, id)
├── public/                  # Static assets
├── uploads/                 # File uploads (visits, delivery proofs, etc.)
├── .env
├── package.json
└── tsconfig.json
```

### 6.3 Database Design Highlights

Key entities and relationships:

**Users & Auth**

- **users** — id, name, email, password_hash, role, is_active, deleted_at

**Customers & CRM**

- **customers** — id, name, address, phone, email, tax_id, payment_terms_days, salesperson_id, gps_latitude (nullable), gps_longitude (nullable), deleted_at
- **customer_visits** — id, customer_id, salesperson_id, check_in_at, expires_at, selfie_path, gps_latitude, gps_longitude, gps_accuracy, status (checked_in/expired)

**Products & Inventory**

- **products** — id, sku, name, description, category, brand, base_uom, capital_cost, sell_price, min_stock, max_stock, image_url, is_active, deleted_at
- **product_price_tiers** — id, product_id, min_qty, max_qty (nullable for last tier), unit_price
- **product_capital_history** — id, product_id, old_cost, new_cost, changed_at, changed_by, source, notes
- **stock_ledger** — id, product_id, warehouse_id, movement_type, qty, reference_type, reference_id, created_at

**Sales**

- **sales_orders** — id, visit_id, customer_id, order_date, status, total, tax, grand_total, created_by, deleted_at
- **sales_order_lines** — id, so_id, product_id, qty, unit_price, discount, line_total
- **delivery_orders** — id, so_id, trip_item_id (nullable), delivery_date, status, created_by, deleted_at
- **delivery_order_lines** — id, do_id, so_line_id, product_id, qty_delivered
- **ar_invoices** — id, do_id, customer_id, invoice_date, due_date, status, total, amount_paid, deleted_at
- **payments** — id, invoice_id, payment_date, amount, method, reference

**Commission**

- **commission_rules** — id, salesperson_id, type (percentage/tiered), rate, effective_date
- **commissions** — id, salesperson_id, invoice_id, period, amount

**Delivery & Drivers**

- **vehicles** — id, plate_number, vehicle_type, capacity_kg, capacity_volume, status (available/in_use/maintenance), is_active
- **delivery_trips** — id, trip_date, driver_id (FK → employees), vehicle_id (FK → vehicles), status (planned/in_progress/completed), notes, created_by, created_at
- **delivery_trip_items** — id, trip_id (FK → delivery_trips), do_id (FK → delivery_orders), sequence_order, delivery_status (pending/picked_up/on_the_way/delivered/failed), status_updated_at, failure_reason, proof_photo_path, proof_gps_latitude, proof_gps_longitude

**Warehouse Operations**

- **goods_receipts** — id, supplier_name, receipt_date, status (draft/verified/confirmed), notes, received_by, confirmed_at
- **goods_receipt_lines** — id, receipt_id, product_id, expected_qty, received_qty, condition (good/damaged/short), unit_cost, notes
- **pick_lists** — id, do_id, status (created/picking/packed/ready_for_handover), assigned_to (FK → employees, nullable), created_at, completed_at
- **pick_list_lines** — id, pick_list_id, product_id, required_qty, picked_qty, location, is_short_picked
- **stock_opname** — id, initiated_by, initiated_at, status (in_progress/completed), notes
- **stock_opname_lines** — id, opname_id, product_id, system_qty, counted_qty, variance, adjusted
- **handovers** — id, trip_id, warehouse_staff_id, driver_id, confirmed_at, notes
- **handover_items** — id, handover_id, do_id, is_loaded (boolean)

**Finance**

- **accounts** — id, code, name, type, parent_id, is_active, deleted_at
- **journal_entries** — id, entry_date, description, reference_type, reference_id, posted_by
- **journal_lines** — id, journal_id, account_id, debit, credit

**Expenses**

- **expense_categories** — id, name, coa_account_id, is_active
- **expenses** — id, category_id, amount, description, expense_date, payment_method, reference_no, status (draft/submitted/approved/rejected), submitted_by, approved_by, rejection_reason, created_at, deleted_at

**HR & Payroll**

- **employees** — id, user_id (nullable), name, nik, department, position, join_date, basic_salary, employment_type, status, deleted_at
- **attendance** — id, employee_id, date, clock_in, clock_out, status
- **leave_requests** — id, employee_id, leave_type, start_date, end_date, status, approved_by
- **payroll_runs** — id, period_month, period_year, status, total_amount, created_by
- **payroll_lines** — id, payroll_run_id, employee_id, basic, allowances, deductions, tax, net_pay

**Audit Trail**

- **audit_logs** — id, timestamp, user_id, user_role, ip_address, action (create/update/delete/approve/reject/export), entity_type, entity_id, entity_label, metadata (JSONB, nullable), created_at
- **audit_log_changes** — id, audit_log_id, field_name, old_value (text, nullable), new_value (text, nullable)

**Notifications**

- **notifications** — id, user_id, title, message, entity_type, entity_id, is_read, created_at
- **whatsapp_log** — id, customer_id, phone_number, template, message, status (sent/delivered/failed), sent_at

**Data Import**

- **import_logs** — id, import_type (product/customer/coa/employee), file_name, total_rows, success_rows, error_rows, imported_by, imported_at

*All business record tables include `deleted_at` (timestamp, nullable) for soft delete support.*

---

## 7. Non-Functional Requirements


| Requirement          | Target                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Response Time**    | Page load < 2s, API response < 500ms                                                                                                              |
| **Concurrent Users** | Up to 10 simultaneous users                                                                                                                       |
| **Data Retention**   | Minimum 5 years for financial data                                                                                                                |
| **Backup**           | Daily automated database backup                                                                                                                   |
| **Browser Support**  | Chrome, Edge, Firefox (latest 2 versions)                                                                                                         |
| **Responsive**       | Desktop-first; tablet-friendly; driver & WH views mobile-first                                                                                    |
| **Localization**     | English (default) + Bahasa Indonesia, switchable per user                                                                                         |
| **Security**         | HTTPS, password hashing (bcrypt), session-based auth, CSRF protection                                                                             |
| **Audit Trail**      | All create/update/delete/approve/reject/export actions logged with user, role, IP, timestamp, and field-level diffs. Immutable. 5-year retention. |
| **File Storage**     | Local filesystem with max 1MB per image (compressed)                                                                                              |


---

## 8. UI/UX Guidelines

### 8.1 Brand Direction


| Property            | Value                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primary Color**   | Blue — trustworthy, professional (exact shade chosen by agent within the blue family, e.g., `#2563EB` range)                                        |
| **Secondary Color** | Slate/gray for neutral backgrounds and text                                                                                                         |
| **Accent Color**    | A complementary warm accent (amber or orange) for CTAs and alerts                                                                                   |
| **Danger/Error**    | Red tones for destructive actions and errors                                                                                                        |
| **Success**         | Green tones for confirmations and positive states                                                                                                   |
| **Font Family**     | **Inter** (Google Fonts) — clean, modern, highly readable                                                                                           |
| **Overall Vibe**    | Modern & playful — rounded corners (`border-radius: 8-12px`), subtle hover/transition animations, friendly feel without sacrificing professionalism |
| **Mode**            | Light mode default; dark mode is out of scope for v1                                                                                                |


### 8.2 Layout

- **Sidebar navigation** (collapsible) with module icons + labels
- **Top bar** with: breadcrumb, search bar (`Ctrl+K`), notification bell, language switcher (EN/ID), user avatar + dropdown
- **Content area** with consistent padding and max-width for readability
- Module-specific **dashboards** as landing pages with KPI cards, recent activity, and quick actions

### 8.3 Components & Patterns

- **Design system:** shadcn/ui components styled with Tailwind CSS for consistency
- **Cards:** Rounded corners, subtle shadow, used for KPI summaries and form sections
- **Buttons:** Rounded (`rounded-lg`), primary = blue fill, secondary = outline, destructive = red fill. Subtle scale/hover animation on interaction
- **Tables:** Sortable, filterable, paginated (TanStack Table). Alternating row shading. Row hover highlight
- **Forms:** Inline real-time validation, floating labels or top-aligned labels, auto-save drafts, confirmation dialogs for destructive actions
- **Modals & Drawers:** Slide-in drawers for record details and history panel; centered modals for confirmations
- **Toasts:** Bottom-right corner, auto-dismiss, for success/error notifications
- **Loading:** Skeleton loaders instead of spinners for page/section loads
- **Transitions:** Subtle fade/slide animations on page navigation and component mount (keep under 200ms for snappiness)

### 8.4 Typography Scale


| Usage           | Style               |
| --------------- | ------------------- |
| Page title      | Inter 24px semibold |
| Section heading | Inter 18px semibold |
| Card title      | Inter 16px medium   |
| Body text       | Inter 14px regular  |
| Small/caption   | Inter 12px regular  |
| Table data      | Inter 14px regular  |
| Button text     | Inter 14px medium   |


*Agent may adjust sizes proportionally as long as the hierarchy and Inter font are preserved.*

### 8.5 Responsive Behavior

- **Desktop-first** design (1280px+ primary target)
- Sidebar collapses to icons on medium screens (768-1279px)
- **Driver & Warehouse mobile views** (`/driver`, `/warehouse`) designed mobile-first with large touch targets (min 44px), bottom navigation bar, and simplified layouts
- Admin/Manager views are tablet-friendly but not mobile-optimized in v1

### 8.6 Additional UI Details

- **History Button:** Every business record displays a clock/history icon → opens a slide-in drawer showing the full change timeline with color-coded diffs (red = old, green = new)
- **Print:** Clean print stylesheets for invoices, delivery orders, payslips, pick lists — hide navigation, use monochrome
- **Empty States:** Friendly illustrations or icons with guidance text (e.g., "No sales orders yet — create your first one")
- **Status Badges:** Color-coded rounded pills for record statuses (e.g., Draft = gray, Confirmed = blue, Delivered = green, Overdue = red)

---

## 9. Milestones & Phasing


| Phase                                   | Scope                                                                                                                                                            | Estimated Duration |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Phase 1 — Foundation**                | Auth, RBAC, settings, product master (with capital cost & price tiers), customer master, warehouse setup, audit trail infrastructure, global search, data import | 5–6 weeks          |
| **Phase 2 — Sales Core**                | Visit check-in, Sales Order → Delivery Order → AR Invoice → Payment                                                                                              | 4–5 weeks          |
| **Phase 2b — Driver Mobile**            | Mobile-optimized driver PWA view, delivery status updates, proof photo upload                                                                                    | 2–3 weeks          |
| **Phase 3 — Inventory & Warehouse Ops** | Stock movements, stock ledger, stock reports, goods receipt, pick & pack, stock opname, handover, warehouse mobile view                                          | 4–5 weeks          |
| **Phase 4 — Finance & Expenses**        | COA, journal entries, expense tracking & approval, financial reports, period closing, tax management                                                             | 5–6 weeks          |
| **Phase 5 — HR & Payroll**              | Employee master, attendance, leave, payroll, payslip generation                                                                                                  | 3–4 weeks          |
| **Phase 6 — Commission & CRM**          | Commission rules & calculation, lead tracking, sales targets, visit analytics                                                                                    | 2–3 weeks          |
| **Phase 7 — Notifications & Polish**    | In-app notifications, WhatsApp integration, dashboards with KPIs, i18n, PDF exports, testing, bug fixes                                                          | 3–4 weeks          |


**Total estimated:** ~29–36 weeks for a solo/small-team build.

---

## 10. Future Considerations (Out of Scope for v1)

- **Purchasing / Procurement module** (PO → Goods Receipt → AP Invoice)
- **Multi-warehouse stock transfers**
- **Batch / serial number tracking**
- **Customer credit limit enforcement**
- **E-Faktur integration** (Indonesian tax system)
- **Mobile app** (React Native)
- **API integrations** (marketplace, shipping providers)
- **Multi-company / multi-tenant support**
- **Advanced reporting / BI dashboard**
- **Dark mode**
- **Real-time WebSocket updates**
- **Customer returns & credit notes**

---

## 11. Glossary


| Term    | Description                                                   |
| ------- | ------------------------------------------------------------- |
| SO      | Sales Order                                                   |
| DO      | Delivery Order / Surat Jalan                                  |
| AR      | Accounts Receivable                                           |
| AP      | Accounts Payable                                              |
| PPN     | Pajak Pertambahan Nilai (Indonesian VAT, 11%)                 |
| PPh 21  | Pajak Penghasilan Pasal 21 (Employee income tax)              |
| BPJS    | Badan Penyelenggara Jaminan Sosial (Social security)          |
| COA     | Chart of Accounts                                             |
| UOM     | Unit of Measure                                               |
| NPWP    | Nomor Pokok Wajib Pajak (Tax ID)                              |
| KTP/NIK | Kartu Tanda Penduduk / Nomor Induk Kependudukan (National ID) |
| WH      | Warehouse                                                     |
| PWA     | Progressive Web App                                           |
| RBAC    | Role-Based Access Control                                     |


