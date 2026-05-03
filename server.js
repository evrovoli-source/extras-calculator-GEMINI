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

    const systemPrompt = `Είσαι το ψηφιακό σύστημα της Google για την τελωνειακή αποτίμηση και αντιστοίχιση extras οχημάτων.
ΚΑΝΟΝΕΣ:
1. Ακρίβεια: Αντιστοίχισε τον τιμοκατάλογο με την datacard. Αν ο κωδικός δεν υπάρχει στον τιμοκατάλογο, η αξία του είναι 0 (καταχωρείται στη λίστα not_found).
2. Υπολογισμός Πακέτων: Αν ένα extra περιέχεται σε πακέτο, η μεμονωμένη αξία του αφαιρείται από το σύνολο.
3. Υπολογισμός: Κάνε σωστή πρόσθεση. Απαγορεύονται οι εικασίες.
4. Μορφή Απάντησης: Απαντάς ΜΟΝΟ με έγκυρο JSON.

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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
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
      return res.status(response.status).json({ error: 'Σφάλμα από το API του Gemini: ' + raw });
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
    // Επιστρέφουμε σωστά το μήνυμα του σφάλματος ως string
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
