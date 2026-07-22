// Background, picks one random canoe image per page load.
//
// The list comes from assets/data/images.json, which a GitHub Action rebuilds
// whenever files under assets/img/ change. Photos added to a year folder are
// picked up automatically; there is no list to maintain here.
//
// A page may bake its own hero straight into the HTML - a <div class="bg-
// slideshow"> already in the markup - so the browser starts downloading it while
// parsing, before this script runs. When that is present this script leaves it
// alone (just fades it in) and skips the random pick. The home page does this so
// its hero springs up as early as possible; the other pages stay random.

(function () {
  "use strict";

  // Shown if the manifest cannot be fetched (offline, or opened via file://).
  var FALLBACK = "assets/img/canoes/2024/1.jpeg";

  // The light WebP copies built by scripts/build-image-derivatives.mjs. The
  // background is decorative, so the small copy is all it needs. If one is
  // missing the <img> onerror falls back to the full original below.
  //   assets/img/canoes/2019/1.JPG -> assets/img/derived/canoes/2019/1.webp
  function derived(src) {
    return src
      .replace(/^assets\/img\/canoes\//, "assets/img/derived/canoes/")
      .replace(/\.[^.]+$/, ".webp");
  }

  function show(src) {
    var container = document.createElement("div");
    container.className = "bg-slideshow";
    container.setAttribute("aria-hidden", "true");

    var img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");
    img.onload = function () {
      img.classList.add("active");
    };
    // Try the light copy first; drop to the original if it is not there.
    img.onerror = function () {
      img.onerror = null;
      img.src = src;
    };
    img.src = derived(src);

    container.appendChild(img);
    document.body.prepend(container);
  }

  // A hero baked into the HTML is already downloading before this runs. Fade it
  // in once it is ready and do not fetch a random replacement.
  var baked = document.querySelector(".bg-slideshow img");
  if (baked) {
    if (baked.complete) {
      baked.classList.add("active");
    } else {
      baked.addEventListener("load", function () {
        baked.classList.add("active");
      });
    }
    return;
  }

  fetch("assets/data/images.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var all = [];
      var byYear = (data && data.canoes) || {};
      Object.keys(byYear).forEach(function (year) {
        all = all.concat(byYear[year]);
      });
      show(all.length ? all[Math.floor(Math.random() * all.length)] : FALLBACK);
    })
    .catch(function () {
      show(FALLBACK);
    });
})();
