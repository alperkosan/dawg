# 🐘 PostgreSQL Kurulum Rehberi

PostgreSQL kurulu değil. Server'ı başlatmak için PostgreSQL gerekiyor.

## ⚡ En Hızlı Yöntem: Postgres.app

1. **Postgres.app'i İndirin:**
   ```bash
   open https://postgresapp.com/downloads.html
   ```
   
   Veya manuel olarak: https://postgresapp.com/downloads.html

2. **Kurulum:**
   - İndirilen `.dmg` dosyasını açın
   - Postgres.app'i Applications klasörüne sürükleyin
   - Applications'dan Postgres.app'i başlatın
   - "Initialize" butonuna tıklayın

3. **Veritabanı Oluşturma:**
   ```bash
   /Applications/Postgres.app/Contents/Versions/latest/bin/createdb dawg
   ```

4. **Server'ı Başlatın:**
   ```bash
   cd server
   npm run migrate
   npm run dev
   ```

## 🔧 Alternatif: Homebrew ile Kurulum

1. **Homebrew Kurulumu:**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   
   Kurulum sonrası terminal'e şunu ekleyin:
   ```bash
   echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
   eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

2. **PostgreSQL Kurulumu:**
   ```bash
   brew install postgresql@14
   brew services start postgresql@14
   createdb dawg
   ```

3. **Server'ı Başlatın:**
   ```bash
   cd server
   npm run migrate
   npm run dev
   ```

## ✅ Kurulum Sonrası

PostgreSQL kurulduktan sonra:

```bash
cd server
npm run migrate
npm run dev
```

Server `http://localhost:3000` adresinde çalışacak.

