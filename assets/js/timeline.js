/* ==============================================
   NYU CONCRETE CANOE - TIMELINE
   Horizontal rail built from assets/data/canoes.json,
   with photos discovered via assets/data/images.json.
   ============================================== */

(function () {
  "use strict";

  // Descriptions in canoes.json intentionally support inline HTML such as
  // <strong>, so they are rendered as-is. Everything else is escaped.
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

  function getJSON(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error(path + ": HTTP " + res.status);
      return res.json();
    });
  }

  /* ---------- Canoes (unchanged rendering) ---------- */

  // Photos come from assets/data/images.json, which a GitHub Action rebuilds
  // whenever files under assets/img/ change. Adding photos to a year folder is
  // therefore all that is needed - no JSON editing. An explicit "images" array
  // in canoes.json still wins, for when a specific order or subset is wanted.
  function imagesFor(canoe, manifest) {
    if (canoe.images && canoe.images.length) return canoe.images;
    var byYear = (manifest && manifest.canoes) || {};
    return byYear[String(canoe.year)] || [];
  }

  function renderCanoes(data, manifest) {
    var canoes = (data && data.canoes) || [];
    if (!canoes.length) return '<p class="text-center">No history found.</p>';

    // Oldest on the left, newest on the right, so the rail reads as time.
    var ordered = canoes.slice().sort(function (a, b) {
      return Number(a.year) - Number(b.year);
    });

    var cards = ordered
      .map(function (canoe) {
        var images = imagesFor(canoe, manifest);
        var media = images.length
          ? '<div class="t-media">' +
            images
              .map(function (img, i) {
                return (
                  '<img src="' + esc(img) + '" alt="' +
                  esc(canoe.name + " " + canoe.year) + '"' +
                  (i === 0 ? ' class="is-active"' : "") +
                  ' loading="lazy">'
                );
              })
              .join("") +
            (images.length > 1
              ? '<div class="t-dots">' +
                images
                  .map(function (_, i) {
                    return (
                      '<button class="t-dot" data-photo="' + i + '"' +
                      (i === 0 ? ' aria-current="true"' : "") +
                      ' aria-label="Photo ' + (i + 1) + ' of ' +
                      esc(canoe.name) + '"></button>'
                    );
                  })
                  .join("") +
                "</div>"
              : "") +
            "</div>"
          : '<div class="t-media t-media--empty"><span>' +
            esc(canoe.year) + "</span></div>";

        return (
          '<article class="t-stop" data-year="' + esc(canoe.year) + '">' +
          '<div class="t-marker" aria-hidden="true"></div>' +
          '<div class="t-card">' +
          media +
          '<div class="t-text">' +
          '<span class="t-year">' + esc(canoe.year) + "</span>" +
          '<h3 class="t-name">' + esc(canoe.name) + "</h3>" +
          '<p class="t-desc">' + (canoe.description || "") + "</p>" +
          '<div class="t-tags">' +
          (canoe.tags || [])
            .map(function (tag) {
              return '<span class="tag">' + esc(tag) + "</span>";
            })
            .join("") +
          "</div></div></div></article>"
        );
      })
      .join("");

    return (
      '<div class="t-head">' +
      '<p class="t-hint">Scroll or drag sideways. Left is earliest.</p>' +
      "</div>" +
      '<div class="t-rail" id="timelineRail" tabindex="0" role="region" ' +
      'aria-label="Canoe history, earliest on the left, scrolls horizontally">' +
      '<div class="t-line" aria-hidden="true"></div>' +
      cards +
      "</div>"
    );
  }

  // Photo dots inside a timeline card.
  function onCanoeClick(e) {
    var dot = e.target.closest(".t-dot");
    if (!dot) return;
    var media = dot.closest(".t-media");
    var i = Number(dot.dataset.photo);
    media.querySelectorAll("img").forEach(function (img, n) {
      img.classList.toggle("is-active", n === i);
    });
    media.querySelectorAll(".t-dot").forEach(function (d, n) {
      d.setAttribute("aria-current", n === i ? "true" : "false");
    });
  }

  function init() {
    var canoesPanel = document.getElementById("panel-canoes");
    if (!canoesPanel) return;

    // Each panel loads and fails independently, so a problem with one data
    // file cannot blank out the other tab.
    // The manifest is optional: if it is missing the timeline still renders
    // using whatever explicit images canoes.json carries.
    Promise.all([
      getJSON("assets/data/canoes.json"),
      getJSON("assets/data/images.json").catch(function () {
        return { canoes: {} };
      }),
    ])
      .then(function (results) {
        canoesPanel.innerHTML = renderCanoes(results[0], results[1]);
        canoesPanel.addEventListener("click", onCanoeClick);

        var rail = document.getElementById("timelineRail");
        if (rail) {
          if (window.enableDragScroll) {
            window.enableDragScroll(rail, { step: 420 });
          }
          // Start at the present. The rail runs oldest to newest, so the most
          // recent canoe is the one people expect to see first.
          rail.scrollLeft = rail.scrollWidth;
        }
      })
      .catch(function (err) {
        console.error("Timeline Error:", err);
        canoesPanel.innerHTML =
          '<div class="card" style="border-color: rgba(255,0,0,0.3);">' +
          "<h3>Error Loading Legacy</h3><p>" + esc(err.message) + "</p></div>";
      });


  }

  window.scrollCarousel = function (carouselId, direction) {
    var carousel = document.getElementById(carouselId);
    if (!carousel) return;
    var track = carousel.querySelector(".carousel-track");
    var slide = track && track.querySelector(".carousel-slide");
    if (!slide) return;
    track.scrollBy({ left: direction * slide.offsetWidth, behavior: "smooth" });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
