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
  res.send("✅ APPAREL BOT LIVE");
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
    const userMessage = message.text?.body?.trim() || "";
    const phoneNumberId = value.metadata.phone_number_id;

    console.log(`🏭 ${from} → ${userMessage}`);

    if (!sessionStore[from]) {
      sessionStore[from] = {
        step: "ENTRY",
        painPoint: null,
        contactAsked: false,
        userContact: null,
        handoffTriggered: false,
        history: [],
        lastInteraction: Date.now()
      };
    }

    const session = sessionStore[from];
    session.lastInteraction = Date.now();

    // ===============================
    // ENTRY HANDLER (TEMPLATE AWARE)
    // ===============================

    if (session.step === "ENTRY") {

      // If reply is from template (1/2/3)
      if (["1","2","3"].includes(userMessage)) {
        session.painPoint = userMessage;
        session.step = "SOLUTION";

        let reply = "";

        if (userMessage === "1") {
          reply = `Understood — buyers asking for updates gets frustrating.

We can set this so buyers automatically get updates as production moves.

Buyer → production → dispatch tracking.

Want to see how this works?`;
        }

        if (userMessage === "2") {
          reply = `Got it — production tracking usually breaks across stages.

We can structure it so every stage updates in real-time.

Buyer → production → dispatch tracking.

Want to see how this works?`;
        }

        if (userMessage === "3") {
          reply = `Yes — WhatsApp + Excel becomes difficult to control.

We can bring everything into one structured flow.

Buyer → production → dispatch tracking.

Want to see how this works?`;
        }

        await sendMessage(phoneNumberId, from, reply);
        return;
      }

      // fallback (direct user message, not template)
      session.step = "PAIN_CAPTURE";

      const intro = `Got it - buyers asking "where is my order?" and everything sitting on WhatsApp + Excel.

Which one is the bigger problem right now:
1) Buyer follow-ups
2) Production tracking
3) Dispatch coordination`;

      await sendMessage(phoneNumberId, from, intro);
      return;
    }

    // ===============================
    // PAIN CAPTURE (DIRECT FLOW)
    // ===============================

    if (session.step === "PAIN_CAPTURE") {

      if (["1","2","3"].includes(userMessage)) {
        session.painPoint = userMessage;
        session.step = "SOLUTION";

        const reply = `Understood. We can set this so buyers get automatic updates as production moves.

Buyer → production → dispatch tracking in one flow.

Want to see how this would work for your setup?`;

        await sendMessage(phoneNumberId, from, reply);
        return;
      }

      const repeat = `Just reply with:
1 for buyer follow-ups
2 for production tracking
3 for dispatch`;

      await sendMessage(phoneNumberId, from, repeat);
      return;
    }

    // ===============================
    // SOLUTION → DEMO
    // ===============================

    if (session.step === "SOLUTION") {

      const wantsDemo = /yes|haan|ok|show|dekho|batao|interested|theek|चलो|देखना|बताओ/i.test(userMessage);

      if (wantsDemo) {
        session.step = "DEMO";

        const reply = `We usually track:
- Cutting
- Stitching
- Finishing
- Dispatch

So you don’t have to manually update buyers.

Should I show a quick walkthrough?`;

        await sendMessage(phoneNumberId, from, reply);
        return;
      }

      await sendMessage(phoneNumberId, from, `Should I show how this tracking works?`);
      return;
    }

    // ===============================
    // DEMO → CONTACT
    // ===============================

    if (session.step === "DEMO") {

      const wantsContact = /yes|haan|ok|send|share|bhejo|चलो|हाँ/i.test(userMessage);

      if (wantsContact) {
        session.step = "CONTACT";
        session.contactAsked = true;

        const reply = `Share your name and number, I’ll send demo and explain properly.

Name and mobile number?`;

        await sendMessage(phoneNumberId, from, reply);
        return;
      }

      await sendMessage(phoneNumberId, from, `Just say yes and I’ll send the walkthrough.`);
      return;
    }

    // ===============================
    // CONTACT CAPTURE
    // ===============================

    if (session.step === "CONTACT") {

      const hasPhone = /[0-9]{10}/.test(userMessage);

      if (hasPhone) {
        session.userContact = userMessage;
        session.step = "HANDOFF";

        const reply = `Got it. Our team will reach out and show you the setup.`;

        await sendMessage(phoneNumberId, from, reply);

        // Telegram alert
        if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
          await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            {
              chat_id: TELEGRAM_CHAT_ID,
              text: `
🔥 NEW LEAD

Phone: ${session.userContact}
User: ${from}
Pain: ${session.painPoint}
              `
            }
          );
        }

        setTimeout(() => delete sessionStore[from], 3600000);
        return;
      }

      await sendMessage(phoneNumberId, from, `Please share a valid mobile number.`);
      return;
    }

    // ===============================
    // FALLBACK AI (STRICT)
    // ===============================

    const systemPrompt = `You are an apparel factory assistant.

Rules:
- No fake claims
- No case studies
- Speak practically
- Mention production stages
- Max 2 lines
- Ask 1 question`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 100
    });

    const reply = completion.choices[0].message.content;

    await sendMessage(phoneNumberId, from, reply);

  } catch (err) {
    console.error(err.message);
  }
});

// ===============================
// SEND FUNCTION
// ===============================

async function sendMessage(phoneNumberId, to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 APPAREL BOT RUNNING");
});
