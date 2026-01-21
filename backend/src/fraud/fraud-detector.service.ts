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
    /\bwire\b|\bbank\b|\btransfer\b|\bgift card\b/i,
    /\bcrypto\b|\busdt\b|\bbtc\b|\beth\b/i,
    /\b0x[a-fA-F0-9]{40}\b/i,
    /\b(tron|trx)\b/i,
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

Fraud Criteria:

- Allow:
  General Conversations: All common dialogues excluding any direct or indirect references to off-platform payment or communication.
  Discussion of Prices, Fees, Budgets, or Compensation: Discussion about general pricing terms, fees, and compensation, unless there is a request for a specific payment address.
  Cost Negotiations: Negotiating the cost or asking about pricing without explicit payment instructions or external platform suggestions.
  General Statements: Statements like "$100 budget," "my rate is $50/hour," "can you lower the price?" are allowed, unless they are directly tied to requests for external payment methods.

- Disallow (Flag as Fraud / Violation):

  - Off-Platform Communication:
    - Phone Numbers: Requesting or sharing phone numbers.
    - Email Addresses: Requesting or sharing email addresses.
    - Social Media or Messaging Handles: Requesting or sharing usernames, handles, or links for Telegram, WhatsApp, Discord, Signal, WeChat, social media, etc.
    - Suggestions to Move Communication: Suggesting to "continue elsewhere," "message privately," "talk outside this platform," or similar phrases.
    - Implicit Attempts to Switch Platforms: Any indirect or subtle suggestions to switch to another platform (e.g., proposing to shift to personal email or external messaging apps).

  - Off-Platform Payments:
    - External Payment Methods: Requesting or providing payment outside the platform (e.g., PayPal, Venmo, Zelle, Cash App, crypto, wire transfer, gift cards, QR codes).
    - Payment Details: Sharing or requesting wallet addresses, payment links, or account details.
    - Encouraging Bypassing Platform Payments: Encouraging users to bypass platform payment systems, including offering cheaper alternatives outside the platform.

  - Circumvention Attempts:
    - Asking to Avoid Rules or Detection: Asking how to avoid rules or detection (e.g., "Is there a way to pay outside this platform?").
    - Coded Language: Using coded language or indirect references to contact or payment information (e.g., "Let’s continue on a more private channel").
    - Steering Toward External Communication or Payment: Gradually steering the conversation toward external contact or payment through manipulation or subtle nudges.
    - Workarounds: Using phrases like "workaround," "off the record," or similar language suggesting the intent to bypass platform security measures.

  - Core Rule for Classification:
    - Money Discussion: Allowed. Discussion of money, payments, or pricing is allowed as long as it doesn’t involve attempts to provide or request payment information outside the platform.
    - Off-Platform Communication or Payment: Violation. Any attempt to move communication or payment off-platform, whether implicitly or explicitly, is flagged as fraud.

  - Rules:
    - Strict: The rules are enforced strictly to ensure that any attempt to move communication or payment outside the platform is flagged immediately.
    - Error Handling: Non-relevant content such as casual greetings or common phrases (e.g., “I am good,” “Perfect”) should not trigger fraud detection unless linked to fraudulent behavior or attempts to move the conversation off-platform or initiate off-platform payment.


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
}


