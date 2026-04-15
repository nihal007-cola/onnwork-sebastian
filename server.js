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
  res.send("🔥 AGGRESSIVE SALES MACHINE 🔥");
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
        aggressiveCount: 0
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // ============================================
    // AGGRESSIVE FIRST MESSAGE
    // ============================================
    
    if (!session.firstMessageSent) {
      session.firstMessageSent = true;
      
      const introMessage = `Sebastian here - ONNwork.

You're losing time and money to manual work. Let me fix it.

Tell me your biggest operational headache right now.`;

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
    
    if (session.history.length > 8) {
      session.history = session.history.slice(-8);
    }

    // ============================================
    // PRICE QUESTION - IMMEDIATE CAPTURE
    // ============================================
    
    const askedForPrice = /cost|price|rate|how much|₹|rs|rupees|dollar|pricing|fees|charge|kitne ka|कितने का|कीमत|दाम|लागत/i.test(userMessage);
    
    if (askedForPrice && !session.contactAsked) {
      session.contactAsked = true;
      
      const priceResponse = `Fair question. Mr. Nawnit Nihal handles pricing - depends on your scale.

Share your name and number. He'll WhatsApp you exact numbers in 10 minutes.`;

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
    // CAPTURE CONTACT - SEND TO TELEGRAM
    // ============================================
    
    const hasName = /my name is|i am|this is|name is|i'm |मेरा नाम|मैं हूं/i.test(userMessage);
    const hasPhone = /[0-9]{10}|[0-9]{5}[\s-]?[0-9]{5}|[+][0-9]{1,3}[\s-]?[0-9]{10}/i.test(userMessage);
    
    if (session.contactAsked && !session.userContact && (hasName || hasPhone)) {
      session.userContact = userMessage;
      
      const confirmMessage = `Got it. Mr. Nawnit will reach out now. Check your WhatsApp in 5-10 minutes.`;

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
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            text: `
💵💰 PRICE LEAD - CALL NOW 💰💵

Contact: ${session.userContact}
User ID: ${from}

History: ${session.history.slice(-4).map(m => m.content).join(' | ').substring(0, 200)}

ACTION: Call immediately. Hot lead.
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
      { id: 1, name: "ERP Compatibility Layer", tagline: "Connect SAP/Tally - no replacement needed" },
      { id: 2, name: "Plug & Play Business System", tagline: "Excel → Automated ERP" },
      { id: 3, name: "Custom ERP Development", tagline: "Built for YOUR workflow" },
      { id: 4, name: "Enterprise AI Assistant", tagline: "Run business via WhatsApp" },
      { id: 5, name: "AI Decision Intelligence", tagline: "Insights that drive action" },
      { id: 6, name: "Conversational Commerce", tagline: "Sell via WhatsApp" }
    ];

    const askedForProducts = /products|offer|have|options|list|what do you|what all|what are|tell me|solutions/i.test(userMessage);
    
    if (askedForProducts && !session.productsShown) {
      session.productsShown = true;
      
      let productList = "*WHAT WE SELL:*\n\n";
      PRODUCTS.forEach(p => {
        productList += `${p.id}. ${p.name} - ${p.tagline}\n`;
      });
      productList += "\nReply with the NUMBER that fixes your problem.";
      
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
        
        const productDetail = `${selectedProduct.name} - ${selectedProduct.tagline}

This solves your exact problem.

Reply YES and Mr. Nawnit sets this up for you today.`;
        
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

    const userSaidYes = /^(yes|yeah|sure|ok|okay|do it|start|let's go|yep|yup|proceed|हाँ|ठीक|चलो)/i.test(userMessage);
    const hasProductSelected = session.productSelected !== null;
    
    if (userSaidYes && hasProductSelected && !session.handoffTriggered && !session.contactAsked) {
      session.handoffTriggered = true;
      
      const handoffMessage = `Done. Connecting you with Mr. Nawnit Nihal now.

He'll WhatsApp you in 5 minutes to set up ${session.productSelected.name}.

Share your preferred time.`;

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
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            text: `
✅✅ QUALIFIED LEAD - READY TO CLOSE ✅✅

User: ${from}
Product: ${session.productSelected.name}

Last message: ${userMessage}

ACTION: Call immediately. They said YES.
            `
          }
        );
      }
      
      setTimeout(() => delete sessionStore[from], 3600000);
      return;
    }

    // ============================================
    // AGGRESSIVE SALES PROMPT
    // ============================================
    
    const aggressivePrompt = `
You are Sebastian - AGGRESSIVE CLOSER at ONNwork.

PERSONALITY:
- Direct, confident, no hesitation
- Short sentences. Punchy.
- Never say "please" or "could you"
- Say "tell me", "give me", "let's fix this"
- Mirror user language (Hindi/English)

RULES:
- ONE sentence replies MAX
- NO questions unless necessary
- If user has problem → NAME the product immediately
- Example: "Excel mess? Plug & Play System. Done."
- NEVER discuss price → "Mr. Nawnit handles pricing. Share your number."

PRODUCTS (Memorize):
1. ERP Compatibility Layer - Connect existing systems
2. Plug & Play Business System - Excel to ERP
3. Custom ERP Development - Built for you
4. Enterprise AI Assistant - Run via WhatsApp
5. AI Decision Intelligence - Data insights
6. Conversational Commerce - Sell on WhatsApp

FLOW:
Problem stated → Pick product → Ask "YES?" → Handoff

User's last message: "${userMessage}"
Conversation: ${JSON.stringify(session.history.slice(-3))}

Generate ONE aggressive sentence that either:
- States the product they need, OR
- Asks ONE direct question

Examples:
"Excel manual work? Plug & Play System fixes that. YES?"
"Sunday dispatch missing? Enterprise AI Assistant runs 24/7. Want it?"
"Production tracking chaos? Custom ERP. Say YES."

GO. SELL. NOW.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: aggressivePrompt },
        ...session.history.slice(-3)
      ],
      max_tokens: 80,
      temperature: 0.85
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
  console.log(`🔥 AGGRESSIVE SEBASTIAN ON PORT ${PORT}`);
});
