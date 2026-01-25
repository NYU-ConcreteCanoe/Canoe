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
          const name = member.name || "Team Member";
          const role = member.role || "NYU Concrete Canoe";
          const imagePath =
            member.image || "assets/img/headshots/placeholder.jpeg";

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
