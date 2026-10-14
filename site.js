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
    if (o.photo) {
      /* За фото лежит заглушка-подложка: если файл не загрузили (onerror),
         карточка не останется с битой картинкой — покажется заглушка. */
      var bg = placeholder(o).replace('role="img" aria-label="Фото объекта появится здесь"', 'aria-hidden="true"');
      return bg + '<img src="' + esc(o.photo) + '" alt="' + esc(o.title) + '" loading="lazy" onerror="this.remove()">';
    }
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
      }).join('') :
        '<div class="rv-note rv-in">' +
          '<p>Мы публикуем только настоящие отзывы с разрешения клиентов. После каждой сделки Раиса Ивановна лично связывается с клиентом и просит поделиться впечатлениями.</p>' +
          '<p>Первые отзывы появятся здесь в ближайшее время — мы начали собирать их совсем недавно.</p>' +
          '<p class="rv-note-invite">Уже работали с «Атлантой»? Форма ниже — ваш отзыв может стать первым.</p>' +
        '</div>';
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

  function cardHtml(o, idx) {
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

    return '<article class="card card-in' + (o.status === 'active' ? '' : ' sold') + '" style="--i:' + (idx % 12) + '">' +
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

  /* ---------- цифры доверия: счёт от нуля до значения ----------
     Готовое число УЖЕ стоит в разметке (его рисует fillStatic), поэтому
     без анимации — старый браузер, нет IntersectionObserver, включён
     режим «меньше движения» — посетитель сразу видит итоговое значение.
     Крутим только небольшие числа (30, 9, 7): годы вроде 1995 не трогаем. */
  function countStat(b) {
    var m = b.textContent.match(/\d+/);
    if (!m) return;
    var target = parseInt(m[0], 10);
    if (isNaN(target) || target > 1000) return;
    var prefix = b.textContent.slice(0, m.index);
    var suffix = b.textContent.slice(m.index + m[0].length);
    var t0 = null, dur = 1100;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);   /* плавно к концу */
      b.textContent = prefix + Math.round(target * e) + suffix;
      if (k < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  function wireStatsCount() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce || !window.requestAnimationFrame) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); countStat(e.target); }
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('#stats .stat b').forEach(function (b) { io.observe(b); });
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
      /* линии у заголовков разделов оживают только когда анимации доступны:
         без IntersectionObserver класс line-in не ставится и линия видна сразу */
      document.querySelectorAll('.sec-head').forEach(function (el) { el.classList.add('line-in'); });
      var watch = function () {
        document.querySelectorAll('.rv-in:not(.seen), .sec-head.line-in:not(.seen)').forEach(function (el) { io.observe(el); });
      };
      watch(); window.__reobserve = watch;
    } else {
      document.querySelectorAll('.rv-in').forEach(function (el) { el.classList.add('seen'); });
    }

    /* полоска прочтения страницы и кнопка «наверх» */
    var prog = $('#scroll-progress'), toTop = $('#to-top');
    var onProgress = function () {
      var doc = document.documentElement;
      var h = (doc.scrollHeight || 0) - window.innerHeight;
      var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      if (prog) prog.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (toTop) toTop.classList.toggle('show', window.scrollY > 600);
    };
    window.addEventListener('scroll', onProgress, { passive: true }); onProgress();
    if (toTop) {
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    $('#modal').addEventListener('click', function (e) { if (e.target === $('#modal')) closeModal(); });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (b) openObject(parseInt(b.getAttribute('data-open'), 10));
    });

    var year = $('#year'); if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------- лёгкий параллакс первого экрана ----------
     Текст героя при прокрутке чуть отстаёт и тает — эффект глубины,
     как в кино. Отключается, если в системе выбрано «меньше движения». */
  function wireParallax() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var heroIn = document.querySelector('.hero-in');
    if (!heroIn || reduce || !window.requestAnimationFrame) return;
    var ticking = false;
    var apply = function () {
      var y = window.scrollY || window.pageYOffset || 0;
      var h = window.innerHeight || 800;
      if (y <= h) {
        heroIn.style.transform = 'translateY(' + (y * 0.14).toFixed(1) + 'px)';
        heroIn.style.opacity = Math.max(0, 1 - y / (h * 0.85)).toFixed(2);
      }
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  }

  function init() {
    fillStatic();
    buildTabs();
    buildDistricts();
    wireForms();
    wireUI();
    wireStatsCount();
    wireParallax();
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

/* =====================================================================
   Дополнительная интерактивность (2026-10-14): волна от клика на кнопках,
   полоса прогресса страницы, 3D-наклон карточек объектов, «магнитные»
   кнопки первого экрана, неоновоe свечение за курсором.
   Учитывает prefers-reduced-motion; на touch-устройствах наклон и свечение
   отключаются — там они не нужны.
   ===================================================================== */
(function () {
  'use strict';
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqFine = window.matchMedia ? window.matchMedia('(pointer:fine)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function fine() { return !!(mqFine && mqFine.matches); }

  /* --- 1. Полоса прогресса чтения --- */
  (function () {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function apply() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener('resize', apply, { passive: true });
    apply();
  })();

  /* --- 2. Волна от клика на любой кнопке --- */
  document.addEventListener('click', function (e) {
    if (reduced()) return;
    var btn = e.target.closest ? e.target.closest('.btn') : null;
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    var d = Math.max(r.width, r.height);
    var sp = document.createElement('span');
    sp.className = 'btn-ripple';
    sp.style.width = sp.style.height = d + 'px';
    sp.style.left = (e.clientX - r.left - d / 2) + 'px';
    sp.style.top = (e.clientY - r.top - d / 2) + 'px';
    btn.appendChild(sp);
    setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 660);
  });

  /* --- 3. 3D-наклон карточек объектов + блик (делегирование: работает после фильтров) --- */
  (function () {
    if (!fine() || reduced()) return;
    var current = null, ticking = false, lastX = 0, lastY = 0;
    function release(card) {
      if (!card) return;
      card.classList.remove('tilting');
      card.style.transform = '';
    }
    function apply() {
      ticking = false;
      if (!current) return;
      var r = current.getBoundingClientRect();
      var x = (lastX - r.left) / r.width - .5;
      var y = (lastY - r.top) / r.height - .5;
      current.style.transform = 'perspective(950px) rotateX(' + (-y * 5).toFixed(2) +
        'deg) rotateY(' + (x * 6.5).toFixed(2) + 'deg) translateY(-5px)';
      current.style.setProperty('--mx', ((x + .5) * 100).toFixed(1) + '%');
      current.style.setProperty('--my', ((y + .5) * 100).toFixed(1) + '%');
    }
    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (card !== current) { release(current); current = card; if (current) current.classList.add('tilting'); }
      if (!current) return;
      lastX = e.clientX; lastY = e.clientY;
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { release(current); current = null; });
  })();

  /* --- 4. «Магнитные» кнопки первого экрана --- */
  (function () {
    if (!fine() || reduced()) return;
    var btns = document.querySelectorAll('.hero-acts .btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        b.style.transform = 'translate(' + (x * .16).toFixed(1) + 'px,' + (y * .3 - 2).toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  })();

  /* --- 5. Неоновое свечение за курсором (только мышь) --- */
  (function () {
    if (!fine() || reduced()) return;
    var g = document.createElement('div');
    g.className = 'cursor-glow';
    g.setAttribute('aria-hidden', 'true');
    document.body.appendChild(g);
    var tx = -500, ty = -500, cx = -500, cy = -500, raf = null;
    function loop() {
      cx += (tx - cx) * .12; cy += (ty - cy) * .12;
      g.style.transform = 'translate3d(' + (cx - 210).toFixed(1) + 'px,' + (cy - 210).toFixed(1) + 'px,0)';
      raf = (Math.abs(tx - cx) > .4 || Math.abs(ty - cy) > .4) ? requestAnimationFrame(loop) : null;
    }
    document.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('mouseleave', function () {
      tx = -500; ty = -500;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  })();
})();

/* =====================================================================
   Ипотечный калькулятор + интерактивная карта районов (2026-10-14).
   Карта дружит с существующим фильтром #f-district: клик по району
   отправляет select'у событие change — каталог фильтруется штатно.
   ===================================================================== */
(function () {
  'use strict';
  function $(s) { return document.querySelector(s); }
  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function plural(n, a, b, c) {
    var m = n % 100, k = n % 10;
    if (m > 10 && m < 20) return c;
    if (k === 1) return a;
    if (k > 1 && k < 5) return b;
    return c;
  }

  /* ---------- 1. Калькулятор ипотеки ---------- */
  var price = $('#c-price'), down = $('#c-down'), years = $('#c-years'), rate = $('#c-rate');
  if (price && down && years && rate) {
    var oPrice = $('#c-price-out'), oDown = $('#c-down-out'), oYears = $('#c-years-out'), oRate = $('#c-rate-out');
    var oMonthly = $('#c-monthly'), oLoan = $('#c-loan'), oOver = $('#c-over'), oTotal = $('#c-total');
    var downHint = $('#c-down-hint');
    var monthlyShown = 0, tweenRaf = null;

    function setFill(inp) {
      var min = +inp.min, max = +inp.max, v = +inp.value;
      inp.style.setProperty('--fill', ((v - min) / (max - min) * 100).toFixed(2) + '%');
    }

    function tweenMonthly(to) {
      if (tweenRaf) cancelAnimationFrame(tweenRaf);
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || Math.abs(to - monthlyShown) < 2) {
        monthlyShown = to; oMonthly.textContent = fmt(to) + ' ₽'; return;
      }
      var from = monthlyShown, start = performance.now(), dur = 260;
      (function step(t) {
        var p = Math.min(1, (t - start) / dur);
        p = 1 - Math.pow(1 - p, 3);
        monthlyShown = from + (to - from) * p;
        oMonthly.textContent = fmt(monthlyShown) + ' ₽';
        if (p < 1) tweenRaf = requestAnimationFrame(step);
      })(start);
    }

    function recalc() {
      var P = +price.value, dp = +down.value, Y = +years.value, R = +rate.value;
      var downSum = P * dp / 100;
      var loan = Math.max(0, P - downSum);
      var n = Y * 12, r = R / 100 / 12, monthly;
      if (loan <= 0) monthly = 0;
      else if (r === 0) monthly = loan / n;
      else monthly = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

      oPrice.textContent = fmt(P) + ' ₽';
      oDown.textContent = fmt(downSum) + ' ₽ · ' + dp + '%';
      oYears.textContent = Y + ' ' + plural(Y, 'год', 'года', 'лет');
      oRate.textContent = String(R).replace('.', ',') + '%';
      oLoan.textContent = fmt(loan) + ' ₽';
      oOver.textContent = fmt(Math.max(0, monthly * n - loan)) + ' ₽';
      oTotal.textContent = fmt(monthly * n) + ' ₽';
      tweenMonthly(monthly);
      if (downHint) downHint.hidden = dp >= 15;
      [price, down, years, rate].forEach(setFill);
    }

    [price, down, years, rate].forEach(function (inp) {
      inp.addEventListener('input', recalc);
      setFill(inp);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.calc-prog'), function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-rate');
        if (v) rate.value = v; else rate.focus();
        recalc();
        Array.prototype.forEach.call(document.querySelectorAll('.calc-prog'), function (x) { x.classList.remove('on'); });
        if (v) b.classList.add('on');
      });
    });

    var apply = $('#c-apply');
    if (apply) apply.addEventListener('click', function () {
      var P = +price.value, dp = +down.value, Y = +years.value, R = +rate.value;
      var want = $('#ld-want'); if (want) want.value = 'Помощь с ипотекой';
      var budget = $('#ld-budget');
      if (budget) budget.value = 'Ипотека: объект ~' + fmt(P) + ' ₽, взнос ' + fmt(P * dp / 100) + ' ₽ (' + dp + '%), ' + Y + ' ' + plural(Y, 'год', 'года', 'лет') + ', ставка ' + String(R).replace('.', ',') + '%';
      var msg = $('#ld-message');
      if (msg) msg.value = 'Расчёт с сайта: ежемесячный платёж ' + fmt(monthlyShown) + ' ₽, сумма кредита ' + fmt(Math.max(0, P - P * dp / 100)) + ' ₽. Прошу помочь с одобрением и подбором программы.';
      var lead = $('#lead');
      if (lead) lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { var nm = $('#ld-name'); if (nm) nm.focus({ preventScroll: true }); }, 750);
    });

    recalc();
  }

})();

/* =====================================================================
   Предложения банков: платёж в каждой карточке пересчитывается живьём
   под параметры калькулятора; «Посчитать с этой ставкой» подставляет
   ставку банка в общий расчёт. Данные: обзор ДОМ.РФ, октябрь 2026.
   ===================================================================== */
(function () {
  'use strict';
  var strip = document.getElementById('bank-strip');
  var price = document.getElementById('c-price');
  var down = document.getElementById('c-down');
  var years = document.getElementById('c-years');
  var rate = document.getElementById('c-rate');
  if (!strip || !price || !down || !years || !rate) return;

  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function annuity(loan, n, R) {
    if (loan <= 0) return 0;
    var r = R / 100 / 12;
    if (r === 0) return loan / n;
    return loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  function effectiveRate(card) {
    var sel = card.querySelector('select');
    return +(sel ? sel.value : card.getAttribute('data-rate'));
  }
  function update() {
    var P = +price.value, dp = +down.value, n = +years.value * 12;
    var loan = Math.max(0, P - P * dp / 100);
    Array.prototype.forEach.call(strip.querySelectorAll('.bank-card'), function (card) {
      var R = effectiveRate(card);
      var out = card.querySelector('[data-pay]');
      if (out) out.textContent = fmt(annuity(loan, n, R)) + ' ₽/мес';
      var ro = card.querySelector('[data-rate-out]');
      if (ro) ro.textContent = String(R).replace('.', ',') + '%';
    });
  }

  [price, down, years, rate].forEach(function (inp) {
    inp.addEventListener('input', update);
  });
  Array.prototype.forEach.call(strip.querySelectorAll('select'), function (s) {
    s.addEventListener('change', update);
  });
  /* чипы программ меняют ставку без события input — обновляем следом */
  Array.prototype.forEach.call(document.querySelectorAll('.calc-prog'), function (b) {
    b.addEventListener('click', function () { setTimeout(update, 0); });
  });
  Array.prototype.forEach.call(strip.querySelectorAll('.bank-use'), function (b) {
    b.addEventListener('click', function () {
      var card = b.closest('.bank-card');
      if (!card) return;
      rate.value = String(effectiveRate(card));
      rate.dispatchEvent(new Event('input', { bubbles: true }));
      Array.prototype.forEach.call(document.querySelectorAll('.calc-prog'), function (x) { x.classList.remove('on'); });
      rate.focus({ preventScroll: true });
    });
  });
  update();
})();
