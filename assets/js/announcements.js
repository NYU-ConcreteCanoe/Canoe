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

  /* ---------- Social embeds ---------- */

  // Only these hosts may be framed. An embed URL comes from the admin panel,
  // and an arbitrary iframe src would let anyone with edit access frame any
  // page on the site, so the host is checked rather than trusted.
  var EMBED_HOSTS = {
    "www.linkedin.com": "LinkedIn post",
    "linkedin.com": "LinkedIn post",
    "www.instagram.com": "Instagram post",
    "instagram.com": "Instagram post",
    "www.youtube.com": "Video",
    "youtube.com": "Video",
    "youtu.be": "Video",
    "www.youtube-nocookie.com": "Video",
    "youtube-nocookie.com": "Video",
  };

  // Pulls the video id out of whatever YouTube URL was pasted: a watch link, a
  // youtu.be short link, or an /embed/ link.
  function youtubeId(parsed) {
    if (/youtu\.be$/.test(parsed.hostname)) {
      return parsed.pathname.slice(1).split("/")[0];
    }
    if (parsed.pathname.indexOf("/embed/") === 0) {
      return parsed.pathname.slice(7).split("/")[0];
    }
    return parsed.searchParams.get("v") || "";
  }

  function embedInfo(url) {
    var raw = String(url == null ? "" : url).trim();
    if (!raw) return null;
    var parsed;
    try {
      parsed = new URL(raw, location.href);
    } catch (err) {
      return null;
    }
    if (parsed.protocol !== "https:") return null;
    var label = EMBED_HOSTS[parsed.hostname];
    if (!label) return null;

    // YouTube: normalise any link shape to a nocookie embed, so editors can
    // paste whatever the share button gave them and viewers are not tracked.
    if (/youtu\.?be/.test(parsed.hostname)) {
      var id = youtubeId(parsed);
      if (!/^[\w-]{6,}$/.test(id)) return null;
      var start = parsed.searchParams.get("t") || parsed.searchParams.get("start");
      return {
        url: "https://www.youtube-nocookie.com/embed/" + id +
             (start ? "?start=" + encodeURIComponent(parseInt(start, 10) || 0) : ""),
        label: label,
        ratio: "video",
      };
    }

    // Instagram permalinks need /embed appended to be framable.
    if (/instagram\.com$/.test(parsed.hostname) &&
        !/\/embed\/?$/.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\/?$/, "/") + "embed";
    }
    return { url: parsed.href, label: label };
  }

  function renderCard(post) {
    var date = formatDate(post.date);
    var image = safeUrl(post.image);
    var link = post.link && safeUrl(post.link.url) ? post.link : null;
    var embed = embedInfo(post.embed);

    // An embedded post is the card. The surrounding chrome stays so it still
    // reads as part of the strip.
    if (embed) {
      return (
        '<article class="news-card news-card--embed' +
        (embed.ratio === "video" ? " news-card--video" : "") + '">' +
        '<div class="news-embed' +
        (embed.ratio === "video" ? " news-embed--video" : "") + '">' +
        '<iframe src="' + esc(embed.url) + '" title="' + esc(embed.label) +
        '" loading="lazy" frameborder="0" allowfullscreen ' +
        'referrerpolicy="no-referrer-when-downgrade" ' +
        'allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" ' +
        'sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"></iframe>' +
        "</div>" +
        '<div class="news-body news-body--embed">' +
        (date ? '<div class="news-meta"><span class="news-date">' +
          esc(date) + "</span></div>" : "") +
        (post.title ? "<h3>" + esc(post.title) + "</h3>" : "") +
        "</div></article>"
      );
    }

    return (
      '<article class="news-card">' +
      (image
        ? '<img class="news-image" src="' + esc(image) +
          '" alt="" loading="lazy" onerror="this.remove()">'
        : "") +
      '<div class="news-body">' +
      (date ? '<div class="news-meta"><span class="news-date">' +
        esc(date) + "</span></div>" : "") +
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
          "<h2>" + esc(settings.heading || "Latest News") + "</h2>" +
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
