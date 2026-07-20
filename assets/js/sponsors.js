/* ==============================================
   NYU CONCRETE CANOE - SPONSORS
   Renders assets/data/sponsors.json into the existing
   .flip-card markup. Produces the same DOM the page
   previously carried inline.
   ============================================== */

(function () {
  "use strict";

  // Tier label colours, matching the values previously inlined per card.
  var TIER_COLORS = {
    Ultimate: "#ffd700",
    Platinum: "#ffd700",
    Gold: "#ffd700",
    Silver: "#c0c0c0",
    Bronze: "#cd7f32",
    Partner: "#ffffff",
  };

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

  function renderCard(sponsor) {
    var color = TIER_COLORS[sponsor.tier] || "#ffd700";
    return (
      '<div class="flip-card">' +
      '<div class="flip-card-inner">' +
      '<div class="card-front">' +
      '<img src="' + esc(sponsor.logo) + '" alt="' + esc(sponsor.name) + ' Logo">' +
      "</div>" +
      '<div class="card-back">' +
      "<h3>" + esc(sponsor.name) + "</h3>" +
      '<p style="color: ' + color + '; font-weight: 700;">' +
      esc(sponsor.tier) + " Sponsor</p>" +
      '<p style="font-size: 0.9rem;">' + esc(sponsor.commitment) + "</p>" +
      "</div></div></div>"
    );
  }

  function init() {
    var container = document.getElementById("sponsor-grid");
    if (!container) return;

    fetch("assets/data/sponsors.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var sponsors = (data && data.sponsors) || [];
        if (!sponsors.length) {
          container.innerHTML =
            '<p style="grid-column: 1 / -1;">Sponsor list coming soon.</p>';
          return;
        }
        container.innerHTML = sponsors.map(renderCard).join("");
      })
      .catch(function (err) {
        console.error("Sponsors failed to load:", err);
        container.innerHTML =
          '<div class="card" style="grid-column: 1 / -1; text-align: center;">' +
          "<p>Unable to load sponsors. Please contact the webmaster.</p></div>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
