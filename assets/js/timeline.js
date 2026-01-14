/* ==============================================
   NYU CONCRETE CANOE - TIMELINE LOGIC
   Ultra-Glossy Liquid Glass Rendering
   ============================================== */

async function initTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    try {
        // Clear loading state
        container.innerHTML = '<p class="text-center" style="opacity: 0.5;">Loading legacy...</p>';

        const response = await fetch('assets/data/canoes.json');
        if (!response.ok) throw new Error('Data not found');
        
        const data = await response.json();
        container.innerHTML = '';

        if (!data.canoes || data.canoes.length === 0) {
            container.innerHTML = '<p class="text-center">No canoes found.</p>';
            return;
        }

        data.canoes.forEach((canoe, index) => {
            const card = document.createElement('div');
            card.className = 'card timeline-item';
            
            card.innerHTML = `
                <div style="text-align: center;">
                    <span class="timeline-year">${canoe.year}</span>
                    <h2 style="font-size: 2rem; margin-top: 1rem;">${canoe.name}</h2>
                    <p style="margin: 1.5rem 0; line-height: 1.8;">${canoe.description}</p>
                    <div class="timeline-tags">
                        ${canoe.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Timeline Error:', error);
        container.innerHTML = `
            <div class="card text-center">
                <p>Unable to load the history at this time.</p>
                <p style="font-size: 0.9rem; opacity: 0.6;">${error.message}</p>
            </div>
        `;
    }
}

// Ensure the function runs when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
} else {
    initTimeline();
}
