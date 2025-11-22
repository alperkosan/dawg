# Bunny CDN Setup Guide

## Environment Variables

Add these to your `.env` file (or copy from `.env.example`):

```env
# CDN Configuration
CDN_PROVIDER=bunny
CDN_BASE_URL=https://dawg.b-cdn.net

# Bunny CDN Settings
BUNNY_PULL_ZONE_URL=https://dawg.b-cdn.net
BUNNY_STORAGE_ZONE_NAME=dawg-storage
BUNNY_STORAGE_ZONE_REGION=de
BUNNY_API_KEY=4cd141b1-7536-4c1d-a271-cdcfb9b7c188164396e2-e980-449e-807a-944dca1017c7
BUNNY_STORAGE_API_KEY=4cd141b1-7536-4c1d-a271-cdcfb9b7c188164396e2-e980-449e-807a-944dca1017c7
```

**Note:** The API keys are already configured in `server/src/config/index.ts` as defaults, but you can override them with environment variables for security.

## How to Get Bunny CDN Credentials

1. **Create Storage Zone:**
   - Go to Bunny CDN Dashboard → Storage → Add Storage Zone
   - Choose a name (e.g., `dawg-storage`)
   - Select region (e.g., `de` for Germany)
   - Copy the **Storage Zone API Key** (this is `BUNNY_STORAGE_API_KEY`)

2. **Create Pull Zone:**
   - Go to Bunny CDN Dashboard → Pull Zones → Add Pull Zone
   - Choose a name (e.g., `dawg`)
   - Set origin to your storage zone
   - Copy the **Pull Zone URL** (e.g., `https://dawg.b-cdn.net`)
   - This is your `BUNNY_PULL_ZONE_URL`

3. **Get API Key:**
   - Go to Bunny CDN Dashboard → Account → API
   - Copy your **API Key** (this is `BUNNY_API_KEY`)

## Features Implemented

### ✅ Storage Service
- **Upload**: Files are uploaded to Bunny CDN Storage Zone
- **Delete**: Files are deleted from Bunny CDN
- **CDN URL**: Generates CDN URLs using Pull Zone URL
- **Fallback**: Falls back to local storage if CDN is not configured

### ✅ System Assets
- Admin panel can upload system assets directly to CDN
- System assets are served from CDN
- FileBrowser loads system assets from database (primary source)

### ✅ User Assets
- User uploads go to CDN
- User assets are served from CDN
- Quota management still works

### ✅ FileBrowser
- System library is loaded from database (not manifest)
- Manifest is optional fallback for static build-time assets
- All assets use CDN URLs when available

## Testing

1. **Set up environment variables** in `.env`
2. **Start the server**: `cd server && npm run dev`
3. **Test system asset upload:**
   - Go to `/admin`
   - Upload a system asset
   - Check that it's uploaded to Bunny CDN
   - Verify CDN URL in database

4. **Test user asset upload:**
   - Login to DAW
   - Upload a file in FileBrowser
   - Check that it's uploaded to Bunny CDN
   - Verify CDN URL in database

5. **Test file serving:**
   - Access a file URL
   - Should redirect to CDN if CDN is configured
   - Should serve from local storage if CDN is not configured

## Storage Structure (Organized for Easy Maintenance)

### System Assets
```
system-assets/{category-slug}/{pack-slug}/{assetId}/{filename}
```

**Examples:**
- `system-assets/drums/dawg-starter-pack/{assetId}/kick.wav`
- `system-assets/instruments/default/{assetId}/piano.wav`
- `system-assets/uncategorized/default/{assetId}/sample.wav`

**Benefits:**
- Easy to find assets by category
- Organized by pack for better management
- Simple to backup/restore specific categories or packs

### User Assets
```
user-assets/{userId}/{year-month}/{assetId}/{filename}
```

**Examples:**
- `user-assets/{userId}/2025-01/{assetId}/my-sample.wav`
- `user-assets/{userId}/2025-02/{assetId}/loop.wav`

**Benefits:**
- Organized by month for easy cleanup
- Simple to archive old files
- Easy to track storage usage per month

## CDN URL Format

- **CDN URL**: `https://dawg.b-cdn.net/system-assets/{assetId}/{filename}`
- **Fallback**: `/api/assets/{assetId}/file` (local storage)

## Notes

- If `CDN_PROVIDER` is not set to `bunny` or credentials are missing, the system falls back to local storage
- Local storage is still used for development
- All uploads and deletes work with both CDN and local storage

