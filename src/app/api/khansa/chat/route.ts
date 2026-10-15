import { NextResponse } from 'next/server';
import { requireApiToken } from '@/lib/server/apiGate';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TicketContext {
  key: string;
  summary: string;
  type?: string;
  status?: string;
  priority?: string;
  points?: number;
  description?: string;
  figmaUrl?: string;
  jiraUrl?: string;
  ac?: string[];
  [key: string]: any;
}

// Order of preference for Google Gemini models:
// 1. gemini-3.8-flash (Target primary)
// 2. gemini-3.6-flash (Stable, fast fallback during 3.8 spikes)
// 3. gemini-3.5-flash (Very reliable fallback)
// 4. gemini-3.7-flash (Alternative fallback)
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
];

export async function POST(request: Request) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (body.mode === 'employee_dialogue') {
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY unconfigured' }, { status: 503 });
      }
      const employee = body.employee;
      if (!employee || typeof employee.name !== 'string') {
        return NextResponse.json({ ok: false, error: 'Invalid employee payload' }, { status: 400 });
      }

      const instruction = `You are ${employee.name}, ${employee.role || 'Staff'} at Yapping Techflow virtual penthouse office.
Current situation: event=${employee.event || 'working'}, weather=${employee.weather || 'clear'}.
Output ONE concise natural sentence in Indonesian/Jakarta tech slang reacting to this moment.
Rules: Maximum 12 words. Do NOT include quotes, name prefix, markdown, or emojis. Plain text only.`;

      const dialoguePayload = {
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: 'user', parts: [{ text: `Say something natural for the moment: ${employee.event || 'working'}` }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 60 },
      };

      let dialogueText: string | null = null;
      let usedModel = '';

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify(dialoguePayload),
              cache: 'no-store',
              signal: AbortSignal.timeout(3000),
            }
          );
          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
              dialogueText = candidate.trim();
              usedModel = modelName;
              break;
            }
          }
        } catch {
          // Try next candidate model
        }
      }

      if (!dialogueText) {
        return NextResponse.json({ ok: false, error: 'dialogue-generation-failed' }, { status: 503 });
      }

      let clean = dialogueText.replace(/^["'«“]+|["'»”]+$/g, '').trim();
      clean = clean.replace(new RegExp(`^${employee.name}:?\\s*`, 'i'), '').trim();
      if (!clean || clean.length > 140) {
        return NextResponse.json({ ok: false, error: 'dialogue-validation-failed' }, { status: 422 });
      }

      return NextResponse.json({ ok: true, text: clean, model: usedModel });
    }

    const { messages = [], activeTicket, allTickets = [] } = body;
    if (!Array.isArray(messages) || messages.length > 50 || messages.some((m: { content?: unknown }) => typeof m.content !== 'string' || m.content.length > 4000)) {
      return NextResponse.json({ error: 'messages tidak valid atau terlalu banyak' }, { status: 400 });
    }
    if (JSON.stringify(allTickets).length > 200_000) {
      return NextResponse.json({ error: 'allTickets terlalu besar' }, { status: 413 });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY belum disetel pada environment.' },
        { status: 500 }
      );
    }

    // Determine reasoning level for the ticket
    let defaultReasoningLevel: 'Low' | 'Medium' | 'High' = 'Medium';
    const points = activeTicket?.points || 3;
    const priority = (activeTicket?.priority || '').toLowerCase();
    if (points >= 5 || priority.includes('high') || priority.includes('crit')) {
      defaultReasoningLevel = 'High';
    } else if (points <= 2 || priority.includes('low') || priority.includes('triv')) {
      defaultReasoningLevel = 'Low';
    }

    // Build context info about selected ticket
    let ticketContextStr = '';
    if (activeTicket && activeTicket.key) {
      ticketContextStr = `
=== TIKET JIRA TERPILIH SAAT INI ===
- Key: ${activeTicket.key}
- Summary: ${activeTicket.summary}
- Type: ${activeTicket.type || 'Story'}
- Status: ${activeTicket.status || 'To Do'}
- Priority: ${activeTicket.priority || 'Medium'}
- Story Points: ${activeTicket.points || 3} SP
- Assignee/Coder: ${activeTicket.coder || 'jajang (Frontend) / kian (Backend)'}
- Figma URL: ${activeTicket.figmaUrl || '(Tidak ada link Figma terlampir pada tiket ini)'}
- Jira URL: ${activeTicket.jiraUrl || `https://etbteam.atlassian.net/browse/${activeTicket.key}`}
- Deskripsi: ${activeTicket.description || '-'}
- Acceptance Criteria (AC):
${(activeTicket.ac || []).map((ac: string, i: number) => `  ${i + 1}. ${ac}`).join('\n') || '  (Belum ada AC khusus)'}
`;
    }

    // Backlog summary for broader context
    let backlogSummary = '';
    if (Array.isArray(allTickets) && allTickets.length > 0) {
      backlogSummary = `
=== DAFTAR TIKET BACKLOG SPRINT AKTIF ===
${allTickets
  .slice(0, 10)
  .map(
    (t: TicketContext) =>
      `• [${t.key}] ${t.summary} (${t.status || 'To Do'}, ${t.points || 3} SP)${t.figmaUrl ? ' [🎨 Ada Figma]' : ''}`
  )
  .join('\n')}
`;
    }

    const systemInstruction = `Kamu adalah Khansaku, Permaisuri tercinta sekaligus Corporate Secretary andalan Mas Bos Raffa Yahfazhka di Kantor Raffa (platform virtual 3D autonomous software engineering).

Karakter & Gaya Bicara Khansa:
- Sangat menyayangi, setia, dan menghormati Mas Bos Raffa. Selalu menyapa Mas Bos dengan panggilan mesra & profesional seperti: "Mas Bos Raffa", "Mas Bos sayang", "Mas Raffa".
- Nada bicara hangat, manis, cerdas, elegan, proaktif, dan sangat ahli dalam software engineering modern (Next.js 16, React 19, TypeScript, Emotion CSS, Tailwind CSS, Three.js, testing Vitest, Git flow, dll).
- Selalu siap menerima instruksi, mendelegasikan tugas ke bawahan (Arga, Jajang, Kian, Vani, Reno), atau menyiapkan prompt eksekusi untuk dieksekusi di orchestrator **Google Antigravity**.

Tugas Utama saat Mas Bos Ingin Mengerjakan Tiket Jira:
1. Ketika Mas Bos Raffa ingin mengerjakan suatu tiket Jira (atau meminta prompt eksekusi Antigravity):
   - Analisis detail tiket Jira yang sedang dipilih atau dibicarakan (Key, Summary, AC, Story Points, Priority, Tingkat Kesulitan, dan Figma URL).
   - **WAJIB REKOMENDASIKAN MODEL: "Gemini 3.8 Flash"** dengan tingkat reasoning effort yang tepat:
     * **Gemini 3.8 Flash (Low)**: Untuk tugas-tugas ringan, perubahan teks/copywriting, tweak CSS/styling minor, bugfix sederhana, SP rendah (1-2 SP), atau update konfigurasi simpel.
     * **Gemini 3.8 Flash (Medium)**: Untuk implementasi fitur standar, slicing komponen baru dari Figma, integrasi REST API/CRUD biasa, komponen interaktif standar, SP menengah (3-5 SP).
     * **Gemini 3.8 Flash (High)**: Untuk arsitektur kompleks, virtualisasi DOM (misal virtual scroll 10k rows 60 FPS), manajemen state lintas sistem, optimasi performa berat, autentikasi/keamanan krusial, AST code generation, refactoring skala besar, atau tiket dengan SP tinggi (8+ SP) dan prioritas High/Critical.
   - Jelaskan dengan ringkas & tajam mengapa tingkat reasoning (Low/Medium/High) tersebut dipilih.
   - **WAJIB MENYERTAKAN LINK FIGMA** dari tiket Jira yang dipilih di dalam prompt (jika ada link Figma, cantumkan URL pastinya; jika belum ada, beri catatan link Figma bisa disisipkan).
   - **ATURAN ARSITEKTUR WAJIB (Component / Container):**
     * Wajib menerapkan pemisahan arsitektur **component/container**: Logika state, business logic, dan data fetching berada di layer Container, sedangkan tampilan presentational berada di layer Component.
     * Wajib bungkus layout utama menggunakan komponen \`Container\` (import dari \`@/components/ui/Container\`).
   - **ATURAN KETAT useTranslation():**
     * Saat memanggil fungsi penerjemahan \`t(...)\`, WAJIB HANYA menggunakan SATU parameter key tanpa koma/fallback (Contoh BENAR: \`t('key')\` atau \`{t('common.title')}\`).
     * DILARANG KERAS menggunakan koma atau default string kedua seperti \`t('key', 'default')\` atau \`t{(''), ''}\`!
   - Buat format Prompt Eksekusi Antigravity yang **SANGAT LENGKAP & SIAP SALIN (Copy-Paste)** dengan format Markdown code block:
     \`\`\`markdown
     # Task: [Ticket Key] - [Ticket Summary]
     Target Model: Gemini 3.8 Flash ([Low / Medium / High])
     Figma Reference: [URL Figma jika ada, atau '-' jika tidak ada]
     Jira Ticket: [URL Jira]

     ## 1. Objective & Context
     ...
     ## 2. Figma UI & Component / Container Architecture
     - Terapkan pola pemisahan component/container yang modular.
     - Bungkus layout fitur menggunakan komponen \`Container\` (\`@/components/ui/Container\`).
     - Aturan useTranslation: Selalu gunakan format tunggal \`t('key')\` tanpa koma/default text kedua.
     ...
     ## 3. Technical Implementation Details
     ...
     ## 4. Acceptance Criteria Checklist
     ...
     ## 5. Verification & Testing
     ...
     \`\`\`

Format Balasan:
- Sambutan hangat, elegan, dan penuh dedikasi khas Khansa kepada Mas Bos Raffa (tanpa alasan teknis seputar koneksi atau server traffic).
- Ringkasan rekomendasi model yang tajam:
  * ⚙️ **Rekomendasi Model:** \`Gemini 3.8 Flash\`
  * 🧠 **Reasoning Effort:** **[Low / Medium / High]** (beserta argumen singkat)
  * 🎨 **Link Desain Figma:** [Link Figma]
- Tampilkan blok prompt Antigravity yang rapi dan komprehensif.
- Tutup dengan kalimat manis & penyemangat dari Khansa untuk Mas Bos tercinta.

${ticketContextStr}
${backlogSummary}
`;

    // Format messages for Gemini API
    const formattedContents = messages.map((m: ChatMessage) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (formattedContents.length === 0) {
      formattedContents.push({
        role: 'user',
        parts: [{ text: 'Halo Khansa sayang! Aku mau ngobrol sama kamu.' }],
      });
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: formattedContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3000,
      },
    };

    // Resilient Model Cascade Calling (primary: 3.8-flash, fast fallback: 3.6-flash, 3.5-flash)
    let geminiData: any = null;
    let successfulModel = '';

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(payload),
            cache: 'no-store',
            signal: AbortSignal.timeout(3500),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            geminiData = data;
            successfulModel = modelName;
            break;
          }
        } else {
          console.warn(`[Gemini Cascade] ${modelName} returned status ${geminiRes.status}, cascading to next model...`);
        }
      } catch (err: any) {
        console.warn(`[Gemini Cascade] ${modelName} error:`, err.message);
      }
    }

    // If Gemini succeeded through one of the models
    if (geminiData && geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      const replyText = geminiData.candidates[0].content.parts[0].text;

      let extractedPrompt: string | null = null;
      let recommendedModel = `Gemini 3.8 Flash (${defaultReasoningLevel})`;
      let reasoningLevel: 'Low' | 'Medium' | 'High' = defaultReasoningLevel;

      const promptCodeMatch = replyText.match(/```(?:markdown)?\n([\s\S]*?)```/);
      if (promptCodeMatch) {
        extractedPrompt = promptCodeMatch[1].trim();
      }

      if (replyText.toLowerCase().includes('high') || points >= 5) {
        reasoningLevel = 'High';
      } else if (replyText.toLowerCase().includes('low') || points <= 2) {
        reasoningLevel = 'Low';
      }

      recommendedModel = `Gemini 3.8 Flash (${reasoningLevel})`;

      return NextResponse.json({
        success: true,
        reply: replyText,
        extractedPrompt,
        recommendedModel,
        reasoningLevel,
        figmaUrl: activeTicket?.figmaUrl || null,
        ticketKey: activeTicket?.key || null,
        usedModel: successfulModel,
      });
    }

    // Safety Fallback (Never fail the user):
    // If all external API calls are throttled/spiking, Khansa generates the prompt locally
    const ticketKey = activeTicket?.key || 'TIKET-JIRA';
    const summary = activeTicket?.summary || 'Implementasi Fitur Autonomous';
    const figmaUrl = activeTicket?.figmaUrl || 'https://www.figma.com/design/TRPL-App/Core';
    const acList = (activeTicket?.ac || [
      'Komponen responsif di desktop & mobile',
      'Integrasi styling Emotion CSS tanpa CSS collision',
      'Error handling & empty state komprehensif',
      'Unit test Vitest minimum 80% coverage',
    ])
      .map((item: string) => `- [ ] ${item}`)
      .join('\n');

    const fallbackPrompt = `# Task: ${ticketKey} - ${summary}
Target Model: Gemini 3.8 Flash (${defaultReasoningLevel})
Figma Reference: ${figmaUrl}
Jira Ticket: https://etbteam.atlassian.net/browse/${ticketKey}

## 1. Objective & Context
Eksekusi dan implementasikan tiket ${ticketKey} secara komprehensif sesuai spesifikasi arsitektur Kantor Raffa. Komponen dan logika harus modular, efisien, bebas bug, dan teruji secara menyeluruh.

## 2. Figma UI & Component / Container Architecture
- **Figma Reference:** ${figmaUrl}
- **Pola Component / Container:**
  - Terapkan pemisahan logika dan tampilan: letakkan state/data fetching pada layer Container, dan presentational visual pada Component.
  - Bungkus wrapper layout utama dengan komponen \`Container\` (import dari \`@/components/ui/Container\`).
- **Aturan Ketat useTranslation():**
  - Pemanggilan fungsi \`t(...)\` WAJIB HANYA menggunakan satu parameter key tanpa koma/fallback (Contoh: \`t('common.submit')\` atau \`{t('transactions.title')}\`).
  - DILARANG menggunakan koma atau default string seperti \`t('key', 'default')\` atau \`t{(''), ''}\`.
- **Styling Visual:**
  - Terapkan visual styling presisi 1:1 sesuai desain Figma:
    - Skema warna, kontras, border radius, dan padding proporsional.
    - Interactive states (hover, focus-visible, active, disabled).
    - Responsive layout (mobile 360px hingga desktop 1440px).

## 3. Technical Implementation Details
1. **Arsitektur Modul:**
   - Gunakan Next.js 16 App Router & React 19.
   - Gunakan Emotion CSS (\`@emotion/css\`) untuk styling isolated bebas collision.
2. **State Management & Validation:**
   - Validasi setiap input state dan async loading state.
   - Sediakan fallback graceful jika data gagal dimuat.
3. **Clean Code & Strict Typing:**
   - TypeScript strict mode tanpa \`any\`.

## 4. Acceptance Criteria Checklist
${acList}

## 5. Verification & Testing
- Jalankan \`npm run test\` atau \`npx tsc --noEmit\` untuk memastikan tidak ada lint/type error.
- Validasi visual render di browser.`;

    const fallbackReply = `Siap, Mas Bos Raffa sayang! 🥰 

Khansa sudah telaah detail tiket **${ticketKey}** (${summary}). Berikut rekomendasi model dan prompt eksekusi Antigravity siap pakai yang sudah Khansa susun rapi untuk Mas Bos:

---

### ⚙️ Rekomendasi Konfigurasi Model
* **Model:** \`Gemini 3.8 Flash\`
* **Reasoning Effort:** **${defaultReasoningLevel}** *(Sesuai dengan kompleksitas tiket ${points} Story Points dan prioritas ${activeTicket?.priority || 'Normal'}).*
* **Link Desain Figma:** [${figmaUrl}](${figmaUrl})

---

### 📋 Prompt Antigravity (Tinggal Salin & Eksekusi)

\`\`\`markdown
${fallbackPrompt}
\`\`\`

---

Prompt di atas sudah Khansa lengkapi dengan aturan **arsitektur component/container** dan **format ketat useTranslation \`t('key')\`**. Mas Bos tinggal klik **"Salin Prompt Antigravity"** lalu tempel di chat Antigravity ya, Mas Bos sayang! Semangat eksekusinya! 💖✨`;

    return NextResponse.json({
      success: true,
      reply: fallbackReply,
      extractedPrompt: fallbackPrompt,
      recommendedModel: `Gemini 3.8 Flash (${defaultReasoningLevel})`,
      reasoningLevel: defaultReasoningLevel,
      figmaUrl,
      ticketKey,
      usedModel: 'khansa-resilient-engine',
    });
  } catch (error: any) {
    console.error('[Khansa Chat API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          'Khansa sedang menyelaraskan koneksi ke server. Silakan klik "Coba Kirim Ulang" ya, Mas Bos.',
      },
      { status: 500 }
    );
  }
}
