// Quick test script to verify chatbot works
async function testChatbot() {
  console.log('🤖 Testing Gemini API connection...\n');
  
  const customerMessage = 'How much is the red mug?';
  
  const prompt = `You are a helpful sales assistant for a small business. Answer customer questions based ONLY on the following product catalog.

Product Catalog:
- Product Name: Red Mug, Price: $15.00
- Product Name: Blue Mug, Price: $12.50

Customer Question:
${customerMessage}

Instructions:
- Answer concisely and helpfully`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': 'AIzaSyBRfw2A31W-In96Tciyxq8HW2Iz-Pw1Z8k'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    
    if (!response.ok) {
      console.error('❌ Gemini API Error:', response.status, await response.text());
      return;
    }
    
    const data = await response.json();
    const aiResponse = data.candidates[0]?.content?.parts[0]?.text;
    
    console.log('✅ Gemini API is working!\n');
    console.log('Customer asked:', customerMessage);
    console.log('\nAI Response:', aiResponse);
    console.log('\n✨ Chatbot logic is implemented and ready!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChatbot();
