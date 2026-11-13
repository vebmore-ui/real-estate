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
// 1. THREE.JS PERSPECTIVE CORRIDOR (Adaptive Mobile & Desktop, 0% vibration)
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

function getCorridorConfig() {
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  const isMobile = width < 768;

  const fov = isMobile ? 54 : 40;
  const vDist = 5.0;
  const vFovRad = (fov * Math.PI) / 180;
  const visibleHalfHeight = vDist * Math.tan(vFovRad / 2);
  const visibleHalfWidth = visibleHalfHeight * (width / height);

  // Position corridor walls based on visible width so they gracefully frame the edges
  const wallX = visibleHalfWidth * (isMobile ? 0.88 : 0.83);
  const planeW = isMobile ? 0.78 : 1.65;
  const planeH = isMobile ? 0.54 : 1.15;
  const rotAngle = isMobile ? 0.35 : 0.39;

  const zNear = isMobile ? 1.1 : 1.6;
  const zFar = isMobile ? -4.2 : -4.8;
  const zSpan = zNear - zFar;

  return { fov, width, height, wallX, planeW, planeH, rotAngle, zNear, zSpan, isMobile };
}

function initThree() {
  const cfg = getCorridorConfig();

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(cfg.width, cfg.height);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(cfg.fov, cfg.width / cfg.height, 0.1, 100);
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

  const baseGeom = new THREE.PlaneGeometry(1, 1);

  // 5 frames on right, 5 frames on left
  for (let i = 0; i < 5; i += 1) {
    const matR = new THREE.MeshBasicMaterial({
      map: textures[i],
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const meshR = new THREE.Mesh(baseGeom, matR);
    meshR.scale.set(cfg.planeW, cfg.planeH, 1);
    scene.add(meshR);
    rightMeshes.push(meshR);

    const matL = new THREE.MeshBasicMaterial({
      map: textures[(i + 2) % textures.length],
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const meshL = new THREE.Mesh(baseGeom, matL);
    meshL.scale.set(cfg.planeW, cfg.planeH, 1);
    scene.add(meshL);
    leftMeshes.push(meshL);
  }

  updateCorridor();
}

function updateCorridor() {
  const cfg = getCorridorConfig();

  camera.fov = cfg.fov;
  camera.aspect = cfg.width / cfg.height;
  camera.updateProjectionMatrix();

  for (let k = 0; k < 5; k += 1) {
    // Right side: enters at outer edge (zNear), travels inward to center (zFar)
    const pR = (k / 5 + heroPhase) % 1;
    const zR = cfg.zNear - pR * cfg.zSpan;
    const meshR = rightMeshes[k];
    meshR.scale.set(cfg.planeW, cfg.planeH, 1);
    meshR.position.set(cfg.wallX, 0, zR);
    meshR.rotation.y = -Math.PI * cfg.rotAngle;

    // Soft opacity fade near center and at extreme outer edge
    const fadeLimitR = cfg.isMobile ? 0.60 : 0.68;
    let opR = 1;
    if (pR > fadeLimitR) {
      opR = Math.max(0, Math.min(1, (1.0 - pR) / (1.0 - fadeLimitR)));
    } else if (pR < 0.08) {
      opR = Math.max(0, Math.min(1, pR / 0.08));
    }
    meshR.material.opacity = 0.95 * opR;
    meshR.visible = opR > 0.005;

    // Left side: emerges from center (zFar), travels outward to left edge (zNear)
    const pL = (k / 5 - heroPhase + 10) % 1;
    const zL = cfg.zNear - pL * cfg.zSpan;
    const meshL = leftMeshes[k];
    meshL.scale.set(cfg.planeW, cfg.planeH, 1);
    meshL.position.set(-cfg.wallX, 0, zL);
    meshL.rotation.y = Math.PI * cfg.rotAngle;

    const fadeLimitL = cfg.isMobile ? 0.60 : 0.68;
    let opL = 1;
    if (pL > fadeLimitL) {
      opL = Math.max(0, Math.min(1, (1.0 - pL) / (1.0 - fadeLimitL)));
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
  renderer.setSize(width, height);
  updateCorridor();
  ScrollTrigger.refresh();
});

// Initial brand / hero entrance
gsap.fromTo('.brand-wrap', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 1.1, delay: 0.15, ease: 'power2.out' });
gsap.fromTo('.headline-wrap', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.3, ease: 'power2.out' });

// ==========================================================================
// 2. HERO FADE AWAY SCROLL TRANSITION
// ==========================================================================
gsap.to('.hero-stage', {
  opacity: 0,
  y: -40,
  ease: 'power1.in',
  scrollTrigger: {
    trigger: hero,
    start: 'top top',
    end: '70% top',
    scrub: 0.5,
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
// 3. FIXED NAVBAR
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

// Hide bottom navbar when scrolled into the last contact section or footer
ScrollTrigger.create({
  trigger: '#contact',
  start: 'top 85%',
  endTrigger: '.site-footer',
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
// 4. SECTION 2 & PINNED HORIZONTAL GALLERY
// ==========================================================================
gsap.utils.toArray('.reveal, .reveal-lines').forEach((element) => {
  gsap.fromTo(element, { y: 25, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.9, ease: 'power2.out',
    scrollTrigger: { trigger: element, start: 'top 84%', once: true }
  });
});

// PINNED GALLERY: Card 01 starts in full view; scrolls horizontally only when reached!
const gallerySection = document.querySelector('.gallery-section');
const galleryTrack = document.querySelector('.gallery-track');

ScrollTrigger.create({
  trigger: gallerySection,
  start: 'top top',
  end: () => `+=${Math.max(window.innerHeight * 1.2, galleryTrack.scrollWidth - window.innerWidth + 160)}`,
  pin: true,
  scrub: 1,
  anticipatePin: 1,
  invalidateOnRefresh: true,
  animation: gsap.to(galleryTrack, {
    x: () => -(galleryTrack.scrollWidth - window.innerWidth + 60),
    ease: 'none'
  })
});

// ==========================================================================
// 5. FULLBLEED, QUOTE, FEATURES, CLOSING
// ==========================================================================
gsap.to('.fullbleed-image img', {
  scale: 1,
  ease: 'none',
  scrollTrigger: { trigger: '.fullbleed', start: 'top bottom', end: 'bottom top', scrub: 1 }
});

gsap.fromTo('.quote-section blockquote, .quote-mark, .quote-credit', { y: 25, opacity: 0 }, {
  y: 0, opacity: 1, stagger: 0.12, duration: 1.0, ease: 'power2.out',
  scrollTrigger: { trigger: '.quote-section', start: 'top 75%', once: true }
});

gsap.utils.toArray('.feature-card').forEach((card, index) => {
  const counter = card.querySelector('.feature-number');
  const target = Number(counter.dataset.count);
  const value = { current: 0 };
  gsap.to(value, {
    current: target, duration: 1.7, ease: 'power1.out', snap: { current: 1 },
    onUpdate: () => { counter.textContent = String(Math.round(value.current)); },
    scrollTrigger: { trigger: card, start: 'top 82%', once: true }
  });
  gsap.fromTo(card, { y: 30, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.8, delay: index * 0.08, ease: 'power2.out',
    scrollTrigger: { trigger: card, start: 'top 85%', once: true }
  });
});

gsap.to('.closing-image img', {
  scale: 1.06, ease: 'none',
  scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: 1 }
});

// ==========================================================================
// 6. CUSTOM CURSOR
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
