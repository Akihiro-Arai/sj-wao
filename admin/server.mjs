import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { simpleGit } from 'simple-git';
import { csrfOriginCheck } from './csrf.mjs';
import { isValidSlug, toScriptLiteral } from './security.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 4322;
const HOST = process.env.HOST || '0.0.0.0';
const REPO_PATH = path.resolve(__dirname, process.env.REPO_PATH || '..');
const AUTO_PUSH = process.env.AUTO_PUSH !== 'false';
const CONTENT_DIR = path.join(REPO_PATH, 'src/content/blog');

const git = simpleGit(REPO_PATH);

// --- IP allowlist (defense-in-depth; the real boundary is keeping this off the public internet) ---

const ALLOWED_CIDRS = [
	'127.0.0.0/8',
	'10.0.0.0/8',
	'172.16.0.0/12',
	'192.168.0.0/16',
	'100.64.0.0/10', // Tailscale CGNAT range
];

function ipv4ToInt(ip) {
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let n = 0;
	for (const part of parts) {
		const byte = Number(part);
		if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
		n = (n << 8) | byte;
	}
	return n >>> 0;
}

function inCidr(ip, cidr) {
	const [base, bitsStr] = cidr.split('/');
	const bits = Number(bitsStr);
	const ipInt = ipv4ToInt(ip);
	const baseInt = ipv4ToInt(base);
	if (ipInt === null || baseInt === null) return false;
	if (bits === 0) return true;
	const mask = (0xffffffff << (32 - bits)) >>> 0;
	return (ipInt & mask) === (baseInt & mask);
}

function normalizeIp(remoteAddress) {
	if (!remoteAddress) return '';
	if (remoteAddress === '::1') return '127.0.0.1';
	if (remoteAddress.startsWith('::ffff:')) return remoteAddress.slice('::ffff:'.length);
	return remoteAddress;
}

function ipAllowlist(req, res, next) {
	const ip = normalizeIp(req.socket.remoteAddress);
	const allowed = ALLOWED_CIDRS.some((cidr) => inCidr(ip, cidr));
	if (!allowed) {
		res.status(403).send('このアプリはローカルネットワークまたはTailscale経由でのみ利用できます。');
		return;
	}
	next();
}

// --- helpers ---

function listPosts() {
	const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
	return files
		.map((file) => {
			const slug = file.replace(/\.(md|mdx)$/, '');
			const ext = path.extname(file).slice(1);
			const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
			const { data } = matter(raw);
			return { slug, ext, ...data };
		})
		.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
}

function findPostFile(slug) {
	if (!isValidSlug(slug)) return null;
	for (const ext of ['md', 'mdx']) {
		const p = path.join(CONTENT_DIR, `${slug}.${ext}`);
		if (fs.existsSync(p)) return { path: p, ext };
	}
	return null;
}

function slugify(title) {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, '0');
	const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
	return `post-${stamp}`;
}

function formatDateInput(value) {
	if (!value) return new Date().toISOString().slice(0, 10);
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
	return d.toISOString().slice(0, 10);
}

async function commitAndPush(relPath, message) {
	try {
		await git.add(relPath);
		await git.commit(message);
	} catch (err) {
		return { ok: false, stage: 'commit', message: err.message };
	}
	if (AUTO_PUSH) {
		try {
			await git.push();
		} catch (err) {
			return { ok: false, stage: 'push', message: err.message };
		}
	}
	return { ok: true };
}

// --- views ---

const layout = (title, body) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 700px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #222; }
  h1 { font-size: 1.4rem; }
  a { color: #2563eb; }
  form { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 1.5rem; }
  label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; color: #444; }
  input, textarea { font: inherit; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; width: 100%; }
  input { min-height: 44px; }
  textarea { min-height: 50vh; font-family: ui-monospace, monospace; resize: vertical; }
  button { align-self: flex-start; padding: 0.5rem 1.2rem; border: none; border-radius: 4px; background: #2563eb; color: white; font-size: 1rem; cursor: pointer; min-height: 44px; }
  button:hover { background: #1d4ed8; }
  .flash { background: #ecfdf5; border: 1px solid #10b981; padding: 0.7rem 1rem; border-radius: 4px; margin-bottom: 1rem; }
  .error { background: #fef2f2; border: 1px solid #ef4444; padding: 0.7rem 1rem; border-radius: 4px; margin-bottom: 1rem; white-space: pre-wrap; }
  .error a { display: inline-flex; align-items: center; min-height: 44px; margin-top: 0.5rem; }
  .draft-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; background: #fffbeb; border: 1px solid #f59e0b; padding: 0.7rem 1rem; border-radius: 4px; margin-top: 1rem; }
  .draft-banner button { min-height: 44px; padding: 0.4rem 0.9rem; font-size: 0.9rem; }
  #draft-discard { background: #6b7280; }
  #draft-discard:hover { background: #4b5563; }
  ul.posts { list-style: none; padding: 0; }
  ul.posts li { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem; padding: 0.6rem 0; border-bottom: 1px solid #eee; }
  ul.posts li a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 0.3rem; }
  .post-meta { color: #777; font-size: 0.85rem; }
  .top-actions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.6rem; }
</style>
</head>
<body>
${body}
</body>
</html>`;

function postForm({ action, title = '', description = '', pubDate = '', slug = '', body = '', slugReadonly = false, updatedDate = '' }) {
	return `
<div id="draft-banner" class="draft-banner" hidden>
  <span>保存されていない下書きがあります。</span>
  <button type="button" id="draft-restore">復元</button>
  <button type="button" id="draft-discard">破棄</button>
</div>
<form method="post" action="${action}">
  <label>タイトル
    <input type="text" name="title" required value="${escapeHtml(title)}">
  </label>
  <label>概要
    <input type="text" name="description" required value="${escapeHtml(description)}">
  </label>
  <label>公開日
    <input type="date" name="pubDate" required value="${formatDateInput(pubDate)}">
  </label>
  <label>スラッグ
    <input type="text" name="slug" ${slugReadonly ? 'readonly' : ''} placeholder="空欄なら自動生成されます" value="${escapeHtml(slug)}">
  </label>
  <label>本文（Markdown）
    <textarea name="body" required>${escapeHtml(body)}</textarea>
  </label>
  <button type="submit">保存</button>
</form>
${draftScript(action)}`;
}

// Autosaves form fields to localStorage as the user types, and offers to
// restore them if the page is reloaded before a successful submit (e.g. the
// server was unreachable). Cleared from the list page once a save actually
// succeeds — see the `clearDraft` query param handling on GET /.
function draftScript(draftKey) {
	return `
<script>
(() => {
  const KEY = ${toScriptLiteral(`admin-draft:${draftKey}`)};
  const FIELDS = ['title', 'description', 'pubDate', 'slug', 'body'];
  const form = document.querySelector('form');
  const banner = document.getElementById('draft-banner');
  const restoreBtn = document.getElementById('draft-restore');
  const discardBtn = document.getElementById('draft-discard');

  function currentValues() {
    const values = {};
    for (const name of FIELDS) {
      const el = form.elements.namedItem(name);
      if (el) values[name] = el.value;
    }
    return values;
  }

  function applyValues(values) {
    for (const name of FIELDS) {
      const el = form.elements.namedItem(name);
      if (el && typeof values[name] === 'string') el.value = values[name];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(currentValues()));
    } catch {}
  }

  function clearDraft() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}

  if (saved) {
    try {
      const draft = JSON.parse(saved);
      const current = currentValues();
      const differs = FIELDS.some((name) => (draft[name] || '') !== (current[name] || ''));
      if (differs) {
        banner.hidden = false;
        restoreBtn.addEventListener('click', () => {
          applyValues(draft);
          banner.hidden = true;
        });
      }
    } catch {}
  }

  discardBtn.addEventListener('click', () => {
    clearDraft();
    banner.hidden = true;
  });

  form.addEventListener('input', save);
})();
</script>`;
}

// Distinguishes the two ways commitAndPush() can fail, since they leave the
// repo in different states: a commit failure means the file is only saved
// on disk (still untracked/uncommitted), while a push failure means it's
// safely committed locally, just not published yet.
function commitFailureMessage(result) {
	const state =
		result.stage === 'push'
			? 'ローカルにコミット済みです（pushのみ失敗しました。サイトへの反映はまだです）'
			: 'ファイルは保存済みですが、まだコミットされていません（commitに失敗しました）';
	return `${state}: ${escapeHtml(result.message)}。再試行してください。`;
}

function escapeHtml(str) {
	return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// --- app ---

const app = express();
app.use(ipAllowlist);
app.use(csrfOriginCheck);
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
	const posts = listPosts();
	const msg = req.query.msg ? `<p class="flash">${escapeHtml(req.query.msg)}</p>` : '';
	const clearDraftScript = req.query.clearDraft
		? `<script>
try { localStorage.removeItem(${toScriptLiteral('admin-draft:')} + ${toScriptLiteral(String(req.query.clearDraft))}); } catch {}
// Drop clearDraft from the URL so reloading/revisiting this exact link later
// (e.g. via browser history) doesn't wipe an unrelated newer draft.
try { window.history.replaceState(null, '', '/'); } catch {}
</script>`
		: '';
	const items = posts
		.map(
			(p) => `<li>
        <div>
          <strong>${escapeHtml(p.title)}</strong>
          <div class="post-meta">${escapeHtml(p.pubDate)}</div>
        </div>
        <a href="/edit/${encodeURIComponent(p.slug)}">編集</a>
      </li>`
		)
		.join('\n');
	res.send(
		layout(
			'投稿一覧',
			`${msg}${clearDraftScript}
<div class="top-actions">
  <h1>投稿一覧</h1>
  <a href="/new"><button type="button">新規投稿</button></a>
</div>
<ul class="posts">${items || '<li>まだ投稿がありません。</li>'}</ul>`
		)
	);
});

app.get('/new', (req, res) => {
	res.send(layout('新規投稿', `<h1>新規投稿</h1>${postForm({ action: '/posts' })}`));
});

app.post('/posts', async (req, res) => {
	const { title, description, pubDate, body } = req.body;
	let { slug } = req.body;

	if (!title || !description || !pubDate || !body) {
		res.status(400).send(
			layout(
				'新規投稿',
				`<p class="error">タイトル・概要・公開日・本文は必須です。</p>${postForm({ action: '/posts', ...req.body })}`
			)
		);
		return;
	}

	slug = (slug || '').trim() || slugify(title);

	if (!isValidSlug(slug)) {
		res.status(400).send(
			layout(
				'新規投稿',
				`<p class="error">スラッグは半角英数字と「-」のみ、先頭は英数字にしてください。</p>${postForm({ action: '/posts', ...req.body })}`
			)
		);
		return;
	}

	if (findPostFile(slug)) {
		res.status(400).send(
			layout(
				'新規投稿',
				`<p class="error">スラッグ「${escapeHtml(slug)}」はすでに使われています。別のスラッグを指定してください。</p>${postForm({ action: '/posts', ...req.body })}`
			)
		);
		return;
	}

	const frontmatter = { title, description, pubDate };
	const fileContent = matter.stringify(body, frontmatter);
	const filePath = path.join(CONTENT_DIR, `${slug}.md`);
	fs.writeFileSync(filePath, fileContent, 'utf-8');

	const relPath = path.relative(REPO_PATH, filePath);
	const result = await commitAndPush(relPath, `Add post: ${title}`);

	if (!result.ok) {
		res.send(
			layout(
				'新規投稿',
				`<p class="error">${commitFailureMessage(result)}<a href="/edit/${encodeURIComponent(slug)}">編集画面に戻る</a></p>`
			)
		);
		return;
	}

	res.redirect(
		`/?msg=${encodeURIComponent(`「${title}」を投稿しました。`)}&clearDraft=${encodeURIComponent('/posts')}`
	);
});

app.get('/edit/:slug', (req, res) => {
	const found = findPostFile(req.params.slug);
	if (!found) {
		res.status(404).send(layout('見つかりません', '<h1>投稿が見つかりません</h1><a href="/">一覧に戻る</a>'));
		return;
	}
	const raw = fs.readFileSync(found.path, 'utf-8');
	const { data, content } = matter(raw);
	res.send(
		layout(
			'投稿を編集',
			`<h1>投稿を編集</h1>${postForm({
				action: `/edit/${encodeURIComponent(req.params.slug)}`,
				title: data.title,
				description: data.description,
				pubDate: data.pubDate,
				slug: req.params.slug,
				body: content.trim(),
				slugReadonly: true,
			})}`
		)
	);
});

app.post('/edit/:slug', async (req, res) => {
	const action = `/edit/${encodeURIComponent(req.params.slug)}`;
	const found = findPostFile(req.params.slug);
	if (!found) {
		res.status(404).send(layout('見つかりません', '<h1>投稿が見つかりません</h1><a href="/">一覧に戻る</a>'));
		return;
	}

	const { title, description, pubDate, body } = req.body;
	if (!title || !description || !pubDate || !body) {
		res.status(400).send(
			layout(
				'投稿を編集',
				`<p class="error">タイトル・概要・公開日・本文は必須です。</p>${postForm({
					action,
					...req.body,
					slug: req.params.slug,
					slugReadonly: true,
				})}`
			)
		);
		return;
	}

	const raw = fs.readFileSync(found.path, 'utf-8');
	const { data: existing } = matter(raw);
	const frontmatter = {
		title,
		description,
		pubDate,
		...(existing.updatedDate ? { updatedDate: existing.updatedDate } : {}),
		...(existing.heroImage ? { heroImage: existing.heroImage } : {}),
	};
	const fileContent = matter.stringify(body, frontmatter);
	fs.writeFileSync(found.path, fileContent, 'utf-8');

	const relPath = path.relative(REPO_PATH, found.path);
	const result = await commitAndPush(relPath, `Update post: ${title}`);

	if (!result.ok) {
		res.send(
			layout(
				'投稿を編集',
				`<p class="error">${commitFailureMessage(result)}<a href="${action}">編集画面に戻る</a></p>`
			)
		);
		return;
	}

	res.redirect(`/?msg=${encodeURIComponent(`「${title}」を更新しました。`)}&clearDraft=${encodeURIComponent(action)}`);
});

app.listen(PORT, HOST, () => {
	console.log(`admin server listening on http://${HOST}:${PORT}`);
});
