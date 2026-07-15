// Pulls the "home" story from Storyblok (Content Delivery API) and injects
// its fields into index.html / bg/index.html between the SB:HOME:* marker
// comments. Everything outside the markers (SEO meta, nav, footer, JSON-LD,
// the other 4 pages) is left untouched.
//
// Usage: node scripts/sync-storyblok-home.mjs
// Env:   STORYBLOK_TOKEN (Content Delivery / public token for the space)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..');

const TOKEN = process.env.STORYBLOK_TOKEN;
if (!TOKEN) {
  console.error('Missing STORYBLOK_TOKEN environment variable.');
  process.exit(1);
}

const CARD_ACCENTS = ['', ' card--peach']; // alternates by index, same as before

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// The "about_text_2" sentence mentions ISO 9001 and was hand-bolded in the
// original markup (<strong>ISO 9001</strong>). The CMS field is plain text,
// so re-apply the same bold treatment when it appears verbatim.
function renderAboutText2(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/ISO 9001/, '<strong>ISO 9001</strong>');
}

function renderServiceCards(cards) {
  return cards
    .map((card, i) => {
      const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
      return `        <article class="card${accent}">
          <span class="card__icon"><span class="card__icon-blob" aria-hidden="true"></span></span>
          <div class="card__body">
            <h3 class="card__title">${escapeHtml(card.title)}</h3>
          <p class="card__desc">${escapeHtml(card.description)}</p>
          </div>
        </article>`;
    })
    .join('\n');
}

function replaceBetweenMarkers(html, key, innerHtml) {
  const startMarker = `<!-- SB:HOME:${key}:START -->`;
  const endMarker = `<!-- SB:HOME:${key}:END -->`;
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Markers for "${key}" not found`);
  }
  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);
  return `${before}\n${innerHtml}\n      ${after}`;
}

async function fetchHomeStory(language) {
  const url = new URL('https://api.storyblok.com/v2/cdn/stories/home');
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('version', 'published');
  if (language) url.searchParams.set('language', language);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Storyblok fetch failed (${language || 'default'}): ${res.status}`);
  }
  const json = await res.json();
  return json.story.content;
}

function applyContent(html, content) {
  let out = html;
  out = replaceBetweenMarkers(out, 'eyebrow_badge', `      <span class="eyebrow">${escapeHtml(content.eyebrow_badge)}</span>`);
  out = replaceBetweenMarkers(out, 'hero_title', `      <h1 class="hero__title">${escapeHtml(content.hero_title)}</h1>`);
  out = replaceBetweenMarkers(out, 'hero_text', `      <p class="hero__text">${escapeHtml(content.hero_text)}</p>`);
  out = replaceBetweenMarkers(out, 'about_heading', `        <h2>${escapeHtml(content.about_heading)}</h2>`);
  out = replaceBetweenMarkers(out, 'about_text_1', `        <p>${escapeHtml(content.about_text_1)}</p>`);
  out = replaceBetweenMarkers(out, 'about_text_2', `        <p>${renderAboutText2(content.about_text_2)}</p>`);
  out = replaceBetweenMarkers(out, 'services_heading', `        <h2>${escapeHtml(content.services_heading)}</h2>`);
  out = replaceBetweenMarkers(out, 'services', renderServiceCards(content.services));
  return out;
}

async function syncFile(relPath, language) {
  const filePath = path.join(SITE_ROOT, relPath);
  const original = await readFile(filePath, 'utf8');
  const content = await fetchHomeStory(language);
  const updated = applyContent(original, content);
  if (updated !== original) {
    await writeFile(filePath, updated, 'utf8');
    console.log(`Updated ${relPath}`);
  } else {
    console.log(`No changes for ${relPath}`);
  }
}

await syncFile('index.html', undefined); // default language = Russian
await syncFile('bg/index.html', 'bg');

console.log('Storyblok sync complete.');
