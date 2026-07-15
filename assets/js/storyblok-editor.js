/*
 * Storyblok live Visual Editor integration for the Home page.
 * Does absolutely nothing for real visitors: only activates when the page
 * is opened inside Storyblok's editor iframe (detected via the `_storyblok`
 * query param it appends). Regular visitors never load the Bridge script.
 */
(function () {
  'use strict';

  var isInEditor = /(^|[?&])_storyblok(=|&|$)/.test(window.location.search);
  if (!isInEditor) return;

  var STORYBLOK_TOKEN = 'PNi8Al5uS5ikYUpSgZa5MAtt'; // public content-delivery token, safe client-side
  var lang = document.documentElement.lang === 'bg' ? 'bg' : undefined;
  var CARD_ACCENTS = ['', ' card--peach'];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderAboutText2(text) {
    return escapeHtml(text).replace(/ISO 9001/, '<strong>ISO 9001</strong>');
  }

  function renderCards(cards) {
    return cards.map(function (card, i) {
      return '<article class="card' + CARD_ACCENTS[i % CARD_ACCENTS.length] + '">' +
        '<span class="card__icon"><span class="card__icon-blob" aria-hidden="true"></span></span>' +
        '<div class="card__body">' +
        '<h3 class="card__title">' + escapeHtml(card.title) + '</h3>' +
        '<p class="card__desc">' + escapeHtml(card.description) + '</p>' +
        '</div></article>';
    }).join('');
  }

  function applyContent(content) {
    if (!content) return;

    var eyebrow = document.querySelector('.eyebrow');
    if (eyebrow && content.eyebrow_badge != null) eyebrow.textContent = content.eyebrow_badge;

    var h1 = document.querySelector('.hero__title');
    if (h1 && content.hero_title != null) h1.textContent = content.hero_title;

    var heroText = document.querySelector('.hero__text');
    if (heroText && content.hero_text != null) heroText.textContent = content.hero_text;

    var aboutHeading = document.querySelector('.about-grid h2');
    if (aboutHeading && content.about_heading != null) aboutHeading.textContent = content.about_heading;

    var aboutParas = document.querySelectorAll('.about-grid__text > p');
    if (aboutParas[0] && content.about_text_1 != null) aboutParas[0].textContent = content.about_text_1;
    if (aboutParas[1] && content.about_text_2 != null) aboutParas[1].innerHTML = renderAboutText2(content.about_text_2);

    var servicesHeading = document.querySelector('#services h2');
    if (servicesHeading && content.services_heading != null) servicesHeading.textContent = content.services_heading;

    var cardsGrid = document.querySelector('.cards-grid');
    if (cardsGrid && Array.isArray(content.services)) cardsGrid.innerHTML = renderCards(content.services);
  }

  function fetchDraft() {
    var url = 'https://api.storyblok.com/v2/cdn/stories/index?token=' + STORYBLOK_TOKEN + '&version=draft' +
      (lang ? '&language=' + lang : '') + '&cv=' + Date.now();
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (json) { applyContent(json.story && json.story.content); })
      .catch(function (err) { console.error('Storyblok draft fetch failed', err); });
  }

  var bridgeScript = document.createElement('script');
  bridgeScript.src = 'https://app.storyblok.com/f/storyblok-v2-latest.js';
  bridgeScript.onload = function () {
    fetchDraft();
    var bridge = new window.StoryblokBridge();
    bridge.on(['input', 'change', 'published'], function (event) {
      if (event && event.story && event.story.content) {
        applyContent(event.story.content);
      } else {
        fetchDraft();
      }
    });
  };
  document.head.appendChild(bridgeScript);
})();
