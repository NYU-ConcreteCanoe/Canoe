/* ==============================================
   NYU CONCRETE CANOE - FRONT PAGE ANNOUNCEMENTS
   Renders assets/data/announcements.json as a
   horizontal strip. Scrolling behaviour comes from
   drag-scroll.js; the scrollbar is hidden.
   ============================================== */

(function () {
  "use strict";

  // Announcement text is authored by team members through the admin panel,
  // so it is treated as untrusted and escaped rather than injected as HTML.
  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (c) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c];
      },
    );
  }

  // Only allow same-origin relative links or explicit http(s) URLs, so a
  // malformed entry cannot introduce a javascript: URL.
  function safeUrl(url) {
    var u = String(url == null ? "" : url).trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u) || /^[\w./#?=&%-]+$/.test(u)) return u;
    return "";
  }

  // "2026-06-22" -> "June 22, 2026". Parsed as UTC so the date does not
  // shift backwards a day for viewers west of GMT.
  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return "";
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function sortPosts(a, b) {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return String(b.date || "").localeCompare(String(a.date || ""));
  }

  function renderCard(post) {
    var date = formatDate(post.date);
    var category = esc(post.category || "news");
    var image = safeUrl(post.image);
    var link = post.link && safeUrl(post.link.url) ? post.link : null;

    return (
      '<article class="news-card">' +
      (image
        ? '<img class="news-image" src="' + esc(image) +
          '" alt="" loading="lazy" onerror="this.remove()">'
        : "") +
      '<div class="news-body">' +
      '<div class="news-meta">' +
      (date ? '<span class="news-date">' + esc(date) + "</span>" : "") +
      '<span class="tag">' + category + "</span>" +
      (post.pinned ? '<span class="tag">Pinned</span>' : "") +
      "</div>" +
      "<h3>" + esc(post.title) + "</h3>" +
      "<p>" + esc(post.body) + "</p>" +
      (link
        ? '<a class="news-link" href="' + esc(safeUrl(link.url)) + '">' +
          esc(link.text || "Read more") + "</a>"
        : "") +
      "</div></article>"
    );
  }

  function init() {
    var container = document.getElementById("announcements");
    if (!container) return;

    fetch("assets/data/announcements.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var posts = (data && data.announcements) || [];
        var settings = (data && data.settings) || {};

        // An empty board should leave no trace on the page rather than
        // rendering an empty heading.
        if (!posts.length) {
          container.remove();
          return;
        }

        var max = Number(settings.maxVisible) > 0 ? Number(settings.maxVisible) : 6;
        var visible = posts.slice().sort(sortPosts).slice(0, max);

        container.innerHTML =
          '<div class="news-head">' +
          "<h2>" + esc(settings.heading || "Latest News") + "</h2>" +
          '<p class="news-hint">Scroll or drag to see more</p>' +
          "</div>" +
          '<div class="news-rail" id="newsRail" tabindex="0" role="region" ' +
          'aria-label="Latest news, scrolls horizontally">' +
          visible.map(renderCard).join("") +
          "</div>";

        var rail = document.getElementById("newsRail");
        if (rail) {
          if (window.enableDragScroll) window.enableDragScroll(rail);
          if (visible.length < 2) rail.classList.add("is-short");
        }
      })
      .catch(function (err) {
        // The bulletin board is supplementary; if it fails to load the rest
        // of the homepage should be unaffected.
        console.error("Announcements failed to load:", err);
        container.remove();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
