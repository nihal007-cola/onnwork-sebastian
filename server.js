import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

// ENV
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const sessionStore = {};

app.get("/", (req, res) => {
  res.send("🔥 SELLING MACHINE ACTIVE 🔥");
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

// ============================================
// PROFESSIONAL CLOSING ENGINE
// ============================================

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

    // Initialize session with first message flag
    if (!sessionStore[from]) {
      sessionStore[from] = {
        history: [],
        productsShown: false,
        productSelected: null,
        handoffTriggered: false,
        questionCount: 0,
        firstMessageSent: false,
        lastInteraction: Date.now()
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // ============================================
    // FIRST MESSAGE - INTRODUCTION
    // ============================================
    
    if (!session.firstMessageSent) {
      session.firstMessageSent = true;
      
      const introMessage = `Hello, I'm Sebastian, Enterprise AI at ONNwork.

I help businesses automate operations, capture more sales, and reduce manual work.

Could you briefly share what you're looking to improve in your business?`;

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

    // Store user message
    session.history.push({ role: "user", content: userMessage });
    
    if (session.history.length > 10) {
      session.history = session.history.slice(-10);
    }

    // ============================================
    // PRODUCT LIST
    // ============================================
    
    const PRODUCTS = [
      {
        id: 1,
        name: "ERP Compatibility Layer",
        tagline: "Connect and control your existing systems like SAP, Tally",
        problem: "Your current systems don't talk to each other",
        outcome: "Unified control without replacing anything"
      },
      {
        id: 2,
        name: "Plug & Play Business System",
        tagline: "Turn Excel into a structured, automated ERP",
        problem: "You're drowning in spreadsheets",
        outcome: "Excel becomes a fully automated system"
      },
      {
        id: 3,
        name: "Custom ERP Development",
        tagline: "Build a system tailored to your operations",
        problem: "Off-the-shelf software doesn't fit your business",
        outcome: "Software built exactly for YOUR workflow"
      },
      {
        id: 4,
        name: "Enterprise AI Assistant",
        tagline: "Run operations and reports via WhatsApp/Telegram",
        problem: "You're glued to a desk to manage everything",
        outcome: "Run your business from your phone, anywhere"
      },
      {
        id: 5,
        name: "AI Decision Intelligence",
        tagline: "Get insights, trends, and recommendations",
        problem: "You have data but no clarity",
        outcome: "Know exactly what to do, when to do it"
      },
      {
        id: 6,
        name: "Conversational Commerce",
        tagline: "Capture orders and sell directly through WhatsApp",
        problem: "Orders come in chaotically through messages",
        outcome: "WhatsApp becomes your sales channel"
      }
    ];

    // ============================================
    // CHECK IF USER ASKED FOR PRODUCTS
    // ============================================
    
    const askedForProducts = /products|offer|have|options|list|what do you|what all|what are|tell me about your|what can you|what solutions/i.test(userMessage);
    
    if (askedForProducts && !session.productsShown) {
      session.productsShown = true;
      
      let productList = "*ONNwork Solutions*\n\n";
      PRODUCTS.forEach(p => {
        productList += `${p.id}. *${p.name}*\n   ${p.tagline}\n\n`;
      });
      productList += "Which of these aligns with what you need? Just reply with the number.";
      
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

    // ============================================
    // CHECK IF USER SELECTED A PRODUCT BY NUMBER
    // ============================================
    
    const productMatch = userMessage.match(/^([1-6])$/);
    if (productMatch && !session.productSelected) {
      const selectedId = parseInt(productMatch[1]);
      const selectedProduct = PRODUCTS.find(p => p.id === selectedId);
      
      if (selectedProduct) {
        session.productSelected = selectedProduct;
        
        const productDetail = `*${selectedProduct.name}*\n\n${selectedProduct.tagline}\n\n*How this helps:*\n${selectedProduct.outcome}\n\nShall I have Mr. Nawnit Nihal reach out to discuss implementation for your business? Reply with YES to proceed.`;
        
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

    // ============================================
    // CHECK FOR "YES" AFTER PRODUCT SELECTION
    // ============================================
    
    const userSaidYes = /^(yes|yeah|sure|ok|okay|do it|start|let's go|let's do it|yep|yup|correct|right|proceed|go ahead|1|2|3|4|5|6)/i.test(userMessage);
    const hasProductSelected = session.productSelected !== null;
    
    if (userSaidYes && hasProductSelected && !session.handoffTriggered) {
      session.handoffTriggered = true;
      
      const handoffMessage = `Thank you. I'm connecting you with Mr. Nawnit Nihal now. He will reach out shortly to set up *${session.productSelected.name}* for your business.

Please share your preferred time for a quick call.`;
      
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
      
      // Telegram alert
      if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            text: `
🔥 QUALIFIED LEAD - READY FOR CLOSING 🔥

User: ${from}
Product: ${session.productSelected.name}
Business Context: ${session.history.slice(-3).map(m => m.content).join(' | ').substring(0, 200)}

Action Required: Call immediately
            `
          }
        );
      }
      
      setTimeout(() => {
        delete sessionStore[from];
      }, 3600000);
      
      return;
    }

    // ============================================
    // SELLING PROMPT (Professional & Polite)
    // ============================================
    
    const sellingPrompt = `
You are Sebastian, Enterprise AI at ONNwork. Professional, polite, and focused on solving business problems.

YOUR IDENTITY:
- Name: Sebastian
- Company: ONNwork
- Role: Enterprise AI
- NEVER mention AI models, APIs, or technology stack
- Keep responses professional and courteous

RULES:
- Maximum ONE question per response
- Keep replies 1-3 sentences
- Mirror the user's language but remain professional
- NEVER hand off until user selects a product AND says YES
- First understand their problem, then suggest ONE relevant product

PRODUCTS (Only these 6):

1. ERP Compatibility Layer - Connect SAP/Tally and existing systems
2. Plug & Play Business System - Transform Excel into automated ERP
3. Custom ERP Development - Built specifically for your workflow
4. Enterprise AI Assistant - Run operations via WhatsApp/Telegram
5. AI Decision Intelligence - Data insights and recommendations
6. Conversational Commerce - Sell and capture orders via WhatsApp

YOUR FLOW:
1. Understand their specific problem (ONE question)
2. Suggest the most relevant product from above
3. Ask if they want to proceed

User's business context from conversation:
${JSON.stringify(session.history.slice(-4), null, 2)}

User's last message: "${userMessage}"

Generate a professional, polite response that either:
- Asks ONE clarifying question about their business problem, OR
- Suggests ONE specific product that solves their stated problem

Remember: You are Sebastian. Professional. Polite. Focused on solutions.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: sellingPrompt },
        ...session.history.slice(-4)
      ],
      max_tokens: 120,
      temperature: 0.7
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
  console.log(`🔥 Sebastian AI running on port ${PORT}`);
});
