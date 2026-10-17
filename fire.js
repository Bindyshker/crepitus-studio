/* =========================================================
   Анимированный фон: зелёные вращающиеся квадраты
   Эффект «пиксельного огня» снизу экрана.
   Настройки — в объекте CFG. Цвет берётся из --green в CSS.
   ========================================================= */
(function () {
    'use strict';

    var canvas = document.getElementById('fire-bg');
    if (!canvas) return;

    // Уважаем системную настройку «уменьшить движение»
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var ctx = canvas.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);

    // ---------- НАСТРОЙКИ ----------
    var CFG = {
        fireRatio:     1 / 3,   // высота горения = 1/3 экрана
        speedMin:      30,      // px/сек — минимальная скорость подъёма
        speedMax:      100,     // px/сек — максимальная
        sizeMin:       4,       // px — минимальный размер квадрата
        sizeMax:       18,      // px — максимальный
        rotSpeedMax:   2.5,     // рад/сек — макс. скорость вращения
        alphaMin:      0.5,     // минимальная стартовая непрозрачность
        alphaMax:      1.0,     // максимальная стартовая
        maxParticles:  80,      // верхний лимит частиц
        spawnPerSec:   16,       // сколько новых в секунду
        glow:          true,    // свечение (shadowBlur) — можно выключить для слабых устройств
        sway:          10       // горизонтальное покачивание, px/сек
    };
    // -------------------------------

    var particles = [];
    var rafId = null;
    var lastTime = 0;
    var lastSpawn = 0;
    var W = 0, H = 0, FIRE_H = 0;
    var color = { r: 81, g: 193, b: 81 }; // запасной #51C151, пока читается CSS

    function isDark() {
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    function readColor() {
        var raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--green').trim();
        if (!raw) return;
        var m = raw.match(/^#([0-9a-fA-F]{6})$/);
        if (m) {
            color.r = parseInt(m[1].slice(0, 2), 16);
            color.g = parseInt(m[1].slice(2, 4), 16);
            color.b = parseInt(m[1].slice(4, 6), 16);
        }
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width  = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        canvas.style.width  = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        FIRE_H = H * CFG.fireRatio;
        particles.length = 0;  // после ресайза проще начать заново
    }

    function spawn() {
        var size = rand(CFG.sizeMin, CFG.sizeMax);
        particles.push({
            x: Math.random() * W,
            y: H + size,                                // чуть ниже экрана
            size: size,
            vy: -rand(CFG.speedMin, CFG.speedMax),      // вверх
            vx: rand(-CFG.sway, CFG.sway),              // лёгкое покачивание
            angle: Math.random() * Math.PI * 2,
            va: rand(-CFG.rotSpeedMax, CFG.rotSpeedMax),
            baseAlpha: rand(CFG.alphaMin, CFG.alphaMax)
        });
    }

    function step(now) {
        var dt = (now - lastTime) / 1000;
        if (dt > 0.1) dt = 0.1;   // защита от «скачков» после переключения вкладки
        lastTime = now;

        // ---- Спавн новых частиц ----
        var maxCount = Math.min(CFG.maxParticles, Math.round(W / 20));
        lastSpawn += dt;
        var interval = 1 / CFG.spawnPerSec;
        while (lastSpawn >= interval && particles.length < maxCount) {
            lastSpawn -= interval;
            spawn();
        }

        // ---- Очистка ----
        ctx.clearRect(0, 0, W, H);

        // ---- Обновление и отрисовка ----
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.y += p.vy * dt;
            p.x += p.vx * dt;
            p.angle += p.va * dt;

            // Прозрачность линейно падает по высоте: 1 внизу → 0 на FIRE_H
            var traveled = H - p.y;
            var fade = 1 - traveled / FIRE_H;
            if (fade <= 0) {
                particles.splice(i, 1);
                continue;
            }
            var alpha = fade * p.baseAlpha;
            if (alpha <= 0.02) continue;

            // Рисуем квадрат
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);

            var colBase = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',';
            ctx.fillStyle = colBase + alpha.toFixed(3) + ')';
            if (CFG.glow) {
                ctx.shadowColor = colBase + (alpha * 0.6).toFixed(3) + ')';
                ctx.shadowBlur = p.size * 0.8;
            }
            var half = p.size / 2;
            ctx.fillRect(-half, -half, p.size, p.size);
            ctx.restore();
        }

        rafId = requestAnimationFrame(step);
    }

    function start() {
        if (rafId !== null) return;
        if (!isDark()) return;
        resize();
        readColor();
        lastTime = performance.now();
        lastSpawn = 0;
        rafId = requestAnimationFrame(step);
    }

    function stop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        ctx.clearRect(0, 0, W, H);
        particles.length = 0;
    }

    // ---- Следим за сменой темы ----
    new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
            if (mutations[i].attributeName === 'data-theme') {
                if (isDark()) start();
                else stop();
                return;
            }
        }
    }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    // ---- Ресайз окна ----
    var resizeT = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(resize, 150);
    });

    // ---- Пауза, когда вкладка скрыта (экономия батареи) ----
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        } else if (isDark() && rafId === null) {
            lastTime = performance.now();
            rafId = requestAnimationFrame(step);
        }
    });

    // ---- Старт ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();