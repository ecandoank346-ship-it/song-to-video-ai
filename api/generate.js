export default async function handler(req, res) {
  // 1. Validasi HTTP Method (hanya menerima POST)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 2. Validasi Input Body
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt belum diberikan" });
    }

    // 3. Validasi Environment Variable API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY belum dipasang di Vercel" });
    }

    // Endpoint Gemini API menggunakan model gemini-1.5-flash
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    
    // Maksimal 2x percobaan untuk menghindari timeout 10 detik di Vercel Hobby Plan
    const maxAttempts = 2; 
    let lastStatus = 500;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ]
          })
        });

        lastStatus = response.status;
        const rawText = await response.text();
        let data = null;

        try {
          data = JSON.parse(rawText);
        } catch {
          data = { raw: rawText };
        }

        // Response Berhasil (HTTP 200 OK)
        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("") || "";

          if (!text) {
            return res.status(502).json({ error: "Gemini tidak mengembalikan teks.", details: data });
          }

          return res.status(200).json({ success: true, text });
        }

        lastError = data?.error?.message || data?.message || data?.raw || `Gemini HTTP ${response.status}`;

        // Retry hanya untuk error sementara (408 Timeout, 429 Rate Limit, atau 500+ Server Error)
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable) {
          return res.status(response.status).json({ error: lastError, status: response.status, details: data });
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        lastError = error.message;
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Jika seluruh percobaaan retry habis
    return res.status(502).json({
      error: lastError || "Gemini gagal dipanggil.",
      status: lastStatus,
      attempts: maxAttempts,
      message: "Gemini gagal setelah beberapa percobaan. Silakan coba lagi beberapa saat kemudian."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
}
