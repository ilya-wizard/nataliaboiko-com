// Regenerates all site pages from Storyblok content between SB:* markers,
// and applies global contacts + the shared portrait across every page.
// Run at build time (Vercel) or manually. Env: STORYBLOK_TOKEN.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(__dirname, '..');
const TOKEN = process.env.STORYBLOK_TOKEN;
if (!TOKEN) { console.error('Missing STORYBLOK_TOKEN'); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function fetchStory(slug, lang) {
  const url = new URL(`https://api.storyblok.com/v2/cdn/stories/${slug}`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('version', 'published');
  if (lang) url.searchParams.set('language', lang);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${slug} (${lang || 'ru'}) -> ${res.status}`);
  return (await res.json()).story.content;
}

function between(html, key, inner) {
  const s = `<!-- SB:${key}:START -->`, e = `<!-- SB:${key}:END -->`;
  const si = html.indexOf(s), ei = html.indexOf(e);
  if (si === -1 || ei === -1) throw new Error(`marker ${key} missing`);
  return html.slice(0, si + s.length) + '\n' + inner + '\n      ' + html.slice(ei);
}

// ---------- renderers ----------
function renderAboutText2(t) { return esc(t).replace(/ISO 9001/, '<strong>ISO 9001</strong>'); }

function renderServiceCards(cards) {
  return cards.map((c, i) => {
    const accent = i % 2 === 1 ? ' card--peach' : '';
    return `        <article class="card${accent}">
          <span class="card__icon"><span class="card__icon-blob" aria-hidden="true"></span></span>
          <div class="card__body">
            <h3 class="card__title">${esc(c.title)}</h3>
          <p class="card__desc">${esc(c.description)}</p>
          </div>
        </article>`;
  }).join('\n');
}

function renderBio(paras) {
  return paras.map((p) => `          <p>${esc(p.text)}</p>`).join('\n');
}

function renderCertificates(certs) {
  const cards = certs.map((c) => {
    const src = (c.image && c.image.filename) || '';
    const cap = esc(c.caption);
    return `        <figure class="cert-card">
          <div class="cert-card__img-wrap">
            <img src="${src}" width="400" height="250" alt="${cap}" loading="lazy">
          </div>
          <figcaption class="cert-card__caption">${cap}</figcaption>
        </figure>`;
  }).join('\n');
  return `      <div class="cert-grid">\n${cards}\n      </div>`;
}

function renderSteps(steps) {
  const cards = steps.map((s, i) => {
    const accent = i % 2 === 1 ? ' step-card--peach' : '';
    return `        <article class="step-card${accent}">
          <span class="step-card__number">${i + 1}</span>
          <div class="step-card__body">
          <h3 class="step-card__title">${esc(s.title)}</h3>
          <p class="step-card__desc">${esc(s.description)}</p>
        </div>
        </article>`;
  }).join('\n');
  return `      <div class="steps-grid">\n${cards}\n      </div>`;
}

// ---------- global contacts + portrait ----------
function applyGlobals(html, globals, lang, opts = {}) {
  const tg = globals.telegram_url;
  const fb = globals.facebook_url;
  const email = globals.email;
  const phoneDisplay = globals.phone;
  const phoneTel = '+' + String(globals.phone).replace(/[^0-9]/g, '');
  const portraitUrl = (globals.portrait && globals.portrait.filename) || '';
  const alt = esc(globals.portrait_alt);

  // shared portrait
  if (opts.heroPhoto) {
    html = html.replace(/(<img class="hero__photo"[^>]*\ssrc=")[^"]*(")/, `$1${portraitUrl}$2`)
               .replace(/(<img class="hero__photo"[^>]*\salt=")[^"]*(")/, `$1${alt}$2`);
  }
  if (opts.introPhoto) {
    html = html.replace(/(<img class="intro-photo"[^>]*\ssrc=")[^"]*(")/, `$1${portraitUrl}$2`)
               .replace(/(<img class="intro-photo"[^>]*\salt=")[^"]*(")/, `$1${alt}$2`);
  }
  // phone display (home only, has marker)
  if (html.includes('SB:GLOBAL:phone_display:START')) {
    html = html.replace(/(<!-- SB:GLOBAL:phone_display:START -->)[\s\S]*?(<!-- SB:GLOBAL:phone_display:END -->)/,
      `$1${esc(phoneDisplay)}$2`);
  }
  // contacts everywhere (links + JSON-LD)
  html = html.replace(/https?:\/\/t\.me\/[^"'\s<)]+/g, tg)
             .replace(/https?:\/\/(?:www\.)?facebook\.com\/[^"'\s<)]+/g, fb)
             .replace(/tel:[^"'\s<)]+/g, 'tel:' + phoneTel)
             .replace(/mailto:[^"'\s<)]+/g, 'mailto:' + email)
             .replace(/"telephone":\s*"[^"]*"/g, `"telephone": "${phoneTel}"`)
             .replace(/"email":\s*"(?!mailto:)[^"]*"/g, `"email": "${email}"`);
  return html;
}

// ---------- page builders ----------
async function buildHome(file, lang) {
  let html = await readFile(path.join(SITE, file), 'utf8');
  const c = await fetchStory('index', lang);
  html = between(html, 'HOME:eyebrow_badge', `      <span class="eyebrow">${esc(c.eyebrow_badge)}</span>`);
  html = between(html, 'HOME:hero_title', `      <h1 class="hero__title">${esc(c.hero_title)}</h1>`);
  html = between(html, 'HOME:hero_text', `      <p class="hero__text">${esc(c.hero_text)}</p>`);
  html = between(html, 'HOME:about_heading', `        <h2>${esc(c.about_heading)}</h2>`);
  html = between(html, 'HOME:about_text_1', `        <p>${esc(c.about_text_1)}</p>`);
  html = between(html, 'HOME:about_text_2', `        <p>${renderAboutText2(c.about_text_2)}</p>`);
  html = between(html, 'HOME:services_heading', `        <h2>${esc(c.services_heading)}</h2>`);
  html = between(html, 'HOME:services', renderServiceCards(c.services || []));
  return html;
}

async function buildAbout(file, lang) {
  let html = await readFile(path.join(SITE, file), 'utf8');
  const c = await fetchStory('about', lang);
  html = between(html, 'ABOUT:h1', `      <h1>${esc(c.h1)}</h1>`);
  html = between(html, 'ABOUT:bio', renderBio(c.bio || []));
  html = between(html, 'ABOUT:certs_heading', `        <h2>${esc(c.certs_heading)}</h2>`);
  html = between(html, 'ABOUT:certificates', renderCertificates(c.certificates || []));
  return html;
}

async function buildWork(file, lang) {
  let html = await readFile(path.join(SITE, file), 'utf8');
  const c = await fetchStory('how-i-work', lang);
  html = between(html, 'WORK:h1', `      <h1>${esc(c.h1)}</h1>`);
  html = between(html, 'WORK:lead', `      <p class="section__lead">${esc(c.lead)}</p>`);
  html = between(html, 'WORK:steps', renderSteps(c.steps || []));
  html = between(html, 'WORK:cta_heading', `        <h2>${esc(c.cta_heading)}</h2>`);
  html = between(html, 'WORK:cta_button', esc(c.cta_button));
  return html;
}

async function run() {
  const globalsRu = await fetchStory('globals', undefined);
  const globalsBg = await fetchStory('globals', 'bg');

  const jobs = [
    { file: 'index.html', build: buildHome, lang: undefined, g: globalsRu, opts: { heroPhoto: true } },
    { file: 'bg/index.html', build: buildHome, lang: 'bg', g: globalsBg, opts: { heroPhoto: true } },
    { file: 'about.html', build: buildAbout, lang: undefined, g: globalsRu, opts: { introPhoto: true } },
    { file: 'bg/about.html', build: buildAbout, lang: 'bg', g: globalsBg, opts: { introPhoto: true } },
    { file: 'how-i-work.html', build: buildWork, lang: undefined, g: globalsRu, opts: {} },
    { file: 'bg/how-i-work.html', build: buildWork, lang: 'bg', g: globalsBg, opts: {} },
  ];

  for (const j of jobs) {
    const original = await readFile(path.join(SITE, j.file), 'utf8');
    let html = await j.build(j.file, j.lang);
    html = applyGlobals(html, j.g, j.lang, j.opts);
    if (html !== original) {
      await writeFile(path.join(SITE, j.file), html, 'utf8');
      console.log('Updated', j.file);
    } else {
      console.log('No changes', j.file);
    }
  }
  console.log('Storyblok sync complete.');
}

run().catch((e) => { console.error(e); process.exit(1); });
