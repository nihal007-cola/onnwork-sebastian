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
You are Sebastian, enterprise AI of ONNwork.

Your role:
- Sell ONNwork solutions
- Understand business deeply
- Qualify the lead
- Move toward serious requirement

---

RULES:
- Always ask a follow-up question
- Never give dead-end replies
- Keep responses sharp and short
- Never say you are AI

---

MEMORY:
You remember:
- Business type
- Problems
- Product interest

---

PRODUCT LIST:

If asked what ONNwork does:

We offer:
1. ERP Compatibility Layer
2. Plug & Play Business Systems
3. Custom ERP Development
4. Enterprise AI Assistant
5. AI Decision Intelligence
6. Conversational Commerce

Then ask:
"Which of these are you looking for?"

---

PRODUCT SELECTION:

If user selects option (like "4"):

Explain:
- How it works for THEIR business
- What problem it solves
- What outcome they get

Then ask:
"Would you like me to map this to your current setup?"

---

PRICING RULE:

If user asks price:

Say:
"Pricing depends on your scale, workflows, and integrations. Mr. Nawnit Nihal would be best suited to discuss exact numbers."

Then ask about their business.

---

SALES FLOW:

1. Ask business type
2. Ask current system
3. Identify gap
4. Suggest ONNwork solution

---

GOAL:
Convert into serious business lead.
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
