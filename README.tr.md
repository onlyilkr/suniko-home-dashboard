<p align="center">
  <img src="app/icon.png" width="112" height="112" alt="Suniko Home simgesi">
</p>

<h1 align="center">Suniko Home</h1>

<p align="center">
  Samsung Tizen TV'ler için sakin, bir bakışta okunan bir ana ekran: saat, dışarıdaki gerçek gökyüzü,<br>
  SmartThings eviniz ve bir geliştirici merkezi; hepsi koltuktan okunacak boyutta.
</p>

<p align="center">
  <a href="https://github.com/onlyilkr/suniko-home-dashboard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/onlyilkr/suniko-home-dashboard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Lisans: MIT" src="https://img.shields.io/badge/license-MIT-3b82f6"></a>
  <img alt="Samsung Tizen 6.5+" src="https://img.shields.io/badge/Samsung%20Tizen-6.5%2B-1f2937">
  <img alt="Diller: Türkçe, İngilizce" src="https://img.shields.io/badge/i18n-EN%20%7C%20TR-8b5cf6">
</p>

<p align="center"><a href="README.md">English</a></p>

![Ana ekran: saat, parçalı bulutlu gökyüzü, saatlik ve haftalık tahmin, iç ortam ve namaz vakitleri](docs/screenshots/home-tr.jpg)

Suniko Home TV'yi bir ortam ekranına çevirir. Dışarısı (saat, tarih, hava) gerçek saate, gün doğumu/batımına ve havaya göre boyanan gökyüzüne doğrudan yazılır; evle ilgili her şey liquid glass panellerde durur. Düz HTML, CSS ve ES5 JavaScript: framework yok, build adımı yok, izleme yok; ağ kesilince önbellekten çalışmaya devam eder.

**30 saniyede tarayıcıda deneyin** (TV ya da SmartThings hesabı gerekmez):

```bash
git clone https://github.com/onlyilkr/suniko-home-dashboard.git && cd suniko-home-dashboard
python3 dev-server.py          # sonra http://127.0.0.1:8770/?demo
```

## Özellikler

- **Bir bakışta:** üç saat stili (dijital, rakamlı ya da sade yuvarlak kadran; yaşlı gözler için daha okunaklı), anlık hava, sonraki altı saat ve her güne hava simgesi olan kompakt yedi günlük çubuklar (Open-Meteo). Üç saat içinde yağmur bekleniyorsa bildirim.
- **Arka plan gökyüzü:** gerçek havayı çizen *Hava durumu* teması (güneş ya da ay ve yıldızlar, kayan bulutlar, yağmur, kar, sis, şimşek), *Canlı gökyüzü*, *Günün renkleri*, *Koyu* ve Wikimedia Commons'tan sekiz fotoğraflı tema (yazar ve lisans ekranda).
- **Akıllı ev (isteğe bağlı, SmartThings):** iç sıcaklık ve nem; kapı, sızıntı, ışık, pil ve evde olma durumu. OK ile oda oda ev kontrolleri, tek tuşla sahneler. Kapı açılınca, sızıntıda, biri gelip gidince macOS gibi inen bildirimler. TV'de kendini yenileyen OAuth.
- **Geliştirici merkezi:** kalkış tahtası görünümünde Hacker News ön sayfası (HN'deki sırayla), bu hafta en çok yıldız alan GitHub repoları ve Claude (claude.ai, API, Claude Code) ile GitHub servis durumu. OK ayrıntıyı açar: ilk yorumlar ve telefonda devam etmek için QR kod. Servis bozulunca ya da düzelince bildirim. Anahtar ya da hesap gerekmez.
- **Namaz vakitleri (isteğe bağlı):** sıradaki vakit ve geri sayım, günün altı vakti. Türkiye'de ilçe bazında resmî Diyanet vakitleri, yurt dışında Aladhan. 15 dakika kala ve vakitte bildirim.
- **TV için:** her şey yön tuşları, OK ve Geri ile; ayarlar anında uygulanır ve TV'de saklanır. Türkçe ve İngilizce, dile göre tarih/sayı/°C-°F/12-24 saat. TV GPU'suna göre ayarlı: kayan panelde bulanıklık yok, sahne katman bütçesi küçük, panel açıkken animasyonlar durur.

### Görseller

![Üç saat stili: dijital, rakamlı yuvarlak, sade yuvarlak](docs/screenshots/clock-styles.jpg)

![Hava durumu teması altı koşulda: açık gündüz, parçalı bulutlu gece, yağmur, kar, sis, fırtına](docs/screenshots/weather-scenes.jpg)

| | |
|---|---|
| ![Odalara göre gruplanmış ev kontrolleri ve sahneler](docs/screenshots/controls.jpg) | ![Yağmur, kapı ve namaz hatırlatması bildirimleri](docs/screenshots/notifications.jpg) |
| **Ev kontrolleri** | **Bildirimler** |
| ![Geliştirici merkezi: Hacker News, GitHub ve servis durumu](docs/screenshots/developer-hub.jpg) | ![Haber ayrıntısı, QR kod ve yorumlar](docs/screenshots/developer-hub-details.jpg) |
| **Geliştirici merkezi** | **Ayrıntı ve QR kod** |
| ![Namaz vakitleri konumu: İstanbul'un ilçeleri](docs/screenshots/prayer-places.jpg) | ![Gruplanmış ayarlar paneli](docs/screenshots/settings.jpg) |
| **Namaz vakitleri konumu** | **Ayarlar** |

<p align="center"><img src="docs/screenshots/tour.gif" width="720" alt="Kumandayla kısa bir tur: üst menü, geliştirici merkezi ve QR kodlu ayrıntı, ev kontrolleri ve ayarlar"></p>

Ekran görüntüleri, kumanda tuşları, ayar anahtarları, SSS (OLED ekranlar dahil), yol haritası, mimari ve veri kaynakları için İngilizce **[README](README.md)**'ye bakın.

## TV'ye kurulum

Tizen 6.5 ve üstü bir Samsung TV (2024 QN85D, Tizen 9.0 üzerinde denendi), aynı ağdaki bir bilgisayar, TV eklentisiyle Tizen Studio ve ücretsiz Samsung geliştirici sertifikası gerekir. Developer Mode'dan ilk açılışa adım adım rehber: **[docs/SETUP.md](docs/SETUP.md)** (İngilizce).

```bash
cp app/config.example.js app/config.js            # isteğe bağlı: konum, varsayılanlar
python3 st_auth.py url                            # isteğe bağlı: SmartThings, bkz. SETUP §6
TV_IP=192.168.1.50 CERT_PROFILE=profilim ./build.sh
```

## Demo modu

Önizleme adresine `?demo` ekleyin (ya da `demo: true`): SmartThings ve hava yerine örnek bir ev ve İstanbul için sabit bir hava gelir; hiçbir yere komut gitmez. `?demo=rain`, `snow`, `storm`, `fog`, `clear` ya da `overcast` havayı seçer.

## Katkı ve lisans

Katkılar memnuniyetle karşılanır: **[CONTRIBUTING.md](CONTRIBUTING.md)**. Tizen paketleme ve kurulum betikleri Gürsu Yaman'ın [gursuyaman1/tizen-tv-dashboard-ai](https://github.com/gursuyaman1/tizen-tv-dashboard-ai) projesinden başladı; arayüz ve geri kalan her şey sıfırdan yazıldı. Lisans: [MIT](LICENSE).
