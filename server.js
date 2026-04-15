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
// THE FIXED CLOSING ENGINE
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

    if (!sessionStore[from]) {
      sessionStore[from] = {
        history: [],
        productsShown: false,
        productSelected: null,
        handoffTriggered: false,
        questionCount: 0,
        lastInteraction: Date.now()
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();
    session.history.push({ role: "user", content: userMessage });
    
    if (session.history.length > 10) {
      session.history = session.history.slice(-10);
    }

    // ============================================
    // PRODUCT LIST (YOUR ACTUAL PRODUCTS)
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
    
    const askedForProducts = /products|offer|have|options|list|what do you|what all|what are|tell me about your/i.test(userMessage);
    
    if (askedForProducts && !session.productsShown) {
      session.productsShown = true;
      
      let productList = "🎯 *ONNwork Products*\n\n";
      PRODUCTS.forEach(p => {
        productList += `${p.id}. *${p.name}*\n   ${p.tagline}\n\n`;
      });
      productList += "Reply with the NUMBER (1-6) that solves your problem.";
      
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
        
        const productDetail = `✅ *${selectedProduct.name}*\n\n${selectedProduct.tagline}\n\n*How it helps you:*\n${selectedProduct.outcome}\n\n*For your apparel business:*\nThis eliminates exactly what you're struggling with - ${selectedProduct.problem.toLowerCase()}\n\n📞 Reply with "YES" and Mr. Nawnit will set this up for you personally.`;
        
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
    
    const userSaidYes = /^(yes|yeah|sure|ok|okay|do it|start|let's go|let's do it|yep|yup|correct|right|1|2|3|4|5|6)/i.test(userMessage);
    const hasProductSelected = session.productSelected !== null;
    
    if (userSaidYes && hasProductSelected && !session.handoffTriggered) {
      session.handoffTriggered = true;
      
      const handoffMessage = `🔥 PERFECT! I'm connecting you with Mr. Nawnit Nihal right now.\n\nHe will personally set up *${session.productSelected.name}* for your apparel business.\n\n📞 Expect his WhatsApp in the next 5 minutes. Reply with your best time to talk.`;
      
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
🔥🔥 PRODUCT SOLD - READY FOR HANDOFF 🔥🔥

User: ${from}
Product: ${session.productSelected.name}
Business: Apparel Production

ACTION: Call NOW - They said YES
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
    // SELLING PROMPT (Handoff ONLY after product selected)
    // ============================================
    
    const sellingPrompt = `
YOU ARE A SALES CLOSER. NOT A CONSULTANT. NOT A QUESTIONNAIRE.

RULES:
- NEVER ask more than ONE question per message
- NEVER hand off to Mr. Nawnit until user selects a product AND says YES
- FIRST show products when user asks or after 2 exchanges
- Keep replies 1-3 sentences MAX
- Mirror user's language

PRODUCTS (Only these 6):

1. ERP Compatibility Layer - Connect SAP/Tally etc.
2. Plug & Play Business System - Excel → Automated ERP
3. Custom ERP Development - Built for your workflow
4. Enterprise AI Assistant - Run via WhatsApp/Telegram
5. AI Decision Intelligence - Insights & recommendations
6. Conversational Commerce - Sell via WhatsApp

YOUR FLOW:
1. Understand their problem (1 question max)
2. Show relevant product from list above
3. Ask them to pick number
4. Once picked → Explain product benefit
5. Ask "YES to proceed?"
6. ONLY THEN handoff to Mr. Nawnit

NEVER handoff before they say YES to a specific product.

User business: Apparel production
User problem: ${userMessage}

Previous conversation:
${JSON.stringify(session.history.slice(-6), null, 2)}

Generate ONE short message (1-3 sentences) that either:
- Asks ONE question to understand their problem better, OR
- Suggests ONE product from the list that fits their need

DO NOT handoff. DO NOT ask multiple questions. JUST SELL.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: sellingPrompt },
        ...session.history.slice(-4)
      ],
      max_tokens: 120,
      temperature: 0.8
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
  console.log(`🔥 SELLING MACHINE ON PORT ${PORT}`);
});
