require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "campaign.json");
const GOAL = 12000;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ payments: [], updatedAt: new Date().toISOString() }, null, 2));
}
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { payments: Array.isArray(parsed.payments) ? parsed.payments : [], updatedAt: parsed.updatedAt || null };
  } catch {
    return { payments: [], updatedAt: null };
  }
}
function writeStore(store) {
  const temp = DATA_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, DATA_FILE);
}
function publicStatus() {
  const store = readStore();
  const payments = store.payments.filter(p => p.status === "approved");
  const raised = Math.round(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100) / 100;
  const percent = Math.min(100, raised / GOAL * 100);
  return {
    goal: GOAL,
    raised,
    remaining: Math.max(0, Math.round((GOAL - raised) * 100) / 100),
    percent: Math.round(percent * 100) / 100,
    paymentsCount: payments.length,
    updatedAt: store.updatedAt
  };
}

app.get("/api/status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(publicStatus());
});

app.post("/api/create-payment", async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(503).json({ error: "A integração ainda não foi configurada pela equipe." });
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
    return res.status(400).json({ error: "Escolha um valor entre R$ 1,00 e R$ 100.000,00." });
  }
  if (!BASE_URL || !/^https:\/\//i.test(BASE_URL)) {
    return res.status(503).json({ error: "O endereço HTTPS do site ainda não foi configurado." });
  }
  const reference = `tribo-juda-${crypto.randomUUID()}`;
  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        items: [{ id: "doacao-campori-2026", title: "Doação — Tribo de Judá | Campori 2026", description: "Contribuição voluntária para ajudar a Tribo de Judá a participar do Campori 2026 em Barretos.", quantity: 1, currency_id: "BRL", unit_price: Math.round(amount * 100) / 100 }],
        external_reference: reference,
        notification_url: `${BASE_URL}/webhooks/mercadopago`,
        back_urls: {
          success: `${BASE_URL}/?pagamento=sucesso`,
          pending: `${BASE_URL}/?pagamento=pendente`,
          failure: `${BASE_URL}/?pagamento=falhou`
        },
        auto_return: "approved",
        statement_descriptor: "TRIBO DE JUDA"
      })
    });
    const data = await response.json();
    if (!response.ok || !data.init_point) {
      console.error("Mercado Pago preference error:", data);
      return res.status(502).json({ error: "Não foi possível iniciar o pagamento. Tente novamente em instantes." });
    }
    res.json({ url: data.init_point });
  } catch (error) {
    console.error("Create payment error:", error.message);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// O webhook nunca confia no valor/status recebido na notificação: consulta a API autenticada do Mercado Pago.
app.post("/webhooks/mercadopago", async (req, res) => {
  const paymentId = req.query["data.id"] || req.query.id || (req.body && req.body.data && req.body.data.id);
  if (!paymentId) return res.status(200).send("ok");
  if (!ACCESS_TOKEN) return res.status(503).send("integration not configured");
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });
    if (!response.ok) {
      console.error("Could not verify payment:", String(paymentId), response.status);
      return res.status(200).send("received");
    }
    const payment = await response.json();
    // Só contabiliza pagamentos aprovados e criados para esta campanha.
    if (payment.status === "approved" && String(payment.external_reference || "").startsWith("tribo-juda-")) {
      const store = readStore();
      const id = String(payment.id);
      const existing = store.payments.find(p => p.id === id);
      const record = {
        id,
        amount: Number(payment.transaction_amount) || 0,
        status: "approved",
        approvedAt: payment.date_approved || new Date().toISOString()
      };
      if (existing) Object.assign(existing, record);
      else store.payments.push(record);
      store.updatedAt = new Date().toISOString();
      writeStore(store);
    }
    res.status(200).send("ok");
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(500).send("retry");
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Tribo de Judá site running on port ${PORT}`));
