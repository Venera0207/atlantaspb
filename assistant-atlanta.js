/* ============================================================
   АССISTENT «АТЛАНТА» — чат-бот агентства недвижимости «Атланта» (СПб)
   Движок адаптирован из assistant.js Венеры (venera-portfolio),
   но самодостаточен и 테마-адаптивен: красится в CSS-переменные сайта-носителя
   (подходит ко всем трём вариантам сайта Атланты).
   • Мгновенные ответы из локальной базы знаний (работает даже без сети трубы).
   • Живые ответы из каталога: читает window.OBJECTS со страницы.
   • Сложные вопросы — нейросети через Google Apps Script (JSONP),
     если на <script> задан data-pipe="https://.../exec".
   • Заявки и журнал диалогов уходят в трубу (source = atlanta-<хост>).
   РЕДАКТИРОВАНИЕ ОТВЕТОВ: блок KB ниже.
   ============================================================ */
(function () {
  'use strict';

  /* Адрес трубы берём из data-pipe собственного <script>; пусто = офлайн-режим */
  var me = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var PIPE_URL = ((me && me.getAttribute('data-pipe')) || '').trim();

  var TEL_DISPLAY = '+7 911 005-57-41';
  var TEL_HREF = 'tel:+79110055741';
  var WA_HREF = 'https://wa.me/79110055741';
  var EMAIL = 'atlanta-spb@yandex.ru';
  var ADDRESS = 'Шлиссельбургский пр., 24, к1, офис 389, 8 минут пешком от м. «Рыбацкое»';
  var HOURS = 'Будни 10:00–20:00, суббота и воскресенье 10:00–18:00';

  /* ---------- живой каталог ---------- */
  function activeObjects() {
    return (window.OBJECTS || []).filter(function (o) { return o.status === 'active'; });
  }
  function money(n) { return Math.round(n).toLocaleString('ru-RU'); }
  function priceOf(o) {
    if (o.price == null) return 'цена по запросу';
    return money(o.price) + ' ₽' + ((o.type === 'rent' || o.rentlike) ? ' в месяц' : '');
  }
  function listObjects(arr, n) {
    return arr.slice(0, n).map(function (o) { return '• ' + o.title + ' — ' + priceOf(o); }).join('\n');
  }
  function byType(t) { return activeObjects().filter(function (o) { return o.type === t; }); }
  function byDistrict(d) { return activeObjects().filter(function (o) { return o.district === d; }); }

  /* ---------- карточка объекта: этаж, площадь и цена из живого каталога ----------
     Вопрос про КОНКРЕТНЫЙ объект («какой этаж в ЖК Viva?») не должен превращаться
     в общую выдачу каталога: бот показывает карточку объекта и ведёт к контакту. */
  var STOP_WORDS = { 'квартира':1,'квартиры':1,'квартиру':1,'квартир':1,'квартира,':1,'дом':1,'дома':1,'жк':1,'гк':1,'проспект':1,'улица':1,'метро':1,'район':1,'в':1,'на':1,'у':1,'и':1,'с':1,'от':1,'до':1,'для':1,'за':1,'по':1,'или':1,'а':1,'к':1,'из':1,'о':1,'что':1,'как':1,'какой':1,'какая':1,'какое':1,'сколько':1,'этот':1,'эта':1,'это':1,'ваш':1,'ваша':1,'сейчас':1,'есть':1,'купить':1,'снять':1,'объект':1,'объекта':1,'вариант':1,'новостройка':1,'новостройки':1,'срочно':1,'купим':1,'снимем':1,'хозяина':1,'клиента':1,'продать':1,'продается':1,'продаётся':1,'сдаётся':1,'сдается':1,'продают':1,'ищут':1 };
  var PLACE_WORDS = ['novogorelovo', 'yanino', 'rybatskoe', 'peterburg', 'novogorelovoe'];
  function titleWords(o) {
    return norm(o.title).split(' ').filter(function (w) {
      if (w.length < 4 || STOP_WORDS[w]) return false;
      for (var i = 0; i < PLACE_WORDS.length; i++) if (w === PLACE_WORDS[i]) return false;
      return true;
    });
  }
  function findObject(q) {
    var t = norm(q), best = null, bestScore = 0;
    activeObjects().forEach(function (o) {
      var sc = 0;
      titleWords(o).forEach(function (w) { if (t.indexOf(w) !== -1) sc += w.length; });
      if (sc > bestScore) { bestScore = sc; best = o; }
    });
    return bestScore >= 4 ? best : null;
  }
  var ATTR_WORDS = ['этаж', 'планиров', 'площад', 'метраж', 'квадратн', 'сколько метров', 'балкон', 'лоджи', 'ремонт', 'сдан', 'сдача', 'год постройки', 'санузел', 'вид из', 'потолк', 'кухня'];
  function asksAttr(q) {
    var t = norm(q);
    for (var i = 0; i < ATTR_WORDS.length; i++) if (t.indexOf(ATTR_WORDS[i]) !== -1) return true;
    return false;
  }
  var CARD_LEAD = 'Расскажу подробнее и запишу на показ: оставьте телефон или @telegram — передам ваш вопрос менеджеру агентства, и она перезвонит.';
  var GEN_DETAIL = 'Такие детали по объекту (этаж, площадь, планировка, документы) подскажет менеджер агентства — по каждой карточке каталога они есть. Оставьте телефон или @telegram: передам ваш вопрос, и менеджер перезвонит с ответом.';
  function cardReply(o) {
    var attrs = [];
    if (o.area) attrs.push(o.area + ' м²');
    if (o.floor && ['—', 'уточняется', 'есть выбор'].indexOf(o.floor) === -1) attrs.push('этаж ' + o.floor);
    attrs.push(priceOf(o));
    var extra = '';
    if (o.floor === 'уточняется') extra = ' Точный этаж уточнит менеджер.';
    if (o.floor === 'есть выбор') extra = ' Этажи на выбор — менеджер подскажет свободные.';
    return '«' + o.title + '»' + (o.district ? ', ' + o.district : '') + ': ' + attrs.join(', ') + '.' + extra + '\n\n' + CARD_LEAD;
  }
  function objectCard(q) {
    var o = findObject(q);
    if (o) return cardReply(o);
    if (asksAttr(q)) return GEN_DETAIL;
    return null;
  }

  /* ---------- база знаний ---------- */
  var KB = [
    { k: ['здравств', 'привет', 'добрый день', 'добрый вечер', 'хай'], s: 1,
      a: 'Здравствуйте! Я ИИ-ассистент агентства «Атланта». Подскажу по объектам каталога, ипотеке, продаже и аренде, контактам и часам работы. Опишите вопрос своими словами.' },
    { k: ['спасибо', 'благодар'], s: 1,
      a: 'Пожалуйста! Я на связи круглосуточно, а менеджер агентства — в рабочее время: ' + TEL_DISPLAY + ' (телефон и WhatsApp).' },

    { k: ['купить', 'покупка', 'продаётся', 'в продаже', 'каталог', 'объект', 'квартир', 'новострой', 'вариант подбер', 'подбор'], c: 1,
      a: function () {
        var sale = byType('sale'), nb = byType('newbuild');
        var all = sale.concat(nb);
        if (!all.length) return 'Каталог сейчас обновляется — менеджер подскажет варианты, включая те, которых нет в открытых объявлениях: ' + TEL_DISPLAY + '.';
        return 'Сейчас в каталоге ' + all.length + ' объект(а) на продажу и новостройки:\n' + listObjects(all, 4) +
          '\n\nПолный каталог с фильтрами по районам, комнатам и цене — в разделе «Объекты» на этой странице. Подберу под ваш бюджет: напишите район и сумму.';
      } },
    { k: ['рыбацкое', 'невск', 'большевик', 'янин', 'новогорел', 'всеволожск', 'ломоносовск', 'район'], c: 1, p: 1,
      a: function (q) {
        var map = [
          ['рыбацкое', 'Невский р-н'], ['невск', 'Невский р-н'], ['большевик', 'Невский р-н'],
          ['янин', 'Всеволожский р-н (ЛО)'], ['всеволожск', 'Всеволожский р-н (ЛО)'],
          ['новогорел', 'Ломоносовский р-н (ЛО)'], ['ломоносовск', 'Ломоносовский р-н (ЛО)']
        ];
        var t = q.toLowerCase();
        for (var i = 0; i < map.length; i++) {
          if (t.indexOf(map[i][0]) !== -1) {
            var arr = byDistrict(map[i][1]);
            if (/сн|аренд/.test(t)) arr = arr.filter(function (o) { return o.type === 'rent'; });
            else if (/куп|прода|новостр/.test(t)) arr = arr.filter(function (o) { return o.type === 'sale' || o.type === 'newbuild'; });
            if (!arr.length) return 'В районе «' + map[i][1] + '» открытых объектов сейчас нет — но у агентства есть варианты вне публичных объявлений. Позвоните: ' + TEL_DISPLAY + ', подберём под ваш запрос.';
            return 'В районе «' + map[i][1] + '» сейчас ' + arr.length + ' объект(а):\n' + listObjects(arr, 5) +
              '\n\nПодробнее и запись на показ — по телефону ' + TEL_DISPLAY + ' или в WhatsApp.';
          }
        }
        return 'Подскажу по районам: у агентства объекты в Невском районе СПб, Всеволожском и Ломоносовском районах ЛО, а также заявки «купим/снимем» по любому району СПб и ЛО. Назовите район — покажу, что там есть сейчас.';
      } },
    { k: ['аренд', 'снять', 'съём', 'сдам', 'найм'], c: 1,
      a: function () {
        var rent = byType('rent');
        var base = 'Аренда в «Атланте»: проверка жильцов и документов, договор аренды, сопровождение до передачи ключей — наймодатель защищён договором.';
        if (rent.length) return base + '\n\nСейчас сдаётся:\n' + listObjects(rent, 3);
        var want = byType('request').filter(function (o) { return o.rentlike; });
        return base + (want.length ? '\n\nКстати, клиенты агентства сейчас ищут аренду:\n' + listObjects(want, 2) + '\nЕсли у вас есть похожий объект — предложите его в форме «Продать или сдать».' : '\n\nВарианты под запрос подберёт менеджер: ' + TEL_DISPLAY + '.');
      } },
    { k: ['продам', 'продать', 'сдавать', 'сдать свою', 'своя квартира', 'мой объект', 'оценить квартиру перед продажей', 'хочу продать', 'хочу сдать'], c: 1,
      a: function () {
        var req = byType('request');
        var tail = req.length ? '\n\nСейчас клиенты агентства ищут именно такие объекты:\n' + listObjects(req, 3) + '\nВозможно, ваш — тот самый.' : '';
        return 'Продажа или сдача вашего объекта: оценка и консультация бесплатно, показы с первого дня, проверка документов, нотариат и безопасные взаиморасчёты. Форма «Продать или сдать свой объект» — в разделе «Заявки» на странице.' + tail;
      } },
    { k: ['ипотек', 'семейная', 'маткапитал', 'материнск', 'сертификат', 'субсид', 'военная ипотек', 'ит-ипотек', 'it-ипотек'], c: 1,
      a: 'Ипотека любой сложности — консультация бесплатна. Семейная ипотека в СПб и ЛО с 01.10.2026: 1 ребёнок — 12%, 2 — 10%, 3 — 8%, 4 — 6%, 5 и больше — 4%; при взносе от 50% — 6% независимо от числа детей (хотя бы один ребёнок младше 7 лет). IT-ипотека — для объектов в Ленинградской области. Материнский капитал, жилищные и военные сертификаты, субсидии — работаем. На странице есть калькулятор: посчитайте платёж и отправьте расчёт в заявку.' },
    { k: ['выкуп', 'срочно продать', 'деньги сейчас', 'срочный выкуп'], c: 1,
      a: 'Срочный выкуп: агентство выкупит объект быстро, когда деньги нужны сейчас. Прозрачные условия, грамотное оформление и безопасные взаиморасчёты. Позвоните — обсудим: ' + TEL_DISPLAY + '.' },
    { k: ['оценк', 'сколько стоит моя', 'стоимость моей', 'оцените'], c: 1,
      a: 'Оценка стоимости бесплатна: сравним ваш объект с похожими на рынке — вы будете знать реальную цену ещё до выхода на сделку. Оставьте заявку в форме «Продать или сдать» или позвоните: ' + TEL_DISPLAY + '.' },
    { k: ['юрист', 'юридич', 'нотари', 'документ', 'приватизац', 'наследств', 'сопровожден', 'обмен', 'встречная покупка', 'цепочк'], c: 1,
      a: 'Юрист и сопровождение сделок: проверка юридической чистоты, нотариат, регистрация прав, приватизация, наследство, цепочки «продажа + встречная покупка» любой сложности. Юридические консультации — бесплатно.' },
    { k: ['контакт', 'телефон', 'позвон', 'адрес', 'как доехать', 'как добраться', 'офис', 'часы', 'график', 'работаете', 'выходн', 'написать', 'ватсап', 'whatsapp', 'почта'],
      a: 'Контакты агентства «Атланта»: телефон и WhatsApp ' + TEL_DISPLAY + '; почта ' + EMAIL + '. Адрес: ' + ADDRESS + '. Часы работы: ' + HOURS + '. Показы — в удобное для вас время, включая выходные.' },
    { k: ['показ', 'просмотр', 'посмотреть квартиру', 'записаться на'], c: 1,
      a: 'Показы проводятся в удобное для вас время, включая выходные. Записаться просто: позвоните или напишите в WhatsApp ' + TEL_DISPLAY + ' — менеджер согласует дату и место встречи.' },
    { k: ['услуг', 'чем занимает', 'направлен', 'что вы дела'],
      a: '«Атланта» — агентство полного цикла с 1995 года: покупка и продажа жилья, дачи и участки, коммерческая и элитная недвижимость, аренда, срочный выкуп, оценка, юрист и сопровождение сделок, ипотека и сертификаты. Консультация и расчёт — бесплатно.' },
    { k: ['коммерческ', 'офис', 'склад', 'производств', 'торгов'], c: 1,
      a: 'Коммерческая недвижимость: офисы, склады, производственные, торговые и универсальные помещения — покупка, продажа и аренда под вашу сферу деятельности. Расскажите о задаче — подберём варианты.' },
    { k: ['элитн', 'премиум'], c: 1,
      a: 'Элитная недвижимость: подбор и продажа объектов премиум-класса — деликатность, конфиденциальность и внимание к деталям на каждом шаге.' },
    { k: ['дач', 'коттедж', 'участок', 'загород', 'земля'], c: 1,
      a: 'Дачи, коттеджи и участки в Петербурге и области: продажа, покупка, подбор и аренда; проверка документов и статуса земли перед сделкой, включая перевод участков из одной категории в другую.' },
    { k: ['отзыв', 'рекоменд', 'доверя'],
      a: 'Агентство публикует только настоящие отзывы с разрешения клиентов: после каждой сделки Раиса Ивановна лично связывается с клиентами и просит поделиться впечатлениями. Раздел отзывов на сайте пополняется — первые публикации совсем скоро.' },
    { k: ['акци', 'бонус', 'спецпредложен'],
      a: 'У агентства действуют акции и бонусы — текущие условия менеджер расскажет при обращении: ' + TEL_DISPLAY + ' (телефон и WhatsApp).' },
    { k: ['скидк', 'дешевл', 'торг', 'комиссия ниже', 'подешев'], e: 1, p: 1,
      a: 'Условия агентства гибкие в разумных пределах: есть акции и специальные предложения. Конкретику обсудит менеджер — передам ваш вопрос и перезвоним.' },
    { k: ['комисси', 'сколько берёте', 'стоимость услуг', 'цена услуг', 'почём услуги'], c: 1,
      a: 'Консультация, оценка объекта и подбор ипотечной программы — бесплатно. Стоимость сопровождения сделки зависит от задачи и объекта и обсуждается лично с менеджером — без скрытых платежей. Позвоните: ' + TEL_DISPLAY + '.' },
    { k: ['директор', 'руковод', 'каштанова', 'кто глав'],
      a: 'Генеральный директор «Атланты» — Раиса Ивановна Каштанова, в недвижимости с 1995 года. После каждой сделки она лично связывается с клиентами: репутацией здесь дорожат больше всего.' },
    { k: ['сколько лет', 'с 1995', 'опыт агентств', 'история', 'давн'],
      a: '«Атланта» работает в Санкт-Петербурге с 1995 года — 30 лет на рынке города и области. Принцип не изменился: за каждую сделку агентство отвечает своей репутацией.' },
    { k: ['кто ты', 'ты кто', 'ты человек', 'ты робот', 'как работаешь'],
      a: 'Я — ИИ-ассистент агентства «Атланта»: отвечаю мгновенно из базы знаний агентства и живого каталога объектов, а сложные вопросы передаю менеджерам. Заявки и диалоги сохраняются, чтобы вам не пришлось пересказывать всё заново.' }
  ];

  var GREETING = 'Привет! Я ИИ-ассистент «Атланты». Отвечаю про объекты каталога, ипотеку, продажу, аренду и контакты агентства. Что вас интересует?';
  var HOOK_TAIL = 'Если актуально — передам наш диалог менеджеру агентства: она перезвонит и всё расскажет лично. Просто оставьте контакт.';
  var SOFT_TAIL = 'Оставите телефон или @telegram — передам этот вопрос менеджеру агентства, и она перезвонит вам лично.';
  var FLOOR = 'По этому вопросу мне нужна помощь менеджера агентства. Оставьте контакт (телефон или @telegram) — вам перезвонят в рабочее время. А пока подскажу по объектам, ипотеке, продаже, аренде и контактам.';

  /* ---------- служебное ---------- */
  function norm(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  function kbMatch(text) {
    var t = norm(text), best = null, bestScore = 0;
    for (var i = 0; i < KB.length; i++) {
      if (KB[i].s) continue;
      var score = 0;
      for (var j = 0; j < KB[i].k.length; j++) {
        var kw = norm(KB[i].k[j]);
        if (kw && t.indexOf(kw) !== -1) score += kw.length;
      }
      if (score > 0 && KB[i].p) return KB[i];
      if (score > bestScore) { bestScore = score; best = KB[i]; }
    }
    return best;
  }
  function socialMatch(text) {
    var t = norm(text);
    for (var i = 0; i < KB.length; i++) {
      if (!KB[i].s) continue;
      for (var j = 0; j < KB[i].k.length; j++) {
        var kw = norm(KB[i].k[j]);
        if (kw && t.indexOf(kw) !== -1) return KB[i];
      }
    }
    return null;
  }
  function looksLikeContact(t) {
    if (/@[a-zа-я0-9_.\-]{3,}/i.test(t)) return true;
    if ((t.match(/\d/g) || []).length >= 10) return true;
    if (/\+?\d[\d\s\-()]{8,}/.test(t)) return true;
    return false;
  }

  var cbCounter = 0;
  function jsonp(url, timeoutMs, handlers) {
    var cbName = '__acb' + (++cbCounter);
    var script = document.createElement('script');
    var done = false;
    var timer = setTimeout(function () {
      if (done) return; done = true; cleanup(); handlers.timeout && handlers.timeout();
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cbName] = function (data) {
      if (done) return; done = true; cleanup(); handlers.ok && handlers.ok(data);
    };
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'callback=' + cbName;
    script.async = true;
    script.onerror = function () { if (done) return; done = true; cleanup(); handlers.fail && handlers.fail(); };
    document.body.appendChild(script);
  }

  /* Отправка в трубу: основной путь — POST (fetch, режим no-cors): в отличие
     от GET у него нет ограничения на длину адреса, поэтому тексты диалогов
     доходят до таблицы ПОЛНОСТЬЮ. Ответ при no-cors не читается — для журнала
     он и не нужен; для заявки успехом считаем сам факт доставки на сервер. */
  function sendPipe(payload, handlers) {
    if (!PIPE_URL) { handlers && handlers.fail && handlers.fail(); return; }
    if (window.fetch) {
      fetch(PIPE_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload)
      }).then(function () { handlers && handlers.ok && handlers.ok({ ok: true }); },
              function () { sendPipeGet_(payload, handlers); });
    } else {
      sendPipeGet_(payload, handlers);
    }
  }
  /* Запасной путь (очень старые браузеры или сбой POST): запрос GET,
     длинные тексты укорачиваем, чтобы адрес уместился в предел. */
  function sendPipeGet_(payload, handlers) {
    var q = [];
    for (var k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) {
        q.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(payload[k]).slice(0, 300)));
      }
    }
    jsonp(PIPE_URL + '?' + q.join('&'), 20000, handlers || {});
  }

  function sendLead(payload, onOk, onFail) {
    if (!PIPE_URL) { onFail && onFail(); return; }
    sendPipe({ action: 'lead', name: payload.name || '', contact: payload.contact || '',
               message: payload.message || '', source: payload.source || ('atlanta-' + location.hostname) },
      { ok: function () {
          log((payload.name ? payload.name + ' / ' : '') + payload.contact + ' / ' + (payload.message || ''),
              'Заявка принята: менеджер свяжется с клиентом.', 'lead');
          onOk && onOk();
        },
        fail: function () { onFail && onFail(); }, timeout: function () { onFail && onFail(); } });
  }
  function sendAlert(text) {
    if (!PIPE_URL) return;
    sendPipe({ action: 'alert', text: text }, {});
  }
  /* Запись в журнал диалогов: вопрос клиента, ПОЛНЫЙ ответ бота и тема ответа.
     Тема (outcome) — короткий код; труба сама превращает его в русский ярлык. */
  function log(client, bot, outcome) {
    if (!PIPE_URL) return;
    sendPipe({ action: 'log', page: location.pathname || '',
               client: String(client).slice(0, 1500), bot: String(bot).slice(0, 3000), outcome: outcome }, {});
  }

  /* ---------- интерфейс виджета ---------- */
  var state = { await: null, dialog: '', lastExchange: '', hookUsed: false, hist: [] };

  function buildUI() {
    var style = document.createElement('style');
    style.textContent =
      '.aa-dock{position:fixed;right:22px;bottom:22px;z-index:9998}' +
      '.aa-btn{width:68px;height:68px;padding:0;border:none;border-radius:50%;overflow:hidden;cursor:pointer;background:var(--surface,#fff);box-shadow:0 10px 28px rgba(0,0,0,.35),0 0 22px color-mix(in srgb,var(--accent,#8B5CF6) 40%,transparent);animation:aaFloat 4s ease-in-out infinite;transition:transform .2s var(--ease,ease)}' +
      '.aa-btn:hover{transform:scale(1.06)}' +
      '.aa-btn img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.aa-btn .aa-fallback{display:grid;place-items:center;width:100%;height:100%;font-size:30px;background:linear-gradient(135deg,var(--accent-2,#22D3EE),var(--accent,#8B5CF6))}' +
      '@keyframes aaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}' +
      '.aa-hint{position:absolute;right:calc(100% + 10px);top:50%;transform:translateY(-50%);white-space:nowrap;background:var(--surface,#14141F);color:var(--text,#EDEDF2);border:1px solid color-mix(in srgb,var(--accent,#8B5CF6) 55%,transparent);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .6s ease}' +
      '.aa-hint.show{opacity:1}' +
      '.aa-bubble{position:absolute;bottom:calc(100% + 12px);right:0;width:250px;background:var(--surface,#14141F);border:1px solid color-mix(in srgb,var(--accent,#8B5CF6) 55%,transparent);border-radius:14px;padding:12px 26px 12px 14px;color:var(--text,#EDEDF2);font-size:12.5px;line-height:1.45;display:none;box-shadow:0 12px 32px rgba(0,0,0,.4);cursor:pointer}' +
      '.aa-bubble.show{display:block}' +
      '.aa-bubble .x{position:absolute;top:5px;right:7px;background:none;border:none;color:var(--muted,#8b8b9a);cursor:pointer;font-size:14px;line-height:1}' +
      '.aa-panel{position:fixed;right:22px;bottom:100px;width:360px;max-width:calc(100vw - 24px);height:500px;max-height:calc(100vh - 130px);background:var(--surface,#0A0A12);color:var(--text,#eee);border:1px solid var(--border,rgba(255,255,255,.12));border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.45);display:none;flex-direction:column;overflow:hidden;z-index:9999;font-family:inherit}' +
      '.aa-panel.open{display:flex}' +
      '.aa-head{padding:14px 16px;border-bottom:1px solid var(--border,rgba(255,255,255,.12));display:flex;align-items:center;gap:10px}' +
      '.aa-head .dot{width:9px;height:9px;border-radius:50%;background:var(--ok,#4ADE80);box-shadow:0 0 10px var(--ok,#4ADE80)}' +
      '.aa-head .n{font-weight:700;font-size:14px}.aa-head .s{font-size:11px;color:var(--accent-2,#22D3EE)}' +
      '.aa-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}' +
      '.aa-msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}' +
      '.aa-msg.agent{background:var(--surface-2,rgba(255,255,255,.1));border:1px solid var(--border,transparent);align-self:flex-start}' +
      '.aa-msg.user{background:linear-gradient(135deg,var(--accent-2,#22D3EE),var(--accent,#8B5CF6));color:#fff;align-self:flex-end}' +
      '.aa-typing{display:none;padding:0 16px 10px;font-size:11px;color:var(--muted,#8b8b9a)}' +
      '.aa-typing.show{display:block}' +
      '.aa-input{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border,rgba(255,255,255,.12))}' +
      '.aa-input input{flex:1;background:var(--surface-2,rgba(255,255,255,.08));border:1px solid var(--border,rgba(255,255,255,.18));border-radius:10px;padding:10px;color:var(--text,#fff);font-size:13px;font-family:inherit}' +
      '.aa-input input:focus{outline:none;border-color:var(--accent-2,#22D3EE);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-2,#22D3EE) 18%,transparent)}' +
      '.aa-input button{border:none;border-radius:10px;background:linear-gradient(135deg,var(--accent-2,#22D3EE),var(--accent,#8B5CF6));color:#fff;padding:10px 14px;cursor:pointer;font-weight:600;font-family:inherit}' +
      '@media (max-width:480px){.aa-btn{width:58px;height:58px}.aa-panel{right:12px;bottom:88px}}' +
      '@media (prefers-reduced-motion: reduce){.aa-btn{animation:none}}' +
      '.aa-panel.aa-inline{position:static;width:100%;height:560px;max-height:none;box-shadow:none}';
    document.head.appendChild(style);

    var dock = document.createElement('div');
    dock.className = 'aa-dock';
    var bubble = document.createElement('div');
    bubble.className = 'aa-bubble';
    bubble.innerHTML = '<button class="x" aria-label="Закрыть">✕</button><span class="t"></span>';
    var btn = document.createElement('button');
    btn.className = 'aa-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Чат с ассистентом агентства «Атланта»');
    btn.innerHTML = '<img src="photos/logo.png" alt="" onerror="this.outerHTML=\'<span class=aa-fallback>🏛</span>\'">';
    var hint = document.createElement('span');
    hint.className = 'aa-hint';
    hint.textContent = 'Задайте вопрос — отвечу сразу';
    dock.appendChild(hint);
    setTimeout(function () { hint.classList.add('show'); }, 1600);
    dock.appendChild(bubble);
    dock.appendChild(btn);
    var panel = document.createElement('div');
    panel.className = 'aa-panel';
    panel.innerHTML =
      '<div class="aa-head"><span class="dot"></span><div><div class="n">Ассистент «Атланты»</div><div class="s">на связи</div></div></div>' +
      '<div class="aa-body"></div>' +
      '<div class="aa-typing">ассистент печатает…</div>' +
      '<div class="aa-input"><input type="text" placeholder="Напишите сообщение…" autocomplete="off"><button type="button">Отправить</button></div>';
    var host = document.getElementById('aa-inline');
    var inline = !!host;
    document.body.appendChild(dock);
    if (inline) { panel.classList.add('open', 'aa-inline'); host.appendChild(panel); }
    else document.body.appendChild(panel);

    var bodyEl = panel.querySelector('.aa-body');
    var typingEl = panel.querySelector('.aa-typing');
    var input = panel.querySelector('.aa-input input');
    var sendBtn = panel.querySelector('.aa-input button');
    var opened = false;

    var BUBBLES = [
      'Ищете квартиру в СПб или области? Покажу, что сейчас в каталоге «Атланты».',
      'Ипотека, материнский капитал, сертификаты? Подскажу программы и посчитаю платёж.',
      'Хотите продать или сдать объект? Оценка бесплатно — расскажу, с чего начать.'
    ];
    var bIdx = 0, bOff = false;
    function showBubble() {
      if (bOff || panel.classList.contains('open')) return;
      bubble.querySelector('.t').textContent = BUBBLES[bIdx % BUBBLES.length];
      bIdx++;
      bubble.classList.add('show');
    }
    bubble.querySelector('.x').addEventListener('click', function (e) { e.stopPropagation(); bOff = true; bubble.classList.remove('show'); });
    bubble.addEventListener('click', open);
    btn.addEventListener('click', open);
    setTimeout(showBubble, 7000);
    setInterval(function () { if (bIdx < BUBBLES.length) showBubble(); }, 30000);

    function open() {
      bubble.classList.remove('show');
      if (inline) {
        host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!opened) { opened = true; add('agent', GREETING); }
        setTimeout(function () { input.focus({ preventScroll: true }); }, 500);
        return;
      }
      panel.classList.toggle('open');
      hint.classList.remove('show');
      if (!opened && panel.classList.contains('open')) { opened = true; add('agent', GREETING); }
      if (panel.classList.contains('open')) input.focus();
    }
    function scroll() { bodyEl.scrollTop = bodyEl.scrollHeight; }
    function add(role, text) {
      var div = document.createElement('div');
      div.className = 'aa-msg ' + role;
      div.textContent = text;
      bodyEl.appendChild(div);
      scroll();
    }
    sendBtn.addEventListener('click', function () { route(input); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !sendBtn.disabled) route(input); });

    if (inline) { opened = true; add('agent', GREETING); }
    return {
      user: function (t) { add('user', t); },
      agent: function (t) { add('agent', t); },
      typing: function (on) { typingEl.classList.toggle('show', !!on); scroll(); },
      lock: function (on) { sendBtn.disabled = !!on; }
    };
  }

  /* ---------- диалог ---------- */
  function pushH(role, text) {
    state.hist.push({ role: role, text: String(text).slice(0, 400) });
    if (state.hist.length > 8) state.hist.shift();
  }

  function route(input) {
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    handle(text);
  }

  function handle(text) {
    U.user(text);
    pushH('user', text);

    /* режим эскалации: ждём контакт */
    if (state.await === 'esc_contact') {
      if (norm(text).indexOf('отмена') !== -1) {
        state.await = null;
        U.agent('Понял, не передаю. Я всё равно рядом для любых вопросов.');
        return;
      }
      if (looksLikeContact(text)) {
        var contact = text;
        state.await = null;
        U.typing(true);
        sendLead(
          { name: contact.split(/\s+/)[0], contact: contact, message: '[диалог из чата Атланты, ждёт звонка менеджера] ' + state.dialog },
          function () { U.typing(false); U.agent('✅ Передал диалог менеджеру агентства: вам перезвонят на оставленный контакт в рабочее время (' + HOURS + ').'); },
          function () { U.typing(false); U.agent('Не получилось отправить автоматически. Позвоните, пожалуйста, напрямую: ' + TEL_DISPLAY + ' или в WhatsApp.'); }
        );
        return;
      }
      /* ждём контакт, но не ругаем за осмысленный вопрос или «спасибо»:
         выходим из режима ожидания и отвечаем как обычно */
      var kbNow = kbMatch(text);
      if (!kbNow && !objectCard(text) && !socialMatch(text)) {
        U.agent('Похоже, это не контакт 🙂 Оставьте телефон (например, +7 9XX XXX-XX-XX) или @ник в Telegram — или напишите «отмена».');
        return;
      }
      state.await = null;
    }

    var card = objectCard(text);
    if (card) {
      U.typing(true);
      setTimeout(function () {
        U.typing(false);
        U.agent(card);
        pushH('agent', card);
        log(text, card, 'kb-object');
        state.lastExchange = 'Клиент: ' + text + ' | Бот: ' + card;
        state.dialog = state.lastExchange;
        state.await = 'esc_contact';
      }, 450 + Math.round(Math.random() * 450));
      return;
    }

    var intent = kbMatch(text);
    if (!intent && text.trim().length <= 40) intent = socialMatch(text);
    if (intent) {
      U.typing(true);
      setTimeout(function () {
        U.typing(false);
        var reply = typeof intent.a === 'function' ? intent.a(text) : intent.a;
        U.agent(reply);
        pushH('agent', reply);
        log(text, reply, intent.e ? 'esc-offer' : (intent.c ? 'kb-commercial' : 'kb'));
        state.lastExchange = 'Клиент: ' + text + ' | Бот: ' + reply;
        if (intent.e) {
          state.dialog = state.lastExchange;
          state.await = 'esc_contact';
          U.agent('Подскажите, как с вами связаться — телефон или @telegram — и я передам диалог менеджеру прямо сейчас.');
          sendAlert('Горячий вопрос клиента Атланты: «' + text + '». Диалог в журнале, ждём контакт.');
        } else if (intent.c) {
          if (!state.hookUsed) { state.hookUsed = true; U.agent(HOOK_TAIL); }
          else U.agent(SOFT_TAIL);
          state.dialog = state.lastExchange;
          state.await = 'esc_contact';
        }
      }, 450 + Math.round(Math.random() * 450));
      return;
    }

    /* сложный вопрос: нейросеть через трубу */
    if (PIPE_URL) {
      U.typing(true);
      jsonp(PIPE_URL + '?action=chat&msg=' + encodeURIComponent(text) + '&hist=' + encodeURIComponent(JSON.stringify(state.hist.slice(0, 6))), 45000, {
        ok: function (d) {
          U.typing(false);
          if (d && d.ok && d.reply) {
            U.agent(d.reply); pushH('agent', d.reply); log(text, d.reply, 'ai');
            state.lastExchange = 'Клиент: ' + text + ' | Бот: ' + d.reply;
            if (/передам|перезвон|оставьте контакт/i.test(d.reply)) { state.dialog = state.lastExchange; state.await = 'esc_contact'; }
          } else { floor(text); }
        },
        fail: function () { U.typing(false); floor(text); },
        timeout: function () { U.typing(false); floor(text); }
      });
    } else {
      floor(text);
    }
  }

  function floor(text) {
    U.agent(FLOOR);
    log(text, '(пол)', 'no-answer');
    sendAlert('Клиент Атланты не получил ответа: «' + text + '» (страница ' + (location.pathname || '') + ').');
    if (!state.hookUsed) { state.hookUsed = true; state.await = 'esc_contact'; state.dialog = 'Клиент: ' + text; }
  }

  var U = null;
  function init() {
    U = buildUI();
    if (PIPE_URL) jsonp(PIPE_URL + '?action=test', 10000, {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* крючки для самопроверок */
  window.ATLANTA_KB = {
    kb: function (t) { var m = kbMatch(t); if (!m) return null; return typeof m.a === 'function' ? m.a(t) : m.a; },
    card: function (t) { return objectCard(t); },
    handle: function (t) { handle(t); }
  };
})();
