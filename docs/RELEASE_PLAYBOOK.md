# BatuFlow Release Playbook

Panduan rilis ringkas untuk tim teknis + operasional.
Fokus: mencegah gangguan pada alur Admin, Sales, Warehouse, Driver.

## 1) Persiapan Sebelum Rilis

- [ ] Scope rilis disepakati (fitur/perbaikan apa saja).
- [ ] PR sudah direview dan CI utama hijau.
- [ ] Risiko perubahan dijelaskan (terutama yang menyentuh order/status).
- [ ] Backout plan siap (versi stabil terakhir sudah diketahui).
- [ ] PIC rilis ditunjuk + kontak owner operasional tersedia.

## 2) SOP Versioning & Tagging

Gunakan format semver:
- Patch: `vX.Y.Z` untuk bugfix kecil
- Minor: `vX.Y.0` untuk fitur baru kompatibel
- Major: `vX.0.0` untuk breaking change

Langkah tagging:

1. Pastikan branch target sudah final dan up-to-date.
2. Buat commit release (jika perlu changelog/version bump).
3. Tag release:
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
4. Push branch + tag:
   - `git push origin <branch>`
   - `git push origin vX.Y.Z`
5. Buat release note singkat:
   - Ringkasan perubahan
   - Risiko yang diketahui
   - Dampak ke Admin/Sales/Warehouse/Driver

## 3) Eksekusi Rilis

- [ ] Freeze merge non-prioritas selama rilis.
- [ ] Deploy ke production sesuai pipeline standar.
- [ ] Catat waktu deploy mulai & selesai.
- [ ] Informasikan ke tim ops bahwa smoke test dimulai.

## 4) Post-Release Verification (Wajib)

Gunakan `docs/PROD_SMOKE_CHECKLIST.md`.
Minimal verifikasi:

- [ ] Admin login + akses dashboard
- [ ] Sales membuat 1 order uji
- [ ] Warehouse proses order hingga ready to ship
- [ ] Driver update hingga delivered
- [ ] Data order konsisten lintas role
- [ ] Tidak ada error kritikal di log/monitoring

## 5) Kriteria GO / ROLLBACK

### GO jika:
- [ ] Semua item kritikal smoke test PASS.
- [ ] Tidak ada error produksi yang mengganggu operasi inti.

### ROLLBACK jika salah satu terjadi:
- [ ] Login role utama gagal
- [ ] Sales tidak bisa membuat order
- [ ] Warehouse/Driver tidak bisa update status
- [ ] Data order tidak sinkron / hilang
- [ ] Error berulang berdampak operasional

## 6) SOP Rollback

1. Umumkan status: **Rollback in progress**.
2. Deploy ulang ke **tag stabil terakhir**.
3. Validasi cepat login + flow order dasar.
4. Umumkan status: **Rollback complete**.
5. Buka incident record:
   - Waktu kejadian
   - Dampak bisnis
   - Akar masalah sementara
   - Tindak lanjut perbaikan

## 7) Komunikasi Setelah Rilis

Kirim update ringkas ke stakeholder:

- Versi/tag rilis:
- Status: GO / ROLLBACK
- Ringkasan hasil smoke test:
- Isu yang perlu dipantau:
- PIC monitoring lanjutan:

## 8) Monitoring 24 Jam Pertama

- [ ] Pantau error rate, latency, dan kegagalan submit/update order.
- [ ] Cek feedback dari tim Sales/Warehouse/Driver.
- [ ] Jika ada isu berulang, eskalasi dan tentukan hotfix vs rollback.
