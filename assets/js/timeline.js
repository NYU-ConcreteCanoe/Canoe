/* ==============================================
   NYU CONCRETE CANOE - TIMELINE WITH SIMPLE CAROUSELS
   Uses canoes.json for data
   ============================================== */

function initTimeline() {
  console.log("Starting timeline initialization...");
  const container = document.getElementById("canoeTimeline");

  if (!container) {
    console.error("Container #canoeTimeline not found");
    return;
  }

  fetch("assets/data/canoes.json")
    .then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      console.log(
        "Data loaded:",
        data.canoes ? data.canoes.length : 0,
        "canoes",
      );
      container.innerHTML = "";

      if (!data.canoes || data.canoes.length === 0) {
        container.innerHTML = '<p class="text-center">No history found.</p>';
        return;
      }

      data.canoes.forEach((canoe, canoeIdx) => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.marginBottom = "6rem";
        card.style.animationDelay = `${canoeIdx * 0.1}s`;

        let imagesHtml = "";
        if (canoe.images && canoe.images.length > 0) {
          const carouselId = `carousel-${canoe.year}`;

          imagesHtml = `
            <div class="simple-carousel" id="${carouselId}">
              <div class="carousel-track">
                ${canoe.images
                  .map(
                    (img) => `
                    <div class="carousel-slide">
                      <img src="${img}" alt="${canoe.name} ${canoe.year}" loading="lazy">
                    </div>
                  `,
                  )
                  .join("")}
              </div>
              ${
                canoe.images.length > 1
                  ? `
                  <button class="carousel-btn prev" onclick="scrollCarousel('${carouselId}', -1)" aria-label="Previous">
                    <i class="fa fa-chevron-left"></i>
                  </button>
                  <button class="carousel-btn next" onclick="scrollCarousel('${carouselId}', 1)" aria-label="Next">
                    <i class="fa fa-chevron-right"></i>
                  </button>
                `
                  : ""
              }
            </div>
          `;
        }

        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 2rem; margin-bottom: 2rem;">
            <span style="font-size: 3.5rem;">${canoe.icon || "🛶"}</span>
            <div style="text-align: left;">
              <span class="timeline-year">${canoe.year}</span>
              <h2 style="margin: 0; text-align: left;">${canoe.name}</h2>
            </div>
          </div>
          <p style="text-align: left; line-height: 1.8; font-size: 1.25rem;">${canoe.description}</p>
          ${imagesHtml}
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem; justify-content: flex-start;">
            ${canoe.tags.map((tag) => `<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 1.2rem;">${tag}</span>`).join("")}
          </div>
        `;
        container.appendChild(card);
      });
      console.log("Timeline rendering complete.");
    })
    .catch((error) => {
      console.error("Timeline Error:", error);
      container.innerHTML = `
        <div class="card" style="border-color: rgba(255,0,0,0.3);">
          <h3>Error Loading Legacy</h3>
          <p>Failed to load canoes.json: ${error.message}</p>
        </div>
      `;
    });
}

// Simple scroll function
window.scrollCarousel = function (carouselId, direction) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;

  const track = carousel.querySelector(".carousel-track");
  const slideWidth = track.querySelector(".carousel-slide").offsetWidth;

  track.scrollBy({
    left: direction * slideWidth,
    behavior: "smooth",
  });
};

// Fire immediately or on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTimeline);
} else {
  initTimeline();
}

// /* ==============================================
//    NYU CONCRETE CANOE - TIMELINE SIMPLE
//    Uses canoes.json for data
//    ============================================== */

// function initTimeline() {
//   console.log("Starting timeline initialization...");
//   const container = document.getElementById("canoeTimeline");

//   if (!container) {
//     console.error("Container #canoeTimeline not found");
//     return;
//   }

//   fetch("assets/data/canoes.json")
//     .then((response) => {
//       if (!response.ok)
//         throw new Error(`HTTP error! status: ${response.status}`);
//       return response.json();
//     })
//     .then((data) => {
//       console.log(
//         "Data loaded:",
//         data.canoes ? data.canoes.length : 0,
//         "canoes",
//       );
//       container.innerHTML = "";

//       if (!data.canoes || data.canoes.length === 0) {
//         container.innerHTML = '<p class="text-center">No history found.</p>';
//         return;
//       }

//       data.canoes.forEach((canoe, canoeIdx) => {
//         const card = document.createElement("div");
//         card.className = "card";
//         card.style.marginBottom = "6rem";
//         card.style.animationDelay = `${canoeIdx * 0.1}s`;

//         let imagesHtml = "";
//         if (canoe.images && canoe.images.length > 0) {
//           const carouselId = `carousel-${canoe.year}`;
//           imagesHtml = `
//                         <div class="carousel" id="${carouselId}">
//                             <div class="carousel-inner">
//                                 ${canoe.images
//                                   .map(
//                                     (img) => `
//                                     <div class="carousel-item">
//                                         <img src="${img}" alt="${canoe.name} ${canoe.year}">
//                                     </div>
//                                 `,
//                                   )
//                                   .join("")}
//                             </div>
//                             ${
//                               canoe.images.length > 1
//                                 ? `
//                                 <button class="carousel-control prev" onclick="moveCarousel('${carouselId}', -1)">
//                                     <i class="fa fa-chevron-left"></i>
//                                 </button>
//                                 <button class="carousel-control next" onclick="moveCarousel('${carouselId}', 1)">
//                                     <i class="fa fa-chevron-right"></i>
//                                 </button>
//                             `
//                                 : ""
//                             }
//                         </div>
//                     `;
//         }

//         card.innerHTML = `
//                     <div style="display: flex; align-items: center; gap: 2rem; margin-bottom: 2rem;">
//                         <span style="font-size: 3.5rem;">${canoe.icon || "🛶"}</span>
//                         <div style="text-align: left;">
//                             <span class="timeline-year">${canoe.year}</span>
//                             <h2 style="margin: 0; text-align: left;">${canoe.name}</h2>
//                         </div>
//                     </div>
//                     <p style="text-align: left; line-height: 1.8; font-size: 1.25rem;">${canoe.description}</p>
//                     ${imagesHtml}
//                     <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem; justify-content: flex-start;">
//                         ${canoe.tags.map((tag) => `<span class="tag" style="font-size: 0.9rem; padding: 0.4rem 1.2rem;">${tag}</span>`).join("")}
//                     </div>
//                 `;
//         container.appendChild(card);
//       });
//       console.log("Timeline rendering complete.");
//     })
//     .catch((error) => {
//       console.error("Timeline Error:", error);
//       container.innerHTML = `
//                 <div class="card" style="border-color: rgba(255,0,0,0.3);">
//                     <h3>Error Loading Legacy</h3>
//                     <p>Failed to load canoes.json: ${error.message}</p>
//                 </div>
//             `;
//     });
// }

// // Global Carousel Control Function
// window.moveCarousel = function (carouselId, direction) {
//   const carousel = document.getElementById(carouselId);
//   if (!carousel) return;

//   const inner = carousel.querySelector(".carousel-inner");
//   const items = carousel.querySelectorAll(".carousel-item");
//   const totalItems = items.length;

//   let currentIndex = parseInt(carousel.getAttribute("data-index") || "0");
//   currentIndex = (currentIndex + direction + totalItems) % totalItems;

//   carousel.setAttribute("data-index", currentIndex);
//   inner.style.transform = `translateX(-${currentIndex * 100}%)`;
// };

// // Fire immediately or on load
// if (document.readyState === "loading") {
//   document.addEventListener("DOMContentLoaded", initTimeline);
// } else {
//   initTimeline();
// }
