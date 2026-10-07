/* =====================================================================
   АН «Атланта» — поведение сайта (фильтры, карточки, формы).
   Править этот файл НЕ нужно: все тексты и объекты живут в objects.js.
   ===================================================================== */

(function () {
  'use strict';

  var TYPE_LABEL = { sale: 'Продажа', newbuild: 'Новостройка', rent: 'Аренда', request: 'Ищем для клиента' };
  var TABS = [
    { id: 'all', label: 'Все объекты' },
    { id: 'sale', label: 'Продажа' },
    { id: 'newbuild', label: 'Новостройки' },
    { id: 'rent', label: 'Аренда' },
    { id: 'request', label: 'Ищем для клиента' }
  ];

  var state = { type: 'all', rooms: '', district: '', min: '', max: '', sold: false, sort: 'new' };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function priceOf(o) {
    if (o.status === 'sold') return { main: 'Продано', sub: 'сделка состоялась', cls: 'price-sold' };
    if (o.status === 'rented') return { main: 'Сдано', sub: 'договор подписан', cls: 'price-sold' };
    if (o.price == null) return { main: 'Цена по запросу', sub: 'уточните по телефону', cls: '' };
    if (o.type === 'rent' || o.rentlike) return { main: money(o.price) + ' ₽', sub: 'в месяц', cls: '' };
    if (o.type === 'request') return { main: 'до ' + money(o.price) + ' ₽', sub: 'бюджет нашего клиента', cls: '' };
    return { main: money(o.price) + ' ₽', sub: '', cls: '' };
  }

  /* ---------- картинка карточки: фото или аккуратная заглушка ---------- */
  var PAL = [
    ['#1E2A4A', '#0B1020', '#22D3EE'],
    ['#2A1B3D', '#0B0814', '#8B5CF6'],
    ['#3A2410', '#120B05', '#FBBF24'],
    ['#12312A', '#06120F', '#4ADE80'],
    ['#331A24', '#120A0E', '#F472B6']
  ];
  function hash(s) { var h = 0, i; for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 9973; } return h; }
  var gid = 0;
  function placeholder(o) {
    var p = PAL[hash(o.title) % PAL.length];
    var uid = 'ag' + (++gid);
    var r = hash(o.title + 'x');
    var i, b = '';
    for (i = 0; i < 7; i++) {
      var x = (r * (i + 3)) % 360, y = 90 + ((r * (i + 7)) % 130), w = 26 + ((r * (i + 2)) % 46), h = 60 + ((r * (i + 5)) % 120);
      b += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + p[1] + '" opacity="' + (0.5 + (i % 3) * 0.16).toFixed(2) + '"/>';
    }
    var win = '';
    for (i = 0; i < 26; i++) {
      var wx = 20 + (i % 13) * 29, wy = 100 + Math.floor(i / 13) * 34;
      if (((r + i) % 4) === 0) win += '<rect x="' + wx + '" y="' + wy + '" width="9" height="11" rx="1" fill="' + p[2] + '" opacity=".55"/>';
    }
    return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Фото объекта появится здесь">' +
      '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#' + uid + ')"/>' +
      '<circle cx="322" cy="58" r="34" fill="' + p[2] + '" opacity=".22"/>' +
      b + win +
      '<rect width="400" height="300" fill="url(#' + uid + ')" opacity=".18"/>' +
      '<text x="20" y="278" fill="#FFFFFF" opacity=".5" font-family="Inter,Arial,sans-serif" font-size="12" letter-spacing="1.4">ФОТО ОБЪЕКТА</text>' +
      '</svg>';
  }
  function photoHtml(o, big) {
    if (o.photo) return '<img src="' + esc(o.photo) + '" alt="' + esc(o.title) + '" loading="lazy">';
    return placeholder(o);
  }

  /* ---------- шапка, цифры, услуги, блок «Об агентстве», контакты ---------- */
  function fillStatic() {
    var i;
    var tel = 'tel:' + SITE.phoneRaw, wa = 'https://wa.me/' + SITE.whatsapp;

    document.querySelectorAll('a[data-tel]').forEach(function (el) { el.setAttribute('href', tel); el.textContent = SITE.phone; });
    document.querySelectorAll('a[data-tel-href]').forEach(function (el) { el.setAttribute('href', tel); });
    document.querySelectorAll('[data-tel-label]').forEach(function (el) { el.textContent = SITE.phone; });
    document.querySelectorAll('[data-fab]').forEach(function (el) {
      el.setAttribute('href', tel);
      el.textContent = '📞 ' + SITE.phone;
    });
    document.querySelectorAll('[data-wa]').forEach(function (el) { el.setAttribute('href', wa); });
    document.querySelectorAll('[data-email]').forEach(function (el) { el.setAttribute('href', 'mailto:' + SITE.email); el.textContent = SITE.email; });
    document.querySelectorAll('[data-address]').forEach(function (el) { el.textContent = SITE.address; });
    document.querySelectorAll('[data-metro]').forEach(function (el) { el.textContent = SITE.metro; });
    document.querySelectorAll('[data-hours]').forEach(function (el) { el.textContent = SITE.hours; });

    var t = TEXTS;
    if ($('#hero-eyebrow')) $('#hero-eyebrow').textContent = t.heroEyebrow;
    if ($('#hero-title')) $('#hero-title').innerHTML = esc(t.heroTitle) + ' <em>' + esc(t.heroTitleEm) + '</em> на рынке Петербурга';
    if ($('#hero-lead')) $('#hero-lead').textContent = t.heroLead;
    if ($('#hero-btn1')) $('#hero-btn1').textContent = t.heroBtn1;
    if ($('#hero-btn2')) $('#hero-btn2').textContent = t.heroBtn2;

    if ($('#dir-quote')) $('#dir-quote').textContent = '«' + t.dirQuote + '»';
    if ($('#dir-name')) $('#dir-name').textContent = t.dirName;
    if ($('#dir-role')) $('#dir-role').textContent = t.dirRole;

    var st = $('#stats');
    if (st) {
      st.innerHTML = STATS.map(function (s) {
        return '<div class="stat"><b>' + esc(s.n) + '</b><span>' + esc(s.t) + '</span></div>';
      }).join('');
    }

    var sv = $('#services-list');
    if (sv) {
      sv.innerHTML = SERVICES.map(function (s) {
        return '<div class="svc-item rv-in"><div class="svc-ico" aria-hidden="true">' + s.ico + '</div>' +
          '<h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></div>';
      }).join('');
    }

    var rv = $('#reviews-list');
    if (rv) {
      rv.innerHTML = REVIEWS.length ? REVIEWS.map(function (r) {
        var stars = '★★★★★'.slice(0, Math.max(1, Math.min(5, r.stars || 5))) + '☆☆☆☆☆'.slice(0, 5 - Math.max(1, Math.min(5, r.stars || 5)));
        return '<div class="rv-item rv-in"><div class="rv-stars" aria-label="Оценка ' + (r.stars || 5) + ' из 5">' + stars + '</div>' +
          '<p class="rv-text">' + esc(r.text) + '</p>' +
          '<div class="rv-who"><b>' + esc(r.name) + '</b>' + esc(r.deal || '') + '</div></div>';
      }).join('') : '<div class="empty rv-in"><b>Отзывов пока нет</b>Будем рады, если вы станете первым — напишите пару слов о сделке.</div>';
    }

    var map = $('#map-frame');
    if (map && SITE.mapSrc) map.src = SITE.mapSrc;
    if (SITE.email === 'ПОЧТА@ПРИМЕР.ru') {
      var db = $('#devbar');
      if (db) db.innerHTML = '<b>Служебная плашка (перед сдачей удалить).</b> Не заполнены: почта агентства в файле <b>objects.js</b> (SITE.email), фото директора, фото объектов. Учебные карточки помечены плашкой «пример».';
    } else {
      var db2 = $('#devbar'); if (db2) db2.style.display = 'none';
    }
  }

  /* ---------- вкладки и фильтры ---------- */
  function buildTabs() {
    var box = $('#tabs');
    if (!box) return;
    box.innerHTML = TABS.map(function (t) {
      var n = t.id === 'all'
        ? OBJECTS.filter(function (o) { return o.status === 'active'; }).length
        : OBJECTS.filter(function (o) { return o.type === t.id && o.status === 'active'; }).length;
      return '<button class="tab" type="button" role="tab" data-type="' + t.id + '" aria-selected="' + (t.id === 'all') + '">' +
        esc(t.label) + '<i>' + n + '</i></button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      state.type = b.getAttribute('data-type');
      box.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      render();
    });
  }

  function buildDistricts() {
    var sel = $('#f-district');
    if (!sel) return;
    var set = {}, cur = sel.value;
    OBJECTS.forEach(function (o) { if (o.district) set[o.district] = 1; });
    sel.innerHTML = '<option value="">Все районы</option>' +
      Object.keys(set).sort().map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    sel.value = cur;
  }

  function filtered() {
    var mn = parseFloat(state.min), mx = parseFloat(state.max);
    var out = OBJECTS.filter(function (o) {
      if (!state.sold && o.status !== 'active') return false;
      if (state.sold && o.status === 'active') return false;
      if (state.type !== 'all' && o.type !== state.type) return false;
      if (state.rooms !== '') {
        var r = parseInt(state.rooms, 10);
        if (o.rooms == null) return false;
        if (r === 4 ? o.rooms < 4 : o.rooms !== r) return false;
      }
      if (state.district && o.district !== state.district) return false;
      if (!isNaN(mn) && (o.price == null || o.price < mn)) return false;
      if (!isNaN(mx) && (o.price == null || o.price > mx)) return false;
      return true;
    });
    out.sort(function (a, b) {
      if (state.sort === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (state.sort === 'price-desc') return (b.price || 0) - (a.price || 0);
      return String(b.added).localeCompare(String(a.added));
    });
    return out;
  }

  function cardHtml(o) {
    var p = priceOf(o);
    var badges = '<span class="badge badge-' + (o.type === 'sale' ? 'sale' : o.type === 'newbuild' ? 'new' : o.type === 'rent' ? 'rent' : 'req') + '">' + TYPE_LABEL[o.type] + '</span>';
    if (o.status === 'sold') badges += '<span class="badge badge-sold">Продано</span>';
    if (o.status === 'rented') badges += '<span class="badge badge-sold">Сдано</span>';
    if (o.sample) badges += '<span class="badge">пример</span>';

    var specs = [];
    if (o.rooms != null) specs.push(o.rooms === 0 ? 'студия' : o.rooms + '-к');
    if (o.area != null) specs.push(o.area + ' м²');
    if (o.floor && o.floor !== '—') specs.push('этаж ' + o.floor);
    if (o.added) specs.push('добавлено ' + o.added);

    return '<article class="card' + (o.status === 'active' ? '' : ' sold') + ' rv-in">' +
      '<div class="card-img">' + photoHtml(o) + '<div class="badges">' + badges + '</div></div>' +
      '<div class="card-body">' +
      '<h3 class="card-title">' + esc(o.title) + '</h3>' +
      '<div class="card-place">📍 ' + esc(o.district || '') + '</div>' +
      (specs.length ? '<div class="specs">' + specs.map(function (s) { return '<span class="spec">' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="card-foot"><div class="price ' + p.cls + '">' + esc(p.main) + (p.sub ? '<small>' + esc(p.sub) + '</small>' : '') + '</div>' +
      '<div class="card-btns"><button class="btn btn-ghost btn-sm" type="button" data-open="' + o.id + '">Подробнее</button></div>' +
      '</div></div></article>';
  }

  function render() {
    var grid = $('#grid'), found = $('#found');
    if (!grid) return;
    var list = filtered();
    if (found) {
      found.textContent = state.sold
        ? 'Архив агентства: ' + list.length + ' ' + plural(list.length, 'сделка', 'сделки', 'сделок') + ' — показываем, что уже продано и сдано.'
        : 'Найдено ' + list.length + ' ' + plural(list.length, 'объект', 'объекта', 'объектов') + '. Чтобы посмотреть архив состоявшихся сделок, отметьте «показать архив».';
    }
    grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="empty"><b>По этим условиям ничего не нашлось</b>Позвоните в агентство — у нас есть объекты, которых нет в открытых объявлениях. ' +
        '<a class="link-u" href="tel:' + SITE.phoneRaw + '">' + SITE.phone + '</a></div>';
    grid.querySelectorAll('.card').forEach(function (el) { el.classList.add('seen'); });
  }

  function plural(n, a, b, c) {
    var m = n % 100, k = n % 10;
    if (m > 10 && m < 20) return c;
    if (k === 1) return a;
    if (k > 1 && k < 5) return b;
    return c;
  }

  /* ---------- окно объекта ---------- */
  function openObject(id) {
    var o = OBJECTS.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var m = $('#modal'), box = $('#modal-box');
    var p = priceOf(o);
    var specs = [];
    if (o.rooms != null) specs.push(o.rooms === 0 ? 'студия' : o.rooms + '-комнатная');
    if (o.area != null) specs.push(o.area + ' м²');
    if (o.floor && o.floor !== '—') specs.push('этаж ' + o.floor);
    specs.push(TYPE_LABEL[o.type]);
    if (o.district) specs.push(o.district);
    if (o.added) specs.push('в базе с ' + o.added);

    var subject = 'Вопрос по объекту: ' + o.title;
    var body = 'Здравствуйте!\n\nМеня интересует объект с вашего сайта:\n«' + o.title + '»\n' + (p.main ? 'Цена: ' + p.main + '\n' : '') + '\nМоё имя:\nУдобное время для звонка:\nВопрос:\n';

    box.innerHTML =
      '<button class="modal-close" type="button" aria-label="Закрыть">✕</button>' +
      '<div class="modal-img">' + photoHtml(o, true) + '</div>' +
      '<div class="modal-in">' +
      (o.sample ? '<p class="hint" style="color:var(--warn);margin:0">Учебная карточка — в рабочей версии здесь настоящий объект агентства.</p>' : '') +
      '<h2>' + esc(o.title) + '</h2>' +
      '<div class="modal-price ' + p.cls + '">' + esc(p.main) + (p.sub ? ' <small style="font-size:13px;color:var(--muted);font-weight:500">' + esc(p.sub) + '</small>' : '') + '</div>' +
      '<div class="modal-specs">' + specs.map(function (s) { return '<span class="spec">' + esc(s) + '</span>'; }).join('') + '</div>' +
      '<p class="modal-desc">' + esc(o.desc || '') + '</p>' +
      '<div class="modal-acts">' +
      '<a class="btn" href="tel:' + SITE.phoneRaw + '">Позвонить: <span data-modal-tel>' + esc(SITE.phone) + '</span></a>' +
      '<a class="btn btn-ghost" href="mailto:' + SITE.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) + '">Написать на почту</a>' +
      '<a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/' + SITE.whatsapp + '?text=' + encodeURIComponent('Здравствуйте! Интересует объект «' + o.title + '» с вашего сайта.') + '">WhatsApp</a>' +
      '</div>' +
      '<p class="form-note">По этому объекту звоните в агентство или пишите в WhatsApp — ответим и договоримся о показе в удобное время.</p>' +
      '</div>';

    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    box.querySelector('.modal-close').focus();
    box.querySelector('.modal-close').addEventListener('click', closeModal);
  }
  function closeModal() {
    $('#modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---------- формы: письмо через почтовую программу посетителя ---------- */
  function wireForms() {
    document.querySelectorAll('form[data-mailto]').forEach(function (f) {
      var ok = f.querySelector('.form-ok');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var kind = f.getAttribute('data-mailto');
        var data = {};
        f.querySelectorAll('input,textarea,select').forEach(function (el) {
          if (el.name) data[el.name] = el.value.trim();
        });
        if (!data.contact || data.contact.length < 5) {
          if (ok) {
            ok.className = 'form-ok show';
            ok.style.borderColor = 'rgba(251,191,36,.4)';
            ok.style.background = 'rgba(251,191,36,.08)';
            ok.style.color = '#FDE68A';
            ok.textContent = 'Пожалуйста, оставьте телефон или почту — иначе мы не сможем ответить.';
          }
          return;
        }
        var subj, lines;
        if (kind === 'review') {
          subj = 'Отзыв об агентстве «Атланта»';
          lines = ['Имя: ' + (data.name || '—'), 'Сделка: ' + (data.deal || '—'), 'Оценка: ' + (data.stars || '5') + ' из 5', '', 'Текст отзыва:', data.text || '—', '', 'Контакт для связи: ' + data.contact];
        } else if (kind === 'sell') {
          subj = 'Хочу продать / сдать объект — заявка с сайта «Атланты»';
          lines = ['Что продаю/сдаю: ' + (data.what || '—'), 'Адрес или район: ' + (data.where || '—'), 'Желаемая цена: ' + (data.price || '—'), 'Имя: ' + (data.name || '—'), 'Контакт: ' + data.contact, '', 'Комментарий:', data.message || '—'];
        } else {
          subj = 'Заявка с сайта агентства «Атланта»';
          lines = ['Интересует: ' + (data.want || '—'), 'Район: ' + (data.district || '—'), 'Бюджет: ' + (data.budget || '—'), 'Имя: ' + (data.name || '—'), 'Контакт: ' + data.contact, '', 'Вопрос:', data.message || '—'];
        }
        var href = 'mailto:' + SITE.email + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(lines.join('\n'));
        if (typeof window.__onNavigate === 'function') window.__onNavigate(href);
        else window.location.href = href;
        if (ok) {
          ok.className = 'form-ok show';
          ok.style.borderColor = 'rgba(74,222,128,.35)';
          ok.style.background = 'rgba(74,222,128,.08)';
          ok.style.color = '#BBF7D0';
          ok.innerHTML = 'Открывается ваша почтовая программа с готовым письмом — нажмите «Отправить».<br>Если письмо не открылось, позвоните нам: <a class="link-u" href="tel:' + SITE.phoneRaw + '">' + esc(SITE.phone) + '</a> или напишите в <a class="link-u" target="_blank" rel="noopener" href="https://wa.me/' + SITE.whatsapp + '">WhatsApp</a>.';
        }
      });
    });
  }

  /* ---------- шапка, меню, появление блоков ---------- */
  function wireUI() {
    var hdr = $('#hdr'), burger = $('#burger');
    var onScroll = function () { hdr.classList.toggle('scrolled', window.scrollY > 30); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    if (burger) {
      burger.addEventListener('click', function () {
        var open = document.body.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', String(open));
      });
      document.querySelectorAll('.nav a').forEach(function (a) {
        a.addEventListener('click', function () {
          document.body.classList.remove('menu-open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      var watch = function () { document.querySelectorAll('.rv-in:not(.seen)').forEach(function (el) { io.observe(el); }); };
      watch(); window.__reobserve = watch;
    } else {
      document.querySelectorAll('.rv-in').forEach(function (el) { el.classList.add('seen'); });
    }

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeModal(); });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (b) openObject(parseInt(b.getAttribute('data-open'), 10));
    });

    var year = $('#year'); if (year) year.textContent = new Date().getFullYear();
  }

  function init() {
    fillStatic();
    buildTabs();
    buildDistricts();
    wireForms();
    wireUI();
    render();

    var f = $('#filters');
    if (f) {
      f.addEventListener('change', function (e) {
        var id = e.target.id;
        if (id === 'f-rooms') state.rooms = e.target.value;
        if (id === 'f-district') state.district = e.target.value;
        if (id === 'f-min') state.min = e.target.value;
        if (id === 'f-max') state.max = e.target.value;
        if (id === 'f-sold') state.sold = e.target.checked;
        if (id === 'f-sort') state.sort = e.target.value;
        render();
        if (window.__reobserve) window.__reobserve();
      });
      var rst = $('#f-reset');
      if (rst) rst.addEventListener('click', function () {
        state.rooms = state.district = state.min = state.max = '';
        state.sold = false; state.sort = 'new';
        ['f-rooms', 'f-district', 'f-min', 'f-max', 'f-sort'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = id === 'f-sort' ? 'new' : ''; });
        var sc = document.getElementById('f-sold'); if (sc) sc.checked = false;
        render();
      });
    }
    document.querySelectorAll('[data-set-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-set-tab');
        var tab = document.querySelector('.tab[data-type="' + t + '"]');
        if (tab) tab.click();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
