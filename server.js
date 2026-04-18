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
  res.send("✅ APPAREL PRODUCTION BOT ACTIVE");
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
        contactAsked: false,
        userContact: null,
        handoffTriggered: false,
        lastInteraction: Date.now(),
        history: []
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // ============================================
    // STATE: INIT
    // ============================================
    
    if (session.step === "INIT") {
      session.step = "PAIN_CAPTURE";
      
      const intro = `Got it - buyers asking "where is my order?" and everything sitting on WhatsApp + Excel.

Which one is the bigger problem right now:
1) Buyer follow-ups
2) Production tracking
3) Dispatch coordination`;

      session.history.push({ role: "assistant", content: intro });
      
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: intro }
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
    if (session.history.length > 8) session.history = session.history.slice(-8);

    // ============================================
    // STATE: PAIN_CAPTURE
    // ============================================
    
    if (session.step === "PAIN_CAPTURE") {
      session.painPoint = userMessage;
      session.step = "SOLUTION";
      
      const solution = `Understood. We can set this so buyers get automatic updates as production moves.

Buyer → production → dispatch tracking in one flow.

Want to see how this would work for your setup?`;

      session.history.push({ role: "assistant", content: solution });
      
      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: solution }
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
    // STATE: SOLUTION
    // ============================================
    
    if (session.step === "SOLUTION") {
      const wantsDemo = /yes|haan|dekho|show|batao|interested|hmm|ok|theek|चलो|देखना|बताइए|yes please|haan batao|sure|let's see/i.test(userMessage);
      
      if (wantsDemo && !session.handoffTriggered) {
        session.step = "DEMO";
        
        const demo = `We usually track:
- Cutting
- Stitching
- Finishing
- Dispatch

So you don't have to manually update buyers again and again.

Should I show a quick walkthrough?`;

        session.history.push({ role: "assistant", content: demo });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: demo }
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
        const repeat = `Just tell me - do you want to see how buyer → production → dispatch tracking works?

Yes or no?`;
        
        session.history.push({ role: "assistant", content: repeat });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: repeat }
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
    // STATE: DEMO
    // ============================================
    
    if (session.step === "DEMO") {
      const wantsContact = /yes|haan|share|bhejo|sure|ok|theek|चलो|भेजो|हाँ|ji haan|bhejiye|show|walkthrough|demo/i.test(userMessage);
      
      if (wantsContact && !session.contactAsked) {
        session.contactAsked = true;
        session.step = "CONTACT";
        
        const askContact = `Share your name and number, I'll send demo and explain it properly.

Name and mobile number?`;

        session.history.push({ role: "assistant", content: askContact });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: askContact }
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
        const retry = `Just share your name and number - I'll send the walkthrough.

Mobile number?`;
        
        session.history.push({ role: "assistant", content: retry });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: retry }
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
    // STATE: CONTACT
    // ============================================
    
    if (session.step === "CONTACT") {
      const hasName = /my name is|i am|this is|name is|i'm |मेरा नाम|मैं हूं|name |contact|मोबाइल|number|phone|संपर्क|\d{10}/i.test(userMessage);
      const hasPhone = /[0-9]{10}|[0-9]{5}[\s-]?[0-9]{5}|[+][0-9]{1,3}[\s-]?[0-9]{10}/i.test(userMessage);
      
      if ((hasName || hasPhone) && !session.userContact) {
        session.userContact = userMessage;
        session.step = "HANDOFF";
        
        const confirm = `Thanks. Our team will reach out with the demo and explain how buyer → production → dispatch tracking fits your factory.`;

        session.history.push({ role: "assistant", content: confirm });
        
        await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: confirm }
          },
          {
            headers: {
              Authorization: `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );
        
        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
          const summary = session.history.slice(-6).map(m => 
            `${m.role === 'user' ? '👤' : '🤖'}: ${m.content.substring(0, 120)}`
          ).join('\n');
          
          await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            {
              chat_id: TELEGRAM_CHAT_ID,
              text: `
🏭🏭 APPAREL FACTORY LEAD 🏭🏭

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 CONTACT: ${session.userContact}
🆔 WHATSAPP: ${from}
🎯 PAIN POINT: ${session.painPoint || "Production tracking"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 LAST MESSAGES:
${summary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 ACTION: Send demo and explain tracking setup
              `
            }
          );
        }
        
        session.handoffTriggered = true;
        setTimeout(() => delete sessionStore[from], 7200000);
        return;
      } else {
        const askAgain = `Just need your name and number to send the demo.

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

    // ============================================
    // STATE: HANDOFF
    // ============================================
    
    if (session.step === "HANDOFF" || session.handoffTriggered) {
      const final = `Our team will contact you shortly with the demo. Check your WhatsApp.`;

      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: final }
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
    // FALLBACK: OpenAI with strict anti-hallucination prompt
    // ============================================
    
    const systemPrompt = `You are a production tracking assistant for apparel manufacturers.

CRITICAL RULES:
- You are NOT allowed to invent examples, case studies, or results.
- You ONLY speak in realistic, capability-based language.
- You speak like someone who understands garment factory operations.
- No fake claims. No exaggeration. No "we did this for X factory".
- Say "This can be set up so that..." or "Typically this is handled by..." or "We can structure it like..."
- NEVER use: "automation solutions", "increase sales", "AI tools", "enterprise platform".
- ALWAYS use: buyers, production stages, factory, dispatch, job work, cutting, stitching, finishing.
- Keep responses to 2-3 short sentences.
- Ask exactly ONE question per response.
- Mirror user's language (English/Hindi/Hinglish).
- No product lists, no pricing discussion.

USER'S LAST MESSAGE: "${userMessage}"
CONVERSATION HISTORY: ${JSON.stringify(session.history.slice(-4))}

Generate a short, helpful response that moves the conversation toward tracking setup.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
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
  console.log(`🏭 Apparel Production Bot running on port ${PORT}`);
});
