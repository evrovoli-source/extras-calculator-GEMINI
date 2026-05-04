export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-gemini-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. Διάβασμα δεδομένων από το event.body
    const body = JSON.parse(event.body);
    const messages = body.messages || [];
    
    // 2. Εύρεση API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Missing GEMINI_API_KEY from environment variables.' }) 
      };
    }

    // 3. Εξαγωγή κειμένου και αρχείων από το `messages[0].content`
    const userContent = messages[0]?.content || [];
    const geminiParts = [];

    // System prompt για να είναι αυστηρός ο Gemini
    geminiParts.push({
      text: "Είσαι το ψηφιακό σύστημα της Google για τελωνειακή αποτίμηση extras οχημάτων. Απαντάς ΜΟΝΟ με έγκυρο JSON. Αντιστοίχισε τα αρχεία με ακρίβεια, χωρίς εικασίες."
    });

    for (const part of userContent) {
      if (part.type === 'text') {
        geminiParts.push({ text: part.text });
      } else if (part.type === 'document' || part.type === 'image') {
        geminiParts.push({
          inlineData: {
            mimeType: part.source.media_type,
            data: part.source.data
          }
        });
      }
    }

    // 4. Κλήση στο API του Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: geminiParts
          }
        ],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json'
        }
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error('GEMINI API ERROR:', raw);
      return { statusCode: response.status, headers, body: raw };
    }

    const data = JSON.parse(raw);
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    return { 
      statusCode: 200, 
      headers, 
      body: responseText 
    };

  } catch (err) {
    console.error('SERVERLESS ERROR:', err);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: err.message }) 
    };
  }
}
