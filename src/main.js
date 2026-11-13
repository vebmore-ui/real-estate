import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as THREE from 'three';

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smooth scrolling with Lenis
const lenis = new Lenis({
  duration: 1.15,
  smoothWheel: true,
  smoothTouch: false,
  lerp: prefersReduced ? 0.22 : 0.09,
  wheelMultiplier: prefersReduced ? 0.82 : 1
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ==========================================================================
// 1. THREE.JS PERSPECTIVE CORRIDOR (Silky smooth, WebGL, 0% vibration)
// ==========================================================================
const canvas = document.getElementById('hero-canvas');
const hero = document.querySelector('.hero');
const SPEED = 0.038;

const imageUrls = [
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
];

let renderer, scene, camera;
let rightMeshes = [];
let leftMeshes = [];
let textures = [];
let heroPhase = 0;
let isHeroActive = true;

function initThree() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 5.0);
  camera.lookAt(0, 0, 0);

  const textureLoader = new THREE.TextureLoader();
  textures = imageUrls.map((url) => {
    const tex = textureLoader.load(url);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  });

  const geom = new THREE.PlaneGeometry(1.68, 1.18);

  // 5 frames on the right, 5 frames on the left
  for (let i = 0; i < 5; i += 1) {
    const matR = new THREE.MeshBasicMaterial({
      map: textures[i],
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const meshR = new THREE.Mesh(geom, matR);
    scene.add(meshR);
    rightMeshes.push(meshR);

    const matL = new THREE.MeshBasicMaterial({
      map: textures[(i + 2) % textures.length],
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const meshL = new THREE.Mesh(geom, matL);
    scene.add(meshL);
    leftMeshes.push(meshL);
  }

  updateCorridor();
}

function updateCorridor() {
  const width = window.innerWidth;
  const mobile = width < 768;

  // Perspective corridor geometry
  const wallX = mobile ? 1.85 : 2.45;
  const rotAngle = mobile ? 0.35 : 0.39;
  const Z_NEAR = 1.6;
  const Z_FAR = -4.8;
  const Z_SPAN = Z_NEAR - Z_FAR;

  for (let k = 0; k < 5; k += 1) {
    // Right side: enters at outer edge (Z_NEAR), travels inward to center (Z_FAR)
    const pR = (k / 5 + heroPhase) % 1;
    const zR = Z_NEAR - pR * Z_SPAN;
    const meshR = rightMeshes[k];
    meshR.position.set(wallX, 0, zR);
    meshR.rotation.y = -Math.PI * rotAngle;

    // Soft opacity fade near center and at extreme outer edge
    let opR = 1;
    if (pR > 0.68) {
      opR = Math.max(0, Math.min(1, (1.0 - pR) / 0.32));
    } else if (pR < 0.08) {
      opR = Math.max(0, Math.min(1, pR / 0.08));
    }
    meshR.material.opacity = 0.95 * opR;
    meshR.visible = opR > 0.005;

    // Left side: emerges from center (Z_FAR), travels outward to left edge (Z_NEAR)
    // At heroPhase = 0: pL = k / 5 = pR (perfect mirror symmetry at rest)
    const pL = (k / 5 - heroPhase + 10) % 1;
    const zL = Z_NEAR - pL * Z_SPAN;
    const meshL = leftMeshes[k];
    meshL.position.set(-wallX, 0, zL);
    meshL.rotation.y = Math.PI * rotAngle;

    let opL = 1;
    if (pL > 0.68) {
      opL = Math.max(0, Math.min(1, (1.0 - pL) / 0.32));
    } else if (pL < 0.08) {
      opL = Math.max(0, Math.min(1, pL / 0.08));
    }
    meshL.material.opacity = 0.95 * opL;
    meshL.visible = opL > 0.005;
  }

  renderer.render(scene, camera);
}

function animateThree() {
  if (isHeroActive) {
    heroPhase = (heroPhase + SPEED * (prefersReduced ? 0.3 : 1) / 60) % 1;
    updateCorridor();
  }
}
gsap.ticker.add(animateThree);

initThree();

window.addEventListener('resize', () => {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  updateCorridor();
  ScrollTrigger.refresh();
});

// Initial brand / hero entrance
gsap.fromTo('.brand', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 1.1, delay: 0.15, ease: 'power2.out' });
gsap.fromTo('.headline-wrap', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.3, ease: 'power2.out' });

// ==========================================================================
// 2. HERO FADE AWAY SCROLL TRANSITION (No zoom in, soft fade out into Section 2)
// ==========================================================================
gsap.to('.hero-stage', {
  opacity: 0,
  y: -50,
  ease: 'power1.in',
  scrollTrigger: {
    trigger: hero,
    start: 'top top',
    end: '75% top',
    scrub: 0.6,
    onUpdate: (self) => {
      if (self.progress > 0.95 && isHeroActive) {
        isHeroActive = false;
      } else if (self.progress <= 0.95 && !isHeroActive) {
        isHeroActive = true;
      }
    }
  }
});

// ==========================================================================
// 3. FIXED NAVBAR (Smooth scroll on click + hidden in closing section)
// ==========================================================================
const bottomNav = document.querySelector('.bottom-nav');

// Smooth scroll to sections on navbar click
document.querySelectorAll('.nav-item').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const id = link.getAttribute('href');
    const target = document.querySelector(id);
    if (target) {
      lenis.scrollTo(target, {
        offset: -20,
        duration: 1.3,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
      });
    }
  });
});

// Hide bottom navbar when scrolled into the last contact section
ScrollTrigger.create({
  trigger: '#contact',
  start: 'top 85%',
  end: 'bottom bottom',
  onEnter: () => bottomNav.classList.add('is-hidden'),
  onLeaveBack: () => bottomNav.classList.remove('is-hidden'),
  onEnterBack: () => bottomNav.classList.add('is-hidden')
});

// Top scroll progress bar
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => gsap.set('.scroll-progress span', { scaleX: self.progress })
});

// ==========================================================================
// 4. EDITORIAL SECTIONS (Section 2, Gallery horizontal scrub, Features, Quote)
// ==========================================================================
gsap.utils.toArray('.reveal, .reveal-lines').forEach((element) => {
  gsap.fromTo(element, { y: 30, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.95, ease: 'power2.out',
    scrollTrigger: { trigger: element, start: 'top 84%', once: true }
  });
});

gsap.utils.toArray('.gallery-card').forEach((card, index) => {
  const restingY = index === 1 || index === 3 ? 52 : index === 2 ? -38 : 0;
  gsap.fromTo(card, { y: restingY + 70 + (index % 2) * 24, opacity: 0 }, {
    y: restingY,
    opacity: 1, ease: 'none',
    scrollTrigger: { trigger: card, start: 'top 95%', end: 'top 40%', scrub: 0.75 }
  });
  gsap.fromTo(card.querySelector('.image-wrap'), { clipPath: 'inset(12% 9% 12% 9%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: card, start: 'top 90%', end: 'top 48%', scrub: 0.8 }
  });
});

// Horizontal scroll effect for gallery track
gsap.to('.gallery-track', {
  x: () => -Math.max(0, document.querySelector('.gallery-track').scrollWidth - window.innerWidth * 0.9),
  ease: 'none',
  scrollTrigger: {
    trigger: '.gallery-section',
    start: 'top 85%',
    end: () => `+=${Math.max(window.innerHeight * 1.6, document.querySelector('.gallery-track').scrollWidth * 0.72)}`,
    scrub: 0.8,
    invalidateOnRefresh: true
  }
});

gsap.to('.fullbleed-image img', {
  scale: 1,
  ease: 'none',
  scrollTrigger: { trigger: '.fullbleed', start: 'top bottom', end: 'bottom top', scrub: 1 }
});

gsap.fromTo('.quote-section blockquote, .quote-mark, .quote-credit', { y: 30, opacity: 0 }, {
  y: 0, opacity: 1, stagger: 0.14, duration: 1.1, ease: 'power2.out',
  scrollTrigger: { trigger: '.quote-section', start: 'top 72%', once: true }
});

gsap.utils.toArray('.feature-card').forEach((card, index) => {
  const image = card.querySelector('img');
  gsap.fromTo(image, { yPercent: 8 + index * 2 }, {
    yPercent: -6, ease: 'none',
    scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
  });
  const counter = card.querySelector('.feature-number');
  const target = Number(counter.dataset.count);
  const value = { current: 0 };
  gsap.to(value, {
    current: target, duration: 1.7, ease: 'power1.out', snap: { current: 1 },
    onUpdate: () => { counter.textContent = String(Math.round(value.current)); },
    scrollTrigger: { trigger: card, start: 'top 78%', once: true }
  });
  gsap.fromTo(card, { y: 35, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.85, delay: index * 0.08, ease: 'power2.out',
    scrollTrigger: { trigger: card, start: 'top 82%', once: true }
  });
});

gsap.to('.closing-image img', {
  scale: 1.06, ease: 'none',
  scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: 1 }
});

// ==========================================================================
// 5. CUSTOM CURSOR
// ==========================================================================
if (window.matchMedia('(pointer:fine)').matches && !prefersReduced) {
  const cursor = document.querySelector('.custom-cursor');
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');

  let mouseX = -100;
  let mouseY = -100;
  let ringX = -100;
  let ringY = -100;
  let isVisible = false;

  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isVisible) {
      isVisible = true;
      cursor.classList.add('is-visible');
      ringX = mouseX;
      ringY = mouseY;
    }
    dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
  }, { passive: true });

  gsap.ticker.add(() => {
    if (!isVisible) return;
    ringX += (mouseX - ringX) * 0.2;
    ringY += (mouseY - ringY) * 0.2;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
  });

  const bindCursorHover = () => {
    document.querySelectorAll('a, button, .nav-item').forEach((el) => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-hover-link'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover-link'));
    });
    document.querySelectorAll('.gallery-card, .feature-image').forEach((el) => {
      el.addEventListener('pointerenter', () => cursor.classList.add('is-hover-frame'));
      el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover-frame'));
    });
  };
  bindCursorHover();

  window.addEventListener('blur', () => cursor.classList.remove('is-visible'));
}

ScrollTrigger.refresh();
