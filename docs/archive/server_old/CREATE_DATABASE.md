# 🗄️ Veritabanı Oluşturma Rehberi

## ⚠️ Önemli Not

Postgres.app'te **yeni bir server instance oluşturmanıza gerek yok!** 
Mevcut PostgreSQL 18 instance'ını (port 5432) kullanın ve sadece **veritabanı** oluşturun.

## ✅ Doğru Yöntem

### 1. Postgres.app'te Mevcut Instance'ı Kullanın

- Sol tarafta **"PostgreSQL 18"** (port 5432) instance'ını kullanın
- **"dawg" adında yeni bir server instance oluşturmayın**
- Port 3000 kullanmayın (bu backend server portu, PostgreSQL portu değil)

### 2. Veritabanı Oluşturma

Terminal'de şu komutu çalıştırın:

```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -p 5432 -d postgres -c "CREATE DATABASE dawg;"
```

Veya daha basit:

```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb -p 5432 dawg
```

### 3. Veritabanının Oluşturulduğunu Kontrol Edin

```bash
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -p 5432 -l | grep dawg
```

## 🔧 Alternatif: Postgres.app GUI Kullanarak

1. Postgres.app'te **"PostgreSQL 18"** instance'ına tıklayın
2. Sağ üstteki **"Open psql"** butonuna tıklayın
3. Terminal'de şu komutu çalıştırın:
   ```sql
   CREATE DATABASE dawg;
   ```

## ❌ Yapmamanız Gerekenler

- ❌ Postgres.app'te yeni server instance oluşturmayın
- ❌ Port 3000 kullanmayın (bu backend server portu)
- ❌ "dawg" adında yeni bir PostgreSQL server başlatmayın

## ✅ Doğru Yapı

```
PostgreSQL 18 (Port 5432) ← Mevcut instance'ı kullanın
  ├── postgres (default database)
  ├── dawg (oluşturacağınız database) ← Sadece bunu oluşturun
  └── ...
```

## 🚀 Sonraki Adımlar

Veritabanı oluşturulduktan sonra:

```bash
cd server
npm run migrate
npm run dev
```

