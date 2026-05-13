import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.post("/api/generate-checkout", async (req, res) => {
    let browser;
    try {
      // Menangkap accountId dari request frontend
      const { accessToken, accountId, planType } = req.body;
      
      if (!accessToken) {
        return res.status(400).json({ error: "Missing accessToken" });
      }

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--lang=id-ID,id'
        ]
      });

      const page = await browser.newPage();
      await page.emulateTimezone('Asia/Jakarta');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'X-Forwarded-For': '114.124.238.15' 
      });

      await page.goto("https://chatgpt.com/", { waitUntil: 'networkidle2' });

      // Passing accountId ke dalam context browser Puppeteer
      const data = await page.evaluate(async (token, account, plan) => {
        const payload = {
          plan_id: plan === 'business' ? 'workspace_standard' : 'plus'
        };
        
        // Kita deklarasikan type Record<string, string> agar Typescript tidak error
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "*/*",
          "Accept-Language": "id-ID,id;q=0.9",
          "Origin": "https://chatgpt.com",
          "Referer": "https://chatgpt.com/premium",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin"
        };

        // KUNCI UTAMA: Inject Account ID agar harga menjadi IDR lokal dan support GoPay
        if (account) {
          headers["ChatGPT-Account-ID"] = account;
        }
        
        const response = await fetch("https://chatgpt.com/backend-api/payments/checkout", {
          method: "POST",
          headers: headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
      }, accessToken, accountId, planType); // Eksekusi dengan 3 parameter
      
      if (data && data.url) {
        try {
          const parsedUrl = new URL(data.url);
          const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
          const sessionSegment = pathSegments[pathSegments.length - 1]; 

          if (sessionSegment && sessionSegment.startsWith('cs_live_')) {
            return res.json({ url: `https://chatgpt.com/checkout/openai_llc/${sessionSegment}` });
          }
        } catch (e) {
          console.warn("Failed to parse URL object");
        }

        const sessionMatch = data.url.match(/(cs_live_[a-zA-Z0-9]+)/);
        if (sessionMatch && sessionMatch[1]) {
          const sessionId = sessionMatch[1];
          return res.json({ url: `https://chatgpt.com/checkout/openai_llc/${sessionId}` });
        }
        return res.json({ url: data.url });
      } else if (data && data.checkout_session_id) {
        return res.json({ url: `https://chatgpt.com/checkout/openai_llc/${data.checkout_session_id}` });
      } else {
        return res.status(500).json({ error: "No URL returned from OpenAI", data });
      }
    } catch (err: any) {
      console.error("Puppeteer proxy error:", err.message);
      res.status(500).json({ error: "Puppeteer Proxy Error", details: err.message });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production delivery of React assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
