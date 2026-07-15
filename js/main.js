/* ============================================================
   main.js — shared site init
   Loads content.json, renders nav + footer, exposes content globally
   ============================================================ */

export let CONTENT = null;

export async function loadContent() {
  if (CONTENT) return CONTENT;
  try {
    const res = await fetch('data/content.json');
    CONTENT = await res.json();
    return CONTENT;
  } catch (e) {
    console.error('Failed to load content.json', e);
    return null;
  }
}

export function renderNav(activePage = '') {
  if (!CONTENT) return;
  const navContainer = document.querySelector('[data-nav]');
  if (!navContainer) return;
  const links = CONTENT.nav.map(item => {
    const isActive = item.href.split('#')[0] === activePage ? 'active' : '';
    return `<li><a href="${item.href}" class="${isActive}">${item.label}</a></li>`;
  }).join('');
  navContainer.innerHTML = `
    <div class="container site-nav__inner">
      <a href="index.html" class="site-nav__brand">${CONTENT.site.name}</a>
      <ul class="site-nav__links">${links}</ul>
    </div>
  `;
}

export function renderFooter() {
  if (!CONTENT) return;
  const footer = document.querySelector('[data-footer]');
  if (!footer) return;
  const cols = CONTENT.footer.columns.map(col => `
    <div class="site-footer__col">
      <h4>${col.heading}</h4>
      <ul>${col.links.map(l => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}</ul>
    </div>
  `).join('');
  footer.innerHTML = `
    <div class="container">
      <div class="site-footer__grid">
        <div>
          <div class="site-footer__brand">${CONTENT.site.name}</div>
          <p class="site-footer__tagline">${CONTENT.footer.tagline}</p>
        </div>
        ${cols}
      </div>
      <div class="site-footer__legal">
        <span>${CONTENT.footer.legal}</span>
        <span>${CONTENT.contact.location} · ${CONTENT.contact.hours}</span>
      </div>
    </div>
  `;
}

export function toast(message, duration = 3000) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}
