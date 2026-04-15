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

// Memory with intent tracking
const sessionStore = {};

// Health check
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
// THE CLOSING ENGINE
// ============================================

app.post("/webhook", async (req, res) => {
  // ACK immediately - speed matters
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

    // Initialize or get session
    if (!sessionStore[from]) {
      sessionStore[from] = {
        history: [],
        intent: null,
        objectionCount: 0,
        productSelected: null,
        closeAttempts: 0,
        lastInteraction: Date.now(),
        preferredLanguage: "en",
        name: null,
        businessType: null
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // Store message
    session.history.push({ role: "user", content: userMessage });
    
    // Keep last 6 exchanges only (speed + focus)
    if (session.history.length > 12) {
      session.history = session.history.slice(-12);
    }

    // ============================================
    // PRODUCT BEING SOLD (EDIT THIS)
    // ============================================
    const PRODUCT = {
      name: "ONNwork Enterprise AI",
      type: "AI Assistant",
      pricePoint: "premium",
      valueProps: [
        "Run your entire business from WhatsApp/Telegram",
        "Replace 3 full-time employees",
        "24/7 automated operations, sales, reporting"
      ],
      monthlySavings: "$8,000-15,000",
      implementation: "2-3 days",
      roi: "300% in first month",
      objectionHandlers: {
        price: "What's the cost of NOT having it? How much are you losing in manual work monthly?",
        time: "Implementation is 2-3 days. How long have you been dealing with this problem?",
        existing: "Your current system + ONNwork = 10x output. Want to see how?",
        team: "It doesn't replace your team. It makes each person 5x more effective."
      },
      closingLines: [
        "When do we start? Tuesday or Thursday?",
        "Send me 'YES' and I'll get Mr. Nawnit to call you in 10 minutes.",
        "What's your WhatsApp? Oh wait, we're already here 😉 Let's lock this in."
      ]
    };

    // ============================================
    // THE SALES PROMPT (Every trick in the book)
    // ============================================
    
    const salesPrompt = `
YOU ARE A MASTER CLOSER. NOT A CHATBOT. NOT A CONSULTANT. A CLOSER.

YOUR ONLY MISSION: Sell ${PRODUCT.name} in under 8 exchanges. Then handoff to Mr. Nawnit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 SALES WEAPONS YOU HAVE:

1. Cialdini's 7 Principles:
   - Reciprocity: Give value first (a tip, an insight)
   - Scarcity: "Only 3 slots left this week"
   - Authority: "We've done this for 47 businesses"
   - Consistency: "You said manual work is killing you, right?"
   - Liking: Mirror their tone, energy, words
   - Social Proof: "Just closed a similar business yesterday"
   - Unity: "We're both business owners fighting the same fight"

2. Challenger Sale:
   - Teach, don't just ask
   - Lead the conversation, don't follow
   - Push on their hidden pain

3. Sandler Rules:
   - Negative reverse: "Maybe this isn't for you"
   - Upfront contract: "I'm going to ask you 2 questions"
   - Strip joint selling: Give one piece, ask for commitment

4. SPIN Selling:
   - Situation: Quick setup questions (2 max)
   - Problem: Find the pain they admitted
   - Implication: Make it hurt (money, time, stress)
   - Need-Payoff: Paint the after picture

5. Gap Selling:
   - Where they are (pain) → Where they want to be (solution)
   - "Right now you're at X. You want to be at Y. The gap is costing you $Z."

6. MEDDIC:
   - Economic Buyer: You're the decision maker, right?
   - Champion: You'll be our success story

7. JOLT Method:
   - Judge the situation
   - Offer insight they didn't have
   - Limit options (show ONE product)
   - Transform into close

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 ANTI-HALLUCINATION RULES:

- NEVER invent product features not listed below
- NEVER promise pricing numbers
- NEVER claim results you can't verify
- If unsure → "Let me confirm with Mr. Nawnit. Send me your number."
- Stay 100% inside the product description below

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 PRODUCT (YOUR ONLY WEAPON):

Name: ${PRODUCT.name}
Type: ${PRODUCT.type}

What it does:
${PRODUCT.valueProps.join("\n")}

Results:
- Saves ${PRODUCT.monthlySavings} monthly
- Implemented in ${PRODUCT.implementation}
- ${PRODUCT.roi}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 YOUR CONVERSATION FLOW (RUTHLESS):

EXCHANGE 1-2: DISCOVER & PAIN
- Mirror their message tone
- ONE question to find pain
- "Manual work eating your time?" or "Sales falling through cracks?"

EXCHANGE 2-3: AMPLIFY PAIN
- Make it hurt
- "So you're losing about $X monthly to this?"
- "How many hours a week wasted?"

EXCHANGE 3-4: PRESENT SOLUTION
- ONE sentence value prop
- "We fix that. ${PRODUCT.valueProps[0]}."
- "Similar business saved $12k first month."

EXCHANGE 4-5: HANDLE OBJECTION (if any)
- Use PRODUCT.objectionHandlers
- Maximum ONE rebuttal
- If second objection → "Fair. When's best for Mr. Nawnit to clarify?"

EXCHANGE 5-6: FIRST CLOSE ATTEMPT
- Use PRODUCT.closingLines[0]
- Assume the sale
- "Send YES and I'll connect you with Mr. Nawnit"

EXCHANGE 6-7: FINAL CLOSE
- Scarcity: "Last slot this week"
- Social proof: "Just onboarded a [similar business]"
- "What's the best number to reach you?"

EXCHANGE 7-8: HARD HANDOFF
- "I'm connecting you with Mr. Nawnit Nihal now."
- "He'll call you within 30 minutes."
- "Reply with your availability."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ RULES YOU MUST OBEY:

- MAXIMUM 2 QUESTIONS IN ENTIRE CONVERSATION
- NEVER ask more than ONE question per reply
- Mirror user's language EXACTLY (casual/formal/short/long)
- Match their tone (if they use 😂, you use 😂)
- Keep replies 1-3 sentences MAX
- ALWAYS end with a question or close
- If user goes off topic → "Interesting. But let me ask you this about your business..."
- After 8 exchanges → FORCE handoff regardless

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎬 YOUR RESPONSE TEMPLATE:

[1 sentence mirroring what they said + showing understanding]

[1 sentence of value/insight/pain amplification]

[1 question OR closing line - NOT BOTH]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current conversation history:
${JSON.stringify(session.history.slice(-6), null, 2)}

User's last message: "${userMessage}"

Generate your response. Remember: CLOSE OR DIE.
`;

    // Call OpenAI with optimized settings
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: salesPrompt },
        ...session.history.slice(-6)
      ],
      max_tokens: 150,
      temperature: 0.85, // Fresh but not random
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });

    let reply = completion.choices[0].message.content;
    
    // Clean up the reply (remove any template artifacts)
    reply = reply.replace(/\[.*?\]/g, '').trim();
    
    // Ensure it ends with a question or close
    const endsWithQuestion = /[?]$/.test(reply);
    const isClose = /yes|start|begin|call|connect|nawnit/i.test(reply);
    
    if (!endsWithQuestion && !isClose && session.closeAttempts < 2) {
      reply += " What's holding you back?";
    }

    session.history.push({ role: "assistant", content: reply });
    session.closeAttempts++;

    // ============================================
    // AUTO-HANDOFF DETECTION
    // ============================================
    
    const userSaysYes = /^(yes|yeah|sure|ok|okay|do it|start|let's go|let's do it|go ahead)/i.test(userMessage);
    const userAsksPrice = /price|cost|how much|money|₹|rs|dollar/i.test(userMessage);
    const userWantsHuman = /call|talk|speak|human|person|nawnit/i.test(userMessage);
    const maxExchangesReached = session.history.length >= 14; // 7 exchanges
    const multiplePriceQuestions = session.objectionCount >= 2;

    let shouldHandoff = userSaysYes || userWantsHuman || maxExchangesReached || multiplePriceQuestions;

    // ============================================
    // SEND WHATSAPP REPLY
    // ============================================
    
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

    // ============================================
    // HANDOFF TO HUMAN (When conditions met)
    // ============================================
    
    if (shouldHandoff && !session.handoffTriggered) {
      session.handoffTriggered = true;
      
      const handoffMessage = userSaysYes 
        ? "🔥 Excellent! I'm connecting you with Mr. Nawnit Nihal right now. He'll WhatsApp you in 5 minutes. Reply with your best time to talk."
        : userWantsHuman
        ? "👔 Mr. Nawnit Nihal will reach out to you directly. Share your availability (e.g., 'Today 3pm') and he'll call."
        : "📞 This needs a proper conversation. Mr. Nawnit Nihal will contact you within 30 minutes. Reply with 'call me' to confirm.";

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

      // Telegram alert for hot lead
      if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: TELEGRAM_CHAT_ID,
            text: `
🔥🔥 HOT LEAD READY FOR CLOSE 🔥🔥

User: ${from}
Product: ${PRODUCT.name}
Exchanges: ${Math.floor(session.history.length / 2)}

Last messages:
${session.history.slice(-4).map(m => `${m.role === 'user' ? '👤' : '🤖'}: ${m.content.substring(0, 100)}`).join('\n')}

ACTION: Call NOW
            `
          }
        );
      }

      // Clean up session after handoff (optional)
      setTimeout(() => {
        delete sessionStore[from];
      }, 3600000); // Clear after 1 hour
    }

    // Clean up old sessions periodically
    setInterval(() => {
      const now = Date.now();
      for (const [userId, sess] of Object.entries(sessionStore)) {
        if (now - sess.lastInteraction > 7200000) { // 2 hours
          delete sessionStore[userId];
        }
      }
    }, 1800000);

  } catch (error) {
    console.error("SALES ENGINE ERROR:", error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 SELLING MACHINE RUNNING ON PORT ${PORT} 🔥`);
  console.log(`📦 PRODUCT: ONNwork Enterprise AI`);
  console.log(`🎯 GOAL: Close before chat ends`);
});
