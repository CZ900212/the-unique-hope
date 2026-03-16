document.addEventListener('DOMContentLoaded', () => {
    initEtherealBackground();
});

function initEtherealBackground() {
    // Create Canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'hope-canvas';
    
    // Insert into hero section if it exists, otherwise body
    const hero = document.querySelector('.hero-section');
    if (hero) {
        hero.insertBefore(canvas, hero.firstChild);
    } else {
        document.body.insertBefore(canvas, document.body.firstChild);
    }

    const ctx = canvas.getContext('2d');
    let width, height;
    
    // Configuration
    const blobCount = 6;
    const blobs = [];
    
    // Palette: Deep Green, Emerald, Soft Pink, White/Cream
    // Using RGBA for blending
    const colors = [
        { r: 16, g: 185, b: 129 },   // Emerald
        { r: 6, g: 78, b: 59 },      // Deep Green
        { r: 219, g: 39, b: 119 },   // Pink Accent
        { r: 209, g: 250, b: 229 },  // Mint
        { r: 52, g: 211, b: 153 }    // Soft Green
    ];

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    class Blob {
        constructor() {
            this.init();
        }

        init() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5; // Very slow movement
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 200 + 150; // Large blobs
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.alpha = Math.random() * 0.2 + 0.05; // Very transparent
            this.angle = Math.random() * Math.PI * 2;
            this.angleSpeed = (Math.random() - 0.5) * 0.002;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.angle += this.angleSpeed;

            // Bounce off walls gently
            if (this.x < -this.radius) this.vx = Math.abs(this.vx);
            if (this.x > width + this.radius) this.vx = -Math.abs(this.vx);
            if (this.y < -this.radius) this.vy = Math.abs(this.vy);
            if (this.y > height + this.radius) this.vy = -Math.abs(this.vy);
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`);
            gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            // Draw an imperfect circle (blob shape)
            ctx.moveTo(this.radius, 0);
            /* 
               Simplified blob: just a radial gradient for performance and smoothness.
               Complex bezier blobs can be expensive to animate full screen.
            */
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Initialize blobs
    for (let i = 0; i < blobCount; i++) {
        blobs.push(new Blob());
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Global composite operation for blending
        // 'screen' or 'overlay' makes them blend nicely
        ctx.globalCompositeOperation = 'screen'; 

        blobs.forEach(blob => {
            blob.update();
            blob.draw();
        });
        
        ctx.globalCompositeOperation = 'source-over'; // Reset
        requestAnimationFrame(animate);
    }

    animate();
}