# Sales Mobile v1 — UAT Guide (EN/ID)

_Last updated: 2026-03-03_

## 1) Purpose / Tujuan

This document helps business users validate the **Sales Mobile v1** flow in real field usage.

Dokumen ini membantu user bisnis melakukan validasi alur **Sales Mobile v1** pada penggunaan lapangan.

Main flow / Alur utama:

1. Login redirect
2. Language switch (EN/ID)
3. Browse customers
4. Submit visit check-in
5. Submit order
6. View order detail

---

## 2) Scope in v1 / Cakupan v1

Completed in v1:

- Sales mobile dashboard (`/sales-mobile/dashboard`)
- Assigned customer list + customer detail (`/sales-mobile/customers`)
- Visit check-in with selfie + GPS (`/sales-mobile/visits/new`)
- Sales order creation from mobile (`/sales-mobile/orders/new`)
- My order list + order status (`/sales-mobile/orders`)
- Basic order detail page (`/sales-mobile/orders/[id]`)
- Language switching EN/ID from mobile header

---

## 3) Test Data Preparation / Persiapan Data Uji

Before UAT, prepare:

- 1 user with role **STAFF** (salesman)
- At least 2 assigned active customers to that user
- At least 3 active products with price
- Device with camera + GPS permission enabled
- Stable internet connection

Sebelum UAT, siapkan:

- 1 user role **STAFF** (sales)
- Minimal 2 pelanggan aktif yang assigned ke user tersebut
- Minimal 3 produk aktif dengan harga
- Perangkat dengan izin kamera + GPS aktif
- Koneksi internet stabil

---

## 4) UAT Scenarios (Practical) / Skenario UAT (Praktis)

> Pass if **actual result matches expected result**.
>
> Lulus jika **hasil aktual sesuai hasil yang diharapkan**.

### UAT-01 — Login Redirect

- **EN Steps**
  1. Open `/login`
  2. Login with STAFF account
  3. Wait until redirected
- **ID Langkah**
  1. Buka `/login`
  2. Login pakai akun STAFF
  3. Tunggu proses redirect
- **Expected / Ekspektasi**
  - Redirect to `/sales-mobile/dashboard`
  - Dashboard cards are visible (Check-in, New Order, Customers, Orders)

---

### UAT-02 — Language Switch (EN/ID)

- **EN Steps**
  1. From sales mobile header, tap language icon
  2. Switch from English to Bahasa Indonesia
  3. Check dashboard, menu labels, and form labels
  4. Switch back to English
- **ID Langkah**
  1. Dari header sales mobile, klik ikon bahasa
  2. Ubah dari English ke Bahasa Indonesia
  3. Cek label dashboard, menu, dan form
  4. Ubah kembali ke English
- **Expected / Ekspektasi**
  - UI text updates to selected language
  - Choice persists after refresh/navigation

---

### UAT-03 — Customer Browse

- **EN Steps**
  1. Open `Customers`
  2. Verify assigned customer list appears
  3. Open one customer detail
- **ID Langkah**
  1. Buka menu `Pelanggan`
  2. Pastikan daftar pelanggan assigned tampil
  3. Buka detail salah satu pelanggan
- **Expected / Ekspektasi**
  - Only assigned active customers are visible for STAFF
  - Customer basic info appears (name, address/phone if available)
  - User can continue to check-in/order flow from customer context

---

### UAT-04 — Check-in Submit (Photo + GPS)

- **EN Steps**
  1. Open `Check-in`
  2. Select customer
  3. Capture/refresh GPS
  4. Start camera and take selfie
  5. Submit check-in
- **ID Langkah**
  1. Buka menu `Check-in`
  2. Pilih pelanggan
  3. Ambil/refresh GPS
  4. Nyalakan kamera dan ambil selfie
  5. Submit check-in
- **Expected / Ekspektasi**
  - Success toast shown (check-in success)
  - User is redirected back to sales dashboard
  - Check-in record is stored for that customer + salesman

Negative checks / uji negatif:

- Submit without customer -> blocked with error
- Submit without GPS -> blocked with error
- Submit without photo -> blocked with error

---

### UAT-05 — Order Submit

- **EN Steps**
  1. Open `Orders` -> `New`
  2. Select customer
  3. Add at least 1 line item (product + qty)
  4. (Optional) adjust discount / PPN / notes
  5. Submit order
- **ID Langkah**
  1. Buka `Pesanan` -> `Baru`
  2. Pilih pelanggan
  3. Tambahkan minimal 1 item (produk + qty)
  4. (Opsional) atur diskon / PPN / catatan
  5. Submit pesanan
- **Expected / Ekspektasi**
  - Success toast shown (order created)
  - Redirect to order detail page
  - New order appears in My Orders list with valid status

Negative checks / uji negatif:

- Submit without customer -> blocked
- Submit with empty/invalid lines -> blocked

---

### UAT-06 — Order Detail View

- **EN Steps**
  1. Open `Orders`
  2. Tap one created order
- **ID Langkah**
  1. Buka `Pesanan`
  2. Klik salah satu pesanan yang sudah dibuat
- **Expected / Ekspektasi**
  - Order detail page opens successfully
  - Order ID/title visible

Note:
- In v1, detail is basic (order identity page), not full commercial breakdown.
- Di v1, detail masih basic (identitas order), belum detail komersial penuh.

---

## 5) Known Limitations & Fallback / Keterbatasan & Langkah Fallback

1. **Order detail still minimal (v1)**
   - Limitation: no full line-by-line commercial summary yet in mobile detail.
   - Fallback: open order list or use web dashboard order detail for deeper review.

2. **Requires camera + GPS permissions for check-in**
   - Limitation: check-in cannot submit without both.
   - Fallback:
     - Enable permission in device/browser settings
     - Refresh GPS and retake selfie
     - Retry check-in

3. **Online-first behavior**
   - Limitation: unstable network may fail submit.
   - Fallback:
     - Retry after connection improves
     - Re-open form and submit again

4. **Data visibility based on role/assignment**
   - Limitation: STAFF only sees assigned customers / own orders.
   - Fallback:
     - Ask admin/manager to verify customer assignment and account role

---

## 6) Release Notes — Sales Mobile v1

### ✅ Completed

- Staff login now redirects to sales mobile dashboard
- Mobile shell with bottom navigation is available
- Language switch EN/ID works in sales mobile header
- Assigned-customer browse flow available
- Visit check-in flow ready (customer + GPS + selfie + submit)
- Mobile order creation flow ready (customer + lines + discount + PPN)
- My Orders listing with statuses available
- Basic order detail page is available for navigation continuity

### ⏭ Planned next (post-v1)

- Rich order detail (full breakdown, commercial and status timeline)
- Better offline draft/retry UX for weak signal areas
- Additional validation and field UX polish based on UAT feedback

---

## 7) UAT Sign-off Template

- Test date / Tanggal tes:
- Tester name / Nama tester:
- Role/Area:
- Device + Browser:
- Scenarios passed: UAT-01 / 02 / 03 / 04 / 05 / 06
- Open issues / Isu terbuka:
- Go/No-Go recommendation:
