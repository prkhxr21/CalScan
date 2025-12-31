// export async function POST(req, res) {
//   if (req.method !== 'POST') {
//       return res.status(405).json({ error: 'Method Not Allowed' });
//   }

//   const { imageBase64 } = await req.json(); // Receive the base64 image from the client

//   if (!imageBase64) {
//       return Response.json({ error: 'Image is required' });
//   }

//   const apiKey = process.env.IMAGGA_API_KEY;
//   const apiSecret = process.env.IMAGGA_API_SECRET;

//   try {
//       const response = await fetch('https://api.imagga.com/v2/uploads', {
//           method: 'POST',
//           headers: {
//               'Authorization': 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64'),
//               'Content-Type': 'application/x-www-form-urlencoded'
//           },
//           body: new URLSearchParams({ image_base64: imageBase64 }) // Send Base64 image
//       });

//       if (!response.ok) {
//           throw new Error(`API Error: ${response.statusText}`);
//       }

//       const data = await response.json();
//       return Response.status(200).json(data);
//   } catch (error) {
//       console.error(error);
//       return Response.json({ error: 'Failed to upload image' });
//   }
// }


import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64 || !imageBase64.startsWith('/9j/') && !imageBase64.startsWith('iVBORw0KGgo')) {
      return Response.json(
        { success: false, error: "Invalid image data (must be JPEG/PNG base64 without prefix)" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" } // Request JSON response
    });

    const prompt = `Analyze this food image and return a JSON object with:
    - foodName (string)
    - confidence (number 0-1)
    - calories (number)
    - protein (number in grams)
    - carbs (number in grams)
    - fats (number in grams)
    
    Example: {"foodName":"apple","confidence":0.9,"calories":52,"protein":0.3,"carbs":14,"fats":0.2}`;

    const imageParts = [{
      inlineData: {
        data: imageBase64,
        mimeType: imageBase64.startsWith('/9j/') ? "image/jpeg" : "image/png"
      }
    }];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    console.log(response);
    
    // Direct JSON parsing (requires generationConfig above)
    const analysis = JSON.parse(response.text());
    
    return Response.json({ 
      success: true,
      ...analysis 
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return Response.json(
      { 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
      },
      { status: 500 }
    );
  }

}

