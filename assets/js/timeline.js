/* ==============================================
   NYU CONCRETE CANOE - TIMELINE SIMPLE
   Uses local data from canoes.js to avoid CORS
   ============================================== */

function initTimeline() {
    console.log('Starting timeline initialization...');
    const container = document.getElementById('canoeTimeline');
    
    if (!container) {
        console.error('Container #canoeTimeline not found');
        return;
    }

    try {
        // Use CANOE_DATA from canoes.js instead of fetch
        // local data is much more reliable for future club members
        const data = CANOE_DATA;
        
        console.log('Data loaded:', data.canoes ? data.canoes.length : 0, 'canoes');
        
        container.innerHTML = '';

        if (!data.canoes || data.canoes.length === 0) {
            container.innerHTML = '<p class="text-center">No history found.</p>';
            return;
        }

        data.canoes.forEach((canoe) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '4rem';
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 2rem; margin-bottom: 1.5rem;">
                    <span style="font-size: 3rem;">${canoe.icon || '🛶'}</span>
                    <div style="text-align: left;">
                        <span class="timeline-year">${canoe.year}</span>
                        <h2 style="margin: 0; text-align: left;">${canoe.name}</h2>
                    </div>
                </div>
                <p style="text-align: left; line-height: 1.8;">${canoe.description}</p>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.5rem;">
                    ${canoe.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            `;
            container.appendChild(card);
        });
        console.log('Timeline rendering complete.');

    } catch (e) {
        console.error('Timeline Error:', e);
        container.innerHTML = `
            <div class="card" style="border-color: rgba(255,0,0,0.3);">
                <h3>Error Loading Legacy</h3>
                <p>Data source 'CANOE_DATA' missing or malformed.</p>
            </div>
        `;
    }
}

// Fire immediately or on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
} else {
    initTimeline();
}
