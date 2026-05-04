const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '25mb' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Δεν βρέθηκε GEMINI_API_KEY στις ρυθμίσεις του server στο Render.' 
      });
    }

    const userContent = req.body.messages?.[0]?.content || [];
    const systemText = req.body.system || '';

    const systemPrompt = `Είσαι το αυτοματοποιημένο σύστημα της Google για τελωνειακή αποτίμηση.
ΚΑΝΟΝΕΣ:
1. Εντόπισε τον τιμοκατάλογο και την Datacard.
2. Αντιστοίχισε τους κωδικούς με ακρίβεια.
3. Υπολόγισε το σύνολο.
4. Απάντησε ΜΟΝΟ με έγκυρο JSON.

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

      if (part.type === 'document' || part.type === 'image') {
        geminiParts.push({
          inlineData: {
            mimeType: part.source.media_type,
            data: part.source.data
          }
        });
      }
    }

    contents.push({ role: 'user', parts: geminiParts });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.0
        }
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error('GEMINI RAW ERROR:', raw);
      return res.status(response.status).json({ error: 'Σφάλμα από το API του Gemini: ' + raw });
    }

    return res.status(200).json({
      content: [
        {
          type: 'text',
          text: raw
        }
      ]
    });

  } catch (err) {
    console.error('GEMINI ERROR:', err);
    return res.status(500).json({ error: err.message || 'Άγνωστο σφάλμα στο backend.' });
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
