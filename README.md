# findmywork (Is Arama ve Basvuru Pipeline)

Bu proje, is portallarindaki hayalet ilanlari filtreleyen, ilanlari yetenek setiyle eslestiren ve basvuru surecini yoneten yerel bir aractir.

## Mimari

| Bilesen | Gorev | Dosya |
| :--- | :--- | :--- |
| Profil Yonetimi | Deneyim, proje ve yetkinlik verileri | config/profile.json |
| Tarayici Entegrasyonu | LinkedIn arama ve veri toplama | modules/linkedInScout.js |
| Anti-Ghost Analizi | Tekrarli veya sahte ilan tespiti | modules/jobAnalyzer.js |
| Karar Verici Tespiti | Muhendislik yoneticisi ve IK arama | modules/hiringManagerScout.js |
| Iletisim Kaliplari | Kisa ve yonlendirici baglanti notlari | templates/messages.json |
| Form Doldurma | Dis kariyer portallari icin otomatik doldurma | modules/formAutofill.js |
| Easy Apply | LinkedIn uzerinden onayli basvuru tamamlama | modules/easyApply.js |
| Basvuru Takibi | Basvurulan ilanlarin durum takibi | modules/tracker.js |

## Tarayici Baglantisi (Chrome DevTools Protocol)

Hesap guvenligi icin dogrudan kullanici oturumunun acik oldugu Chrome ornegine baglanti saglanir:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 &
```

## Komutlar

Proje dizinine gecin:
```bash
cd /Users/enesozden/.gemini/antigravity/scratch/findmywork
```

1. Durum ve Baglanti Kontrolu:
```bash
node cli.js check
```

2. Ilan Tarama:
```bash
node cli.js scan "React Native"
```

3. Inceleme ve Onayli Basvuru:
```bash
node cli.js review
```

4. Rapor Listeleme:
```bash
node cli.js report
```

5. Basvuru Gecmisi:
```bash
node cli.js track
```
