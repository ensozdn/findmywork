# findmywork: Arka Planda Is Arama ve Basvuru Yonetim Rehberi

Bu rehber, sen diger islerinle mesgulken veya bilgisayar basinda yokken sistemin arkada nasil ilan toplayacagini, hayalet ilanlari nasil suzecegini ve basvuru onay surecini nasil yurutecegini aciklar.

---

## 1. Mimari ve Temel Isleyis

Sistem 3 bagimsiz adimda calisir:

1. **Arka Planda Tarama (Scout):** Belirledigin roller (Full Stack, NestJS, Backend) icin LinkedIn'deki son 24 saatin ilanlarini tarar.
2. **Anti-Ghost ve ATS Analizi:** 350+ basvurusu olan, repost edilmis veya data toplayan ajans ilanlarini isaretler; senin Emlak24, Pro Sicht ve Car Studio AI tecrubelerinle eslesen gercek ilanlara uyum skoru verir (%0 - %100).
3. **Onayli Basvuru (Human-in-the-Loop):** Masanin basina gectiginde kaliteli ilanlari onune serer. Tek tusla Easy Apply yapar, hazir PDF CV'ni yukler veya sirketteki Engineering Manager / IK liderine kisa baglanti notu yazar.

---

## 2. Ilk Kurulum: Tarayiciyi Baslatma ve Oturum Acma

Bu adim sadece tek bir kez yapilir. Oturumun `data/chrome_profile` klasorunde kalici olarak saklanir.

1. Terminalden su komutu calistir:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/Users/enesozden/.gemini/antigravity/scratch/findmywork/data/chrome_profile" &
```

2. Acilan Chrome penceresinde LinkedIn adresine git ve hesabina giris yap.
3. Giris yaptiktan sonra bu pencereyi acik birak veya kucult. Tarayici arka planda botun baglanmasi icin hazir bekler.

---

## 3. Sen Baska Islerle Mesgulken: 2 Farkli Calisma Modu

### Mod A: Ihtiyac Duydukca Tek Komutla Arka Planda Calistirma
Calismaya baslarken veya bir gorev arasi verdiginde arka planda taramayi baslatabilirsin:

```bash
cd /Users/enesozden/.gemini/antigravity/scratch/findmywork
node cli.js scan "Full Stack" &
```
Komutun sonundaki `&` isareti islemi arka plana atar; terminali baska isler icin kullanmaya devam edebilirsin.

### Mod B: Otomatik Donen Arka Plan Modu (Daemon)
Her 2 saatte bir belirledigin anahtar kelimeleri (Full Stack, NestJS, Backend) sirayla otomatik tarayan arka plan servisidir:

```bash
cd /Users/enesozden/.gemini/antigravity/scratch/findmywork
node scripts/autoScout.js &
```
Bu script acik kaldigi surece her 2 saatte bir sessizce LinkedIn'i tarar ve uygun gordugu ilanlari `data/jobs_latest.json` dosyasina biriktirir.

---

## 4. Masanin Basina Gectiginde: Onay ve Basvuru

Arka planda toplanan ilanlari onaylayip basvurmak icin terminalde su komutu calistir:

```bash
cd /Users/enesozden/.gemini/antigravity/scratch/findmywork
node cli.js review
```

Bu ekranda ilanlar en yuksek uyum skoruna gore teker teker karsina cikar:

* **[1] Onayla ve Otomatik Basvur:** Ilan LinkedIn Easy Apply destekliyorsa; tarayicida modal acilir, iletisim bilgilerin girilir, `config/resume.pdf` dosyan eklenir ve basvuru tamamlanarak takip listene islenir.
* **[2] Chrome'da Ac:** Ilan sirketin kendi kariyer sayfasindaysa (Workday, Greenhouse vb.), sayfayi Chrome'da onune acar. Sayfadaki form alanlarini otomatik doldurmak istersen baska bir terminal sekmesinden `node cli.js autofill` diyebilirsin.
* **[3] Yoneticiye Mesaj / Baglanti Notu Hazirla:** Ilanin bagli oldugu sirketteki Engineering Manager, Tech Lead veya IK sorumlusunu tespit eder. Profilini acar ve baglanti notu kutucuguna Can Deger tarzindaki su kisa mesaji otomatik yazar:
  > *"Merhabalar [Ad] Bey/Hanim, [Sirket] bunyesinde acilan [Pozisyon] pozisyonunu inceledim. Emlak24 ve Pro Sicht projelerinde edindigim NestJS ve TypeScript tecrubelerimle pozisyona iyi bir uyum saglayabilecegimi dusunuyorum. Sureci yoneten ilgili teknik lidere yonlendirebilirseniz sevinirim. Vaktiniz icin tesekkurler, Enes Ozden"*
* **[4] Pas Gec:** Ilani begenmediysen veya calisma sartlari uymuyorsa siradaki ilana gecer.
* **[q] Cikis:** Incelemeyi bitirir.

---

## 5. Raporlama ve Basvuru Takibi

Tum basvurularin `data/applications.json` dosyasinda saklanir.

* Daha once hangi firmalara basvurdugunu gormek icin:
```bash
node cli.js track
```
* Taranan tum ilanlari tek bakista ozet metin olarak gormek icin:
```bash
node cli.js report
```

---

## 6. Sık Sorulan Sorular ve Guvenlik

* **LinkedIn hesabim askiya alinir mi?**
  Hayir, cunku sistem rastgele headless tarayici kullanmaz. Kendi Chrome profilin uzerinden, insan hizinda bekleme sureleriyle calisir ve korumaya takilmaz.
* **Ayni ilana iki kez basvurur muyum?**
  Hayir, `review` modu daha once basvurdugun veya `track` listesinde kayitli olan ilanlari otomatik olarak filtreler.
* **Farkli roller aratabilir miyim?**
  Evet, `node cli.js scan "Frontend"`, `node cli.js scan "Node.js"` gibi istedigin rol parametresiyle calistirabilirsin.
