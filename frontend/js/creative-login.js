document.addEventListener('DOMContentLoaded', () => {
    initTiltEffect();
    initCanvasBackground();
    initInputEffects();
    initTypingEffect();
    initMagneticButtons();
});

function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });
}

function initTypingEffect() {
    const subtitle = document.querySelector('.subtitle');
    if (!subtitle) return;
    
    const text = subtitle.innerText;
    subtitle.innerText = '';
    
    let i = 0;
    function type() {
        if (i < text.length) {
            subtitle.innerText += text.charAt(i);
            i++;
            setTimeout(type, 30);
        }
    }
    
    setTimeout(type, 500);
}

function initTiltEffect() {
    const card = document.querySelector('.login-card');
    const container = document.body;

    if (!card) return;

    container.addEventListener('mousemove', (e) => {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
        
        card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    });

    // Reset on mouse leave
    container.addEventListener('mouseleave', () => {
        card.style.transform = `rotateY(0deg) rotateX(0deg)`;
        card.style.transition = 'transform 0.5s ease';
    });

    container.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
    });
}

function initCanvasBackground() {
    const canvas = document.createElement('canvas');
    canvas.id = 'creative-bg';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 1;
            this.vy = (Math.random() - 0.5) * 1;
            this.size = Math.random() * 3 + 1;
            this.color = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 200 + 50}, ${Math.random() * 200 + 150}, ${Math.random() * 0.5 + 0.1})`;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }

    for (let i = 0; i < 100; i++) {
        particles.push(new Particle());
    }

    // Mouse interaction
    let mouse = { x: null, y: null };
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    });

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Draw connections
        particles.forEach((p, index) => {
            p.update();
            p.draw();

            // Connect to mouse
            if (mouse.x) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 200) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(100, 200, 255, ${1 - distance / 200})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            // Connect to other particles
            for (let j = index + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(100, 200, 255, ${0.1 * (1 - distance / 100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        });

        requestAnimationFrame(animate);
    }

    animate();
}

function initInputEffects() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.style.transform = 'scale(1.05)';
            input.parentElement.style.transition = 'transform 0.3s ease';
        });
        input.addEventListener('blur', () => {
            input.parentElement.style.transform = 'scale(1)';
        });
    });
}
