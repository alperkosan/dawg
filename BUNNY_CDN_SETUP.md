# Bunny CDN Yapılandırma Rehberi

Bu rehber, DAWG projesi için Bunny CDN yapılandırmasını adım adım açıklar.

## 📋 Gereksinimler

1. **Bunny CDN hesabı** (ücretsiz deneme mevcut: https://bunny.net)
2. **Storage Zone** oluşturulmuş olmalı
3. **Pull Zone** oluşturulmuş olmalı (opsiyonel, CDN URL için)

---

## 🔧 Adım 1: Bunny CDN Hesabı ve Storage Zone Oluşturma

### 1.1 Bunny CDN Hesabı
1. https://bunny.net adresine gidin
2. Hesap oluşturun veya giriş yapın
3. Dashboard'a gidin

### 1.2 Storage Zone Oluşturma
1. Dashboard'da **"Storage"** sekmesine gidin
2. **"Add Storage Zone"** butonuna tıklayın
3. Aşağıdaki bilgileri girin:
   - **Name**: `dawg-storage` (veya istediğiniz isim)
   - **Region**: En yakın bölgeyi seçin (örn: `Frankfurt (DE)`, `New York (NY)`, `Los Angeles (LA)`, `Singapore (SG)`)
   - **Replication Regions**: İsteğe bağlı (ücretsiz plan için gerekli değil)
4. **"Add Storage Zone"** butonuna tıklayın

### 1.3 Storage Zone API Key'ini Alma
1. Oluşturduğunuz Storage Zone'a tıklayın
2. **"FTP & HTTP API"** sekmesine gidin
3. **"Password"** (Storage API Key) değerini kopyalayın
   - ⚠️ **ÖNEMLİ**: Bu key'i güvenli bir yerde saklayın, tekrar gösterilmez!

### 1.4 Pull Zone Oluşturma (Opsiyonel - CDN URL için)
1. Dashboard'da **"Pull Zones"** sekmesine gidin
2. **"Add Pull Zone"** butonuna tıklayın
3. Aşağıdaki bilgileri girin:
   - **Name**: `dawg` (veya istediğiniz isim)
   - **Origin URL**: Storage Zone'unuzun URL'i (örn: `https://storage.bunnycdn.com/dawg-storage`)
4. **"Add Pull Zone"** butonuna tıklayın
5. Pull Zone'unuzun CDN URL'ini not edin (örn: `https://dawg.b-cdn.net`)

---

## 🔑 Adım 2: API Key'lerini Alma

### 2.1 Bunny CDN API Key (Account API Key)
1. Dashboard'da sağ üst köşedeki profil ikonuna tıklayın
2. **"Account"** → **"API"** sekmesine gidin
3. **"API Key"** değerini kopyalayın
   - Bu key, CDN yönetimi için kullanılır (şu an için opsiyonel)

### 2.2 Storage API Key (Storage Zone Password)
- Yukarıdaki **1.3** adımında aldığınız key'i kullanın
- Bu key, dosya yükleme için **ZORUNLUDUR**

---

## ⚙️ Adım 3: Environment Variables Yapılandırması

### 3.1 Local Development (.env dosyası)

Projenizin root dizininde `.env` dosyası oluşturun veya düzenleyin:

```bash
# CDN Configuration
CDN_PROVIDER=bunny
CDN_BASE_URL=https://dawg.b-cdn.net  # Pull Zone URL'iniz (opsiyonel)

# Bunny CDN Configuration
BUNNY_PULL_ZONE_URL=https://dawg.b-cdn.net  # Pull Zone URL'iniz (opsiyonel)
BUNNY_STORAGE_ZONE_NAME=dawg-storage  # Storage Zone adınız
BUNNY_STORAGE_ZONE_REGION=de  # Storage Zone bölgeniz (de, ny, la, sg, vb.)
BUNNY_API_KEY=your-bunny-api-key-here  # Account API Key (opsiyonel)
BUNNY_STORAGE_API_KEY=your-storage-api-key-here  # Storage Zone Password (ZORUNLU)
```

### 3.2 Vercel Production Environment Variables

1. Vercel Dashboard'a gidin: https://vercel.com
2. Projenizi seçin
3. **Settings** → **Environment Variables** sekmesine gidin
4. Aşağıdaki değişkenleri ekleyin:

```
CDN_PROVIDER = bunny
CDN_BASE_URL = https://dawg.b-cdn.net
BUNNY_PULL_ZONE_URL = https://dawg.b-cdn.net
BUNNY_STORAGE_ZONE_NAME = dawg-storage
BUNNY_STORAGE_ZONE_REGION = de
BUNNY_API_KEY = your-bunny-api-key-here
BUNNY_STORAGE_API_KEY = your-storage-api-key-here
```

5. Her değişken için **Production**, **Preview**, ve **Development** ortamlarını seçin
6. **Save** butonuna tıklayın

---

## ✅ Adım 4: Yapılandırmayı Test Etme

### 4.1 Local Test

1. Server'ı yeniden başlatın:
```bash
cd server
npm run dev
```

2. Console log'larında şu mesajları görmelisiniz:
```
📤 Uploading to Bunny CDN: https://storage.bunnycdn.com/dawg-storage/...
📦 Storage Zone: dawg-storage
🔑 API Key: SET (length: XX)
```

3. File browser'dan bir dosya yüklemeyi deneyin

### 4.2 Vercel Test

1. Değişiklikleri commit edin ve push edin
2. Vercel otomatik olarak deploy edecek
3. Production'da bir dosya yükleme işlemi yapın
4. Vercel Function Logs'unda yukarıdaki log'ları kontrol edin

---

## 🔍 Sorun Giderme

### Hata: "Bunny CDN is not configured"
- ✅ `BUNNY_STORAGE_API_KEY` environment variable'ının set edildiğinden emin olun
- ✅ `BUNNY_STORAGE_ZONE_NAME` environment variable'ının doğru olduğundan emin olun
- ✅ Server'ı yeniden başlatın (environment variables değişiklikleri için gerekli)

### Hata: "401 Unauthorized" veya "403 Forbidden"
- ✅ `BUNNY_STORAGE_API_KEY` değerinin doğru olduğundan emin olun
- ✅ Storage Zone Password'ü kopyalarken boşluk veya yeni satır karakteri eklenmediğinden emin olun

### Hata: "404 Not Found" (Storage Zone)
- ✅ `BUNNY_STORAGE_ZONE_NAME` değerinin Storage Zone adıyla tam olarak eşleştiğinden emin olun
- ✅ Storage Zone'un aktif olduğundan emin olun

### Upload çalışmıyor
- ✅ Network tab'ında request'leri kontrol edin
- ✅ Server log'larını kontrol edin
- ✅ Bunny CDN Dashboard'da Storage Zone'unuzu kontrol edin (dosyalar görünüyor mu?)

---

## 📚 Ek Bilgiler

### Storage Zone Bölgeleri
- `de` - Frankfurt, Germany
- `ny` - New York, USA
- `la` - Los Angeles, USA
- `sg` - Singapore
- `uk` - London, UK
- `syd` - Sydney, Australia

### Dosya Yükleme Yöntemleri
1. **Client-side direct upload** (Bunny CDN yapılandırılmışsa):
   - Büyük dosyalar için önerilir (Vercel 4.5MB limit'ini bypass eder)
   - Doğrudan client'tan Bunny CDN'e yüklenir

2. **Server-side upload** (Fallback):
   - Bunny CDN yapılandırılmamışsa veya client-side upload başarısız olursa kullanılır
   - Server üzerinden yüklenir (Vercel 4.5MB limit'i geçerli)

### Güvenlik Notları
- ⚠️ **ASLA** API key'lerini kod içine hardcode etmeyin
- ⚠️ **ASLA** API key'lerini Git'e commit etmeyin
- ✅ `.env` dosyasını `.gitignore`'a ekleyin
- ✅ Production'da environment variables kullanın

---

## 🎉 Tamamlandı!

Bunny CDN yapılandırmanız tamamlandı! Artık dosya yüklemeleri Bunny CDN üzerinden gerçekleşecek.

Sorularınız için: https://docs.bunny.net

