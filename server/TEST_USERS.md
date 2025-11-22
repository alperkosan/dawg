# 👤 Test Kullanıcıları

## Mevcut Test Kullanıcısı

**Email:** `test@example.com`  
**Username:** `testuser`  
**Password:** `Test1234`

## Kullanıcı Oluşturma

### API ile Kayıt

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test1234",
    "displayName": "Test User"
  }'
```

### Şifre Gereksinimleri

- Minimum 8 karakter
- En az 1 büyük harf (A-Z)
- En az 1 küçük harf (a-z)
- En az 1 rakam (0-9)

### Username Gereksinimleri

- Minimum 3 karakter
- Maximum 30 karakter
- Sadece harf, rakam ve alt çizgi (_)

## Veritabanında Kontrol

```bash
# Kullanıcı sayısı
psql -d dawg -c "SELECT COUNT(*) FROM users;"

# Tüm kullanıcılar
psql -d dawg -c "SELECT id, email, username, display_name, created_at FROM users;"

# Belirli bir kullanıcı
psql -d dawg -c "SELECT * FROM users WHERE email = 'test@example.com';"
```

## Login Test

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

## Yeni Kullanıcı Oluşturma Örnekleri

```bash
# Admin kullanıcı
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dawg.com",
    "username": "admin",
    "password": "Admin1234",
    "displayName": "Admin User"
  }'

# Beatmaker kullanıcı
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "beatmaker@dawg.com",
    "username": "beatmaker",
    "password": "Beat1234",
    "displayName": "Beat Maker"
  }'
```

