// Names and roles are authored by team members through the admin panel, so
// they are escaped rather than injected as HTML.
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

// Headshots must stay inside the repo. Anything absolute, protocol-relative or
// climbing out of the tree is rejected and falls back to the placeholder.
function safePath(path) {
  const p = String(path == null ? "" : path).trim();
  if (!p) return "";
  if (/^[a-z]+:/i.test(p) || p.startsWith("//") || p.startsWith("/")) return "";
  if (p.includes("..")) return "";
  return p;
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("team-container");

  // Path to team JSON file
  fetch("assets/data/team.json")
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then((data) => {
      if (!data.leadership || !Array.isArray(data.leadership)) {
        throw new Error("JSON structure is incorrect");
      }

      const cardsHTML = data.leadership
        .map((member) => {
          // Default Parameters if elements are missing in JSON
          const name = esc(member.name || "Team Member");
          const role = esc(member.role || "NYU Concrete Canoe");
          const imagePath = esc(
            safePath(member.image) || "assets/img/headshots/placeholder.jpeg",
          );

          return `
                <div class="card">
                    <img
                        src="${imagePath}"
                        alt="${name}"
                        style="width: 100%; border-radius: 12px; margin-bottom: 1.5rem;"
                        onerror="this.onerror=null; this.src='assets/img/headshots/placeholder.jpeg'; this.style.opacity='0.5';"
                    >
                    <h3>${name}</h3>
                    <p>${role}</p>
                </div>
                `;
        })
        .join("");

      container.innerHTML = cardsHTML;
    })
    .catch((error) => {
      console.error("Error loading team cards:", error);
      container.innerHTML = `
                <div class="card" style="grid-column: 1 / -1; text-align: center;">
                    <p>Unable to load leadership team. Please contact the webmaster.</p>
                </div>
            `;
    });
});
