# 🚀 Hızlı Başlangıç

## PostgreSQL Kurulumu Gerekli

PostgreSQL kurulu değil. Server'ı başlatmak için önce PostgreSQL kurmanız gerekiyor.

### ⚡ En Hızlı Yöntem (Önerilen)

1. **Postgres.app İndirin ve Kurun:**
   - https://postgresapp.com/downloads.html adresinden indirin
   - Applications klasörüne kurun
   - Uygulamayı başlatın ve "Initialize" butonuna tıklayın

2. **Veritabanı Oluşturun:**
   ```bash
   /Applications/Postgres.app/Contents/Versions/latest/bin/createdb dawg
   ```

3. **Server'ı Başlatın:**
   ```bash
   cd server
   ./quick-start.sh
   ```

### 🔧 Alternatif: Homebrew

```bash
# Homebrew kurulumu (ilk kez)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# PostgreSQL kurulumu
brew install postgresql@14
brew services start postgresql@14
createdb dawg

# Server başlatma
cd server
./quick-start.sh
```

## ✅ Kurulum Sonrası

PostgreSQL kurulduktan sonra `./quick-start.sh` scriptini çalıştırın. 
Script otomatik olarak:
- Veritabanını kontrol eder
- Migration'ları çalıştırır
- Server'ı başlatır

Server `http://localhost:3000` adresinde çalışacak.
