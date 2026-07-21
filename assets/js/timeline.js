/* ==============================================
   NYU CONCRETE CANOE - TIMELINE
   Horizontal rail built from assets/data/canoes.json,
   with photos discovered via assets/data/images.json.
   Each year is a stop on a line; its photos can be
   stepped through in place or opened full screen.
   ============================================== */

(function () {
  "use strict";

  // year -> { images, name }, used by the full screen viewer
  var PHOTOS = {};

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

  // Photos come from assets/data/images.json, which a GitHub Action rebuilds
  // whenever files under assets/img/ change. Adding photos to a year folder is
  // therefore all that is needed - no JSON editing. An explicit "images" array
  // in canoes.json still wins, for when a specific order or subset is wanted.
  function imagesFor(canoe, manifest) {
    if (canoe.images && canoe.images.length) return canoe.images;
    var byYear = (manifest && manifest.canoes) || {};
    return byYear[String(canoe.year)] || [];
  }

  /* ---------- Rail ---------- */

  function renderStop(canoe, images) {
    var year = String(canoe.year);
    var media;

    if (images.length) {
      media =
        '<div class="t-media" data-year="' + esc(year) + '" data-index="0">' +
        images
          .map(function (img, i) {
            return (
              '<img src="' + esc(img) + '" alt="' +
              esc(canoe.name + " " + year) + '"' +
              (i === 0 ? ' class="is-active"' : "") +
              ' loading="lazy" draggable="false">'
            );
          })
          .join("") +
        '<button class="t-zoom" data-year="' + esc(year) + '" ' +
        'aria-label="View ' + esc(canoe.name) + ' photos full screen">' +
        '<i class="fa fa-expand"></i></button>' +
        (images.length > 1
          ? '<button class="t-arrow prev" data-step="-1" aria-label="Previous photo">' +
            '<i class="fa fa-chevron-left"></i></button>' +
            '<button class="t-arrow next" data-step="1" aria-label="Next photo">' +
            '<i class="fa fa-chevron-right"></i></button>' +
            '<span class="t-count"><span class="t-count-now">1</span> / ' +
            images.length + "</span>"
          : "") +
        "</div>";
    } else {
      media =
        '<div class="t-media t-media--empty"><span>No photos yet</span></div>';
    }

    return (
      '<article class="t-stop" data-year="' + esc(year) + '">' +
      '<div class="t-marker"><span class="t-marker-year">' + esc(year) +
      "</span></div>" +
      '<div class="t-card">' +
      media +
      '<div class="t-text">' +
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
  }

  function renderCanoes(data, manifest) {
    var canoes = (data && data.canoes) || [];
    if (!canoes.length) return '<p class="text-center">No history found.</p>';

    // Oldest on the left, newest on the right, so the rail reads as time.
    var ordered = canoes.slice().sort(function (a, b) {
      return Number(a.year) - Number(b.year);
    });

    var stops = ordered
      .map(function (canoe) {
        var images = imagesFor(canoe, manifest);
        PHOTOS[String(canoe.year)] = { images: images, name: canoe.name };
        return renderStop(canoe, images);
      })
      .join("");

    return (
      '<div class="t-rail" id="timelineRail" tabindex="0" role="region" ' +
      'aria-label="Canoe history, earliest on the left, scrolls horizontally">' +
      stops +
      "</div>"
    );
  }

  /* ---------- Stepping photos inside a card ---------- */

  function showPhoto(media, index) {
    var imgs = media.querySelectorAll("img");
    if (!imgs.length) return;
    index = (index + imgs.length) % imgs.length;
    imgs.forEach(function (img, n) {
      img.classList.toggle("is-active", n === index);
    });
    media.dataset.index = String(index);
    var now = media.querySelector(".t-count-now");
    if (now) now.textContent = String(index + 1);
  }

  function onRailClick(e) {
    // Stepping photos in place must win over opening the viewer, otherwise
    // the arrows would be unusable.
    var arrow = e.target.closest(".t-arrow");
    if (arrow) {
      var m = arrow.closest(".t-media");
      showPhoto(m, Number(m.dataset.index || 0) + Number(arrow.dataset.step));
      return;
    }

    // Anywhere else on the card opens the viewer at the photo on show. A drag
    // of the rail does not reach here: drag-scroll.js swallows the click that
    // follows a real drag.
    var card = e.target.closest(".t-card");
    if (!card) return;
    var media = card.querySelector(".t-media");
    var stop = card.closest(".t-stop");
    if (!media || !stop || media.classList.contains("t-media--empty")) return;
    openViewer(stop.dataset.year, Number(media.dataset.index || 0));
  }

  /* ---------- Full screen viewer ---------- */

  var viewer, viewerImg, viewerCaption, viewerCount;
  var viewerYear = null, viewerIndex = 0, lastFocus = null;

  function buildViewer() {
    viewer = document.createElement("div");
    viewer.className = "viewer";
    viewer.id = "photoViewer";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Photo viewer");
    viewer.hidden = true;
    viewer.innerHTML =
      '<button class="viewer-close" aria-label="Close viewer">' +
      '<i class="fa fa-times"></i></button>' +
      '<button class="viewer-arrow prev" data-step="-1" aria-label="Previous photo">' +
      '<i class="fa fa-chevron-left"></i></button>' +
      '<figure class="viewer-stage">' +
      '<img alt="">' +
      '<figcaption><span class="viewer-caption"></span>' +
      '<span class="viewer-count"></span></figcaption>' +
      "</figure>" +
      '<button class="viewer-arrow next" data-step="1" aria-label="Next photo">' +
      '<i class="fa fa-chevron-right"></i></button>';
    document.body.appendChild(viewer);

    viewerImg = viewer.querySelector("img");
    viewerCaption = viewer.querySelector(".viewer-caption");
    viewerCount = viewer.querySelector(".viewer-count");

    viewer.addEventListener("click", function (e) {
      if (e.target.closest(".viewer-close")) return closeViewer();
      var arrow = e.target.closest(".viewer-arrow");
      if (arrow) return step(Number(arrow.dataset.step));
      // Clicking the backdrop closes; clicking the photo itself does not.
      if (!e.target.closest(".viewer-stage")) closeViewer();
    });
  }

  function paint() {
    var set = PHOTOS[viewerYear];
    if (!set || !set.images.length) return;
    viewerIndex = (viewerIndex + set.images.length) % set.images.length;
    viewerImg.src = set.images[viewerIndex];
    viewerImg.alt = set.name + " " + viewerYear;
    viewerCaption.textContent = set.name + " (" + viewerYear + ")";
    viewerCount.textContent = viewerIndex + 1 + " / " + set.images.length;

    var many = set.images.length > 1;
    viewer.querySelectorAll(".viewer-arrow").forEach(function (b) {
      b.hidden = !many;
    });
  }

  function step(n) {
    viewerIndex += n;
    paint();
  }

  function openViewer(year, index) {
    var set = PHOTOS[year];
    if (!set || !set.images.length) return;
    if (!viewer) buildViewer();

    lastFocus = document.activeElement;
    viewerYear = year;
    viewerIndex = index || 0;
    paint();

    viewer.hidden = false;
    document.body.classList.add("viewer-open");
    viewer.querySelector(".viewer-close").focus();
    document.addEventListener("keydown", onViewerKey);
  }

  function closeViewer() {
    if (!viewer || viewer.hidden) return;
    viewer.hidden = true;
    document.body.classList.remove("viewer-open");
    document.removeEventListener("keydown", onViewerKey);
    // Return focus to whatever opened it.
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onViewerKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeViewer();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog while it is open.
      var f = viewer.querySelectorAll("button:not([hidden])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ---------- Init ---------- */

  function init() {
    var canoesPanel = document.getElementById("panel-canoes");
    if (!canoesPanel) return;

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
        canoesPanel.addEventListener("click", onRailClick);

        var rail = document.getElementById("timelineRail");
        if (!rail) return;

        if (window.enableDragScroll) {
          window.enableDragScroll(rail, { step: 460 });
        }

        var stops = Array.prototype.slice.call(rail.querySelectorAll(".t-stop"));

        // Marks whichever year is nearest the middle of the rail, so it can be
        // shown at full size while the rest sit back.
        var ticking = false;
        function markCentred() {
          var mid = rail.scrollLeft + rail.clientWidth / 2;
          var best = null, bestDistance = Infinity;
          stops.forEach(function (stop) {
            var centre = stop.offsetLeft + stop.offsetWidth / 2;
            var distance = Math.abs(centre - mid);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = stop;
            }
          });
          stops.forEach(function (stop) {
            stop.classList.toggle("is-current", stop === best);
          });
        }
        function onScroll() {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(function () {
            markCentred();
            ticking = false;
          });
        }
        rail.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);

        // Open centred on the most recent canoe, WITHOUT animating. The rail
        // sets scroll-behavior: smooth, so assigning scrollLeft directly made
        // the page visibly scroll all the way from the oldest year to the
        // newest on every single load, which read as a stutter.
        var newest = stops[stops.length - 1];
        var previous = rail.style.scrollBehavior;
        rail.style.scrollBehavior = "auto";
        if (newest) {
          rail.scrollLeft =
            newest.offsetLeft - (rail.clientWidth - newest.offsetWidth) / 2;
        }
        markCentred();
        requestAnimationFrame(function () {
          rail.style.scrollBehavior = previous || "";
        });
      })
      .catch(function (err) {
        console.error("Timeline Error:", err);
        canoesPanel.innerHTML =
          '<div class="card" style="border-color: rgba(255,0,0,0.3);">' +
          "<h3>Error Loading Legacy</h3><p>" + esc(err.message) + "</p></div>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
