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
    let promptText = '';

    for (const part of userContent) {
      if (part.type === 'text') {
        promptText += part.text + '\n';
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText }
            ]
          }
        ],
        // Διορθώθηκε η δομή για να αποφευχθεί το σφάλμα 400
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
    let text = '';
    
    if (data.candidates && data.candidates.length > 0) {
      text = data.candidates[0].content.parts[0].text;
    }

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
