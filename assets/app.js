/* Vensure Escalation Log — data-driven renderer (vanilla JS) */
(function () {
  "use strict";

  var DATA_URL = "data/escalations.json";

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
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
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

  function load() {
    return fetch(DATA_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) { return (d && d.escalations) || []; });
  }

  /* ---------------- INDEX ---------------- */
  function renderIndex(el) {
    load().then(function (list) {
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
    load().then(function (list) {
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

        section("References", "list",
          '<ul class="refs">' + (e.references || []).map(function (r) {
            return '<li>' + ico("doc") + esc(r) + '</li>';
          }).join("") + '</ul>');
    }).catch(function (err) {
      el.innerHTML =
        '<a class="back-link" href="index.html">' + ico("arrowLeft") + 'All escalations</a>' +
        '<div class="notice"><h2>Couldn\'t load the log</h2><p>' + esc(err.message) + '</p></div>';
    });
  }

  function section(title, icon, body) {
    return '<section class="detail-section"><h2>' + ico(icon) + esc(title) + '</h2>' + body + '</section>';
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

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var idx = document.getElementById("escalation-list");
    if (idx) renderIndex(idx);
    var det = document.getElementById("escalation-detail");
    if (det) renderDetail(det);
  });
})();
