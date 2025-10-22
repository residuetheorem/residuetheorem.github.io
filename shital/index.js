



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- Application State & Configuration ---
const state = {
    isMobile: window.innerWidth <= 768,
    isInteracting: false, // Becomes true once the user can scroll freely
    isAutoScrolling: false, // True during programmatic scroll
    currentSection: 0,
    audioContextStarted: false,
    volume: null,
};

const config = {
    particleCount: state.isMobile ? 30 : 50,
    autoScrollDuration: 1.5,
    starCount: state.isMobile ? 50 : 100,
};

// --- DOM Elements ---
const DOM = {
    viewport: document.getElementById('viewport'),
    startOverlay: document.getElementById('start-overlay'),
    startButton: document.getElementById('start-button'),
    particleContainer: document.getElementById('particle-container'),
    storyNavContainer: document.getElementById('story-navigation'),
    storyNavUp: document.getElementById('story-mode-indicator-up'),
    storyNavDown: document.getElementById('story-mode-indicator-down'),
    bouquetCanvas: document.getElementById('bouquet-canvas'),
    bouquetSection: document.getElementById('bouquet-section'),
    themeSwitcher: document.getElementById('theme-switcher'),
    backgroundElements: document.getElementById('background-elements'),
    sections: [],
};

// --- Interactive Theme Manager ---
const themeManager = {
    themes: ['theme-day', 'theme-night'],
    currentThemeIndex: 0,
    
    init() {
        if (DOM.themeSwitcher) {
            DOM.themeSwitcher.addEventListener('click', () => this.cycleTheme());
        }
    },

    cycleTheme() {
        // Increment and wrap around the index
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const nextTheme = this.themes[this.currentThemeIndex];
        
        // Apply the new theme
        const body = document.body;
        body.classList.remove(...this.themes);
        body.classList.add(nextTheme);

        // Manage ambient audio track based on the new theme
        audio.setAmbientTrack(nextTheme.replace('theme-', ''));

        // Redraw the bouquet with the new theme colors to fix color-switching bug
        flowerBouquet.draw();
    }
};

// --- Utility Functions ---
function shadeColor(color, percent) {
    if (!color.startsWith('#')) return color; // Handle non-hex colors gracefully

    let hex = color.slice(1);

    // If shorthand form (#RGB), expand it to #RRGGBB
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    if (hex.length !== 6) {
        return color; // Return original if still invalid
    }

    let R = parseInt(hex.substring(0, 2), 16);
    let G = parseInt(hex.substring(2, 4), 16);
    let B = parseInt(hex.substring(4, 6), 16);

    // Calculate the new RGB values
    R = Math.round(R * (1 + percent / 100));
    G = Math.round(G * (1 + percent / 100));
    B = Math.round(B * (1 + percent / 100));

    // Clamp the values to the valid 0-255 range
    R = Math.max(0, Math.min(255, R));
    G = Math.max(0, Math.min(255, G));
    B = Math.max(0, Math.min(255, B));
    
    const toHex = (c) => ('00' + c.toString(16)).slice(-2);
    
    return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


// --- Flower Bouquet ---
const flowerBouquet = {
    ctx: null,
    width: 0,
    height: 0,
    hasAnimated: false,
    flowers: [],
    stems: [],
    leaves: [],
    time: 0,
    animationFrameId: null,
    
    init() {
        if (!DOM.bouquetCanvas) return;
        this.ctx = DOM.bouquetCanvas.getContext('2d');
        this.handleResize();
        this.generate(); // Generate the bouquet structure
        this.draw(); // Initial draw (invisible stems)

        // Use the debounce utility for resizing
        window.addEventListener('resize', debounce(() => {
            this.handleResize();
            this.generate();
            this.draw();
        }, 100));
    },

    handleResize() {
        const section = DOM.bouquetSection;
        const size = Math.min(section.clientWidth * 0.9, section.clientHeight * 0.9, 500);
        this.width = size;
        this.height = size;
        DOM.bouquetCanvas.width = this.width;
        DOM.bouquetCanvas.height = this.height;
    },
    
    getThemeColors() {
        const style = getComputedStyle(document.body);
        
        return {
            stem: style.getPropertyValue('--stem-color').trim(),
            leaf: style.getPropertyValue('--leaf-color').trim(),
            // Use the dedicated petal colors from CSS to make them "pop"
            petal1: style.getPropertyValue('--petal-color1').trim(),
            petal2: style.getPropertyValue('--petal-color2').trim(),
            petal3: style.getPropertyValue('--petal-color3').trim(),
        };
    },

    generate() {
        const wasAnimated = this.hasAnimated;
        this.flowers = [];
        this.stems = [];
        this.leaves = [];
        const numFlowers = state.isMobile ? 15 : 25;
        const origin = { x: this.width / 2, y: this.height };
        const bouquetRadius = this.width * 0.4;

        for (let i = 0; i < numFlowers; i++) {
            const angle = (Math.PI / numFlowers) * (i - (numFlowers - 1) / 2) * (0.7 + Math.random() * 0.6);
            const stemLength = bouquetRadius * (0.4 + Math.random() * 0.6);
            const endX = origin.x + Math.sin(angle) * stemLength * 1.0; // Reduced from 1.5 to prevent clipping
            const endY = origin.y - Math.cos(angle) * stemLength - (this.height * 0.3);

            const controlX = origin.x + Math.sin(angle * 0.5) * stemLength * 0.5;
            const controlY = origin.y - this.height * 0.5;
            this.stems.push({
                p0: origin, p1: { x: controlX, y: controlY }, p2: { x: endX, y: endY },
                progress: wasAnimated ? 1 : 0
            });

            // A single leaf per stem for a cleaner look
            const t = 0.4 + Math.random() * 0.3;
            this.leaves.push({
                stemIndex: i, t, side: Math.random() > 0.5 ? 1 : -1,
                progress: wasAnimated ? 1 : 0
            });

            // Flower radius is proportionate to stem length, but small overall
            const flowerRadius = stemLength * 0.12;
            this.flowers.push({
                x: endX, y: endY, radius: flowerRadius,
                colorIndex: i % 3,
                zIndex: endY,
                progress: wasAnimated ? 1 : 0,
                animationOffset: Math.random() * Math.PI * 2, // For unique petal sway
                petalShape: Math.floor(Math.random() * 3) // 0: Classic, 1: Pointed, 2: Heart
            });
        }
    },

    animate() {
        if (this.hasAnimated) return;
        this.hasAnimated = true;
        
        const tl = gsap.timeline({ 
            onUpdate: () => this.draw(),
            onComplete: () => this.startSwayingAnimation() 
        });
        
        tl.to(this.stems, {
            progress: 1, duration: 2.5, ease: 'power2.out', stagger: 0.1
        });
        
        tl.to(this.leaves, {
            progress: 1, duration: 2.0, ease: 'power1.out', stagger: 0.05
        }, "-=2.0");

        tl.to(this.flowers, {
            progress: 1, duration: 3.5, ease: 'elastic.out(1, 0.7)', stagger: 0.1
        }, "-=1.5");
    },
    
    startSwayingAnimation() {
        if (this.animationFrameId) return; // Animation is already running
        const loop = () => {
            this.time += 0.02; // Controls the speed of the sway
            this.draw();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    },

    stopSwayingAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    },

    getQuadraticBezierPoint(p0, p1, p2, t) {
        const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
        const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
        return { x, y };
    },
    
    drawLeaf(leaf, colors) {
        const stem = this.stems[leaf.stemIndex];
        if (!stem || leaf.progress <= 0) return;
        
        const pos = this.getQuadraticBezierPoint(stem.p0, stem.p1, stem.p2, leaf.t);
        const leafSize = this.width * 0.035 * leaf.progress;
        if (leafSize <= 0.1) return;

        const angleToCenter = Math.atan2(pos.y - this.height, pos.x - this.width / 2);

        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(angleToCenter + Math.PI / 2 + (leaf.side * (Math.PI / 4)));
        this.ctx.scale(leaf.progress, leaf.progress);
        
        this.ctx.fillStyle = colors.leaf;
        this.ctx.globalAlpha = 0.7; // Watercolor transparency

        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.quadraticCurveTo(leafSize * 0.5, -leafSize, leafSize, -leafSize * 1.5);
        this.ctx.quadraticCurveTo(leafSize * 0.6, 0, 0, 0);
        this.ctx.closePath();
        
        this.ctx.fill();
        this.ctx.restore();
    },
    
    drawFlower(flower, index, colors) {
        const p = flower.progress;
        if (p <= 0) return;

        const petalColors = [colors.petal1, colors.petal2, colors.petal3];
        const petalColor = petalColors[flower.colorIndex % 3];
        const centerColor = shadeColor(petalColor, -20);

        this.ctx.save();
        this.ctx.translate(flower.x, flower.y);
        this.ctx.scale(p, p);

        const numPetals = 5;
        const petalLength = flower.radius;
        const petalWidth = flower.radius * 0.6;
        
        // --- Calculate sway for this frame ---
        // A small sine wave value based on global time and the flower's unique offset
        const sway = Math.sin(this.time + flower.animationOffset) * 0.05;
        
        // --- Draw Petals ---
        this.ctx.fillStyle = petalColor;
        for (let i = 0; i < numPetals; i++) {
            const angle = (Math.PI * 2 / numPetals) * i;
            this.ctx.save();
            this.ctx.rotate(angle + sway); // Apply the subtle sway to the petal's angle
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);

            switch (flower.petalShape) {
                case 1: // Pointed Petal
                    this.ctx.quadraticCurveTo(petalWidth * 0.5, -petalLength, 0, -petalLength * 1.2);
                    this.ctx.quadraticCurveTo(-petalWidth * 0.5, -petalLength, 0, 0);
                    break;
                case 2: // Heart Petal
                    this.ctx.bezierCurveTo(-petalWidth * 0.6, -petalLength * 0.6, -petalWidth, -petalLength, 0, -petalLength);
                    this.ctx.bezierCurveTo(petalWidth, -petalLength, petalWidth * 0.6, -petalLength * 0.6, 0, 0);
                    break;
                default: // Case 0: Classic Petal
                    this.ctx.quadraticCurveTo(petalWidth, -petalLength * 0.5, 0, -petalLength);
                    this.ctx.quadraticCurveTo(-petalWidth, -petalLength * 0.5, 0, 0);
                    break;
            }

            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        }

        // --- Draw Center ---
        this.ctx.fillStyle = centerColor;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, flower.radius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    },

    draw() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);
        const colors = this.getThemeColors();

        this.ctx.strokeStyle = colors.stem;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.stems.forEach(stem => {
            const t = stem.progress;
            if (t <= 0) return;
            this.ctx.beginPath();
            this.ctx.moveTo(stem.p0.x, stem.p0.y);
            const p1 = { x: stem.p0.x + (stem.p1.x - stem.p0.x) * t, y: stem.p0.y + (stem.p1.y - stem.p0.y) * t };
            const p2 = this.getQuadraticBezierPoint(stem.p0, stem.p1, stem.p2, t);
            this.ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
            this.ctx.stroke();
        });

        this.leaves.forEach(leaf => {
            this.drawLeaf(leaf, colors);
        });

        this.flowers.sort((a, b) => a.zIndex - b.zIndex);
        this.flowers.forEach((flower, i) => {
            this.drawFlower(flower, i, colors);
        });
    }
};


// --- Particle System (Efficient Object Pooling) ---
const particles = {
    pool: [],
    available: [],
    init() {
        if (!DOM.particleContainer) return;
        for (let i = 0; i < config.particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            DOM.particleContainer.appendChild(particle);
            this.pool.push(particle);
        }
        this.available = [...this.pool];
    },
    animate(config) {
        const particle = this.available.pop();
        if (!particle) return;

        particle.className = `particle ${config.type} animate`;
        particle.innerHTML = config.content || '';
        particle.style.backgroundColor = config.color || '';
        particle.style.left = `${Math.random() * 100}%`;
        
        const duration = Math.random() * config.durationRange + config.durationMin;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${Math.random() * 0.5}s`;

        const onAnimationEnd = () => {
            particle.classList.remove('animate');
            particle.removeEventListener('animationend', onAnimationEnd);
            this.available.push(particle);
        };
        particle.addEventListener('animationend', onAnimationEnd);
    },
    effects: {
        flowers() {
            const items = ['🌸', '🌺', '🌻', '🌷', '🌹', '💐', '🌼', '🌿'];
            const count = state.isMobile ? 15 : 30;
            for (let i = 0; i < count; i++) {
                setTimeout(() => particles.animate({
                    type: 'emoji-rain',
                    content: items[items.length * Math.random() | 0], // Bitwise optimization
                    durationRange: 3, durationMin: 4
                }), i * 80);
            }
        },
        confetti(count) {
            const style = getComputedStyle(document.documentElement);
            const colors = [
                style.getPropertyValue('--accent1').trim(),
                style.getPropertyValue('--accent2').trim(),
                style.getPropertyValue('--text-dark').trim(),
                style.getPropertyValue('--bg-color').trim()
            ];
            for (let i = 0; i < count; i++) {
                setTimeout(() => particles.animate({
                    type: 'confetti-piece',
                    color: colors[colors.length * Math.random() | 0], // Bitwise optimization
                    durationRange: 4, durationMin: 5
                }), i * 100);
            }
        }
    }
};

// --- Music & Audio ---
const audio = {
    sampler: null,
    nightPlayer: null,
    nightVolume: null,
    
    init() {
        return new Promise(async (resolve, reject) => {
            try {
                if (state.audioContextStarted) {
                    resolve();
                    return;
                }
                
                await Tone.start();
                state.audioContextStarted = true;

                state.volume = new Tone.Volume(0).toDestination();

                // Set up dedicated volume nodes for ambient tracks for independent control
                this.nightVolume = new Tone.Volume(-Infinity).connect(state.volume);

                const nightPlayerPromise = new Promise((res, rej) => {
                    this.nightPlayer = new Tone.Player({
                        url: "https://files.catbox.moe/r3ysou.mp3",
                        loop: true,
                        onload: res,
                        onerror: rej,
                    }).connect(this.nightVolume);
                });

                const samplerPromise = new Promise((res, rej) => {
                    this.sampler = new Tone.Sampler({
                        urls: { "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", "A4": "A4.mp3", "C5": "C5.mp3" },
                        release: 1,
                        baseUrl: "https://tonejs.github.io/audio/salamander/",
                        onload: res,
                        onerror: rej,
                    }).connect(state.volume);
                });
                
                await Promise.all([nightPlayerPromise, samplerPromise]);
                
                this.startPlayback();
                resolve(); // Resolve promise now that all audio is ready.

                document.addEventListener('visibilitychange', this.handleVisibilityChange);
            } catch (error) {
                console.error("Error initializing audio context or loading files:", error);
                reject(error);
            }
        });
    },

    setAmbientTrack(theme) {
        if (!state.audioContextStarted) return;
        
        const melodyEndTime = Tone.Time('8:0').toSeconds();
        const isHbdMelodyOver = Tone.Transport.seconds > melodyEndTime;
        const targetVolume = isHbdMelodyOver ? -16 : -10; // Quieter after main melody
        const fadeDuration = 2.5; // seconds

        if (theme === 'night') {
            if (this.nightPlayer.state !== 'started') this.nightPlayer.start();
            this.nightVolume.volume.rampTo(targetVolume, fadeDuration);
        } else { // It's 'day' theme
            this.nightVolume.volume.rampTo(-Infinity, fadeDuration);
        }
    },

    createOrb() {
        const orb = document.createElement('div');
        orb.className = 'music-orb';
        const style = getComputedStyle(document.documentElement);
        // Use the vibrant petal colors for a more lively effect
        const colors = [
            style.getPropertyValue('--petal-color1').trim(),
            style.getPropertyValue('--petal-color2').trim(),
            style.getPropertyValue('--petal-color3').trim()
        ];
        const size = Math.random() * 30 + 15;
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        const color = colors[colors.length * Math.random() | 0]; // Bitwise optimization
        orb.style.backgroundColor = color;
        orb.style.left = `${Math.random() * 100}vw`;
        orb.style.top = `${Math.random() * 100}vh`;
        orb.style.boxShadow = `0 0 ${size * 2}px ${color}`;
        document.body.appendChild(orb);
        setTimeout(() => orb.remove(), 6000);
    },
    startPlayback() {
        // Set time signature for "Happy Birthday"
        Tone.Transport.timeSignature = 3; 

        const melody = [
            { time: '0:0', note: 'C4', duration: '8n' }, { time: '0:0.5', note: 'C4', duration: '8n' },
            { time: '0:1', note: 'D4', duration: '4n' }, { time: '0:2', note: 'C4', duration: '4n' },
            { time: '1:0', note: 'F4', duration: '4n' }, { time: '1:1', note: 'E4', duration: '2n' },
            { time: '2:0', note: 'C4', duration: '8n' }, { time: '2:0.5', note: 'C4', duration: '8n' },
            { time: '2:1', note: 'D4', duration: '4n' }, { time: '2:2', note: 'C4', duration: '4n' },
            { time: '3:0', note: 'G4', duration: '4n' }, { time: '3:1', note: 'F4', duration: '2n' },
            { time: '4:0', note: 'C4', duration: '8n' }, { time: '4:0.5', note: 'C4', duration: '8n' },
            { time: '4:1', note: 'C5', duration: '4n' }, { time: '4:2', note: 'A4', duration: '4n' },
            { time: '5:0', note: 'F4', duration: '4n' }, { time: '5:1', note: 'E4', duration: '4n' },
            { time: '5:2', note: 'D4', duration: '2n' },
            { time: '6:0', note: 'A#4', duration: '8n' }, { time: '6:0.5', note: 'A#4', duration: '8n' },
            { time: '6:1', note: 'A4', duration: '4n' }, { time: '6:2', note: 'F4', duration: '4n' },
            { time: '7:0', note: 'G4', duration: '4n' }, { time: '7:1', note: 'F4', duration: '2n' },
        ];
        new Tone.Part((time, value) => {
            this.sampler.triggerAttackRelease(value.note, value.duration, time);
            this.createOrb();
        }, melody).start(0);

        const melodyEndTime = '8:0';
        
        // New ambient, looping background piece.
        const backgroundMusic = new Tone.Sequence((time, note) => {
            this.sampler.triggerAttackRelease(note, '1n', time);
            if (Math.random() < 0.25) this.createOrb();
        }, [
            'C4', 'E4', 'G4', 'D4',
            'A3', 'C4', 'E4', 'B3',
            'F3', 'A3', 'C4', 'G3',
            'G3', 'B3', 'D4', 'A3'
        ], '2n').start(melodyEndTime);
        
        backgroundMusic.loop = true;
        backgroundMusic.humanize = true;

        // Schedule a volume adjustment for ambient tracks at the end of the main melody
        Tone.Transport.scheduleOnce(() => {
            const bodyClass = document.body.className;
            if (bodyClass.includes('theme-night') && this.nightPlayer.state === 'started') {
                this.nightVolume.volume.rampTo(-16, 1.5);
            }
        }, melodyEndTime);

        state.volume.volume.rampTo(-12, '1m', melodyEndTime);
        Tone.Transport.start();
    },
    handleVisibilityChange() {
        if (!state.audioContextStarted || !state.volume) return;
        if (document.hidden) {
            state.volume.volume.rampTo(-Infinity, 0.5);
        } else {
            const melodyEndTimeInSeconds = Tone.Time('8:0').toSeconds();
            // The main melody plays at 0dB, background loop at -12dB.
            const targetVolume = Tone.Transport.seconds > melodyEndTimeInSeconds ? -12 : 0;
            state.volume.volume.rampTo(targetVolume, 0.5);
        }
    }
};

// --- Animations & Scrolling ---
const experience = {
    handleWheel: null,
    handleTouchMove: null,

    init() {
        gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
        DOM.sections = gsap.utils.toArray('.content-section');
        this.adjustSectionHeights(); // Set initial heights
        this.setupBackgrounds();
        flowerBouquet.init();
        this.setupTextAnimations();
        this.setupScrolling();
        this.setupSpecialEffects();
        if (!state.isMobile) this.setupCursorTrail();

        // Use debounce for performance on resize
        window.addEventListener('resize', debounce(() => this.adjustSectionHeights(), 250));
    },

    adjustSectionHeights() {
        // This ensures each section is exactly the height of the viewport, preventing bleed.
        const vh = window.innerHeight;
        DOM.sections.forEach(section => {
            section.style.minHeight = `${vh}px`;
        });
    },

    setupBackgrounds() {
        if (!DOM.backgroundElements) return;
        
        // Clear any previous content
        DOM.backgroundElements.innerHTML = '';

        // --- Create Night Sky Scene ---
        const nightSky = document.createElement('div');
        nightSky.className = 'background-scene night-sky';

        const moonSVGString = `
            <svg class="moon" viewBox="0 0 100 100">
                <defs>
                    <radialGradient id="moon-gradient" cx="30%" cy="30%" r="70%">
                        <stop offset="0%" style="stop-color: #f8f7f2;" />
                        <stop offset="100%" style="stop-color: #d4d3c8;" />
                    </radialGradient>
                </defs>
                <path transform="rotate(-65 50 50)" d="M 50 0 A 50 50 0 1 0 50 100 A 38 50 0 0 1 50 0 Z" fill="url(#moon-gradient)"/>
            </svg>`;
        
        // Use a temporary element to parse the SVG string into a DOM node
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = moonSVGString.trim();
        const moonElement = tempDiv.firstChild;
        if(moonElement) {
            nightSky.appendChild(moonElement);
        }

        // --- Create Venus Conjunction ---
        const venusContainer = document.createElement('div');
        venusContainer.className = 'venus-container';
        
        const venusPlanet = document.createElement('div');
        venusPlanet.className = 'venus';
        
        const venusLabel = document.createElement('span');
        venusLabel.className = 'venus-label';
        venusLabel.textContent = 'Venus';
        
        venusContainer.appendChild(venusPlanet);
        venusContainer.appendChild(venusLabel);
        nightSky.appendChild(venusContainer);


        for (let i = 0; i < config.starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 2 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.left = `${Math.random() * 100}%`;
            star.style.animationDelay = `${Math.random() * 5}s`;
            star.style.animationDuration = `${Math.random() * 3 + 4}s`;
            nightSky.appendChild(star);
        }
        DOM.backgroundElements.appendChild(nightSky);
    },

    setupTextAnimations() {
        DOM.sections.forEach((section) => {
            const words = section.querySelectorAll(".line span");
            if (words.length === 0) return;
    
            // Set initial state: words are transparent, slightly scaled down, and moved down
            gsap.set(words, {
                autoAlpha: 0,
                y: '50%', // Start slightly below their final position
                scale: 0.95,
            });
            
            // Store the animation on the section object itself
            section.textAnimation = gsap.to(words, {
                autoAlpha: 1,
                y: '0%', // Animate to their final position
                scale: 1,
                duration: 1.5, // Slower duration for a more gentle effect
                stagger: 0.09, // Increased stagger for a slower word-by-word reveal
                ease: 'expo.out', // A more energetic ease
                paused: true
            });
        });
    },
    
    triggerTextAnimationFor(sectionIndex) {
        const section = DOM.sections[sectionIndex];
        if (section && section.textAnimation && !section.textAnimation.isActive()) {
            section.textAnimation.play(0);
        }
    },

    setupScrolling() {
        this.handleWheel = (e) => {
            if (state.isInteracting || state.isAutoScrolling) return;
            e.preventDefault();
        };

        this.handleTouchMove = (e) => {
            if (state.isInteracting || state.isAutoScrolling) return;
            e.preventDefault();
        };
        
        DOM.viewport.addEventListener('wheel', this.handleWheel, { passive: false });
        DOM.viewport.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    },
    setupSpecialEffects() {
        if (DOM.bouquetSection) {
            // Animate the bouquet drawing sequence once when it first comes into view.
            ScrollTrigger.create({
                trigger: DOM.bouquetSection,
                scroller: DOM.viewport,
                start: 'top center',
                once: true,
                onEnter: () => flowerBouquet.animate(),
            });

            // This trigger is for both redraws (preventing canvas clearing) and managing
            // the animation loop for performance, so it only runs when visible.
            ScrollTrigger.create({
                trigger: DOM.bouquetSection,
                scroller: DOM.viewport,
                start: 'top bottom',
                end: 'bottom top',
                onEnter: () => {
                    flowerBouquet.draw(); // Redraw in case it was cleared
                    if (flowerBouquet.hasAnimated) {
                        flowerBouquet.startSwayingAnimation();
                    }
                },
                onLeave: () => flowerBouquet.stopSwayingAnimation(),
                onEnterBack: () => {
                    flowerBouquet.draw();
                    if (flowerBouquet.hasAnimated) {
                        flowerBouquet.startSwayingAnimation();
                    }
                },
                onLeaveBack: () => flowerBouquet.stopSwayingAnimation(),
            });
        }
        
        if (!state.isMobile) {
            gsap.utils.toArray('.parallax-el').forEach(el => {
                gsap.to(el, {
                    yPercent: -50, ease: 'none',
                    scrollTrigger: { trigger: el.closest('.content-section'), scroller: DOM.viewport, scrub: 0.5 }
                });
            });
        }
    },
    startStoryMode() {
        state.isInteracting = false;
        state.currentSection = 0;
        DOM.storyNavContainer.classList.remove('hidden');

        // Defer the button update to the next frame to avoid potential rendering race conditions
        // where child button visibility is calculated before the parent container becomes visible.
        requestAnimationFrame(() => {
            this.updateNavButtons();
            // Trigger animation for the first section explicitly
            this.triggerTextAnimationFor(0);
        });
    },
    endStoryMode() {
        if (state.isInteracting) return;
        state.isInteracting = true;
        DOM.storyNavContainer.classList.add('hidden');
        gsap.killTweensOf(DOM.viewport);

        // Remove scroll prevention to allow free, unconstrained scrolling
        DOM.viewport.removeEventListener('wheel', this.handleWheel);
        DOM.viewport.removeEventListener('touchmove', this.handleTouchMove);
    },
    updateNavButtons() {
        DOM.storyNavUp.classList.toggle('hidden', state.currentSection === 0);
        DOM.storyNavDown.classList.toggle('hidden', state.currentSection === DOM.sections.length - 1);
    },
    
    navigateStory(direction) {
        if (state.isAutoScrolling) return;

        const nextSectionIndex = state.currentSection + direction;
        if (nextSectionIndex < 0 || nextSectionIndex >= DOM.sections.length) {
            return;
        }

        state.currentSection = nextSectionIndex;
        state.isAutoScrolling = true;

        gsap.to(DOM.viewport, {
            scrollTo: DOM.sections[state.currentSection],
            duration: config.autoScrollDuration,
            ease: 'power3.inOut',
            onComplete: () => {
                state.isAutoScrolling = false;
                this.triggerTextAnimationFor(state.currentSection);
                this.updateNavButtons();
                if (state.currentSection === DOM.sections.length - 1) {
                    this.endStoryMode();
                }
            }
        });
    },
    
    setupCursorTrail() {
        const trailCount = 20;
        const trailParticles = [];
        
        const getTrailColors = () => {
            const style = getComputedStyle(document.documentElement);
            return [
                style.getPropertyValue('--accent1').trim(),
                style.getPropertyValue('--accent2').trim(),
                style.getPropertyValue('--text-dark').trim()
            ];
        };

        let colors = getTrailColors();

        for(let i = 0; i < trailCount; i++) {
            let p = document.createElement('div');
            p.className = 'cursor-trail';
            p.style.backgroundColor = colors[i % colors.length];
            document.body.appendChild(p);
            trailParticles.push({ el: p, x: 0, y: 0 });
        }
        
        new MutationObserver(() => {
            const newColors = getTrailColors();
            trailParticles.forEach((p, i) => {
                p.el.style.backgroundColor = newColors[i % newColors.length];
            });
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

        let mouseX = -100, mouseY = -100;
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function draw() {
            let x = mouseX, y = mouseY;
            if (trailParticles[0]) trailParticles[0].el.style.opacity = '1';
            
            trailParticles.forEach((p, index) => {
                const nextP = trailParticles[index + 1] || trailParticles[0];
                p.x = x; p.y = y;
                p.el.style.transform = `translate(${x - 5}px, ${y - 5}px) scale(${ (trailCount - index) / trailCount })`;
                x += (nextP.x - p.x) * 0.4;
                y += (nextP.y - p.y) * 0.4;
            });
            requestAnimationFrame(draw);
        }
        draw();
    }
};

// --- Main Application Initialization ---
function init() {
    if (!DOM.viewport) {
        console.error("Critical error: Viewport element not found.");
        return;
    }
    
    themeManager.init();
    particles.init();
    experience.init();

    DOM.startButton.addEventListener('click', async () => {
        DOM.startOverlay.classList.add('hidden');
        
        const startButtonText = DOM.startButton.querySelector('.start-button-text');
        if (startButtonText) startButtonText.textContent = 'Loading...';

        particles.effects.flowers();
        particles.effects.confetti(state.isMobile ? 15 : 25);
        try {
            await audio.init();
        } catch(e) {
            console.warn("Could not initialize audio. Story will continue without sound.");
        } finally {
            experience.startStoryMode();
        }
        
    }, { once: true });
    
    DOM.storyNavDown.addEventListener('click', () => experience.navigateStory(1));
    DOM.storyNavUp.addEventListener('click', () => experience.navigateStory(-1));

    setInterval(() => particles.effects.confetti(state.isMobile ? 1 : 3), 18000);
}

document.addEventListener('DOMContentLoaded', init);