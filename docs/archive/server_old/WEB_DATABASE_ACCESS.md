# 🌐 Web Tabanlı Veritabanı Erişimi

## ⚠️ Önemli Not

**Postgres.app web tabanlı değildir** - Desktop uygulamasıdır. Web tabanlı erişim için ek bir araç kurmanız gerekir.

## 🚀 Seçenek 1: Postgres.app (Zaten Kurulu - Desktop)

Postgres.app'in kendi arayüzünü kullanın:

1. **Applications** klasöründen **Postgres.app**'i açın
2. Sol tarafta **PostgreSQL 18** instance'ını göreceksiniz
3. Instance'a tıklayın
4. **"Open psql"** butonuna tıklayın (Terminal açılır)

**URL yok** - Desktop uygulamasıdır.

## 🌐 Seçenek 2: pgAdmin (Web Tabanlı - Önerilen)

pgAdmin, web tabanlı bir PostgreSQL yönetim arayüzüdür.

### Kurulum:

```bash
# Homebrew ile
brew install --cask pgadmin4

# Veya manuel: https://www.pgadmin.org/download/pgadmin-4-macos/
```

### Erişim:

1. pgAdmin4'ü açın (Applications'dan)
2. Tarayıcıda otomatik açılır: `http://127.0.0.1:5050`
3. İlk açılışta master password belirleyin
4. Sol tarafta **"Add New Server"** > **"DAWG Local"**
5. **Connection** tab:
   - Host: `localhost`
   - Port: `5432`
   - Database: `dawg`
   - Username: `alperkosan` (veya `postgres`)
   - Password: (boş bırakın)

**Web URL:** `http://127.0.0.1:5050` (pgAdmin başladıktan sonra)

## 💻 Seçenek 3: Terminal (psql)

Doğrudan terminal'den:

```bash
# Veritabanına bağlan
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg

# Tabloları listele
\dt

# Kullanıcıları görüntüle
SELECT * FROM users;
```

## 📊 Mevcut Tablolar

Veritabanınızda şu tablolar var:

- `users` - Kullanıcılar
- `projects` - Projeler
- `sessions` - Oturumlar
- `project_collaborators` - İşbirlikçiler
- `project_shares` - Paylaşımlar
- `project_interactions` - Etkileşimler
- Ve daha fazlası...

## 🔍 Hızlı Kontrol

Terminal'den veritabanı içeriğini kontrol edin:

```bash
# Tabloları listele
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg -c "\dt"

# Kullanıcı sayısı
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg -c "SELECT COUNT(*) FROM users;"

# Proje sayısı
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg -c "SELECT COUNT(*) FROM projects;"
```

## 💡 Öneri

**En Hızlı:** Postgres.app'i açın ve "Open psql" butonuna tıklayın

**Web Tabanlı İsterseniz:** pgAdmin kurun (`brew install --cask pgadmin4`)

**Modern GUI:** TablePlus kurun (`brew install --cask tableplus`)

