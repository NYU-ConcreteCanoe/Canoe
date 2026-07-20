/* ==============================================
   NYU CONCRETE CANOE - FRONT PAGE ANNOUNCEMENTS
   Renders assets/data/announcements.json into the
   existing .card / .grid / .tag visual vocabulary.
   No new CSS is required by this module.
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

    // .timeline-year is reused for the date chip and .tag for the category,
    // both already defined in style.css.
    return (
      '<article class="card announcement-card">' +
      '<div class="announcement-meta">' +
      (date ? '<span class="timeline-year">' + esc(date) + "</span>" : "") +
      '<span class="tag">' + category + "</span>" +
      (post.pinned ? '<span class="tag">Pinned</span>' : "") +
      "</div>" +
      "<h3>" + esc(post.title) + "</h3>" +
      (image
        ? '<img class="announcement-image" src="' + esc(image) +
          '" alt="' + esc(post.title) + '" loading="lazy" ' +
          "onerror=\"this.remove()\">"
        : "") +
      "<p>" + esc(post.body) + "</p>" +
      (link
        ? '<a class="btn announcement-link" href="' + esc(safeUrl(link.url)) +
          '">' + esc(link.text || "Read more") + "</a>"
        : "") +
      "</article>"
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

        var max = Number(settings.maxVisible) > 0 ? Number(settings.maxVisible) : 3;
        var visible = posts.slice().sort(sortPosts).slice(0, max);

        container.innerHTML =
          "<h2>" + esc(settings.heading || "Latest News") + "</h2>" +
          '<div class="grid">' + visible.map(renderCard).join("") + "</div>";
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
