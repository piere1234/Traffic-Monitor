# Extension Test Server

A minimal test server for the LanStation extension.

## Setup

```bash
npm install
npm start
```

The server runs on `http://localhost:3000`

## Configuration

Edit `.env`:
- `TRAFFIC_API_KEY=trafficapikey` - API key for extension
- `PORT=3000` - Server port

## Connected to Extension

1. Open the extension
2. Enter Server URL: `http://localhost:3000`
3. Enter API Key: `trafficapikey`
4. Click Connect

## Test Page

Open `http://localhost:3000/` to generate test traffic

## API Endpoints

- `GET /api/traffic` - Returns traffic log (requires X-Traffic-Key header)
- `GET /api/metrics` - Returns server metrics (requires X-Traffic-Key header)
- `GET /api/health` - Health check
- `GET /test/ok` - Returns 200
- `GET /test/error` - Returns 500
- `GET /test/notfound` - Returns 404
- `GET /test/slow` - Returns 200 after 2 seconds
