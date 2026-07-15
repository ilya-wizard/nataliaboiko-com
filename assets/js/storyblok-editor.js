/*
 * Storyblok live Visual Editor for Home / About / How-i-work pages.
 * Only activates inside Storyblok's editor iframe (detected via the
 * `_storyblok` query param). Regular visitors never load the Bridge.
 */
(function () {
  'use strict';
  if (!/(^|[?&])_storyblok(=|&|$)/.test(window.location.search)) return;

  var TOKEN = 'PNi8Al5uS5ikYUpSgZa5MAtt'; // public content-delivery token
  var lang = document.documentElement.lang === 'bg' ? 'bg' : null;

  var path = window.location.pathname;
  var page, slug;
  if (path.indexOf('about') !== -1) { page = 'about'; slug = 'about'; }
  else if (path.indexOf('how-i-work') !== -1) { page = 'work'; slug = 'how-i-work'; }
  else { page = 'home'; slug = 'index'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // localized getter: prefer *__i18n__bg on raw content, else the resolved field
  function L(obj, key) {
    if (lang === 'bg' && obj[key + '__i18n__bg'] != null && obj[key + '__i18n__bg'] !== '') return obj[key + '__i18n__bg'];
    return obj[key];
  }
  function set(sel, text) { var el = document.querySelector(sel); if (el && text != null) el.textContent = text; }
  function setHtml(sel, html) { var el = document.querySelector(sel); if (el) el.innerHTML = html; }

  function renderCards(cards) {
    return (cards || []).map(function (c, i) {
      var a = i % 2 === 1 ? ' card--peach' : '';
      return '<article class="card' + a + '"><span class="card__icon"><span class="card__icon-blob" aria-hidden="true"></span></span>' +
        '<div class="card__body"><h3 class="card__title">' + esc(L(c, 'title')) + '</h3>' +
        '<p class="card__desc">' + esc(L(c, 'description')) + '</p></div></article>';
    }).join('');
  }
  function renderSteps(steps) {
    return (steps || []).map(function (s, i) {
      var a = i % 2 === 1 ? ' step-card--peach' : '';
      return '<article class="step-card' + a + '"><span class="step-card__number">' + (i + 1) + '</span>' +
        '<div class="step-card__body"><h3 class="step-card__title">' + esc(L(s, 'title')) + '</h3>' +
        '<p class="step-card__desc">' + esc(L(s, 'description')) + '</p></div></article>';
    }).join('');
  }
  function renderCerts(certs) {
    return (certs || []).map(function (c) {
      var src = (c.image && c.image.filename) || '';
      var cap = esc(L(c, 'caption'));
      return '<figure class="cert-card"><div class="cert-card__img-wrap">' +
        '<img src="' + src + '" width="400" height="250" alt="' + cap + '" loading="lazy"></div>' +
        '<figcaption class="cert-card__caption">' + cap + '</figcaption></figure>';
    }).join('');
  }

  function applyHome(c) {
    set('.eyebrow', L(c, 'eyebrow_badge'));
    set('.hero__title', L(c, 'hero_title'));
    set('.hero__text', L(c, 'hero_text'));
    set('.about-grid h2', L(c, 'about_heading'));
    var ps = document.querySelectorAll('.about-grid__text > p');
    if (ps[0] && L(c, 'about_text_1') != null) ps[0].textContent = L(c, 'about_text_1');
    if (ps[1] && L(c, 'about_text_2') != null) ps[1].innerHTML = esc(L(c, 'about_text_2')).replace(/ISO 9001/, '<strong>ISO 9001</strong>');
    set('#services h2', L(c, 'services_heading'));
    if (Array.isArray(c.services)) setHtml('.cards-grid', renderCards(c.services));
  }
  function applyAbout(c) {
    set('.intro-flow h1', L(c, 'h1'));
    if (Array.isArray(c.bio)) setHtml('.bio-text', c.bio.map(function (b) { return '<p>' + esc(L(b, 'text')) + '</p>'; }).join(''));
    set('.section--page h2', L(c, 'certs_heading'));
    if (Array.isArray(c.certificates)) setHtml('.cert-grid', renderCerts(c.certificates));
  }
  function applyWork(c) {
    set('.section__header h1', L(c, 'h1'));
    set('.section__lead', L(c, 'lead'));
    if (Array.isArray(c.steps)) setHtml('.steps-grid', renderSteps(c.steps));
    set('.cta-banner h2', L(c, 'cta_heading'));
    var btn = document.querySelector('.cta-banner .btn-primary');
    if (btn && L(c, 'cta_button') != null) {
      var svg = btn.querySelector('svg');
      btn.innerHTML = (svg ? svg.outerHTML : '') + '\n          ' + esc(L(c, 'cta_button'));
    }
  }
  function apply(c) {
    if (!c) return;
    if (page === 'home') applyHome(c);
    else if (page === 'about') applyAbout(c);
    else if (page === 'work') applyWork(c);
  }

  function fetchDraft() {
    var url = 'https://api.storyblok.com/v2/cdn/stories/' + slug + '?token=' + TOKEN +
      '&version=draft' + (lang ? '&language=' + lang : '') + '&cv=' + Date.now();
    fetch(url).then(function (r) { return r.json(); })
      .then(function (j) { apply(j.story && j.story.content); })
      .catch(function (e) { console.error('Storyblok draft fetch failed', e); });
  }

  var s = document.createElement('script');
  s.src = 'https://app.storyblok.com/f/storyblok-v2-latest.js';
  s.onload = function () {
    fetchDraft();
    var bridge = new window.StoryblokBridge();
    bridge.on(['input', 'change', 'published'], function (event) {
      if (event && event.story && event.story.content) apply(event.story.content);
      else fetchDraft();
    });
  };
  document.head.appendChild(s);
})();
