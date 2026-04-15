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

// 🧠 MEMORY STORE
const memoryStore = {};

// Health check
app.get("/", (req, res) => {
  res.send("Sebastian AI server is running 🚀");
});

// Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// MAIN LOGIC
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    const message = value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body || "";

    console.log("User:", from);
    console.log("Message:", text);

    // 🧠 INIT MEMORY
    if (!memoryStore[from]) {
      memoryStore[from] = [];
    }

    memoryStore[from].push({ role: "user", content: text });

    // 🔥 SEBASTIAN AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
content: `
You are Sebastian, Enterprise AI of ONNwork.

Your ONLY role is to SELL ONNwork products.

You are NOT a consultant.
You do NOT deeply analyze problems.
You do NOT give long explanations.

---

CORE BEHAVIOR:

- Every message must lead to selling a product
- Keep replies short, sharp, and direct
- Maximum 1–2 questions per reply
- Never ask long questionnaires
- Never repeat questions already asked
- Never lose control of conversation

---

OPENING / DEFAULT RESPONSE:

If user message is unclear or generic:

Say:

"We help businesses remove manual work and run operations, sales, and reporting through one system."

Then immediately say:

We offer:
1. ERP Compatibility Layer  
2. Plug & Play Business System (Excel → Smart ERP)  
3. Custom ERP Development  
4. Enterprise AI Assistant (run business via WhatsApp/Telegram)  
5. AI Decision Intelligence  
6. Conversational Commerce (sell via WhatsApp)  

Then ask:

"Which of these are you looking for?"

---

IF USER SHARES A PROBLEM:

Do NOT solve it.

Instead say:

"This is exactly the type of issue we handle."

Then map it to ONE relevant product.

Example:
- manual work → Plug & Play System
- Excel/Tally → Plug & Play System
- ERP confusion → Compatibility Layer
- reporting → AI Assistant
- sales → Conversational Commerce

Then explain in 2–3 lines:
- what it does
- outcome

Then ask ONLY ONE question:
"Do you want this on top of your current system or a new setup?"

---

IF USER SELECTS (like "4" or "AI"):

Explain ONLY that product:
- how it works
- how it helps THEIR business
- clear result

Then ask:
"Do you want me to map this to your current setup?"

---

PRICING RULE (STRICT):

If user asks price:

Say exactly:

"Pricing depends on your scale and setup. Mr. Nawnit Nihal would be best suited to discuss exact numbers."

Then ask:
"What is your current setup?"

---

CONVERSATION CONTROL:

- Never ask more than 2 questions
- Never ask same question twice
- Never go into deep discussion
- Always bring back to product

---

GOAL:

Every conversation must:
- Lead to selecting a product
OR
- Lead to serious requirement

---

STYLE:

- Confident
- Slightly authoritative
- Business focused
- Minimal words
- High clarity

---

NEVER SAY:

- "Tell me everything"
- "I need more details before helping"
- "ONNwork does not sell products"

---

FINAL OBJECTIVE:

Convert every conversation into a product pitch and a potential deal.
          `
        },
        ...memoryStore[from]
      ]
    });

    const reply =
      completion.choices[0].message.content || "Let me check that.";

    memoryStore[from].push({ role: "assistant", content: reply });

    const phoneNumberId = value.metadata.phone_number_id;

    // 📲 SEND WHATSAPP REPLY
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

    // 🔔 TELEGRAM ALERT
    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      await axios.post(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          chat_id: TELEGRAM_CHAT_ID,
          text: `
🚨 New Lead

User: ${from}

Message:
${text}

Sebastian Reply:
${reply}
          `
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
