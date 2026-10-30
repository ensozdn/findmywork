# 🎯 findmywork (Can Değer Stratejisi & AI Destekli İş Arama Asistanı)

Bu proje, **Can Değer'in yapay zeka ajanları ile iş arama ve ATS bypass etme stratejisini** temel alarak geliştirilmiş; LinkedIn ve iş portallarındaki yorucu ve "hayalet ilan" dolu süreci otomatikleştiren yerel bir asistandır.

---

## 🚀 Can Değer Stratejisinin Uygulanışı

| Prensip | Nasıl Uygulandı? | İlgili Dosya |
| :--- | :--- | :--- |
| **1. Yapay Zekayı Eğitme** | Trip Noute, Convoy Radio, Pro Sicht ve Emlak24 tecrübelerin sistemin hafızasına işlendi. | `config/profile.json` |
| **2. Otomatik İş Takibi** | Son 24 saatte yayınlanan React Native / Mobile / Full-Stack ilanlarını tarar. | `modules/linkedInScout.js` |
| **3. Anti-Ghost & Doğrulama** | 400+ başvurulu, repost edilmiş veya data toplayan ajans ilanlarını eler. | `modules/jobAnalyzer.js` |
| **4. Hiring Manager Bulma** | Şirketteki Engineering Manager / Mobile Lead / İK kişilerini otomatik bulur. | `modules/hiringManagerScout.js` |
| **5. Akıllı İletişim Stratejisi** | Çarşaf gibi metinler yerine 2-3 cümlelik, kasmayan "yönlendirme rica eden" mesajlar üretir. | `templates/messages.json` |
| **6. Form Doldurma Kolaylığı** | Workday / Greenhouse gibi dış kariyer formlarını tek tıkla doldurur. | `modules/formAutofill.js` |
| **7. ATS Bypass & Özel CV** | İlandaki anahtar kelimelerle eşleşen hazır CV maddeleri (bullet points) üretir. | `modules/jobAnalyzer.js` |
| **8. Başvuru Takibi** | Hangi şirkete ne zaman başvurulduğunu ve durumunu yerel veritabanında tutar. | `modules/tracker.js` |

---

## 🛡️ Güvenlik & Ban Koruması (Chrome DevTools Protocol)

LinkedIn'in bot koruma algoritmalarına takılmamak ve hesabını riske atmamak için sistem sıfırdan sahte bir tarayıcı açmaz. Zaten giriş yaptığın **kendi Google Chrome oturumuna** `remote-debugging-port` üzerinden güvenle bağlanır.

### Chrome'u Debug Modunda Başlatma:
Mevcut açık Chrome pencerelerini kapatıp terminalde şu komutu çalıştır:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 &
```

---

## 🛠️ Kullanım Komutları

Proje dizinine geç:
```bash
cd /Users/enesozden/.gemini/antigravity/scratch/findmywork
```

### 1. Durum ve Bağlantı Kontrolü
```bash
node cli.js check
```

### 2. İlanları Tara ve Analiz Et
```bash
# Varsayılan "React Native" ilanlarını tarar:
node cli.js scan "React Native"

# Veya farklı bir arama:
node cli.js scan "Mobile Developer"
```

### 3. Taranan İlanları & Hazır Mesajları İncele
```bash
node cli.js report
```

### 4. Şirketin Karar Vericilerini / İK Liderini Bul
```bash
node cli.js lead "Trendyol"
```

### 5. Dış Başvuru Formunu (Workday / Greenhouse) Doldur
Chrome'da formun açık olduğu sekmedeyken:
```bash
node cli.js autofill
```

### 6. Başvuru Geçmişini Gör
```bash
node cli.js track
```

