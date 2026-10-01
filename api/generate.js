export default async function handler(req, res) {
  // Hanya menerima POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    // Ambil prompt dari aplikasi
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Prompt belum diberikan"
      });
    }

    // Ambil API key dari Vercel Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY belum tersedia di Vercel Environment Variables"
      });
    }

    // Panggil Gemini
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    // Baca respons Gemini sebagai text terlebih dahulu
    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        success: false,
        error: "Respons Gemini bukan JSON",
        details: responseText.slice(0, 1000)
      });
    }

    // Kalau Gemini mengembalikan error
    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "Gemini API error",
        status: response.status,
        details: data
      });
    }

    // Ambil teks hasil Gemini
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    if (!text) {
      return res.status(502).json({
        success: false,
        error: "Gemini tidak menghasilkan teks",
        details: data
      });
    }

    // Berhasil
    return res.status(200).json({
      success: true,
      text
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error?.message || String(error)
    });
  }
}
