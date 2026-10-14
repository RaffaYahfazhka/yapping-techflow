import { NextResponse } from 'next/server';
import { requireApiToken } from '@/lib/server/apiGate';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// Local-only gate: this route can run git commands and push to remotes.
// It is inert unless the operator explicitly opts in on their own machine.
const LOCAL_MODE = process.env.KANTOR_LOCAL_MODE === '1';
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,100}$/;
// https-only to well-known git hosts; blocks ssh option injection and typosquats.
const SAFE_REMOTE_RE = /^https:\/\/(github\.com|gitlab\.com)\/[A-Za-z0-9._~-]+\/[A-Za-z0-9._~-]+(\.git)?$|^git@(github\.com|gitlab\.com):[A-Za-z0-9._~-]+\/[A-Za-z0-9._~-]+(\.git)?$/;

function localOnly() {
  return NextResponse.json({ error: 'Local-only: set KANTOR_LOCAL_MODE=1' }, { status: 403 });
}

function isSafeBranch(name) {
  return typeof name === 'string' && BRANCH_RE.test(name) && !name.includes('..') && !name.startsWith('-');
}

function isConfinedToSafeRoots(resolved) {
  for (const root of SAFE_ROOTS) {
    if (resolved === root) return true;
    if (resolved.startsWith(root + path.sep)) return true;
  }
  return false;
}

const DEFAULT_WORKSPACE = process.env.KANTOR_WORKSPACE_ROOT || process.cwd();
const MASTER_DIR = process.env.KANTOR_WORKSPACE_ROOT || DEFAULT_WORKSPACE;
const SAFE_ROOTS = [
  fs.realpathSync(DEFAULT_WORKSPACE),
  ...(process.env.KANTOR_WORKSPACE_ROOT ? [fs.realpathSync(process.env.KANTOR_WORKSPACE_ROOT)] : []),
];

// Helper to safely execute git commands in a target directory
function runGit(cmd, cwd) {
  // cmd is a fixed, code-authored string split on spaces; never request input.
  const args = cmd.split(' ');
  try {
    return execFileSync('git', args.slice(1), {
      cwd,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch (err) {
    return null;
  }
}

// Inspect a specific folder path
function inspectDirectory(targetPath) {
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    return {
      success: false,
      path: resolved,
      error: `Folder tidak ditemukan di path: ${resolved}`,
      isValid: false,
    };
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return {
      success: false,
      path: resolved,
      error: `Path yang dipilih bukan direktori: ${resolved}`,
      isValid: false,
    };
  }

  // Check Git Status
  const isGit = runGit('git rev-parse --is-inside-work-tree', resolved) === 'true';
  let currentBranch = null;
  let allBranches = [];
  let isDevBranch = false;
  let hasDevOrDevelopmentBranch = false;
  let uncommittedFiles = 0;
  let remoteUrl = null;
  let remoteWebUrl = null;
  let remoteProvider = null;
  let remoteRepoName = null;

  if (isGit) {
    currentBranch = runGit('git branch --show-current', resolved) || runGit('git rev-parse --abbrev-ref HEAD', resolved) || 'unknown';
    
    // Check if current active branch is dev or development
    isDevBranch = currentBranch === 'dev' || currentBranch === 'development';

    const branchListRaw = runGit('git branch --list', resolved) || '';
    allBranches = branchListRaw
      .split('\n')
      .map((b) => b.replace(/^\*?\s+/, '').trim())
      .filter(Boolean);

    hasDevOrDevelopmentBranch = allBranches.some((b) => b === 'dev' || b === 'development');

    const statusOutput = runGit('git status --porcelain', resolved) || '';
    uncommittedFiles = statusOutput.split('\n').filter((l) => l.trim().length > 0).length;

    // Detect Git Remote URL (e.g. GitHub or GitLab)
    remoteUrl = runGit('git config --get remote.origin.url', resolved) || null;

    if (remoteUrl) {
      // Normalize git@github.com:User/Repo.git to https://github.com/User/Repo
      let cleanUrl = remoteUrl.trim();
      if (cleanUrl.startsWith('git@') && cleanUrl.includes(':')) {
        const parts = cleanUrl.slice(4).split(':');
        cleanUrl = `https://${parts[0]}/${parts[1]}`;
      }
      cleanUrl = cleanUrl.replace(/\.git$/, '');
      remoteWebUrl = cleanUrl;

      if (cleanUrl.includes('github.com')) remoteProvider = 'GitHub';
      else if (cleanUrl.includes('gitlab.com')) remoteProvider = 'GitLab';
      else remoteProvider = 'Git Remote';

      const pathSegments = cleanUrl.split('/').filter(Boolean);
      remoteRepoName = pathSegments.slice(-2).join('/');
    }
  }

  // Check Package.json
  let packageInfo = null;
  let projectType = 'Generic Project';
  const pkgPath = path.join(resolved, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      packageInfo = {
        name: pkgContent.name || path.basename(resolved),
        version: pkgContent.version || '0.1.0',
        scripts: Object.keys(pkgContent.scripts || {}),
      };
      const deps = { ...(pkgContent.dependencies || {}), ...(pkgContent.devDependencies || {}) };
      if (deps['next']) projectType = 'Next.js App';
      else if (deps['react']) projectType = 'React App';
      else if (deps['@nestjs/core']) projectType = 'NestJS Backend';
      else if (deps['vue']) projectType = 'Vue.js App';
      else projectType = 'Node.js Service';
    } catch (e) {
      // ignore json parse error
    }
  }

  let branchStatus = 'valid';
  let branchMessage = 'Branch aktif sesuai standar (dev / development). Siap eksekusi!';
  if (!isGit) {
    branchStatus = 'not_git';
    branchMessage = 'Bukan repositori Git. Eksekusi lokal tetap dapat dijalankan.';
  } else if (!isDevBranch) {
    branchStatus = 'warning';
    branchMessage = `Branch aktif: "${currentBranch}". Disarankan pindah ke branch "dev" atau "development" sebelum eksekusi Jira task.`;
  }

  return {
    success: true,
    path: resolved,
    folderName: path.basename(resolved),
    isValid: true,
    isGitRepo: isGit,
    currentBranch,
    isDevBranch,
    hasDevOrDevelopmentBranch,
    allBranches,
    uncommittedFiles,
    remoteUrl,
    remoteWebUrl,
    remoteProvider,
    remoteRepoName,
    projectType,
    packageInfo,
    branchStatus,
    branchMessage,
  };
}

export async function GET(request) {
  if (!LOCAL_MODE) return localOnly();
  const denied = requireApiToken(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const targetPath = searchParams.get('path');

    if (targetPath) {
      const rp = fs.realpathSync(path.resolve(targetPath));
      if (!isConfinedToSafeRoots(rp)) {
        return NextResponse.json({ error: 'Path di luar workspace yang diizinkan' }, { status: 403 });
      }
      const inspection = inspectDirectory(rp);
      return NextResponse.json(inspection);
    }

    // Default: scan available workspaces and master subdirectories
    const availableProjects = [];

    // Always include current workspace first
    if (fs.existsSync(DEFAULT_WORKSPACE)) {
      availableProjects.push({
        path: DEFAULT_WORKSPACE,
        name: path.basename(DEFAULT_WORKSPACE),
        isDefault: true,
        ...inspectDirectory(DEFAULT_WORKSPACE),
      });
    }

    // Scan master directory for sibling projects
    if (fs.existsSync(MASTER_DIR)) {
      try {
        const items = fs.readdirSync(MASTER_DIR, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory() && !item.name.startsWith('.')) {
            const itemPath = path.join(MASTER_DIR, item.name);
            if (itemPath !== DEFAULT_WORKSPACE) {
              availableProjects.push({
                path: itemPath,
                name: item.name,
                isDefault: false,
                ...inspectDirectory(itemPath),
              });
            }
          }
        }
      } catch (e) {
        // ignore read error
      }
    }

    return NextResponse.json({
      success: true,
      defaultPath: DEFAULT_WORKSPACE,
      availableProjects,
    });
  } catch (err) {
    console.error('[local-inspect API Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// POST endpoint to checkout or create dev branch if user requests
export async function POST(request) {
  if (!LOCAL_MODE) return localOnly();
  const denied = requireApiToken(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { folderPath, action, targetBranch = 'dev' } = body;
    if (!isSafeBranch(targetBranch)) {
      return NextResponse.json({ error: 'targetBranch tidak valid' }, { status: 400 });
    }

    const resolved = fs.realpathSync(path.resolve(folderPath || DEFAULT_WORKSPACE));
    if (!isConfinedToSafeRoots(resolved)) {
      return NextResponse.json({ error: 'Path di luar workspace yang diizinkan' }, { status: 403 });
    }

    if (action === 'checkout_dev') {
      // Try checkout dev or create if not exists
      try {
        execFileSync('git', ['checkout', targetBranch], { cwd: resolved, encoding: 'utf8' });
      } catch (err) {
        // If branch doesn't exist, create it from current HEAD
        execFileSync('git', ['checkout', '-b', targetBranch], { cwd: resolved, encoding: 'utf8' });
      }

      const updated = inspectDirectory(resolved);
      return NextResponse.json({
        success: true,
        message: `Berhasil beralih ke branch "${targetBranch}"`,
        ...updated,
      });
    }

    if (action === 'set_remote') {
      const { remoteUrl: newRemoteUrl } = body;
      if (!newRemoteUrl) {
        return NextResponse.json({ error: 'remoteUrl wajib diisi' }, { status: 400 });
      }
      if (!SAFE_REMOTE_RE.test(newRemoteUrl)) {
        return NextResponse.json({ error: 'remoteUrl tidak valid' }, { status: 400 });
      }
      try {
        // Check if origin exists
        const currentOrigin = runGit('git remote get-url origin', resolved);
        if (currentOrigin && currentOrigin !== newRemoteUrl) {
          if (process.env.KANTOR_ALLOW_REMOTE_OVERWRITE !== '1') {
            return NextResponse.json(
              { error: 'Penggantian remote origin yang sudah ada diblokir demi keamanan. Set KANTOR_ALLOW_REMOTE_OVERWRITE=1 untuk mengizinkan.' },
              { status: 403 }
            );
          }
          execFileSync('git', ['remote', 'set-url', 'origin', newRemoteUrl], { cwd: resolved, encoding: 'utf8' });
        } else if (!currentOrigin) {
          execFileSync('git', ['remote', 'add', 'origin', newRemoteUrl], { cwd: resolved, encoding: 'utf8' });
        }
        const updated = inspectDirectory(resolved);
        return NextResponse.json({
          success: true,
          message: `Remote origin berhasil dihubungkan ke ${newRemoteUrl}`,
          ...updated,
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    if (action === 'execute_git_flow') {
      const {
        baseBranch: base = 'main',
        featureBranch = 'feat/task',
        releaseBranch = 'rc/task',
        targetBranch: target = 'dev',
        commitMessage = 'feat: autonomous pipeline execution',
        pushToRemote = true,
      } = body;

      for (const b of [base, featureBranch, releaseBranch, target]) {
        if (!isSafeBranch(b)) {
          return NextResponse.json({ error: `nama branch tidak valid: ${b}` }, { status: 400 });
        }
      }

      const logs: string[] = [];
      const runStep = (args: string[]) => {
        logs.push(`$ git ${args.join(' ')}`);
        try {
          const out = execFileSync('git', args, { cwd: resolved, encoding: 'utf8', timeout: 15000 });
          if (out && out.trim()) logs.push(out.trim());
          return { success: true, output: out };
        } catch (err: any) {
          const errOutput = (err.stdout || '') + (err.stderr || err.message);
          logs.push(`⚠️ ${errOutput.trim()}`);
          return { success: false, error: errOutput };
        }
      };

      // 1. Check working directory status
      runStep(['checkout', base]);
      runStep(['pull', 'origin', base]);

      // 2. Create feature branch
      runStep(['checkout', '-B', featureBranch]);

      // 3. Stage & commit (commit message is passed as a single argv entry)
      runStep(['add', '.']);
      runStep(['commit', '-m', String(commitMessage).slice(0, 500)]);

      // 4. Create release branch and merge feature
      runStep(['checkout', '-B', releaseBranch]);
      runStep(['merge', featureBranch]);

      // 5. Checkout target branch and merge release branch
      runStep(['checkout', '-B', target]);
      runStep(['merge', releaseBranch]);

      // 6. Push to remote if origin is configured and push requested
      let pushResult = null;
      if (pushToRemote) {
        const remoteCheck = runGit('git config --get remote.origin.url', resolved);
        if (remoteCheck) {
          pushResult = runStep(['push', 'origin', featureBranch, releaseBranch, target]);
        } else {
          logs.push('ℹ️ Remote origin tidak terkonfigurasi, push dilewati.');
        }
      }

      const updated = inspectDirectory(resolved);
      return NextResponse.json({
        success: true,
        message: `Git Flow ${featureBranch} ➔ ${releaseBranch} ➔ ${target} berhasil dieksekusi!`,
        logs,
        pushResult,
        ...updated,
      });
    }

    const inspection = inspectDirectory(resolved);
    return NextResponse.json(inspection);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
