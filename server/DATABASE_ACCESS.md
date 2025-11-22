# 🗄️ Veritabanı Erişim Yöntemleri

## 1. Postgres.app Arayüzü (Zaten Kurulu)

Postgres.app'in kendi arayüzünü kullanabilirsiniz:

1. **Applications** klasöründen **Postgres.app**'i açın
2. Sol tarafta **PostgreSQL 18** instance'ını göreceksiniz
3. Instance'a tıklayın
4. Sağ üstteki **"Open psql"** butonuna tıklayın (Terminal açılır)
5. Veya **"Open Database"** butonuna tıklayın (Finder'da veritabanı klasörü açılır)

**psql Komutları:**
```bash
# Veritabanına bağlan
psql -d dawg

# Tabloları listele
\dt

# Tablo yapısını görüntüle
\d users

# SQL sorgusu çalıştır
SELECT * FROM users;
```

## 2. Web Tabanlı: pgAdmin (Önerilen)

pgAdmin, PostgreSQL için popüler bir web arayüzüdür.

### Kurulum:
```bash
brew install --cask pgadmin4
```

### Kullanım:
1. pgAdmin4'ü açın
2. Sol tarafta "Servers" > "Add New Server"
3. **General** tab:
   - Name: `DAWG Local`
4. **Connection** tab:
   - Host: `localhost`
   - Port: `5432`
   - Database: `dawg`
   - Username: `alperkosan` (veya `postgres`)
   - Password: (boş bırakın veya Postgres.app'te ayarladığınız şifre)
5. **Save** butonuna tıklayın

## 3. Desktop: TablePlus (macOS için En İyi)

TablePlus, macOS için modern ve hızlı bir veritabanı arayüzüdür.

### Kurulum:
```bash
brew install --cask tableplus
```

Veya: https://tableplus.com/ adresinden indirin

### Bağlantı:
1. TablePlus'ı açın
2. **Create a new connection** > **PostgreSQL**
3. Ayarlar:
   - Name: `DAWG Local`
   - Host: `localhost`
   - Port: `5432`
   - Database: `dawg`
   - User: `alperkosan`
   - Password: (boş veya Postgres.app şifresi)
4. **Test** > **Connect**

## 4. Desktop: Postico (macOS Native)

Postico, macOS için özel tasarlanmış bir PostgreSQL arayüzüdür.

### Kurulum:
```bash
brew install --cask postico
```

Veya: https://eggerapps.at/postico/ adresinden indirin

## 5. Terminal: psql (Doğrudan)

Postgres.app'in psql'ini kullanarak:

```bash
# Veritabanına bağlan
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg

# Veya PATH'e ekleyerek
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
psql -d dawg
```

## 📊 Hızlı Bağlantı Bilgileri

```
Host: localhost
Port: 5432
Database: dawg
Username: alperkosan (veya postgres)
Password: (genellikle boş)
```

## 🔍 Veritabanı İçeriğini Kontrol Etme

Terminal'den:

```bash
# Tabloları listele
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg -c "\dt"

# Kullanıcıları listele
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg -c "SELECT * FROM users;"

# Projeleri listele
/Applications/Postgres.app/Contents/Versions/latest/bin/psql -d dawg -c "SELECT id, title, user_id FROM projects LIMIT 10;"
```

## 💡 Öneri

**En Kolay:** Postgres.app'in kendi arayüzünü kullanın (zaten kurulu)

**En Güçlü:** TablePlus (modern, hızlı, macOS native)

**Web Tabanlı:** pgAdmin (tarayıcıdan erişim)

