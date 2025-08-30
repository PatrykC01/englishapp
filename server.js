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

// Proxy for Imagen 4 generateImage
app.post('/api/imagen4', async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    if (!apiKey) return res.status(400).json({ error: 'Missing Google API key. Set GOOGLE_API_KEY env var on the server.' });

    const { prompt, config } = req.body || {};
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateImage?key=${encodeURIComponent(apiKey)}`;

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
    // Expected: data.generatedImages[0].bytesBase64Encoded
    const base64 = data?.generatedImages?.[0]?.bytesBase64Encoded;
    if (!base64) {
      return res.status(502).json({ error: 'No image returned from Imagen 4' });
    }
    return res.json({ mime: 'image/png', base64 });
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

app.get('/', (req, res) => {
  res.type('text').send('AI proxy is running. Endpoints: POST /api/imagen4, POST /api/gemini/flash-preview');
});

app.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}`);
});
