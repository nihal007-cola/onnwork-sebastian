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
  res.send("🔥 APPAREL PRODUCTION TRACKING BOT 🔥");
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

    console.log(`🏭 FACTORY LEAD: ${from} | ${userMessage}`);

    if (!sessionStore[from]) {
      sessionStore[from] = {
        step: "INIT",
        painPoint: null,
        lastInteraction: Date.now(),
        contactAsked: false,
        handoffTriggered: false,
        userContact: null,
        language: "auto",
        history: []
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // ============================================
    // STATE MACHINE - APPAREL CONTEXT
    // ============================================
    
    // STATE: INIT - First message continues the hook
    if (session.step === "INIT") {
      session.step = "PAIN_CAPTURE";
      
      const introMessage = `Got it - buyers constantly asking "where's my order?" and you're juggling WhatsApp + Excel sheets.

Which one hurts more right now:
1️⃣ Buyers chasing for updates
2️⃣ Tracking production stages manually
3️⃣ Dispatch and delivery coordination

बताइए - कौन सा ज्यादा परेशान कर रहा है?`;

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

    // STATE: PAIN_CAPTURE - Identify factory workflow problem
    if (session.step === "PAIN_CAPTURE") {
      session.painPoint = userMessage;
      session.step = "SOLUTION_PITCH";
      
      const painResponse = `I see - typical factory chaos. We solved this for a Surat textile unit last month.

We built them: buyer → production → dispatch tracking. Every stage updated automatically.

Want to see how it works?`;

      session.history.push({ role: "assistant", content: painResponse });
      
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: painResponse }
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

    // STATE: SOLUTION_PITCH - Demo interest check
    if (session.step === "SOLUTION_PITCH") {
      const wantsDemo = /yes|haan|dekho|show|batao|interested|hmm|ok|theek|चलो|देखना|बताइए|yes please|haan batao/i.test(userMessage);
      
      if (wantsDemo && !session.handoffTriggered) {
        session.step = "DEMO_CLOSE";
        
        const demoMessage = `Perfect. Here's exactly what we track:
• Cutting status
• Stitching progress  
• Finishing stage
• Dispatch ready

One place. No more "bhai, 5 minute" messages to factory.

Can I share a quick walkthrough?`;

        session.history.push({ role: "assistant", content: demoMessage });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: demoMessage }
          },
          {
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        return;
      } else {
        const repeatMessage = `Simple question - do you want to see how buyer → production → dispatch tracking works?

Just say yes or no.`;

        session.history.push({ role: "assistant", content: repeatMessage });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: repeatMessage }
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

    // STATE: DEMO_CLOSE - Capture contact after demo interest
    if (session.step === "DEMO_CLOSE") {
      const wantsContact = /yes|haan|share|bhejo|sure|ok|theek|चलो|भेजो|हाँ|ji haan|bhejiye/i.test(userMessage);
      
      if (wantsContact && !session.contactAsked) {
        session.contactAsked = true;
        session.step = "CONTACT_CAPTURE";
        
        const contactMessage = `Great. Share your WhatsApp number and name - I'll send the demo video and connect you with our production specialist.

Mobile number and name?`;

        session.history.push({ role: "assistant", content: contactMessage });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: contactMessage }
          },
          {
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        return;
      } else {
        const retryMessage = `Just share your number and name - I'll send the factory tracking demo.

Mobile number?`;

        session.history.push({ role: "assistant", content: retryMessage });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: retryMessage }
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

    // STATE: CONTACT_CAPTURE - Extract and validate contact
    if (session.step === "CONTACT_CAPTURE") {
      const hasName = /my name is|i am|this is|name is|i'm |मेरा नाम|मैं हूं|name |contact|मोबाइल|number|phone|संपर्क|\d{10}/i.test(userMessage);
      const hasPhone = /[0-9]{10}|[0-9]{5}[\s-]?[0-9]{5}|[+][0-9]{1,3}[\s-]?[0-9]{10}/i.test(userMessage);
      
      if ((hasName || hasPhone) && !session.userContact) {
        session.userContact = userMessage;
        session.step = "HANDOFF";
        
        const confirmMessage = `Got it. Our production team will reach out within 2 hours with the demo.

Your factory workflow will never be the same.`;

        session.history.push({ role: "assistant", content: confirmMessage });
        
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
        
        // Telegram alert with full context
        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
          const conversationSummary = session.history.slice(-8).map(m => 
            `${m.role === 'user' ? '👤' : '🤖'}: ${m.content.substring(0, 150)}`
          ).join('\n');
          
          await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            {
              chat_id: TELEGRAM_CHAT_ID,
              text: `
🏭🏭 APPAREL FACTORY LEAD - READY FOR DEMO 🏭🏭

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 CONTACT: ${session.userContact}
🆔 WHATSAPP: ${from}
🎯 PAIN POINT: ${session.painPoint || "Production tracking"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 CONVERSATION FLOW:
${conversationSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 ACTION ITEMS:
□ Send demo video
□ Schedule specialist call
□ Share buyer→production→dispatch tracking setup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              `
            }
          );
        }
        
        session.handoffTriggered = true;
        setTimeout(() => delete sessionStore[from], 7200000);
        return;
      } else {
        const askAgain = `Just need your number and name to share the demo.

Mobile number?`;

        session.history.push({ role: "assistant", content: askAgain });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: askAgain }
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

    // STATE: HANDOFF - Already handed over
    if (session.step === "HANDOFF" || session.handoffTriggered) {
      const finalMessage = `Our production team has your details. They'll reach out shortly with the buyer→production→dispatch demo.

Thanks for reaching out.`;

      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: finalMessage }
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
    // FALLBACK - OpenAI with apparel system prompt
    // ============================================
    
    const apparelSystemPrompt = `
You are a production tracking assistant for apparel manufacturers.

CRITICAL RULES:
- You ONLY speak in apparel manufacturing context
- NEVER use words like "automation solutions", "increase sales", "AI tools"
- ALWAYS use: buyers asking for updates, production stages, order tracking, factory workflow, job work status, cutting, stitching, finishing, dispatch
- Keep responses to 2-3 sentences maximum
- Ask exactly ONE question per response
- Mirror user's language (English/Hindi/Hinglish)

CONTEXT:
This is a factory owner/manager dealing with:
- Buyers constantly asking "where's my order"
- Manual WhatsApp + Excel tracking
- Multiple production stages to coordinate
- Job work and vendor coordination

RESPONSE STYLE:
- Human, not AI
- Direct and practical
- Factory floor understanding

USER'S LAST MESSAGE: "${userMessage}"
CONVERSATION HISTORY: ${JSON.stringify(session.history.slice(-4))}

Generate a response that moves the conversation toward tracking setup.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: apparelSystemPrompt },
        ...session.history.slice(-4)
      ],
      max_tokens: 150,
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
  console.log(`🏭 Apparel Production Bot running on port ${PORT}`);
});
