# Firebase Storage CORS Setup

The CORS error when uploading to Firebase Storage happens because the bucket must explicitly allow requests from your app's origin. **Next.js config cannot fix this** — CORS is enforced by Firebase Storage's servers.

## Fix: Configure CORS on your Firebase Storage bucket

### Option 1: Google Cloud Shell (easiest)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project **ball-iq-28ac7**
3. Open **Cloud Shell** (terminal icon in top-right)
4. Run:

```bash
# Create cors.json (copy the content from the cors.json file in this project)
# Or upload it, then:
gsutil cors set cors.json gs://ball-iq-28ac7.firebasestorage.app
```

### Option 2: Local gsutil (requires Google Cloud SDK)

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Run `gcloud auth login`
3. From your project root:

```bash
gsutil cors set cors.json gs://ball-iq-28ac7.firebasestorage.app
```

### Add production domain

When you deploy, add your production URL to `cors.json`:

```json
"origin": [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://your-production-domain.com"
]
```

Then run the `gsutil cors set` command again.
