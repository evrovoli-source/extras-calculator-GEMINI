const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '25mb' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    const userContent = req.body.messages?.[0]?.content || [];
    const systemText = req.body.system || '';

    // Ολοκληρωμένο σύστημα οδηγιών για απόλυτη ακρίβεια
    const systemPrompt = `Είσαι το αυτοματοποιημένο σύστημα της Google για την τελωνειακή αποτίμηση και αντιστοίχιση extras οχημάτων με τη datacard. 
Σκοπός σου είναι να αντιστοιχίσεις τον τιμοκατάλογο του οχήματος με τους κωδικούς της datacard με απόλυτη ακρίβεια, χωρίς εικασίες.

ΚΑΝΟΝΕΣ ΛΕΙΤΟΥΡΓΙΑΣ:
1. ΜΗΝ ΜΑΝΤΕΥΕΙΣ τιμές. Αν ένας κωδικός δεν υπάρχει στον τιμοκατάλογο, η αξία του είναι 0 και καταχωρείται στη λίστα not_found.
2. ΠΑΚΕΤΑ: Αν ένα extra περιέχεται σε πακέτο, η μεμονωμένη αξία του αφαιρείται από το σύνολο για να μην μετράει διπλά.
3. ΜΗΝ αλλάζεις ποσά. Κάνε σωστή πρόσθεση των επιμέρους αξιών.
4. Η απάντησή σου πρέπει να είναι ΜΟΝΟ έγκυρο JSON, χωρίς κείμενο ή σχόλια εκτός αυτού.

${systemText}`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      }
    ];

    const geminiParts = [];

    for (const part of userContent) {
      if (part.type === 'text') {
        geminiParts.push({ text: part.text });
      }

      if (part.type === 'document') {
        geminiParts.push({
          inlineData: {
            mimeType: part.source.media_type,
            data: part.source.data
          }
        });
      }

      if (part.type === 'image') {
        geminiParts.push({
          inlineData: {
            mimeType: part.source.media_type,
            data: part.source.data
          }
        });
      }
    }

    contents.push({ role: 'user', parts: geminiParts });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json'
        }
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error('GEMINI RAW ERROR:', raw);
      return res.status(response.status).send(raw);
    }

    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      content: [
        {
          type: 'text',
          text: text
        }
      ]
    });

  } catch (err) {
    console.error('GEMINI ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
