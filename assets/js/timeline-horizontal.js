/* ==============================================
   NYU CONCRETE CANOE - HORIZONTAL TIMELINE
   One year per screen, advanced by scroll.
   Desktop only. Below 900px this does nothing and
   the standard vertical timeline renders instead.
   ============================================== */

(function () {
  "use strict";

  var MOBILE = window.matchMedia("(max-width: 900px)");
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

  var rail, panels = [], current = 0, locked = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (c) {
        return {
          "&": "&amp;", "<": "&lt;", ">": "&gt;",
          '"': "&quot;", "'": "&#39;",
        }[c];
      },
    );
  }

  function getJSON(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error(path + ": HTTP " + res.status);
      return res.json();
    });
  }

  function imagesFor(canoe, manifest) {
    if (canoe.images && canoe.images.length) return canoe.images;
    return ((manifest && manifest.canoes) || {})[String(canoe.year)] || [];
  }

  /* ---------- Build ---------- */

  function buildPanel(canoe, images, index) {
    var media = images.length
      ? images
          .map(function (src, i) {
            return (
              '<img src="' + esc(src) + '" alt="' +
              esc(canoe.name + " " + canoe.year) + '"' +
              (i === 0 ? ' class="is-active"' : "") +
              // Only the first screen's images are eager; the rest defer.
              (index < 2 ? "" : ' loading="lazy"') +
              ">"
            );
          })
          .join("") +
        (images.length > 1
          ? '<div class="h-dots">' +
            images
              .map(function (_, i) {
                return (
                  '<button class="h-dot" data-photo="' + i + '"' +
                  (i === 0 ? ' aria-current="true"' : "") +
                  ' aria-label="Photo ' + (i + 1) + '"></button>'
                );
              })
              .join("") +
            "</div>"
          : "")
      : '<div class="h-media-empty">' + (canoe.icon || "🛶") + "</div>";

    return (
      '<section class="h-panel" data-year="' + esc(canoe.year) + '">' +
      '<div class="h-media">' + media + "</div>" +
      '<div class="h-content">' +
      '<span class="h-year">' + esc(canoe.year) + "</span>" +
      '<h2 class="h-name"><span class="h-icon">' + (canoe.icon || "🛶") +
      "</span>" + esc(canoe.name) + "</h2>" +
      '<p class="h-desc">' + (canoe.description || "") + "</p>" +
      '<div class="h-tags">' +
      (canoe.tags || [])
        .map(function (t) {
          return '<span class="tag">' + esc(t) + "</span>";
        })
        .join("") +
      "</div></div></section>"
    );
  }

  /* ---------- Navigation ---------- */

  function goTo(index, smooth) {
    if (!panels.length) return;
    index = Math.max(0, Math.min(panels.length - 1, index));
    current = index;

    rail.scrollTo({
      left: panels[index].offsetLeft,
      behavior: smooth === false || REDUCED.matches ? "auto" : "smooth",
    });

    panels.forEach(function (p, i) {
      p.classList.toggle("is-current", i === index);
    });

    document.querySelectorAll(".h-scrub").forEach(function (b, i) {
      b.setAttribute("aria-current", i === index ? "true" : "false");
      if (i === index && b.scrollIntoView) {
        b.scrollIntoView({ block: "nearest", inline: "center",
          behavior: REDUCED.matches ? "auto" : "smooth" });
      }
    });

    var prev = document.querySelector(".h-nav.prev");
    var next = document.querySelector(".h-nav.next");
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === panels.length - 1;

    var hint = document.querySelector(".h-hint");
    if (hint && index > 0) hint.classList.add("is-hidden");
  }

  // One gesture moves exactly one year. Without the lock a trackpad fires
  // dozens of wheel events per flick and the rail flies past several panels.
  function onWheel(e) {
    if (MOBILE.matches) return;
    var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 8) return;

    e.preventDefault();
    if (locked) return;

    locked = true;
    goTo(current + (delta > 0 ? 1 : -1));
    setTimeout(function () { locked = false; }, REDUCED.matches ? 120 : 620);
  }

  function onKey(e) {
    if (MOBILE.matches) return;
    var map = { ArrowRight: 1, ArrowDown: 1, PageDown: 1,
                ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
    if (e.key in map) {
      e.preventDefault();
      goTo(current + map[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault(); goTo(0);
    } else if (e.key === "End") {
      e.preventDefault(); goTo(panels.length - 1);
    }
  }

  // Photo dots within a panel
  function onClick(e) {
    var dot = e.target.closest(".h-dot");
    if (dot) {
      var media = dot.closest(".h-media");
      var i = Number(dot.dataset.photo);
      media.querySelectorAll("img").forEach(function (img, n) {
        img.classList.toggle("is-active", n === i);
      });
      media.querySelectorAll(".h-dot").forEach(function (d, n) {
        d.setAttribute("aria-current", n === i ? "true" : "false");
      });
      return;
    }
    var scrub = e.target.closest(".h-scrub");
    if (scrub) goTo(Number(scrub.dataset.index));
  }

  /* ---------- Init ---------- */

  function init() {
    var root = document.getElementById("horizontalTimeline");
    if (!root) return;

    Promise.all([
      getJSON("assets/data/canoes.json"),
      getJSON("assets/data/images.json").catch(function () {
        return { canoes: {} };
      }),
    ])
      .then(function (r) {
        // Oldest to newest reads naturally left to right.
        var canoes = ((r[0] && r[0].canoes) || []).slice().reverse();
        if (!canoes.length) return;

        root.innerHTML =
          '<div class="h-rail" id="hRail">' +
          canoes
            .map(function (c, i) {
              return buildPanel(c, imagesFor(c, r[1]), i);
            })
            .join("") +
          "</div>" +
          '<div class="h-scrubber">' +
          canoes
            .map(function (c, i) {
              return (
                '<button class="h-scrub" data-index="' + i + '">' +
                esc(c.year) + "</button>"
              );
            })
            .join("") +
          "</div>" +
          '<button class="h-nav prev" aria-label="Previous year">' +
          '<i class="fa fa-chevron-left"></i></button>' +
          '<button class="h-nav next" aria-label="Next year">' +
          '<i class="fa fa-chevron-right"></i></button>' +
          '<div class="h-hint">Scroll to move through the years</div>';

        rail = document.getElementById("hRail");
        panels = Array.prototype.slice.call(root.querySelectorAll(".h-panel"));

        rail.addEventListener("wheel", onWheel, { passive: false });
        root.addEventListener("click", onClick);
        document.addEventListener("keydown", onKey);

        root.querySelector(".h-nav.prev").addEventListener("click", function () {
          goTo(current - 1);
        });
        root.querySelector(".h-nav.next").addEventListener("click", function () {
          goTo(current + 1);
        });

        // Keep the current panel aligned if the window is resized.
        window.addEventListener("resize", function () {
          goTo(current, false);
        });

        // Open on the newest canoe, which is the last panel.
        goTo(panels.length - 1, false);
      })
      .catch(function (err) {
        console.error("Horizontal timeline failed:", err);
        root.remove();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
