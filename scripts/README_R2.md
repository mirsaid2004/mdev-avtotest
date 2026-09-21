# Uploading question images to Cloudflare R2

801 files, 156 MB. One-time setup, then `./scripts/upload_r2.sh <bucket>` is repeatable.

## 1. Create the bucket

Cloudflare dashboard -> **R2 Object Storage** -> **Create bucket**

- Name: `avtomaktab-images` (or whatever you like)
- Location: **Automatic**
- Leave the rest default

Free tier: 10 GB storage, and **zero egress fees** - the reason R2 beats S3 here.
156 MB sits comfortably inside it.

## 2. Create an API token

R2 -> **API** -> **Manage API Tokens** -> **Create API Token**

- Permission: **Object Read & Write**
- Scope it to just the bucket you created (not "all buckets")
- TTL: your call

You get three values. **Copy them now - the secret is shown only once.**

- Access Key ID
- Secret Access Key
- Account ID (also on the R2 overview page, right sidebar)

## 3. Point rclone at it

Run this yourself so the secret never leaves your machine - in Claude Code,
prefix with `!` to run it in the session:

```sh
rclone config create r2 s3 \
  provider=Cloudflare \
  access_key_id=YOUR_ACCESS_KEY_ID \
  secret_access_key=YOUR_SECRET_ACCESS_KEY \
  endpoint=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com \
  acl=private
```

Check it worked - **list the bucket by name, not the account**:

```sh
rclone lsd r2:avtomaktab-images --s3-no-check-bucket
```

Empty output = success (the bucket exists and is empty).

Do NOT verify with `rclone lsd r2:` (no bucket name). That calls ListBuckets,
which is an account-level operation your bucket-scoped token is denied by
design. It returns `AccessDenied` even when everything is configured correctly.
Scoping the token to one bucket is the safer setup - keep it and verify by name.

## 4. Upload

```sh
./scripts/upload_r2.sh avtomaktab-images
```

Sets `Cache-Control: public, max-age=31536000, immutable` on every object - the
header e-avtomaktab.uz omits, and the thing that makes each image a once-ever
download per device. Re-running only transfers what's missing, then verifies
with `rclone check`.

## 5. Make the bucket public

Two options:

**A. r2.dev subdomain** - bucket -> **Settings** -> **Public Development URL** -> Enable.
Instant, no domain needed. URLs look like:

    https://pub-<hash>.r2.dev/tests/e-avtomaktab101.jpg

Cloudflare **rate-limits r2.dev and says not to use it for production.** Fine for
testing or a handful of classmates; not what you want if the link spreads.

**B. Custom domain** (recommended if you have a domain on Cloudflare) -
bucket -> **Settings** -> **Custom Domains** -> Connect Domain, e.g.
`img.yourdomain.uz`. No rate limit, full CDN caching, and you can move the
files later without changing app URLs.

    https://img.yourdomain.uz/tests/e-avtomaktab101.jpg

## 6. Wire it into the app

Keep resolution in ONE place so the source can change without touching components:

```js
const IMG_BASE = import.meta.env.VITE_IMG_BASE ?? 'https://e-avtomaktab.uz/storage/tests'

export const imageUrl = (media) => `${IMG_BASE}/${media.split('/').pop()}`
```

Then `.env.local`:

```
VITE_IMG_BASE=https://img.yourdomain.uz/tests
```

Falls back to hotlinking their server if the env var is unset, so the app works
before R2 is ready and switches over with one line.
