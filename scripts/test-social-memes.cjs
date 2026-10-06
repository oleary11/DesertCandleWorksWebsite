// Offline regression coverage for planning -> Imgflip -> full-frame render -> review storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const sharp = require('sharp');

function load(file, overrides) {
  const filename = path.resolve(file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const mod = { exports: {} };
  const requireActual = createRequire(filename);
  const requireMock = (name) => Object.hasOwn(overrides, name) ? overrides[name] : requireActual(name);
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(requireMock, mod, mod.exports);
  return mod.exports;
}

async function main() {
  const originalFetch = global.fetch;
  const keys = ['IMGFLIP_API_KEY', 'IMGFLIP_USERNAME', 'IMGFLIP_PASSWORD', 'OPENAI_API_KEY'];
  const originalEnv = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  keys.forEach(k => delete process.env[k]);
  process.env.IMGFLIP_USERNAME = 'test-user';
  process.env.IMGFLIP_PASSWORD = 'test-password';
  process.env.OPENAI_API_KEY = 'test-key';
  const templates = [
    { id: '181913649', name: 'Drake Hotline Bling', box_count: 2 },
    { id: '112126428', name: 'Distracted Boyfriend', box_count: 3 },
  ];
  let drafts = [
    { kind: 'meme', hook: 'Candle priorities', meme_template_id: templates[0].id, meme_texts: ['finish the candles I own', 'buy one more candle'] },
    { kind: 'meme', hook: 'Another candle?', meme_template_id: templates[1].id, meme_texts: ['new candle', 'me', 'my unused candles'] },
  ];
  let captionFailure = false;
  const calls = [];
  // Colored edge strips stand in for text at the template edges: contain must preserve both.
  const source = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#fff' } })
    .composite([
      { input: await sharp({ create: { width: 60, height: 400, channels: 3, background: '#f00' } }).png().toBuffer(), left: 0, top: 0 },
      { input: await sharp({ create: { width: 60, height: 400, channels: 3, background: '#00f' } }).png().toBuffer(), left: 740, top: 0 },
    ]).png().toBuffer();
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/get_memes')) return Response.json({ success: true, data: { memes: templates } });
    if (String(url).includes('reddit.com')) return Response.json({ data: { children: [] } });
    if (String(url).includes('openai.com')) {
      const prompt = JSON.parse(init.body).messages[1].content;
      assert.match(prompt, /Drake Hotline Bling/);
      assert.match(prompt, /meme_texts/);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ posts: drafts }) } }] });
    }
    if (String(url).endsWith('/caption_image')) {
      if (captionFailure) return Response.json({ success: false, error_message: 'caption unavailable' });
      return Response.json({ success: true, data: { url: 'https://i.imgflip.com/test.png' } });
    }
    if (String(url) === 'https://i.imgflip.com/test.png') return new Response(source);
    throw new Error(`Unexpected network request: ${url}`);
  };
  try {
    const selection = load('src/lib/social/meme-selection.ts', {});
    const memes = load('src/lib/social/memes.ts', { './meme-selection': selection });
    const posts = [];
    const store = {
      listExcludedImages: async () => new Set(), recentHooks: async () => [], listSocialPosts: async () => posts,
      createSocialPost: async (post) => { const saved = { ...post, id: String(posts.length), status: 'generating', jobs: [], slides: [], updatedAt: new Date().toISOString() }; posts.push(saved); return saved; },
      updateSocialPost: async (id, patch) => Object.assign(posts.find(p => p.id === id), patch),
    };
    const content = load('src/lib/social/content.ts', {
      '@/lib/resolvedProducts': { listResolvedProducts: async () => [] }, './store': store, './memes': memes, './meme-selection': selection,
    });
    const uploads = [];
    const render = load('src/lib/social/render.tsx', {
      './content': content,
      '@vercel/blob': { put: async (name, buf) => { uploads.push(buf); return { url: `https://blob.example/${name}` }; } },
      'next/og': {},
    });
    const pipeline = load('src/lib/social/pipeline.ts', { './fal': {}, './content': content, './render': render, './memes': memes, './store': store });
    const result = await pipeline.createBatch({ collections: 0, slideshows: 0, memes: 2 });
    assert.equal(result.length, 2);
    assert.ok(result.every(p => p.status === 'pending_review' && p.plan.templateId && p.slides.length === 1));
    assert.deepEqual(result[1].plan.texts, drafts[1].meme_texts);
    const captionCalls = calls.filter(c => c.url.endsWith('/caption_image'));
    assert.equal(captionCalls.length, 2);
    assert.equal(new URLSearchParams(captionCalls[1].init.body).get('boxes[2][text]'), 'my unused candles');
    assert.equal(new URLSearchParams(captionCalls[0].init.body).get('username'), 'test-user');
    const meta = await sharp(uploads[0]).metadata();
    assert.equal(meta.width, 1080); assert.equal(meta.height, 1350);
    const pixel = async (left) => [...await sharp(uploads[0]).extract({ left, top: 675, width: 1, height: 1 }).raw().toBuffer()];
    assert.ok((await pixel(10))[0] > 230, 'left caption edge preserved');
    assert.ok((await pixel(1070))[2] > 230, 'right caption edge preserved');
    assert.ok(!calls.some(c => /pexels|unsplash|fal.ai/.test(c.url)));
    console.log('PASS: two- and three-box templates become review posts, all panels preserved, no stock/AI requests');
    // Error cases use a fresh history; variety/history behavior has its own regression test.
    store.listSocialPosts = async () => [];

    drafts = [{ ...drafts[0], meme_template_id: 'unknown' }];
    await assert.rejects(() => pipeline.createBatch({ collections: 0, slideshows: 0, memes: 1 }), /no valid Imgflip template/);
    assert.equal(posts.length, 2);
    drafts = [{ ...drafts[0], meme_template_id: templates[0].id, meme_texts: ['only one box'] }];
    await assert.rejects(() => pipeline.createBatch({ collections: 0, slideshows: 0, memes: 1 }), /exactly 2 text boxes/);
    assert.equal(posts.length, 2);
    drafts = [];
    await assert.rejects(() => pipeline.createBatch({ collections: 0, slideshows: 0, memes: 1 }), /requested 1 meme drafts/);
    delete process.env.IMGFLIP_USERNAME; delete process.env.IMGFLIP_PASSWORD;
    await assert.rejects(() => pipeline.createBatch({ collections: 0, slideshows: 0, memes: 1 }), /Imgflip credentials/);
    assert.equal(posts.length, 2);
    console.log('PASS: invalid templates, box counts, omitted memes and missing credentials fail before inserting posts');

    process.env.IMGFLIP_API_KEY = 'test-bearer';
    await memes.captionMeme(templates[0].id, ['one', 'two']);
    assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer test-bearer');
    assert.equal(new URLSearchParams(calls.at(-1).init.body).has('password'), false);
    drafts = [{ kind: 'meme', hook: 'Failure case', meme_template_id: templates[0].id, meme_texts: ['one', 'two'] }];
    captionFailure = true;
    const failed = await pipeline.createBatch({ collections: 0, slideshows: 0, memes: 1 });
    assert.equal(failed[0].status, 'failed'); assert.equal(failed[0].slides.length, 0);
    assert.match(failed[0].error, /caption unavailable/);
    console.log('PASS: bearer authentication and persisted caption failure without stock fallback');
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
