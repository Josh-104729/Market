import { Injectable, Logger } from '@nestjs/common';
import { FraudDecision } from './fraud.types';

@Injectable()
export class FraudDetectorService {
  private readonly logger = new Logger(FraudDetectorService.name);

  // Mirrors the Python heuristics for chat text
  private readonly suspiciousRegexes: RegExp[] = [
    /https?:\/\//i,
    /\btelegram\b|\bt\.me\b|\btelegram\.me\b/i,
    /\bwhatsapp\b|\bwa\.me\b/i,
    /\bdiscord\b|\bdiscord\.gg\b/i,
    /\b0x[a-fA-F0-9]{40}\b/i,
    /\bseed phrase\b|\bprivate key\b/i,
  ];

  private readonly offPlatformKeywords = ['telegram', 'whatsapp', 'discord', 't.me', 'wa.me'];

  private clampText(s: string, limit: number) {
    if (s.length <= limit) return s;
    return s.slice(0, limit) + '…';
  }

  private quickSignalsFromText(text: string): string[] {
    const signals: string[] = [];
    const t = text || '';

    for (const re of this.suspiciousRegexes) {
      if (re.test(t)) {
        signals.push(`regex:${re.source}`);
      }
    }

    return signals;
  }

  private buildSystemPrompt(): string {
    // Ported from fraud detection/detector.py
    return `
You are a fraud detection engine for a real-time chat platform.

-Task

  -Analyze chat messages to determine whether they contain fraudulent behavior according to the platform rules below.
  - A message is considered fraudulent ONLY IF it contains:
    - Attempts at external/off-platform communication, or
    - Attempts at external/off-platform payment
    - Everything else is allowed.

1. External Communication (Fraud)
  Flag a message as fraud if it attempts to move communication outside the platform, including but not limited to:
    - Phone numbers (calls or SMS)
    - Email addresses
    - External messaging apps or platforms (e.g., WhatsApp, Telegram, WeChat, Signal, Discord)
    - Requests to continue the conversation off-platform(e.g., “Let’s talk elsewhere”, “Contact me directly”)
    - Social media links or handles EXCEPT for LinkedIn
    - If there is a "@" symbol that is used in telegram id, gmail, and etc, make it fraud but make confidence low.

  Explicit Exception (Allowed)
  The following must NOT be flagged as fraud:
    - Sharing LinkedIn profile URLs or LinkedIn identifiers (e.g., linkedin.com/in/...)
    - Mentioning LinkedIn without requesting off-platform communication

  ⚠️ Important:
  - Email addresses and phone numbers are NOT allowed, even if shared as personal information.
  - Any request to communicate via LinkedIn messages outside the platform may still be considered fraud if it explicitly asks to move the conversation off-platform.

2. External Payment Attempts (Fraud)
  Flag messages that involve payment outside the platform’s approved payment system, including:
    - Offers to send or receive money externally
    - Mention or sharing of external payment methods:
      - PayPal
      - Bank or wire transfers
      - Venmo, Cash App, Zelle
      - Cryptocurrency (wallets, addresses, tokens)
      - Sharing payment details or instructions
      Examples:
    - “Pay me via PayPal”
    - “Send USDT to this wallet”
    - “I’ll transfer the money directly”
    - “There is a way to pay without using this platform”
  

  Allowed Content (Do NOT Flag)
    The following content is explicitly allowed and must NOT be considered fraud:
    - Sharing sensitive personal information such as:
      - Driver’s License (DL)
      - Social Security Number (SSN)
      - Physical or mailing address
      - Date of birth
    - Sharing LinkedIn profile links
    - Any conversation that stays fully on-platform
    - Any content unrelated to external communication or external payment
    - when the content relates to payment, unless it is direct wallet address or direct outside payment request. make the confidence low.(in the case of bank address, it can be created for customer. consider carefully) 

Output format (exact):
{"fraud": true|false, "category": "string or null", "reason": "short string or null", "confidence": "low|medium|high"}
`.trim();
  }

  private async openaiClassify(normalizedContent: string): Promise<FraudDecision> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL_TEXT || 'gpt-4.1-mini';
    const conservative = (process.env.CONSERVATIVE_IF_UNCERTAIN || 'true').toLowerCase() === 'true';
    const maxChars = parseInt(process.env.MAX_TEXT_CHARS || '8000', 10);

    if (!apiKey) {
      return {
        fraud: false,
        category: null,
        reason: null,
        confidence: 'low',
        signals: ['openai_key_missing'],
      };
    }

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt() },
            { role: 'user', content: `Analyze this content:\n${this.clampText(normalizedContent, maxChars)}` },
          ],
        }),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        this.logger.warn(`OpenAI classify failed: ${resp.status} ${resp.statusText} ${body}`);
        return conservative
          ? { fraud: true, category: 'uncertain', reason: 'Unable to validate content safely.', confidence: 'low', signals: ['openai_http_error'] }
          : { fraud: false, category: null, reason: null, confidence: 'low', signals: ['openai_http_error'] };
      }

      const data: any = await resp.json();
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      const obj = JSON.parse(text);

      const confidence = obj?.confidence === 'low' || obj?.confidence === 'medium' || obj?.confidence === 'high'
        ? obj.confidence
        : (conservative ? 'low' : 'medium');

      return {
        fraud: Boolean(obj?.fraud),
        category: obj?.category ?? null,
        reason: obj?.reason ?? null,
        confidence,
        signals: [],
      };
    } catch (e: any) {
      this.logger.warn(`OpenAI classify exception: ${e?.message || e}`);
      return (process.env.CONSERVATIVE_IF_UNCERTAIN || 'true').toLowerCase() === 'true'
        ? { fraud: true, category: 'uncertain', reason: 'Unable to validate content safely.', confidence: 'low', signals: ['json_parse_failed'] }
        : { fraud: false, category: null, reason: null, confidence: 'low', signals: ['json_parse_failed'] };
    }
  }

  async decideText(message: string): Promise<FraudDecision> {
    const maxChars = parseInt(process.env.MAX_TEXT_CHARS || '8000', 10);
    const msg = (message || '').trim();

    if (!msg) {
      return { fraud: false, category: null, reason: null, confidence: 'high', signals: ['empty_message'] };
    }

    const clipped = this.clampText(msg, maxChars);
    const signals = this.quickSignalsFromText(clipped);

    // HARD BLOCK: off-platform redirection (no AI)
    const lower = clipped.toLowerCase();
    if (this.offPlatformKeywords.some((k) => lower.includes(k))) {
      return {
        fraud: true,
        category: 'off_platform_redirect',
        reason: 'Off-platform contact request detected.',
        confidence: 'high',
        signals,
      };
    }

    const alwaysClassify = (process.env.FRAUD_ALWAYS_CLASSIFY || 'false').toLowerCase() === 'true';
    const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

    if (!alwaysClassify && !hasOpenAi) {
      // Heuristic-only fallback: if we saw suspicious signals, flag it.
      if (signals.length > 0) {
        return {
          fraud: true,
          category: 'suspicious_text',
          reason: 'Suspicious patterns detected.',
          confidence: 'medium',
          signals,
        };
      }
      return { fraud: false, category: null, reason: null, confidence: 'high', signals: ['no_signals'] };
    }

    if (!hasOpenAi && alwaysClassify) {
      // Can't classify without a key; fall back to conservative heuristic.
      return signals.length > 0
        ? { fraud: true, category: 'suspicious_text', reason: 'Suspicious patterns detected.', confidence: 'low', signals: ['openai_key_missing', ...signals] }
        : { fraud: false, category: null, reason: null, confidence: 'low', signals: ['openai_key_missing'] };
    }

    const normalized = `Content type: TEXT\nMessage:\n${clipped}\nSignals:\n${signals.join('\n')}`;
    const d = await this.openaiClassify(normalized);
    d.signals = signals;
    return d;
  }

  /**
   * Analyze an image for fraud detection using OpenAI Vision API
   * @param imageUrl - URL of the image to analyze
   * @returns FraudDecision indicating if the image contains fraudulent content
   */
  async decideImage(imageUrl: string): Promise<FraudDecision> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL_VISION || 'gpt-4o';
    const conservative = (process.env.CONSERVATIVE_IF_UNCERTAIN || 'true').toLowerCase() === 'true';

    if (!apiKey) {
      return {
        fraud: false,
        category: null,
        reason: null,
        confidence: 'low',
        signals: ['openai_key_missing'],
      };
    }

    try {
      // Build system prompt for image analysis
      const systemPrompt = `
You are a fraud detection engine for a real-time chat platform analyzing images.

Task: Analyze images to determine if they contain fraudulent behavior according to platform rules.

A image is considered fraudulent ONLY IF it contains:
1. External Communication Attempts:
   - Phone numbers (calls or SMS)
   - Email addresses
   - External messaging app QR codes or links (WhatsApp, Telegram, WeChat, Signal, Discord)
   - Social media links or handles EXCEPT LinkedIn
   - Requests to continue conversation off-platform

2. External Payment Attempts:
   - Payment QR codes (PayPal, Venmo, Cash App, Zelle, etc.)
   - Cryptocurrency wallet addresses or QR codes
   - Bank account details
   - Instructions for external payment

Allowed Content (Do NOT Flag):
   - Personal identification documents (Driver's License, SSN, etc.)
   - LinkedIn profile information
   - On-platform content
   - General images unrelated to external communication or payment

Output format (exact JSON):
{"fraud": true|false, "category": "string or null", "reason": "short string or null", "confidence": "low|medium|high"}
`.trim();

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image for fraudulent content according to the rules. Look for external communication attempts, payment methods, QR codes, phone numbers, email addresses, or any off-platform redirection.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        this.logger.warn(`OpenAI image classify failed: ${resp.status} ${resp.statusText} ${body}`);
        return conservative
          ? { fraud: true, category: 'uncertain', reason: 'Unable to validate image safely.', confidence: 'low', signals: ['openai_http_error'] }
          : { fraud: false, category: null, reason: null, confidence: 'low', signals: ['openai_http_error'] };
      }

      const data: any = await resp.json();
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      const obj = JSON.parse(text);

      const confidence = obj?.confidence === 'low' || obj?.confidence === 'medium' || obj?.confidence === 'high'
        ? obj.confidence
        : (conservative ? 'low' : 'medium');

      return {
        fraud: Boolean(obj?.fraud),
        category: obj?.category ?? null,
        reason: obj?.reason ?? null,
        confidence,
        signals: ['image_analysis'],
      };
    } catch (e: any) {
      this.logger.warn(`OpenAI image classify exception: ${e?.message || e}`);
      return (process.env.CONSERVATIVE_IF_UNCERTAIN || 'true').toLowerCase() === 'true'
        ? { fraud: true, category: 'uncertain', reason: 'Unable to validate image safely.', confidence: 'low', signals: ['image_parse_failed'] }
        : { fraud: false, category: null, reason: null, confidence: 'low', signals: ['image_parse_failed'] };
    }
  }
}


