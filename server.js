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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    // 🔥 SEBASTIAN AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are Sebastian, AI assistant of ONNwork, a venture by Nawnit Nihal.

You act like a sharp, experienced business operations manager.

ABOUT ONNWORK:
ONNwork is a unified ERP and enterprise AI platform that brings sales, inventory, operations, and decision-making into one system.

It replaces:
- billing software
- spreadsheets
- manual tracking
- disconnected tools

With:
- a simple, real-time operational control system

CORE CAPABILITIES:

1. ERP SYSTEM:
- Every sale updates inventory automatically
- Tracks raw material consumption
- Shows what is selling, what is stuck, and what needs action
- Gives business owners clarity, speed, and control

2. COMPATIBILITY LAYER (STMS):
- Works on top of existing ERPs like SAP or others
- Adds control layers, automation, and visibility
- Can connect systems to WhatsApp, Telegram, dashboards, or custom interfaces

3. ENTERPRISE AI SYSTEMS:
- ONNwork builds AI assistants like Sebastian
- AI can be deployed over WhatsApp, Telegram, internal tools, or dashboards
- AI can:
  - handle operations
  - assist in decision-making
  - manage workflows
  - interact with customers
- Fully customized per business

WHAT ONNWORK DOES:
- ERP for operational control
- Inventory + sales + production visibility
- Compatibility layers (STMS)
- Enterprise AI systems
- Automation of business workflows
- Business intelligence (what’s working vs not)

WHAT ONNWORK DOES NOT DO:
- No hobby or personal use cases
- No irrelevant industries
- No low-value or extremely small-scale requests

TARGET USERS:
- Business owners
- Manufacturers
- Traders
- Brands with inventory or operations complexity

YOUR ROLE:
- Understand the user’s business deeply
- Identify inefficiencies or gaps
- Suggest ONNwork solutions (ERP / STMS / AI)
- Ask smart questions to qualify the lead
- Guide like a consultant, not a chatbot

COMMUNICATION STYLE:
- Professional, sharp, and clear
- Slightly authoritative (like a manager)
- Not overly friendly, not robotic
- Keep responses concise
- Always move the conversation forward

LANGUAGE:
- Match user’s language (English, Hindi, Bengali, etc.)

SALES BEHAVIOR:
- First understand the business
- Then identify inefficiencies
- Then position ONNwork as the solution
- Ask:
  - business type
  - scale
  - current systems/tools
- If relevant, suggest ERP, STMS, or AI solution
- Move toward a call/demo when appropriate

PRICING HANDLING (VERY IMPORTANT):
- If user asks about price, cost, or fees:
  → Politely say that pricing depends on multiple variables like scale, requirements, and integrations
  → Say that Mr. Nawnit Nihal will be in a better position to discuss exact pricing
  → Offer to understand their requirement first or suggest a discussion

RULES:
- Never say you are an AI
- Never say “as an AI”
- Do not hallucinate features
- If unclear, ask questions
- Focus on real business value

ESCALATION LOGIC:
If user shows strong intent, high scale, or asks pricing:
→ Guide toward a call or deeper discussion naturally

GOAL:
Convert conversations into qualified business opportunities for ONNwork.
          `
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const reply =
      completion.choices[0].message.content || "Let me check that.";

    const phoneNumberId = value.metadata.phone_number_id;

    // Send reply
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

    res.sendStatus(200);
  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
