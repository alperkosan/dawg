# 🚀 Backend Server Başlatma Kılavuzu

## 📋 Gereksinimler

1. **PostgreSQL** - Veritabanı
2. **Node.js 18+** - Runtime
3. **npm** - Paket yöneticisi

## 🔧 Kurulum Adımları

### 1. Dependencies Yükleme
```bash
cd server
npm install
```

### 2. PostgreSQL Kurulumu ve Veritabanı Oluşturma

#### macOS (Homebrew):
```bash
brew install postgresql@14
brew services start postgresql@14

# Veritabanı oluştur
createdb dawg
```

#### Linux:
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql

# Veritabanı oluştur
sudo -u postgres createdb dawg
```

#### Docker (Alternatif):
```bash
docker run --name dawg-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dawg \
  -p 5432:5432 \
  -d postgres:14
```

### 3. .env Dosyası Ayarlama

`.env` dosyası zaten oluşturulmuş olmalı. Eğer yoksa:

```bash
cd server
cp .env.example .env
```

`.env` dosyasını düzenleyin ve PostgreSQL bağlantı bilgilerinizi güncelleyin:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dawg
```

### 4. Veritabanı Migration'ları Çalıştırma

```bash
cd server
npm run migrate
```

### 5. Server'ı Başlatma

#### Development Mode (Hot Reload):
```bash
cd server
npm run dev
```

#### Production Mode:
```bash
cd server
npm run build
npm start
```

## ✅ Server Durumu Kontrolü

Server başladıktan sonra:

```bash
# Health check
curl http://localhost:3000/health

# Beklenen yanıt:
# {"status":"ok","timestamp":"2025-01-XX..."}
```

## 🔍 Troubleshooting

### PostgreSQL Bağlantı Hatası

1. PostgreSQL'in çalıştığını kontrol edin:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Veritabanının var olduğunu kontrol edin:
   ```bash
   psql -l | grep dawg
   ```

3. Bağlantıyı test edin:
   ```bash
   psql -d dawg -c "SELECT version();"
   ```

### Port Zaten Kullanılıyor

Eğer 3000 portu kullanılıyorsa, `.env` dosyasında `PORT` değerini değiştirin:

```env
PORT=3001
```

Ve client tarafında `VITE_API_URL` değişkenini güncelleyin:

```env
VITE_API_URL=http://localhost:3001/api
```

## 📝 Notlar

- Development modunda server otomatik olarak yeniden başlar (hot reload)
- Migration'lar otomatik olarak çalıştırılır
- CORS ayarları `.env` dosyasında `CORS_ORIGIN` ile kontrol edilir
- Client'ın çalıştığı port'u (5173 veya 5174) `CORS_ORIGIN`'e eklemeyi unutmayın

