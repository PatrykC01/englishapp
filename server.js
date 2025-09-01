// Simple proxy server for Google Imagen 4 and Gemini Flash Image Preview
// Run: npm install express cors dotenv
// Then: GOOGLE_API_KEY=YOUR_KEY node server.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Small helper to get API key safely
function resolveApiKey(req) {
  // Prefer server-side env var
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) return process.env.GOOGLE_API_KEY.trim();
  // As a development fallback, allow passing via header (less secure). Do NOT use in production.
  const headerKey = req.headers['x-api-key'] || req.headers['x-google-api-key'];
  if (headerKey && typeof headerKey === 'string') return headerKey.trim();
  // Or allow in body for local dev only
  if (req.body && typeof req.body.apiKey === 'string') return req.body.apiKey.trim();
  return null;
}

// Proxy for Imagen generateImage with model fallback
app.post('/api/imagen4', async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(400).json({ error: 'Missing Google API key. Set GOOGLE_API_KEY env var on the server.' });

    const { prompt, config, model } = req.body || {};
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' });

    const body = {
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        safetyFilterLevel: 'BLOCK_ONLY_HIGH',
        personGeneration: 'DONT_ALLOW',
        ...(config || {})
      }
    };

    const candidates = [
      model && typeof model === 'string' ? model : null,
      'imagen-4.0-generate-001',
      'imagen-3.0-generate-001'
    ].filter(Boolean);

    let lastError = null;
    for (const mdl of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateImage?key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (upstream.ok) {
        const data = await upstream.json();
        const base64 = data?.generatedImages?.[0]?.bytesBase64Encoded;
        if (!base64) {
          // Try next candidate if structure unexpected
          lastError = { status: 502, body: 'No image in response' };
          continue;
        }
        return res.json({ mime: 'image/png', base64, model: mdl });
      } else {
        const text = await upstream.text().catch(() => '');
        lastError = { status: upstream.status, body: text };
        // On 404 specifically, try next model candidate
        if (upstream.status === 404) continue;
        // On rate limit 429, bubble up directly
        if (upstream.status === 429) return res.status(429).json({ error: 'Upstream rate limited', status: 429, body: text });
        // For other errors, still try next candidate
        continue;
      }
    }

    const status = (lastError && lastError.status) || 502;
    return res.status(status).json({ error: 'Upstream error', status, body: lastError && lastError.body });
  } catch (err) {
    console.error('Proxy /api/imagen4 error', err);
    return res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
  }
});

// Proxy for Gemini 2.5 Flash Image Preview generateContent
app.post('/api/gemini/flash-preview', async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(400).json({ error: 'Missing Google API key. Set GOOGLE_API_KEY env var on the server.' });

    const { prompt, model, generationConfig } = req.body || {};
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Missing prompt' });

    const mdl = model || 'gemini-2.5-flash-image-preview';
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: Object.assign({ responseMimeType: 'application/json' }, generationConfig || {})
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({ error: 'Upstream error', status: upstream.status, body: text });
    }

    const data = await upstream.json();
    // Try inline image
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inlineData && p.inlineData.data);
    if (imgPart && imgPart.inlineData && imgPart.inlineData.data) {
      const mime = imgPart.inlineData.mimeType || 'image/png';
      const base64 = imgPart.inlineData.data;
      return res.json({ mime, base64 });
    }
    // Or URL in text
    const linkPart = parts.find(p => typeof p.text === 'string' && p.text.startsWith('http'));
    if (linkPart) {
      return res.json({ url: (linkPart.text || '').trim() });
    }
    return res.status(502).json({ error: 'No image or link returned from Gemini' });
  } catch (err) {
    console.error('Proxy /api/gemini/flash-preview error', err);
    return res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
  }
});

// Lightweight image proxy to avoid third-party failures/CORS/adblock
// Allowed hosts for safety
const ALLOWED_IMAGE_HOSTS = new Set([
 'image.pollinations.ai',
 'source.unsplash.com',
 'images.unsplash.com',
 'picsum.photos',
 'api.iconify.design'
]);

app.get('/api/proxy-image', async (req, res) => {
 try {
   const url = String(req.query.url || '').trim();
   if (!url) return res.status(400).json({ error: 'Missing url' });

   let parsed;
   try { parsed = new URL(url); } catch (_) { return res.status(400).json({ error: 'Invalid url' }); }
   if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
     return res.status(400).json({ error: 'Host not allowed' });
   }

   const upstream = await fetch(url);
   if (!upstream.ok) {
     const text = await upstream.text().catch(() => '');
     return res.status(upstream.status).json({ error: 'Upstream error', status: upstream.status, body: text });
   }

   const contentType = upstream.headers.get('content-type') || 'image/jpeg';
   const buf = Buffer.from(await upstream.arrayBuffer());
   res.set('Content-Type', contentType);
   res.set('Cache-Control', 'public, max-age=3600');
   res.send(buf);
 } catch (err) {
   console.error('Proxy /api/proxy-image error', err);
   return res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
 }
});

app.get('/', (req, res) => {
  res.type('text').send('AI proxy is running. Endpoints: POST /api/imagen4, POST /api/gemini/flash-preview');
});

app.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}`);
});
