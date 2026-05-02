const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '25mb' }));

app.post('/api/analyze', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const userContent = req.body.messages?.[0]?.content || [];
    const systemText = req.body.system || '';

    const inputContent = [];

    if (systemText) {
      inputContent.push({
        type: 'input_text',
        text: systemText
      });
    }

    for (const part of userContent) {
      if (part.type === 'text') {
        inputContent.push({
          type: 'input_text',
          text: part.text
        });
      }

      if (part.type === 'document') {
        inputContent.push({
          type: 'input_file',
          filename: 'document.pdf',
          file_data: `data:${part.source.media_type};base64,${part.source.data}`
        });
      }

      if (part.type === 'image') {
        inputContent.push({
          type: 'input_image',
          image_url: `data:${part.source.media_type};base64,${part.source.data}`
        });
      }
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'user',
            content: inputContent
          }
        ]
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error('OPENAI RAW ERROR:', raw);
      return res.status(response.status).send(raw);
    }

    const data = JSON.parse(raw);

    const text =
      data.output_text ||
      data.output?.flatMap(o => o.content || [])
        .map(c => c.text || '')
        .join('') ||
      '';

    return res.status(200).json({
      content: [
        {
          type: 'text',
          text
        }
      ]
    });

  } catch (err) {
    console.error('OPENAI ERROR:', err);
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
