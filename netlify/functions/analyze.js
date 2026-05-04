export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body);
    const messages = body.messages || [];
    const systemText = body.system || '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'Missing GEMINI_API_KEY from environment variables.' }) 
      };
    }

    const userContent = messages[0]?.content || [];
    const geminiParts = [];

    // Προσθήκη των οδηγιών συστήματος ως κείμενο
    if (systemText) {
      geminiParts.push({ text: `System Instructions: ${systemText}` });
    }

    // Προσθήκη κειμένου και αρχείων (documents/images) ως inlineData
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

    // Επιστρέφουμε κατευθείαν το κείμενο της απάντησης
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
