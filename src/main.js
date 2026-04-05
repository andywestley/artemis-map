/**
 * Artemis II Mission Map Logic
 * Projects 3D ECI coordinates to a 2D Lunar Orbital Plane.
 */

class MissionTracker {
    constructor() {
        this.canvas = document.getElementById('missionMap');
        this.ctx = this.canvas.getContext('2d');
        this.orionPath = [];
        this.moonPath = [];
        this.stars = [];
        this.startTime = null;
        this.currentTime = new Date();
        this.lastWallTime = performance.now();
        
        // Stabilized Basis Vectors
        this.currentBasisY = { x: 0, y: 1, z: 0 };
        this.currentBasisX = { x: 1, y: 0, z: 0 };
        
        // Bootstrap Tooltip Setup
        this.tooltip = null;
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.initStars();
        this.loadData();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initStars() {
        // Pre-calculated star positions and twinkling phases
        for (let i = 0; i < 600; i++) {
            this.stars.push({
                x: Math.random() * 3000 - 1500,
                y: Math.random() * 3000 - 1500,
                size: Math.random() * 1.8,
                phase: Math.random() * Math.PI * 2,
                twinkleSpeed: 0.001 + Math.random() * 0.002
            });
        }
    }

    async loadData() {
        try {
            const response = await fetch('/trajectory.json');
            const raw = await response.json();
            const result = JSON.parse(raw.result);
            
            this.parseTrajectory(result);
            this.initTooltip();
            this.animate();
        } catch (err) {
            console.error("Failed to load trajectory data:", err);
            document.getElementById('missionStatus').textContent = "ERROR: OFFLINE";
            document.getElementById('missionStatus').className = "text-danger";
        }
    }

    initTooltip() {
        // Initialize Bootstrap tooltip
        const el = document.getElementById('statVelocity');
        if (window.bootstrap) {
            this.tooltip = new bootstrap.Tooltip(el);
        }
    }

    parseTrajectory(result) {
        const parsePath = (indicesArray) => {
            const path = [];
            for (const startIdx of indicesArray) {
                const meta = result[startIdx];
                if (!meta || typeof meta !== 'object') continue;
                const dStr = result[meta.date];
                const x = result[meta.x], y = result[meta.y], z = result[meta.z];
                if (typeof x === 'number' && dStr) {
                    path.push({ 
                        time: new Date(dStr.replace(/-/g, ' ')),
                        pos: { x, y, z } 
                    });
                }
            }
            return path;
        };

        const orionIndices = result[1];
        const moonIndices = result[result[0].moon];

        this.orionPath = parsePath(orionIndices);
        this.moonPath = parsePath(moonIndices);
        
        if (this.orionPath.length > 0) {
            this.startTime = this.orionPath[0].time;
        }

        // --- CALCULATE STABLE INTERCEPT BASIS ---
        // Rendezvous point (April 6th, 22:08)
        const flybyTime = new Date('2026-04-06T22:08:32.305Z');
        const mPosAtFlyby = this.getInterpolatedState(this.moonPath, flybyTime);
        const dFlyby = Math.sqrt(mPosAtFlyby.x**2 + mPosAtFlyby.y**2 + mPosAtFlyby.z**2);
        
        this.fixedBasis = {
            uy: { x: mPosAtFlyby.x / dFlyby, y: mPosAtFlyby.y / dFlyby, z: mPosAtFlyby.z / dFlyby },
            d: dFlyby
        };

        // Plane normal for X-axis (Lunar orbital plane)
        const mNext = this.getInterpolatedState(this.moonPath, new Date(flybyTime.getTime() + 600000));
        const mv = { x: mNext.x - mPosAtFlyby.x, y: mNext.y - mPosAtFlyby.y, z: mNext.z - mPosAtFlyby.z };
        const normal = {
            x: this.fixedBasis.uy.y * mv.z - this.fixedBasis.uy.z * mv.y,
            y: this.fixedBasis.uy.z * mv.x - this.fixedBasis.uy.x * mv.z,
            z: this.fixedBasis.uy.x * mv.y - this.fixedBasis.uy.y * mv.x
        };
        const nLen = Math.sqrt(normal.x**2 + normal.y**2 + normal.z**2);
        const un = (nLen > 1e-6) ? { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen } : { x: 0, y: 0, z: 1 };
        this.fixedBasis.ux = {
            x: this.fixedBasis.uy.y * un.z - this.fixedBasis.uy.z * un.y,
            y: this.fixedBasis.uy.z * un.x - this.fixedBasis.uy.x * un.z,
            z: this.fixedBasis.uy.x * un.y - this.fixedBasis.uy.y * un.x
        };
    }

    getInterpolatedState(path, targetTime) {
        if (!path || path.length === 0) return { x: 0, y: 0, z: 0 };
        if (targetTime <= path[0].time) return path[0].pos;
        if (targetTime >= path[path.length - 1].time) return path[path.length - 1].pos;

        for (let i = 0; i < path.length - 1; i++) {
            if (targetTime >= path[i].time && targetTime <= path[i+1].time) {
                const dt = path[i+1].time - path[i].time;
                if (dt === 0) return path[i].pos;
                const alpha = (targetTime - path[i].time) / dt;
                return {
                    x: path[i].pos.x + alpha * (path[i+1].pos.x - path[i].pos.x),
                    y: path[i].pos.y + alpha * (path[i+1].pos.y - path[i].pos.y),
                    z: path[i].pos.z + alpha * (path[i+1].pos.z - path[i].pos.z)
                };
            }
        }
        return path[path.length - 1].pos;
    }

    getVelocity(path, targetTime) {
        if (!path || path.length < 2) return 0;
        let p1, p2;
        for (let i = 0; i < path.length - 1; i++) {
            if (targetTime >= path[i].time && targetTime <= path[i+1].time) {
                p1 = path[i]; p2 = path[i+1];
                break;
            }
        }
        if (!p1) { p1 = path[path.length-2]; p2 = path[path.length-1]; }
        const dt = (p2.time - p1.time) / 1000;
        if (dt === 0) return 0;
        const dist = Math.sqrt((p2.pos.x - p1.pos.x)**2 + (p2.pos.y - p1.pos.y)**2 + (p2.pos.z - p1.pos.z)**2);
        return (dist / dt) * 3600; // km/h
    }

    animate() {
        const now = performance.now();
        if (!this.lastWallTime) this.lastWallTime = now;
        const dt = now - this.lastWallTime;
        this.currentTime = new Date(this.currentTime.getTime() + dt);
        this.lastWallTime = now;

        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    updateHUD(orionPos, moonPos, velocityKph) {
        const alt = Math.sqrt(orionPos.x**2 + orionPos.y**2 + orionPos.z**2);
        const moonDist = Math.sqrt((orionPos.x - moonPos.x)**2 + (orionPos.y - moonPos.y)**2 + (orionPos.z - moonPos.z)**2);
        const velocityMph = velocityKph * 0.621371;
        const velocityMps = velocityKph / 3.6;

        const elAlt = document.getElementById('statAltitude'), elDist = document.getElementById('statMoonDist'), elV = document.getElementById('statVelocity');
        if (elAlt) elAlt.textContent = `${Math.floor(alt).toLocaleString()} km`;
        if (elDist) elDist.textContent = `${Math.floor(moonDist).toLocaleString()} km`;
        if (elV) {
            elV.textContent = `${Math.floor(velocityKph).toLocaleString()} km/h`;
            const tipText = `Speed:\n${Math.floor(velocityMph).toLocaleString()} mph\n${Math.floor(velocityMps).toLocaleString()} m/s`;
            elV.setAttribute('title', tipText);
        }
        
        const missionElapsed = this.startTime ? Math.floor((this.currentTime - this.startTime) / 1000) : 0;
        const d = Math.floor(missionElapsed / 86400), h = Math.floor((missionElapsed % 86400) / 3600), m = Math.floor((missionElapsed % 3600) / 60), s = Math.floor(missionElapsed % 60);
        const clockEl = document.getElementById('missionClock');
        if (clockEl) clockEl.textContent = `T+ ${d}d ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }

    draw() {
        const { ctx, canvas } = this;
        if (!this.fixedBasis) return;

        ctx.fillStyle = '#02040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const nowMs = Date.now();
        
        // Background Stars
        ctx.fillStyle = 'white';
        this.stars.forEach(s => {
            ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(nowMs * s.twinkleSpeed + s.phase));
            ctx.beginPath();
            ctx.arc(canvas.width/2 + s.x, canvas.height/2 + s.y, s.size, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        const orionPos = this.getInterpolatedState(this.orionPath, this.currentTime);
        const moonPos = this.getInterpolatedState(this.moonPath, this.currentTime);
        const velocityKph = this.getVelocity(this.orionPath, this.currentTime);
        
        this.updateHUD(orionPos, moonPos, velocityKph);

        // --- STABLE INTERCEPT PROJECTION ---
        const mapHeight = canvas.height * 0.62;
        const scale = mapHeight / this.fixedBasis.d;
        const centerX = canvas.width / 2;
        const centerY = (canvas.width < canvas.height) ? canvas.height * 0.75 : canvas.height * 0.82;

        const project = (p) => {
            const yOffset = (p.x * this.fixedBasis.uy.x + p.y * this.fixedBasis.uy.y + p.z * this.fixedBasis.uy.z) * scale;
            const xOffset = (p.x * this.fixedBasis.ux.x + p.y * this.fixedBasis.ux.y + p.z * this.fixedBasis.ux.z) * scale;
            return { x: centerX + xOffset, y: centerY - yOffset };
        };

        // --- RENDER LAYERS ---

        // 1. Earth
        const earthP = { x: centerX, y: centerY };
        ctx.fillStyle = ctx.createRadialGradient(earthP.x, earthP.y, 0, earthP.x, earthP.y, 25);
        ctx.fillStyle.addColorStop(0, '#4facfe'); ctx.fillStyle.addColorStop(1, '#0061ff');
        ctx.beginPath(); ctx.arc(earthP.x, earthP.y, 14, 0, Math.PI*2); ctx.fill();
        ctx.font = '10px Orbitron'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText("EARTH", earthP.x - 20, earthP.y + 35);

        // 2. Moon Orbit/Trajectory (HIGH VISIBILITY)
        this.moonDashOffset = (this.moonDashOffset || 0) + 0.3;
        ctx.strokeStyle = 'rgba(200, 200, 220, 0.6)'; // Silver-white
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 12]);
        ctx.lineDashOffset = -this.moonDashOffset;
        ctx.beginPath();
        for (let i = 0; i < this.moonPath.length; i += 4) {
            const p = project(this.moonPath[i].pos);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // 3. Orion Predicted Path (MARCHING ANTS)
        this.dashOffset = (this.dashOffset || 0) + 0.5;
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.6)'; ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -this.dashOffset; ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < this.orionPath.length; i += 2) {
            const p = project(this.orionPath[i].pos);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;

        // 4. Past Trail
        ctx.strokeStyle = '#00f2ff'; ctx.lineWidth = 2.5; ctx.shadowBlur = 10; ctx.shadowColor = '#00f2ff';
        ctx.beginPath();
        for (let i = 0; i < this.orionPath.length; i++) {
            if (this.orionPath[i].time > this.currentTime) break;
            const p = project(this.orionPath[i].pos);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Moon Icon (at actual current pos)
        const moonIconP = project(moonPos);
        const moonGrad = ctx.createRadialGradient(moonIconP.x, moonIconP.y, 0, moonIconP.x, moonIconP.y, 15);
        moonGrad.addColorStop(0, '#ffffff'); moonGrad.addColorStop(1, '#333');
        ctx.fillStyle = moonGrad;
        ctx.beginPath(); ctx.arc(moonIconP.x, moonIconP.y, 10, 0, Math.PI*2); ctx.fill();
        ctx.font = '10px Orbitron'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText("MOON", moonIconP.x - 20, moonIconP.y - 25);

        // 6. Orion Icon
        const orionCurrentP = project(orionPos);
        ctx.shadowBlur = 20; ctx.shadowColor = '#00f2ff'; ctx.fillStyle = '#00f2ff';
        ctx.beginPath(); ctx.arc(orionCurrentP.x, orionCurrentP.y, 5, 0, Math.PI*2); ctx.fill();
        ctx.font = 'bold 12px Orbitron'; ctx.fillText("ORION", orionCurrentP.x + 15, orionCurrentP.y + 5);
        ctx.shadowBlur = 0;
    }
}

new MissionTracker();
