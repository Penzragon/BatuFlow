## Summary

<!-- Jelaskan perubahan dengan bahasa singkat dan jelas -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Improvement/refactor
- [ ] Docs only
- [ ] Hotfix

## Operational Impact (BatuFlow)

Centang flow yang terdampak:

- [ ] Admin
- [ ] Sales
- [ ] Warehouse
- [ ] Driver
- [ ] Tidak ada dampak operasional langsung

Dampak singkat:

- 

## Validation Checklist

- [ ] Sudah dites lokal sesuai scope perubahan
- [ ] Tidak ada regression pada flow inti yang terdampak
- [ ] Jika menyentuh order/status: verifikasi lintas role dilakukan
- [ ] Jika perubahan code: build/test relevan sudah dijalankan
- [ ] Jika docs-only: tidak perlu build (konfirmasi)

## Production Readiness

- [ ] Risiko sudah dijelaskan
- [ ] Rollback plan jelas (tag/versi tujuan rollback ditentukan)
- [ ] Tidak ada perubahan rahasia/credential di PR

Rollback target bila perlu:

- `v`

Rollback trigger utama (jika terjadi di production):

- [ ] Login role operasional gagal
- [ ] Sales tidak bisa submit order
- [ ] Warehouse/Driver gagal update status
- [ ] Data order tidak sinkron lintas role

## Release Notes Draft

<!-- Ringkas untuk changelog/release note -->

- 
