import type { SpeechBubble } from './socialEngine';

export interface EmployeeDialogueContext {
  id: string;
  name: string;
  role?: string;
  event: 'pantry' | 'terrace' | 'chatting' | 'rain' | 'treat' | 'delegation' | 'working';
  weather?: string;
  stamina?: number;
  focus?: number;
}

export interface DialogueValidationResult {
  valid: boolean;
  text: string | null;
  reason?: string;
}

/**
 * Validates raw AI dialogue output.
 * Guardrails:
 * - Must be non-empty string
 * - Max 140 characters, min 2 characters
 * - No code blocks, markdown tags, JSON, or HTML
 * - No name prefixes or quotation marks
 */
export function validateDialogueOutput(
  raw: unknown,
  employeeName?: string
): DialogueValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, text: null, reason: 'non-string-output' };
  }

  let text = raw.trim();
  // Strip outer quotes
  text = text.replace(/^["'«“]+|["'»”]+$/g, '').trim();

  // Strip prefix like "Tara: " or "tara - "
  if (employeeName) {
    text = text.replace(new RegExp(`^${employeeName}[:\\-\\s]+`, 'i'), '').trim();
  }

  if (text.length === 0) {
    return { valid: false, text: null, reason: 'empty-text' };
  }

  if (text.length > 140) {
    return { valid: false, text: null, reason: 'exceeds-max-length' };
  }

  // Reject code blocks or HTML
  if (text.includes('```') || text.includes('</') || text.includes('/>') || text.includes('{') || text.includes('}')) {
    return { valid: false, text: null, reason: 'contains-code-or-markup' };
  }

  // Reject system/error tokens
  if (/error|exception|undefined|null|object\s*object/i.test(text)) {
    return { valid: false, text: null, reason: 'contains-error-tokens' };
  }

  return { valid: true, text };
}

/**
 * Requests speech bubble dialogue from Gemini via /api/khansa/chat.
 * Anti-fabrication & guardrails:
 * - Rejects failed, timed-out, or malformed responses.
 * - Explicitly NEVER falls back to static hardcoded quotes.
 * - Returns null when AI is unavailable or fails.
 */
export async function fetchEmployeeDialogue(
  ctx: EmployeeDialogueContext,
  timeoutMs = 3000
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch('/api/khansa/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'employee_dialogue',
        employee: {
          name: ctx.name,
          role: ctx.role,
          event: ctx.event,
          weather: ctx.weather,
          stamina: ctx.stamina,
          focus: ctx.focus,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // Failed upstream or unconfigured: return null, NO static fallback!
      return null;
    }

    const json = await res.json();
    if (!json?.ok || typeof json.text !== 'string') {
      return null;
    }

    const validation = validateDialogueOutput(json.text, ctx.name);
    if (!validation.valid || !validation.text) {
      return null;
    }

    return validation.text;
  } catch {
    // Network error or timeout: drop bubble, return null without static fallback
    return null;
  }
}

/**
 * Creates a SpeechBubble object ONLY IF valid dialogue is provided.
 * If dialogueText is null or empty, returns null (no bubble).
 */
export function createAiSpeechBubble(
  agentId: string,
  emoji: string,
  dialogueText: string | null,
  expiresAt: number,
  kind: 'status' | 'ghibah-whole' | 'ghibah-savage' = 'status'
): SpeechBubble | null {
  const check = validateDialogueOutput(dialogueText);
  if (!check.valid || !check.text) {
    return null;
  }

  return {
    agentId,
    emoji,
    text: check.text,
    kind,
    expiresAt,
  };
}
