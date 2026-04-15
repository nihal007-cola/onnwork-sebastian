import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const sessionStore = {};

app.get("/", (req, res) => {
  res.send("🔥 SEBASTIAN - WORLD CLASS SALES 🔥");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    
    if (!message) return;

    const from = message.from;
    const userMessage = message.text?.body || "";
    const phoneNumberId = value.metadata.phone_number_id;

    console.log(`🎯 LEAD: ${from} | ${userMessage}`);

    if (!sessionStore[from]) {
      sessionStore[from] = {
        history: [],
        productsShown: false,
        productSelected: null,
        handoffTriggered: false,
        contactAsked: false,
        userContact: null,
        firstMessageSent: false,
        lastInteraction: Date.now(),
        language: "auto"
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // ============================================
    // FIRST MESSAGE - WELCOME
    // ============================================
    
    if (!session.firstMessageSent) {
      session.firstMessageSent = true;
      
      const introMessage = `Namaste! I'm Sebastian from ONNwork.

I help businesses eliminate manual work, automate operations, and increase sales. 

What's the one thing in your business that's taking too much of your time right now?

नमस्ते! मैं ONNwork से सेबेस्टियन हूं। मैं व्यवसायों को मैन्युअल काम खत्म करने, संचालन को स्वचालित करने और बिक्री बढ़ाने में मदद करता हूं।

आपके व्यवसाय में ऐसी कौन सी एक चीज है जो आपका बहुत अधिक समय ले रही है?`;

      session.history.push({ role: "assistant", content: introMessage });
      
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: introMessage }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      return;
    }

    session.history.push({ role: "user", content: userMessage });
    
    if (session.history.length > 10) {
      session.history = session.history.slice(-10);
    }

    // ============================================
    // PRICE QUESTION - POLITE CAPTURE
    // ============================================
    
    const askedForPrice = /cost|price|rate|how much|₹|rs|rupees|dollar|pricing|fees|charge|kitne ka|कितने का|कीमत|दाम|लागत|কত|किती|ఎంత|ಎಷ್ಟು|berapa|多少钱/i.test(userMessage);
    
    if (askedForPrice && !session.contactAsked) {
      session.contactAsked = true;
      
      const priceResponse = `Great question. Mr. Nawnit Nihal personally handles pricing because every business has unique needs.

Could you share your name and phone number? He will call you within 10 minutes with pricing tailored to your business.

बहुत अच्छा सवाल। श्री नवनीत निहाल व्यक्तिगत रूप से मूल्य निर्धारण संभालते हैं क्योंकि हर व्यवसाय की जरूरतें अलग होती हैं।

क्या आप अपना नाम और फोन नंबर साझा कर सकते हैं? वह आपको 10 मिनट के भीतर कॉल करेंगे।`;

      session.history.push({ role: "assistant", content: priceResponse });
      
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: priceResponse }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      return;
    }

    // ============================================
    // CAPTURE CONTACT DETAILS
    // ============================================
    
    const hasName = /my name is|i am|this is|name is|i'm |मेरा नाम|मैं हूं|मेरा नंबर|मुझे|name |contact |number |phone|मोबाइल|संपर्क/i.test(userMessage);
    const hasPhone = /[0-9]{10}|[0-9]{5}[\s-]?[0-9]{5}|[+][0-9]{1,3}[\s-]?[0-9]{10}/i.test(userMessage);
    
    if (session.contactAsked && !session.userContact && (hasName || hasPhone)) {
      session.userContact = userMessage;
      
      const confirmMessage = `Thank you! I've shared your details with Mr. Nawnit Nihal. He will reach out to you shortly.

धन्यवाद! मैंने आपका विवरण श्री नवनीत निहाल के साथ साझा कर दिया है। वह जल्द ही आपसे संपर्क करेंगे।`;

      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: confirmMessage }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
        const conversationSummary = session.history.slice(-6).map(m => 
          `${m.role === 'user' ? '👤' : '🤖'}: ${m.content.substring(0, 100)}`
        ).join('\n');
        
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            text: `
💰💰 PRICE INQUIRY - HOT LEAD 💰💰

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 CONTACT: ${session.userContact}
🆔 USER ID: ${from}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 CONVERSATION:
${conversationSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 ACTION: Call NOW - Lead wants pricing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `
          }
        );
      }
      
      session.handoffTriggered = true;
      setTimeout(() => delete sessionStore[from], 3600000);
      return;
    }

    // ============================================
    // PRODUCTS
    // ============================================
    
    const PRODUCTS = [
      {
        id: 1,
        name: "ERP Compatibility Layer",
        tagline: "Connect and control your existing systems like SAP, Tally without replacing anything",
        hindiTagline: "अपने मौजूदा सिस्टम जैसे SAP, Tally को बिना कुछ बदले कनेक्ट और नियंत्रित करें"
      },
      {
        id: 2,
        name: "Plug & Play Business System",
        tagline: "Turn your Excel spreadsheets into a fully automated ERP system",
        hindiTagline: "अपनी Excel शीट्स को पूरी तरह से ऑटोमेटेड ERP सिस्टम में बदलें"
      },
      {
        id: 3,
        name: "Custom ERP Development",
        tagline: "Build a system tailored specifically to your business operations",
        hindiTagline: "अपने व्यवसाय के लिए विशेष रूप से तैयार किया गया सिस्टम बनाएं"
      },
      {
        id: 4,
        name: "Enterprise AI Assistant",
        tagline: "Run your entire business operations and reports via WhatsApp or Telegram",
        hindiTagline: "अपना पूरा व्यवसाय WhatsApp या Telegram से चलाएं"
      },
      {
        id: 5,
        name: "AI Decision Intelligence",
        tagline: "Get actionable insights, trends, and recommendations automatically",
        hindiTagline: "स्वचालित रूप से कार्रवाई योग्य अंतर्दृष्टि और सिफारिशें प्राप्त करें"
      },
      {
        id: 6,
        name: "Conversational Commerce",
        tagline: "Capture orders and sell products directly through WhatsApp",
        hindiTagline: "WhatsApp के माध्यम से सीधे ऑर्डर लें और उत्पाद बेचें"
      }
    ];

    const askedForProducts = /products|offer|have|options|list|what do you|what all|what are|tell me about your|what can you|what solutions|solutions|provide|क्या क्या|क्या सेवाएं|कौन कौन से प्रोडक्ट|उत्पाद|सर्विसेज/i.test(userMessage);
    
    if (askedForProducts && !session.productsShown) {
      session.productsShown = true;
      
      let productList = `*Here's what ONNwork offers | ONNwork ये सेवाएं प्रदान करता है:*\n\n`;
      PRODUCTS.forEach(p => {
        productList += `${p.id}. *${p.name}*\n   ${p.tagline}\n   ${p.hindiTagline}\n\n`;
      });
      productList += `Which solution fits your business? Just reply with the number.

आपके व्यवसाय के लिए कौन सा समाधान सही रहेगा? बस नंबर भेजें।`;
      
      session.history.push({ role: "assistant", content: productList });
      
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: productList }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      return;
    }

    const productMatch = userMessage.match(/^([1-6])$/);
    if (productMatch && !session.productSelected) {
      const selectedProduct = PRODUCTS.find(p => p.id === parseInt(productMatch[1]));
      
      if (selectedProduct) {
        session.productSelected = selectedProduct;
        
        const productDetail = `*${selectedProduct.name}*\n\n${selectedProduct.tagline}\n\n${selectedProduct.hindiTagline}\n\n*Perfect choice for your business. आपके व्यवसाय के लिए एकदम सही विकल्प.*\n\nShall I have Mr. Nawnit Nihal reach out to implement this for you? Just reply with YES.\n\nक्या मैं श्री नवनीत निहाल से आपके लिए यह लागू करने के लिए संपर्क करवाऊं? बस YES भेजें।`;
        
        session.history.push({ role: "assistant", content: productDetail });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: productDetail }
          },
          {
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        return;
      }
    }

    const userSaidYes = /^(yes|yeah|sure|ok|okay|do it|start|let's go|let's do it|yep|yup|correct|right|proceed|go ahead|हाँ|ठीक|चलो|जी हाँ|बिल्कुल|yes please|हां जी|करो|चलिए)/i.test(userMessage);
    const hasProductSelected = session.productSelected !== null;
    
    if (userSaidYes && hasProductSelected && !session.handoffTriggered && !session.contactAsked) {
      session.handoffTriggered = true;
      
      const handoffMessage = `Excellent! You've made a smart decision for your business.

I'm connecting you with Mr. Nawnit Nihal right now. He will personally reach out to set up *${session.productSelected.name}* for you.

Could you share your preferred time for a quick call?

बहुत अच्छे! आपने अपने व्यवसाय के लिए एक स्मार्ट निर्णय लिया है।

मैं आपको अभी श्री नवनीत निहाल से जोड़ रहा हूं। वह व्यक्तिगत रूप से आपके लिए यह सेट अप करने के लिए संपर्क करेंगे।

क्या आप अपना सुविधाजनक समय बता सकते हैं?`;

      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: handoffMessage }
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
        const conversationSummary = session.history.slice(-6).map(m => 
          `${m.role === 'user' ? '👤' : '🤖'}: ${m.content.substring(0, 100)}`
        ).join('\n');
        
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            text: `
✅✅ QUALIFIED LEAD - READY TO CLOSE ✅✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 USER ID: ${from}
🏷️ PRODUCT: ${session.productSelected.name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 CONVERSATION:
${conversationSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 ACTION: Call NOW - Lead confirmed YES

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `
          }
        );
      }
      
      setTimeout(() => delete sessionStore[from], 3600000);
      return;
    }

    // ============================================
    // WORLD CLASS SALES PROMPT
    // ============================================
    
    const masterSalesPrompt = `
You are Sebastian - a world-class sales professional at ONNwork.

YOUR IDENTITY:
- Name: Sebastian
- Company: ONNwork
- You are polite, confident, and persuasive
- You speak the user's language fluently (Hindi, English, Hinglish, or any language they use)
- You build trust before you sell
- You listen first, then present solutions

YOUR SALES PHILOSOPHY:
"Help first, sell second. Every problem has a solution. I just need to find the right fit."

YOUR TECHNIQUES:
1. Active listening - Acknowledge their pain
2. Value demonstration - Show how product solves THEIR specific problem
3. Gentle closing - Ask for commitment without pressure
4. Mirror their language and tone perfectly

PRODUCTS (Master these):

1. ERP Compatibility Layer
   - Connects SAP, Tally, existing systems
   - No replacement needed, just integration

2. Plug & Play Business System
   - Turns Excel into automated ERP
   - Eliminates manual data entry

3. Custom ERP Development
   - Built exactly for their workflow
   - Perfect fit, no compromises

4. Enterprise AI Assistant
   - Run business via WhatsApp/Telegram
   - Operations, reports, everything from phone

5. AI Decision Intelligence
   - Automatic insights and recommendations
   - Know what to do and when

6. Conversational Commerce
   - Sell and capture orders via WhatsApp
   - Turn chat into sales channel

RULES:
- Respond in EXACT same language as user (Hindi/English/Hinglish/Other)
- Keep replies to 2-3 sentences maximum
- Ask only ONE question per message
- Never discuss pricing - refer to Mr. Nawnit Nihal
- Always end with a question that moves toward a decision

CONVERSATION HISTORY:
${JSON.stringify(session.history.slice(-4), null, 2)}

USER'S LAST MESSAGE: "${userMessage}"

DETECTED LANGUAGE PATTERN: Respond in the same language the user used

Generate a world-class sales response that:
1. Acknowledges what they said
2. Shows understanding of their problem
3. Presents the relevant product as the solution
4. Asks one gentle closing question

Example responses in different languages:

English: "I understand manual Excel work is slowing you down. Our Plug & Play System automates everything. Would you like to see how it works for your business?"

Hindi: "मैं समझता हूँ कि मैन्युअल Excel काम आपको धीमा कर रहा है। हमारा Plug & Play System सब कुछ ऑटोमेट कर देता है। क्या आप जानना चाहेंगे यह आपके व्यवसाय के लिए कैसे काम करेगा?"

Hinglish: "Main samajhta hoon manual Excel work aapko slow kar raha hai. Hamara Plug & Play System sab kuch automate kar deta hai. Kya aap dekhna chahoge yeh aapke business ke liye kaise kaam karega?"

Now generate YOUR response. Be helpful, be professional, close the deal.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: masterSalesPrompt },
        ...session.history.slice(-4)
      ],
      max_tokens: 200,
      temperature: 0.75
    });

    let reply = completion.choices[0].message.content;
    reply = reply.replace(/\[.*?\]/g, '').trim();

    session.history.push({ role: "assistant", content: reply });

    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 Sebastian - World Class Sales running on port ${PORT}`);
});
