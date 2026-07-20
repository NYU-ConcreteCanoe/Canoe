/* ==============================================
   NYU CONCRETE CANOE - TIMELINE
   Tabbed view over two data files:
     assets/data/canoes.json  -> Canoes
     assets/data/awards.json  -> Awards
   ============================================== */

(function () {
  "use strict";

  var TABS = [
    { id: "canoes", label: "Canoes" },
    { id: "awards", label: "Awards" },
  ];

  // Content in canoes.json intentionally supports inline HTML (e.g. <strong>)
  // and predates the admin panel, so it is rendered as-is. Awards content is
  // authored through the admin panel and is escaped instead.
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

    return canoes
      .map(function (canoe, canoeIdx) {
        var images = imagesFor(canoe, manifest);
        var imagesHtml = "";
        if (images.length > 0) {
          var carouselId = "carousel-" + canoe.year;
          imagesHtml =
            '<div class="simple-carousel" id="' + carouselId + '">' +
            '<div class="carousel-track">' +
            images
              .map(function (img) {
                return (
                  '<div class="carousel-slide">' +
                  '<img src="' + esc(img) + '" alt="' +
                  esc(canoe.name + " " + canoe.year) +
                  '" loading="lazy">' +
                  "</div>"
                );
              })
              .join("") +
            "</div>" +
            (images.length > 1
              ? '<button class="carousel-btn prev" onclick="scrollCarousel(\'' +
                carouselId +
                '\', -1)" aria-label="Previous">' +
                '<i class="fa fa-chevron-left"></i></button>' +
                '<button class="carousel-btn next" onclick="scrollCarousel(\'' +
                carouselId +
                '\', 1)" aria-label="Next">' +
                '<i class="fa fa-chevron-right"></i></button>'
              : "") +
            "</div>";
        }

        return (
          '<div class="card" style="margin-bottom: 6rem; animation-delay: ' +
          canoeIdx * 0.1 +
          's;">' +
          '<div style="display: flex; align-items: center; gap: 2rem; margin-bottom: 2rem;">' +
          '<span style="font-size: 3.5rem;">' + (canoe.icon || "🛶") + "</span>" +
          '<div style="text-align: left;">' +
          '<span class="timeline-year">' + esc(canoe.year) + "</span>" +
          '<h2 style="margin: 0; text-align: left;">' + esc(canoe.name) + "</h2>" +
          "</div></div>" +
          '<p style="text-align: left; line-height: 1.8; font-size: 1.25rem;">' +
          (canoe.description || "") +
          "</p>" +
          imagesHtml +
          '<div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem; justify-content: flex-start;">' +
          (canoe.tags || [])
            .map(function (tag) {
              return (
                '<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 1.2rem;">' +
                esc(tag) +
                "</span>"
              );
            })
            .join("") +
          "</div></div>"
        );
      })
      .join("");
  }

  /* ---------- Awards ---------- */

  function renderPlacements(placements) {
    if (!placements || !placements.length) return "";
    return (
      '<ul class="placement-list">' +
      placements
        .map(function (p) {
          return (
            '<li class="placement' +
            (p.featured ? " placement--featured" : "") +
            '">' +
            '<span class="placement-place">' + esc(p.place) + "</span>" +
            '<span class="placement-category">' + esc(p.category) + "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderRoster(roster) {
    if (!roster || !roster.length) return "";
    return (
      '<div class="award-section-label">Team</div>' +
      roster
        .map(function (group) {
          return (
            '<div class="roster-group">' +
            '<div class="roster-group-name">' + esc(group.group) + "</div>" +
            '<div class="roster-names">' +
            (group.members || []).map(esc).join(" &middot; ") +
            "</div></div>"
          );
        })
        .join("")
    );
  }

  function renderImages(images, alt) {
    if (!images || !images.length) return "";
    var carouselId = "award-carousel-" + alt.replace(/[^a-z0-9]+/gi, "-");
    return (
      '<div class="simple-carousel" id="' + carouselId + '">' +
      '<div class="carousel-track">' +
      images
        .map(function (img) {
          return (
            '<div class="carousel-slide">' +
            '<img src="' + esc(img) + '" alt="' + esc(alt) +
            '" loading="lazy"></div>'
          );
        })
        .join("") +
      "</div>" +
      (images.length > 1
        ? '<button class="carousel-btn prev" onclick="scrollCarousel(\'' +
          carouselId +
          '\', -1)" aria-label="Previous">' +
          '<i class="fa fa-chevron-left"></i></button>' +
          '<button class="carousel-btn next" onclick="scrollCarousel(\'' +
          carouselId +
          '\', 1)" aria-label="Next">' +
          '<i class="fa fa-chevron-right"></i></button>'
        : "") +
      "</div>"
    );
  }

  function renderAwards(data) {
    var seasons = (data && data.seasons) || [];
    if (!seasons.length) {
      return '<p class="text-center" style="opacity: 0.6;">Awards coming soon.</p>';
    }

    return seasons
      .map(function (season) {
        return (
          '<section class="award-season">' +
          '<h2 style="margin-bottom: 2.5rem;">' + esc(season.season) + " Season</h2>" +
          (season.events || [])
            .map(function (ev) {
              return (
                '<div class="card award-card" id="' + esc(ev.id || "") + '">' +
                '<div class="award-header">' +
                '<span class="award-icon">' + (ev.icon || "🏆") + "</span>" +
                "<div><h2>" + esc(ev.shortName || ev.name) + "</h2>" +
                '<div style="opacity: 0.7; font-size: 0.95rem; margin-top: 0.35rem;">' +
                esc(ev.name) +
                (ev.location ? " &middot; " + esc(ev.location) : "") +
                "</div></div></div>" +
                (ev.headline
                  ? '<div class="award-headline">' + esc(ev.headline) + "</div>"
                  : "") +
                (ev.summary
                  ? '<p class="award-summary">' + esc(ev.summary) + "</p>"
                  : "") +
                renderPlacements(ev.placements) +
                renderImages(ev.images, ev.shortName || ev.name) +
                (ev.innovations && ev.innovations.length
                  ? '<div class="award-section-label">Innovations</div>' +
                    '<div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">' +
                    ev.innovations
                      .map(function (t) {
                        return (
                          '<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 1.2rem;">' +
                          esc(t) +
                          "</span>"
                        );
                      })
                      .join("") +
                    "</div>"
                  : "") +
                renderRoster(ev.roster) +
                (ev.note ? '<p class="award-note">' + esc(ev.note) + "</p>" : "") +
                "</div>"
              );
            })
            .join("") +
          "</section>"
        );
      })
      .join("");
  }

  /* ---------- Tabs ---------- */

  function showTab(id) {
    TABS.forEach(function (tab) {
      var panel = document.getElementById("panel-" + tab.id);
      var button = document.getElementById("tab-" + tab.id);
      if (!panel || !button) return;
      var selected = tab.id === id;
      panel.hidden = !selected;
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.setAttribute("tabindex", selected ? "0" : "-1");
    });
  }

  function initTabs() {
    var nav = document.getElementById("timelineTabs");
    if (!nav) return;

    nav.addEventListener("click", function (e) {
      var button = e.target.closest(".timeline-tab");
      if (!button) return;
      var id = button.dataset.tab;
      showTab(id);
      // Keep the hash in sync so the view can be linked to and shared,
      // without adding a history entry per click.
      history.replaceState(null, "", id === "canoes" ? "#" : "#" + id);
    });

    // Left/right arrow navigation between tabs (WAI-ARIA tabs pattern)
    nav.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var order = TABS.map(function (t) { return t.id; });
      var current = order.indexOf(
        document.querySelector('.timeline-tab[aria-selected="true"]').dataset.tab,
      );
      var next =
        (current + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length;
      showTab(order[next]);
      document.getElementById("tab-" + order[next]).focus();
      e.preventDefault();
    });
  }

  function init() {
    var canoesPanel = document.getElementById("panel-canoes");
    var awardsPanel = document.getElementById("panel-awards");
    if (!canoesPanel || !awardsPanel) {
      console.error("Timeline panels not found");
      return;
    }

    initTabs();

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
      })
      .catch(function (err) {
        console.error("Timeline Error:", err);
        canoesPanel.innerHTML =
          '<div class="card" style="border-color: rgba(255,0,0,0.3);">' +
          "<h3>Error Loading Legacy</h3><p>" + esc(err.message) + "</p></div>";
      });

    getJSON("assets/data/awards.json")
      .then(function (data) {
        awardsPanel.innerHTML = renderAwards(data);
      })
      .catch(function (err) {
        console.error("Awards Error:", err);
        awardsPanel.innerHTML =
          '<div class="card" style="border-color: rgba(255,0,0,0.3);">' +
          "<h3>Error Loading Awards</h3><p>" + esc(err.message) + "</p></div>";
      });

    // Honour a deep link such as timeline.html#awards
    var hash = (location.hash || "").replace("#", "");
    showTab(hash === "awards" ? "awards" : "canoes");
  }

  // Shared by both the canoe and award carousels.
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
