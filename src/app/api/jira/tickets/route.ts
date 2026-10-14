import { NextResponse } from 'next/server';
import { TICKETS } from '@/lib/data/tickets';
import { requireApiToken } from '@/lib/server/apiGate';

export async function GET(request: Request) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  const domain = process.env.JIRA_DOMAIN || 'etbteam.atlassian.net';
  const email = process.env.JIRA_EMAIL || 'raffa.yahfazhka@etb.co.id';
  const apiToken = process.env.JIRA_API_TOKEN;

  // Fallback helper with TECH-777 guaranteed at the top
  const getFallbackTickets = () => {
    const tech777 = TICKETS.find((t) => t.key === 'TECH-777');
    if (tech777) {
      return [tech777, ...TICKETS.filter((t) => t.key !== 'TECH-777')];
    }
    return TICKETS;
  };

  if (!apiToken) {
    return NextResponse.json({
      success: true,
      source: 'fallback',
      total: TICKETS.length,
      tickets: getFallbackTickets(),
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectKey = searchParams.get('project');
    const onlyMe = searchParams.get('onlyMe') !== 'false';

    const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;

    let jql = '';
    if (onlyMe) {
      if (projectKey && projectKey !== 'all') {
        jql = `project = "${projectKey}" AND assignee = currentUser() ORDER BY updated DESC`;
      } else {
        jql = `assignee = currentUser() ORDER BY updated DESC`;
      }
    } else {
      if (projectKey && projectKey !== 'all') {
        jql = `project = "${projectKey}" ORDER BY updated DESC`;
      } else {
        jql = `updated >= -180d ORDER BY updated DESC`;
      }
    }

    const res = await fetch(`https://${domain}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql,
        maxResults: 50,
        fields: ['summary', 'description', 'issuetype', 'priority', 'status', 'project', 'assignee'],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn('[Jira API Warning] Live fetch returned status', res.status, '- using fallback tickets');
      return NextResponse.json({
        success: true,
        source: 'fallback',
        total: TICKETS.length,
        tickets: getFallbackTickets(),
      });
    }

    const data = await res.json();

    const extractText = (node: any): string => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (node.text) return node.text;
      if (Array.isArray(node.content)) {
        return node.content.map(extractText).join(' ');
      }
      return '';
    };

    const extractFigmaUrl = (node: any): string | null => {
      if (!node) return null;
      if (node.type === 'inlineCard' && node.attrs?.url && node.attrs.url.includes('figma.com')) {
        return node.attrs.url;
      }
      if (node.marks && Array.isArray(node.marks)) {
        for (const mark of node.marks) {
          if (mark.type === 'link' && mark.attrs?.href && mark.attrs.href.includes('figma.com')) {
            return mark.attrs.href;
          }
        }
      }
      if (node.text && typeof node.text === 'string' && node.text.includes('figma.com')) {
        const match = node.text.match(/https:\/\/(www\.)?figma\.com\/[^\s)]+/);
        if (match) return match[0];
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          const found = extractFigmaUrl(child);
          if (found) return found;
        }
      }
      return null;
    };

    const extractAcItems = (descriptionNode: any): string[] => {
      const items: string[] = [];
      const traverse = (node: any) => {
        if (!node) return;
        if (node.type === 'listItem' || node.type === 'taskItem') {
          const text = extractText(node).trim();
          if (text) items.push(text);
          return;
        }
        if (Array.isArray(node.content)) {
          node.content.forEach(traverse);
        }
      };
      traverse(descriptionNode);
      return items;
    };

    const parsedTickets = (data.issues || []).map((issue: any) => {
      const typeName = issue.fields.issuetype?.name || 'Task';
      const isBug = typeName.toLowerCase().includes('bug');
      const isFE = (issue.fields.summary || '').toUpperCase().includes('[FE]');
      const coder = isFE ? 'jajang' : 'kian';

      const desc = issue.fields.description ? extractText(issue.fields.description) : '';
      const figmaUrl = issue.fields.description ? extractFigmaUrl(issue.fields.description) : null;
      let acItems = issue.fields.description ? extractAcItems(issue.fields.description) : [];

      if (acItems.length === 0) {
        acItems = [
          `Implementasi fitur/fix sesuai summary: "${issue.fields.summary || issue.key}"`,
          'Unit & integration tests passing di CI pipeline',
          'Code review lolos linting & pixel/schema check',
        ];
      }

      return {
        key: issue.key,
        summary: issue.fields.summary || 'Untitled issue',
        type: ['Story', 'Bug', 'Task'].includes(typeName) ? typeName : 'Task',
        priority: issue.fields.priority?.name || 'Medium',
        status: issue.fields.status?.name || 'To Do',
        description: desc.slice(0, 400),
        projectName: issue.fields.project?.name || 'General',
        projectKey: issue.fields.project?.key || 'JIRA',
        repo: 'frontend-dashboard-v2',
        points: isBug ? 2 : 5,
        coder,
        figmaUrl: figmaUrl || null,
        ac: acItems,
        plan: [
          'Arga: Scan codebase & susun dependency graph',
          `${coder === 'jajang' ? 'jajang' : 'Kian'}: Implementasi kode & schema`,
          'Vani: Run test suite & static code analysis',
        ],
        files: [
          {
            path: `src/features/${issue.key.toLowerCase()}.ts`,
            status: 'modified',
            diff: `@@ -1,5 +1,12 @@\n+// Implemented for Jira ticket ${issue.key}: ${issue.fields.summary}\n+export async function handle${issue.key.replace('-', '')}() {\n+  return { success: true, timestamp: Date.now() };\n+}`,
          },
        ],
        tests: [
          `${issue.key} › validasi business logic`,
          `${issue.key} › error boundaries & null handling`,
          `${issue.key} › e2e acceptance criteria pass`,
        ],
      };
    });

    // If live Jira returns 0 issues, fallback to mock backlog with TECH-777
    let finalTickets = parsedTickets;
    if (finalTickets.length === 0) {
      finalTickets = getFallbackTickets();
    } else {
      const tech777 = TICKETS.find((t) => t.key === 'TECH-777');
      if (tech777 && !finalTickets.some((t: any) => t.key === 'TECH-777')) {
        finalTickets = [tech777, ...finalTickets];
      }
    }

    return NextResponse.json({
      success: true,
      source: parsedTickets.length > 0 ? 'jira_live' : 'fallback',
      total: finalTickets.length,
      tickets: finalTickets,
    });
  } catch (err: any) {
    console.warn('[Jira API Caught Error]', err.message, '- falling back to mock tickets');
    return NextResponse.json({
      success: true,
      source: 'fallback',
      total: TICKETS.length,
      tickets: getFallbackTickets(),
    });
  }
}
