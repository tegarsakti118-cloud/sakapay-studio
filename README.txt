SAKAPAY AI OFFICE 3D - FASE 1

ISI FOLDER
- index.html   Struktur halaman aplikasi
- style.css    Tampilan responsif untuk HP
- app.js       Scene 3D Three.js, karakter, interaksi dan navigasi
- manifest.json Konfigurasi PWA
- sw.js        Cache dasar agar shell aplikasi bisa dibuka kembali
- icon.svg     Ikon aplikasi

MENJALANKAN DI HP
1. Ekstrak ZIP ke folder proyek di HP.
2. Buka folder lewat Acode.
3. Untuk melihat 3D, jalankan lewat local server/preview Acode yang mendukung ES modules. Jangan membuka index.html sebagai file:// karena browser dapat memblokir module import.
4. Jika preview Acode tidak menyediakan server, upload folder ke GitHub lalu deploy sebagai static site di Vercel. Semua file harus berada di root proyek.
5. Buka URL HTTPS hasil deploy di Chrome/ browser Android. Pilih menu browser > Add to Home Screen / Install App.

CATATAN
- Three.js dan OrbitControls dimuat dari jsDelivr CDN, jadi koneksi internet diperlukan saat memuat scene 3D.
- FASE 1 belum memakai API AI dan belum terhubung ke data transaksi SakaPay. Profil, tugas, dan log aktivitas adalah simulasi lokal.
- Tidak ada API key, backend berbayar, atau biaya layanan AI pada fase ini.
- PWA shell di-cache, tetapi modul Three.js eksternal belum disimpan offline. Untuk pengalaman 3D, tetap butuh internet.


PERBAIKAN FASE 1 - VERSI 2
- Memperbaiki import map Three.js dan OrbitControls agar browser dapat menemukan modul "three".
- Menaikkan versi cache Service Worker ke v2 agar file lama tidak terus dipakai.
- Jika website pernah dibuka sebelumnya, tutup tab lalu buka ulang setelah deploy. Jika masih versi lama, hapus data situs/cache website dari browser lalu buka kembali.
