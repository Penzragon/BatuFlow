# BatuFlow Production Smoke Checklist

> Tujuan: validasi cepat setelah deploy agar operasi harian tetap aman.
> Waktu target: 15–30 menit.

## Release Info

- Tanggal/Waktu:
- Environment: Production
- Versi/Tag (contoh `v1.1.0`):
- PIC (on-duty):
- Approver bisnis:

## Aturan Lulus/Gagal

- **PASS** = semua item kritikal di bawah lolos.
- **FAIL** = ada 1 item kritikal gagal.
- Jika FAIL, ikuti **Rollback Trigger**.

## 1) Akses & Auth (Kritikal)

- [ ] **PASS** / [ ] FAIL — Login berhasil untuk role **Admin**.
- [ ] **PASS** / [ ] FAIL — Login berhasil untuk role **Sales**.
- [ ] **PASS** / [ ] FAIL — Login berhasil untuk role **Warehouse**.
- [ ] **PASS** / [ ] FAIL — Login berhasil untuk role **Driver**.
- [ ] **PASS** / [ ] FAIL — Logout dan login ulang berjalan normal.

## 2) Admin Flow (Kritikal)

- [ ] **PASS** / [ ] FAIL — Dashboard Admin terbuka tanpa error.
- [ ] **PASS** / [ ] FAIL — Bisa buat/ubah data master (contoh: customer/produk).
- [ ] **PASS** / [ ] FAIL — Bisa lihat status order terbaru.
- [ ] **PASS** / [ ] FAIL — Data perubahan tersimpan dan muncul setelah refresh.

## 3) Sales Flow (Kritikal)

- [ ] **PASS** / [ ] FAIL — Sales bisa membuat order baru.
- [ ] **PASS** / [ ] FAIL — Validasi stok/harga tampil benar saat order dibuat.
- [ ] **PASS** / [ ] FAIL — Order tersubmit dan nomor order terbentuk.
- [ ] **PASS** / [ ] FAIL — Status order terlihat oleh Admin/Warehouse.

## 4) Warehouse Flow (Kritikal)

- [ ] **PASS** / [ ] FAIL — Warehouse bisa melihat antrian order baru.
- [ ] **PASS** / [ ] FAIL — Proses pick/pack berjalan tanpa gagal simpan.
- [ ] **PASS** / [ ] FAIL — Update status siap kirim (ready to ship) berhasil.
- [ ] **PASS** / [ ] FAIL — Perubahan status terlihat oleh Driver/Admin.

## 5) Driver Flow (Kritikal)

- [ ] **PASS** / [ ] FAIL — Driver bisa melihat daftar pengiriman.
- [ ] **PASS** / [ ] FAIL — Driver bisa update status (pickup/on delivery/delivered).
- [ ] **PASS** / [ ] FAIL — Bukti kirim (jika ada) bisa diunggah/tersimpan.
- [ ] **PASS** / [ ] FAIL — Status akhir terkirim terlihat di dashboard.

## 6) Integritas Data & Sinkronisasi (Kritikal)

- [ ] **PASS** / [ ] FAIL — 1 order uji tampil konsisten di semua role (Admin/Sales/Warehouse/Driver).
- [ ] **PASS** / [ ] FAIL — Tidak ada duplikasi order/status.
- [ ] **PASS** / [ ] FAIL — Timestamp/status update berurutan dan masuk akal.

## 7) Observability Dasar (Kritikal)

- [ ] **PASS** / [ ] FAIL — Tidak ada lonjakan error 5xx di log/monitoring.
- [ ] **PASS** / [ ] FAIL — Endpoint health utama respons normal.
- [ ] **PASS** / [ ] FAIL — Tidak ada error blocking di browser console pada flow utama.

## Rollback Trigger (WAJIB)

Lakukan rollback **segera** jika salah satu kondisi ini terjadi:

- [ ] Gagal login untuk role operasional (Admin/Sales/Warehouse/Driver).
- [ ] Sales tidak bisa submit order baru.
- [ ] Warehouse/Driver tidak bisa update status order.
- [ ] Data order hilang/tidak sinkron lintas role.
- [ ] Error server berulang yang mengganggu operasi.

## Keputusan

- [ ] **GO** — Release aman, lanjut monitoring normal.
- [ ] **ROLLBACK** — Kembalikan ke versi stabil terakhir.

Catatan insiden/temuan:
- 
- 

Ditandatangani:
- PIC Teknis:
- PIC Operasional:
