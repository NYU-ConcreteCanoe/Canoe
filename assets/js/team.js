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

const PLACEHOLDER = "assets/img/headshots/placeholder.jpeg";

// One person card. Faculty lead with the name and add an email line; students
// lead with the photo. Both fall back to the placeholder if the file is gone.
function cardHTML(member, withEmail) {
  const name = esc(member.name || "Team Member");
  const role = esc(member.role || "NYU Concrete Canoe");
  const imagePath = esc(safePath(member.image) || PLACEHOLDER);
  const email = esc(member.email || "");

  const img = `
                    <img
                        src="${imagePath}"
                        alt="${name}"
                        style="width: 100%; border-radius: 12px; margin-bottom: 1.5rem;"
                        onerror="this.onerror=null; this.src='${PLACEHOLDER}'; this.style.opacity='0.5';"
                    >`;

  if (withEmail) {
    return `
                <div class="card">
                    <h3>${name}</h3>${img}
                    <p>${role}</p>
                    ${email ? `<p style="font-size: 1rem; opacity: 0.8;">${email}</p>` : ""}
                </div>
                `;
  }

  return `
                <div class="card">${img}
                    <h3>${name}</h3>
                    <p>${role}</p>
                </div>
                `;
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("team-container");
  const facultyContainer = document.getElementById("faculty-container");
  const facultySection = document.getElementById("faculty");

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

      container.innerHTML = data.leadership
        .map((member) => cardHTML(member, false))
        .join("");

      // The faculty section stays hidden unless there is someone to show.
      const faculty = Array.isArray(data.faculty) ? data.faculty : [];
      if (facultyContainer && facultySection) {
        if (faculty.length) {
          facultyContainer.innerHTML = faculty
            .map((member) => cardHTML(member, true))
            .join("");
          facultySection.hidden = false;
        } else {
          facultySection.hidden = true;
        }
      }
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
