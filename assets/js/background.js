// Background — picks one random canoe image per page load.
//
// The list comes from assets/data/images.json, which a GitHub Action rebuilds
// whenever files under assets/img/ change. Photos added to a year folder are
// picked up automatically; there is no list to maintain here.

(function () {
  "use strict";

  // Shown if the manifest cannot be fetched (offline, or opened via file://).
  var FALLBACK = "assets/img/canoes/2024/1.jpeg";

  function show(src) {
    var container = document.createElement("div");
    container.className = "bg-slideshow";
    container.setAttribute("aria-hidden", "true");

    var img = document.createElement("img");
    img.alt = "";
    img.onload = function () {
      img.classList.add("active");
    };
    img.src = src;

    container.appendChild(img);
    document.body.prepend(container);
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
