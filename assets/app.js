/* Vensure Escalation Log — data-driven renderer (vanilla JS) */
(function () {
  "use strict";

  var DATA_URL = "data/escalations.json";
  var PEOPLE_URL = "data/people.json";
  var LOCKED_URL = "data/locked.json";

  /* ---- lucide-style inline SVG icons (no emoji) ---- */
  var ICONS = {
    alert: '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    tag: '<path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6Z"/><circle cx="7" cy="7" r="1.2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" stroke="none"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'
  };

  function ico(name, cls) {
    return '<svg class="svg-ico ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    var months = ["January","February","March","April","May","June","July",
      "August","September","October","November","December"];
    var m = parseInt(parts[1], 10) - 1;
    return months[m] + " " + parseInt(parts[2], 10) + ", " + parts[0];
  }

  function statusPill(status) {
    var s = String(status || "").toLowerCase();
    var cls = "pill", icon = "check";
    if (s.indexOf("open") === 0 || s.indexOf("open ") > -1 || s.indexOf("— open") > -1) {
      cls += " pill--attn"; icon = "alert";
    } else if (s.indexOf("resolved") > -1 || s.indexOf("closed") > -1) {
      cls += " pill--resolved"; icon = "check";
    }
    return '<span class="' + cls + '">' + ico(icon) + esc(status) + "</span>";
  }

  function fetchJson(url, optional) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function (err) {
        if (optional) return null; // registry is optional — degrade gracefully
        throw err;
      });
  }

  // Loads escalations (required) + people/company registry (optional)
  // + locked confidential blobs (optional). Returns { list, registry, locked }.
  function load() {
    return Promise.all([
      fetchJson(DATA_URL, false),
      fetchJson(PEOPLE_URL, true),
      fetchJson(LOCKED_URL, true)
    ]).then(function (res) {
      var d = res[0];
      var p = res[1] || {};
      var l = res[2] || {};
      return {
        list: (d && d.escalations) || [],
        registry: { people: (p && p.people) || {}, companies: (p && p.companies) || {} },
        locked: l || {}
      };
    });
  }

  /* ---- people / company registry helpers ---- */
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // company id -> initials-avatar bg class (color-blind-safe navy vs action-blue,
  // and the company is ALWAYS also shown as a text chip, never color alone).
  function avatarColorClass(companyId) {
    if (companyId === "crosspeak") return "av--crosspeak";
    if (companyId === "uniq") return "av--uniq";
    if (companyId === "paychex") return "av--paychex";
    return "av--vensure";
  }

  // Resolve a player {id, issueRole} against the registry. Returns null if unknown.
  function resolvePlayer(player, registry) {
    if (!player || !player.id) return null;
    var person = registry.people[player.id];
    if (!person) return null;
    var company = registry.companies[person.company] || null;
    var formerCompany = person.formerCompany ? (registry.companies[person.formerCompany] || null) : null;
    return { id: player.id, issueRole: player.issueRole || "", person: person, company: company, formerCompany: formerCompany };
  }

  function resolvePlayers(players, registry) {
    return (players || []).map(function (p) { return resolvePlayer(p, registry); })
      .filter(function (x) { return x; });
  }

  // Avatar markup with photo + onerror initials fallback. `size` = "card" | "stack".
  function avatarHtml(rp, size) {
    var person = rp.person;
    var companyId = person.company;
    var shortName = rp.company ? rp.company.shortName : "";
    var alt = person.name + (person.title ? ", " + person.title : "") + (shortName ? ", " + shortName : "");
    var colorCls = avatarColorClass(companyId);
    var ini = initials(person.name);
    // Initials fallback element (shown if no photo or photo fails to load).
    var fallback = '<span class="avatar-initials ' + colorCls + '" aria-hidden="true">' + esc(ini) + '</span>';
    var wrapCls = "avatar avatar--" + size + " " + colorCls;
    if (person.photo) {
      var onerr = "this.style.display='none';var f=this.nextElementSibling;if(f)f.style.display='flex';";
      return '<span class="' + wrapCls + '">' +
        '<img class="avatar-img" src="' + esc(person.photo) + '" alt="' + esc(alt) + '" ' +
          'loading="lazy" onerror="' + onerr + '">' +
        '<span class="avatar-initials ' + colorCls + '" aria-hidden="true" style="display:none">' + esc(ini) + '</span>' +
      '</span>';
    }
    // No photo: render initials, but keep an accessible label on the wrapper.
    return '<span class="' + wrapCls + '" role="img" aria-label="' + esc(alt) + '">' + fallback + '</span>';
  }

  /* ---------------- INDEX ---------------- */
  function renderIndex(el) {
    load().then(function (data) {
      var list = data.list, registry = data.registry;
      if (!list.length) {
        el.innerHTML = '<div class="notice"><h2>No escalations yet</h2><p>The log is empty.</p></div>';
        return;
      }
      var sorted = list.slice().sort(function (a, b) {
        return String(b.opened).localeCompare(String(a.opened)) || String(b.id).localeCompare(String(a.id));
      });
      el.innerHTML = sorted.map(function (e) {
        return '' +
          '<a class="esc-card" href="escalation.html?id=' + encodeURIComponent(e.id) + '">' +
            '<div class="card-top">' +
              '<span class="id-badge">#' + esc(e.id) + '</span>' +
              statusPill(e.status) +
            '</div>' +
            '<span class="card-cat">' + ico("tag") + esc(e.category) + '</span>' +
            '<h3>' + esc(e.title) + '</h3>' +
            '<p class="card-summary">' + esc(oneLine(e.summary)) + '</p>' +
            avatarStackHtml(resolvePlayers(e.players, registry)) +
            '<div class="card-meta">' +
              '<span class="meta-i">' + ico("calendar") + 'Opened ' + esc(fmtDate(e.opened)) + '</span>' +
              '<span class="card-cta">View details ' + ico("arrowRight") + '</span>' +
            '</div>' +
          '</a>';
      }).join("");
    }).catch(function (err) {
      el.innerHTML = '<div class="notice"><h2>Couldn\'t load the log</h2><p>' + esc(err.message) + '</p></div>';
    });
  }

  // Subtle overlapping avatar stack for index cards (max ~5, then "+N").
  function avatarStackHtml(resolved) {
    if (!resolved || !resolved.length) return "";
    var MAX = 5;
    var shown = resolved.slice(0, MAX);
    var extra = resolved.length - shown.length;
    var avatars = shown.map(function (rp) { return avatarHtml(rp, "stack"); }).join("");
    var more = extra > 0
      ? '<span class="avatar avatar--stack avatar--more" aria-hidden="true">+' + extra + '</span>'
      : "";
    var label = resolved.length + (resolved.length === 1 ? " person" : " people") + " involved";
    return '<div class="avatar-stack" role="img" aria-label="' + esc(label) + '">' +
      avatars + more + '</div>';
  }

  function oneLine(summary) {
    if (!summary) return "";
    var first = String(summary).split(/(?<=\.)\s/)[0];
    return first.length > 180 ? first.slice(0, 177) + "…" : first;
  }

  /* ---------------- DETAIL ---------------- */
  function getParam(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  function renderDetail(el) {
    var id = getParam("id");
    load().then(function (data) {
      var list = data.list, registry = data.registry, locked = data.locked || {};
      var e = list.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!e) {
        el.innerHTML =
          '<a class="back-link" href="index.html">' + ico("arrowLeft") + 'All escalations</a>' +
          '<div class="notice"><h2>Escalation not found</h2>' +
          '<p>No escalation matches the requested id' + (id ? ' "' + esc(id) + '"' : "") + '.</p>' +
          '<p><a href="index.html">Return to the escalation log ' + ico("arrowRight") + '</a></p></div>';
        return;
      }
      document.title = "Escalation #" + e.id + " — Vensure Escalation Log";

      el.innerHTML = '' +
        '<a class="back-link" href="index.html">' + ico("arrowLeft") + 'All escalations</a>' +
        '<header class="detail-header">' +
          '<div class="detail-headrow">' +
            '<span class="id-badge">#' + esc(e.id) + '</span>' +
            statusPill(e.status) +
            '<span class="card-cat">' + ico("tag") + esc(e.category) + '</span>' +
          '</div>' +
          '<h1>' + esc(e.title) + '</h1>' +
          '<div class="detail-meta">' +
            (e.account ? '<span class="meta-i">' + ico("user") + '<strong>' + esc(e.account) + '</strong></span>' : "") +
            '<span class="meta-i">' + ico("calendar") + 'Opened <strong>' + esc(fmtDate(e.opened)) + '</strong></span>' +
            '<span class="meta-i">' + ico("refresh") + 'Updated <strong>' + esc(fmtDate(e.updated)) + '</strong></span>' +
          '</div>' +
        '</header>' +

        playersSection(resolvePlayers(e.players, registry)) +

        section("Summary", "doc",
          '<p class="lede">' + esc(e.summary) + '</p>') +

        section("Impact", "alert",
          '<ul class="bullets">' + (e.impact || []).map(function (i) {
            return '<li>' + ico("alert") + esc(i) + '</li>';
          }).join("") + '</ul>') +

        section("Timeline", "clock", timelineHtml(e.timeline || [])) +

        section("What resolution looks like", "target",
          '<ol class="asks">' + (e.asks || []).map(function (a) {
            return '<li>' + esc(a) + '</li>';
          }).join("") + '</ol>') +

        lockedCardHtml(locked[String(e.id)]) +

        section("References", "list",
          '<ul class="refs">' + (e.references || []).map(function (r) {
            return '<li>' + ico("doc") + esc(r) + '</li>';
          }).join("") + '</ul>');

      // Wire the confidential unlock form (no-op if the card wasn't rendered).
      wireLockedCard(el, locked[String(e.id)]);
    }).catch(function (err) {
      el.innerHTML =
        '<a class="back-link" href="index.html">' + ico("arrowLeft") + 'All escalations</a>' +
        '<div class="notice"><h2>Couldn\'t load the log</h2><p>' + esc(err.message) + '</p></div>';
    });
  }

  function section(title, icon, body) {
    return '<section class="detail-section"><h2>' + ico(icon) + esc(title) + '</h2>' + body + '</section>';
  }

  // Company chip: logo (onerror hides img, keeps text) + shortName text.
  function companyChip(company) {
    if (!company) return "";
    var logo = company.logo
      ? '<img class="company-chip-logo" src="' + esc(company.logo) + '" alt="" ' +
        'onerror="this.style.display=\'none\'">'
      : "";
    return '<span class="company-chip">' + logo + esc(company.shortName || company.name || "") + '</span>';
  }

  // Turnover marker: rendered after the CURRENT company chip when a person has
  // since left a (former) vendor. Text + icon, never color alone. WCAG AA.
  function formerBadge(formerCompany) {
    if (!formerCompany) return "";
    var label = formerCompany.shortName || formerCompany.name || "";
    var title = "Was at " + label + " during this issue; has since left.";
    return '<span class="former-chip" title="' + esc(title) + '">' +
      ico("logout") + 'Formerly ' + esc(label) + '</span>';
  }

  function playerCard(rp) {
    var person = rp.person;
    var linkedinBtn = person.linkedin
      ? '<a class="player-linkedin" href="' + esc(person.linkedin) + '" target="_blank" ' +
        'rel="noopener noreferrer">' + ico("linkedin") + 'LinkedIn</a>'
      : "";
    return '' +
      '<div class="player-card">' +
        '<div class="player-top">' +
          avatarHtml(rp, "card") +
          '<div class="player-id">' +
            '<span class="player-name">' + esc(person.name) + '</span>' +
            '<span class="player-title">' + esc(person.title || "") + '</span>' +
            companyChip(rp.company) +
            formerBadge(rp.formerCompany) +
          '</div>' +
        '</div>' +
        (rp.issueRole ? '<p class="player-role">' + esc(rp.issueRole) + '</p>' : "") +
        linkedinBtn +
      '</div>';
  }

  function playersSection(resolved) {
    if (!resolved || !resolved.length) return "";
    var cards = resolved.map(playerCard).join("");
    return '<section class="detail-section players-section">' +
      '<h2>' + ico("users") + 'Players</h2>' +
      '<div class="players-grid">' + cards + '</div>' +
    '</section>';
  }

  function timelineHtml(items) {
    var legend =
      '<div class="tl-legend">' +
        '<span>' + ico("square") + ' Vensure entries</span>' +
        '<span>' + ico("circle") + ' CrossPeak entries</span>' +
      '</div>';
    var rows = items.map(function (t) {
      var isV = String(t.party).toLowerCase() === "vensure";
      var partyCls = isV ? "vensure" : "crosspeak";
      var nodeIcon = isV ? "square" : "circle";
      var chipLabel = isV ? "Vensure" : "CrossPeak";
      return '' +
        '<li class="tl-item tl-' + partyCls + '">' +
          '<span class="tl-node">' + ico(nodeIcon) + '</span>' +
          '<div class="tl-card">' +
            '<div class="tl-head">' +
              '<span class="party-chip ' + partyCls + '">' + ico(nodeIcon) + esc(chipLabel) + '</span>' +
              '<span class="tl-when">' + esc(fmtDate(t.date)) + ' · ' + esc(t.time) + '</span>' +
            '</div>' +
            '<div class="tl-head">' +
              '<span class="tl-actor">' + esc(t.actor) + '</span>' +
              '<span class="tl-role">' + esc(t.role) + '</span>' +
            '</div>' +
            '<p class="tl-text">' + esc(t.text) + '</p>' +
          '</div>' +
        '</li>';
    }).join("");
    return legend + '<ol class="timeline">' + rows + '</ol>';
  }

  /* ---------------- Confidential (client-side AES-GCM) ---------------- */
  // Returns "" when there is no blob for this escalation — card simply omitted.
  function lockedCardHtml(blob) {
    if (!blob || !blob.ct) return "";
    return '' +
      '<section class="detail-section locked-section" data-locked="1">' +
        '<h2>' +
          '<span class="lock-ico-wrap" data-lock-ico>' + ico("lock") + '</span>' +
          'Confidential analysis' +
          '<span class="locked-pill">' + ico("lock") + 'Locked</span>' +
        '</h2>' +
        '<div class="locked-card">' +
          '<div class="locked-gate" data-locked-gate>' +
            '<p class="locked-sub">CrossPeak internal — password required.</p>' +
            '<form class="locked-form" data-locked-form>' +
              '<label class="locked-label" for="locked-pw">Password</label>' +
              '<div class="locked-row">' +
                '<input class="locked-input" id="locked-pw" type="password" ' +
                  'autocomplete="off" autocapitalize="off" spellcheck="false" ' +
                  'aria-describedby="locked-err" />' +
                '<button class="locked-btn" type="submit">' + ico("unlock") + 'Unlock</button>' +
              '</div>' +
              '<p class="locked-err" id="locked-err" role="alert" hidden></p>' +
            '</form>' +
          '</div>' +
          '<div class="locked-body" data-locked-body hidden></div>' +
        '</div>' +
      '</section>';
  }

  async function unlockBlob(blob, password){
    var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
    var salt = b64(blob.salt), iv = b64(blob.iv), data = b64(blob.ct);
    var baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey(
      { name:'PBKDF2', salt: salt, iterations: blob.iter || 210000, hash:'SHA-256' },
      baseKey, { name:'AES-GCM', length:256 }, false, ['decrypt']);
    var plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv: iv }, key, data); // throws on wrong password
    return new TextDecoder().decode(plain);
  }

  function wireLockedCard(root, blob) {
    if (!blob || !blob.ct) return;
    var form = root.querySelector("[data-locked-form]");
    if (!form) return;
    var input = root.querySelector("#locked-pw");
    var errEl = root.querySelector("#locked-err");
    var gate = root.querySelector("[data-locked-gate]");
    var body = root.querySelector("[data-locked-body]");
    var lockIco = root.querySelector("[data-lock-ico]");
    var pill = root.querySelector(".locked-pill");

    function showError(msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      input.value = "";
      input.focus();
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      errEl.hidden = true;
      var pw = input.value;
      if (!pw) { showError("Enter the password."); return; }
      unlockBlob(blob, pw).then(function (html) {
        // Inject decrypted HTML fragment, then swap to the unlocked state.
        body.innerHTML = html;
        body.hidden = false;
        gate.hidden = true;
        if (lockIco) lockIco.innerHTML = ico("unlock");
        if (pill) { pill.innerHTML = ico("unlock") + "Unlocked"; pill.classList.add("locked-pill--open"); }
      }).catch(function () {
        showError("Incorrect password");
      });
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var idx = document.getElementById("escalation-list");
    if (idx) renderIndex(idx);
    var det = document.getElementById("escalation-detail");
    if (det) renderDetail(det);
  });
})();
