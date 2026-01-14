/* ==============================================
   NYU CONCRETE CANOE - LANDING PAGE INTERACTIONS
   ============================================== */

// Navbar scroll effect
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// Mobile menu toggle
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking on a link
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

// Parallax effect for hero section
const hero = document.getElementById('hero');
const layers = document.querySelectorAll('.parallax-layer');

window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroHeight = hero.offsetHeight;
    
    if (scrolled < heroHeight) {
        layers.forEach((layer, index) => {
            const speed = (index + 1) * 0.3;
            layer.style.transform = `translateY(${scrolled * speed}px)`;
        });
    }
});

// Mouse parallax effect for hero
hero.addEventListener('mousemove', (e) => {
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    layers.forEach((layer, index) => {
        const speed = (index + 1) * 10;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        
        layer.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// Create floating butterflies and flowers
const floatingContainer = document.getElementById('floatingElements');
const emojis = ['🦋', '🌸', '🌺', '🌼', '🦋', '🌷'];

function createFloatingElement() {
    const element = document.createElement('div');
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const isButterfly = emoji === '🦋';
    
    element.className = isButterfly ? 'floating-butterfly' : 'floating-flower';
    element.textContent = emoji;
    element.style.left = Math.random() * 100 + '%';
    element.style.top = Math.random() * 100 + '%';
    element.style.animationDelay = Math.random() * 5 + 's';
    element.style.animationDuration = (15 + Math.random() * 10) + 's';
    
    floatingContainer.appendChild(element);
}

// Create 12 floating elements
for (let i = 0; i < 12; i++) {
    createFloatingElement();
}

// Simple AOS (Animate On Scroll) implementation
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('aos-animate');
        }
    });
}, observerOptions);

// Observe all elements with data-aos attribute
document.querySelectorAll('[data-aos]').forEach(el => {
    observer.observe(el);
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const offsetTop = target.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Add sparkle effect on glass cards
const glassCards = document.querySelectorAll('.glass-card');

glassCards.forEach(card => {
    card.addEventListener('mouseenter', function(e) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = e.offsetX + 'px';
        sparkle.style.top = e.offsetY + 'px';
        this.appendChild(sparkle);
        
        setTimeout(() => sparkle.remove(), 1000);
    });
});

// Butterfly icon animation on hover
const butterflyIcons = document.querySelectorAll('.butterfly-icon');

butterflyIcons.forEach(icon => {
    icon.addEventListener('mouseenter', () => {
        icon.style.animation = 'none';
        setTimeout(() => {
            icon.style.animation = 'flutter 1s ease-in-out';
        }, 10);
    });
});

// Performance optimization: Reduce animations on low-end devices
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-aos]').forEach(el => {
        el.classList.add('aos-animate');
    });
    
    floatingContainer.style.display = 'none';
}

console.log('🦋 NYU Concrete Canoe - Landing page loaded successfully!');
