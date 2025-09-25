"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASSETS, type AssetKey } from "../assets";

const SEGMENT_COLORS = ["#4338CA", "#6D28D9", "#0EA5E9", "#10B981", "#F59E0B"];

type WheelCanvasProps = {
    segments: string[];
    segmentAssetKeys: (AssetKey | null)[];
    isSpinning: boolean;
    targetIndex: number | null;
    onStopped: (index: number) => void;
    size?: number;
};

export default function WheelCanvas({
    segments,
    segmentAssetKeys,
    isSpinning,
    targetIndex,
    onStopped,
    size = 360,
}: WheelCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const requestIdRef = useRef<number | null>(null);
    const angleRef = useRef<number>(0);
    const angularVelocityRef = useRef<number>(0);
    const deceleratingRef = useRef<boolean>(false);
    const finalAngleRef = useRef<number | null>(null);
    const lastTimestampRef = useRef<number | null>(null);
    const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const [assetLoadTick, setAssetLoadTick] = useState<number>(0);

    const segmentAngle = useMemo(() => (2 * Math.PI) / segments.length, [segments.length]);

    // Preload images used by current segments
    useEffect(() => {
        let cancelled = false;
        const uniqueKeys = Array.from(new Set(segmentAssetKeys.filter((k): k is AssetKey => !!k)));
        uniqueKeys.forEach((key) => {
            const cache = imageCacheRef.current;
            if (cache.has(key)) return;
            const src = ASSETS[key].src as string;
            const img = new Image();
            img.onload = () => {
                if (cancelled) return;
                cache.set(key, img);
                setAssetLoadTick((n) => n + 1);
            };
            img.onerror = () => {
                if (cancelled) return;
                cache.set(key, img);
                setAssetLoadTick((n) => n + 1);
            };
            img.src = src;
        });
        return () => { cancelled = true; };
    }, [segmentAssetKeys]);

    const drawWheel = useCallback(
        (ctx: CanvasRenderingContext2D, angle: number) => {
            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
            const width = size;
            const height = size;
            const radius = (size / 2) * 0.92;
            const innerRingRadius = radius * 0.78;
            const outerAccentRadius = radius + 10;

            const canvas = ctx.canvas;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.translate(width / 2, height / 2);

            // Rotate wheel by current angle
            ctx.rotate(angle);

            // Draw segments with subtle gradients and separators
            for (let i = 0; i < segments.length; i++) {
                const start = i * segmentAngle;
                const end = start + segmentAngle;
                // base wedge
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, start, end);
                ctx.closePath();
                const baseColor = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                ctx.fillStyle = baseColor;
                ctx.fill();

                // overlay radial highlight for depth
                const grad = ctx.createRadialGradient(0, 0, innerRingRadius * 0.4, 0, 0, radius);
                grad.addColorStop(0, "rgba(255,255,255,0.06)");
                grad.addColorStop(1, "rgba(255,255,255,0.015)");
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, start, end);
                ctx.closePath();
                ctx.fillStyle = grad;
                ctx.fill();

                // Icon in wedge
                const assetKey = segmentAssetKeys[i];
                const label = (segments[i] || "").trim();
                if (assetKey) {
                    const img = imageCacheRef.current.get(assetKey);
                    if (img && img.complete && img.naturalWidth > 0) {
                        ctx.save();
                        const mid = start + segmentAngle / 2;
                        ctx.rotate(mid);
                        const r = radius * 0.63;
                        ctx.translate(r, 0);
                        ctx.rotate(Math.PI / 2);
                        const imgSize = Math.min(size * 0.14, radius * 0.26);
                        // soft backdrop for asset for legibility
                        ctx.beginPath();
                        ctx.arc(0, 0, imgSize * 0.65, 0, 2 * Math.PI);
                        ctx.fillStyle = "rgba(255,255,255,0.08)";
                        ctx.fill();
                        ctx.strokeStyle = "rgba(255,255,255,0.12)";
                        ctx.lineWidth = Math.max(1, imgSize * 0.06);
                        ctx.stroke();
                        ctx.drawImage(img, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                        ctx.restore();
                    }
                } else if (
                    label && (
                        /better\s*luck/i.test(label) ||
                        /try\s*again/i.test(label) ||
                        /no\s*prize/i.test(label)
                    )
                ) {
                    // Themed cross
                    ctx.save();
                    const mid = start + segmentAngle / 2;
                    ctx.rotate(mid);
                    const r = radius * 0.63;
                    ctx.translate(r, 0);
                    ctx.rotate(Math.PI / 2);
                    const iconSize = Math.min(size * 0.14, radius * 0.26);
                    const half = iconSize / 2;
                    ctx.strokeStyle = "rgba(124,58,237,0.9)"; // violet-600
                    ctx.lineWidth = Math.max(2, iconSize * 0.12);
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(-half, -half);
                    ctx.lineTo(half, half);
                    ctx.moveTo(half, -half);
                    ctx.lineTo(-half, half);
                    ctx.stroke();
                    ctx.restore();
                }

                // segment boundary (end)
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(radius * Math.cos(end), radius * Math.sin(end));
                ctx.strokeStyle = "rgba(17,24,39,0.7)"; // slate-900 w/ alpha
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();

            // Pointer at top
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.translate(width / 2, height / 2);
            const pointerSize = Math.max(14, size * 0.04);
            const pointerOffset = Math.max(6, size * 0.015);
            ctx.beginPath();
            ctx.moveTo(0, -radius + pointerSize - pointerOffset);
            ctx.lineTo(pointerSize * 0.6, -radius - pointerSize * 0.2 - pointerOffset);
            ctx.lineTo(-pointerSize * 0.6, -radius - pointerSize * 0.2 - pointerOffset);
            ctx.closePath();
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Outer ring (base)
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.translate(width / 2, height / 2);
            ctx.beginPath();
            ctx.arc(0, 0, radius + 6, 0, 2 * Math.PI);
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            // Outer accent ring
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.translate(width / 2, height / 2);
            ctx.beginPath();
            ctx.arc(0, 0, outerAccentRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = "rgba(99,102,241,0.35)"; // indigo tint
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Center hub
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.translate(width / 2, height / 2);
            const hubR = Math.max(12, size * 0.06);
            const hubGrad = ctx.createRadialGradient(0, 0, hubR * 0.2, 0, 0, hubR);
            hubGrad.addColorStop(0, "#1f2937");
            hubGrad.addColorStop(1, "#111827");
            ctx.fillStyle = hubGrad;
            ctx.beginPath();
            ctx.arc(0, 0, hubR, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        },
        [segmentAngle, segments, size, segmentAssetKeys]
    );

    const computeFinalAngle = useCallback(
        (currentAngle: number, targetIdx: number) => {
            const segmentCenter = targetIdx * segmentAngle + segmentAngle / 2;
            const desired = -Math.PI / 2 - segmentCenter;
            const twoPi = Math.PI * 2;
            const normCurrent = ((currentAngle % twoPi) + twoPi) % twoPi;
            const normDesired = ((desired % twoPi) + twoPi) % twoPi;
            const minTurns = 3;
            const k = minTurns;
            let final = normDesired + twoPi * k;
            const base = currentAngle - normCurrent;
            final = base + final;
            return final;
        },
        [segmentAngle]
    );

    const step = useCallback(
        (ts: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
            if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
                canvas.width = size * dpr;
                canvas.height = size * dpr;
            }

            const last = lastTimestampRef.current ?? ts;
            const dt = Math.min(0.032, (ts - last) / 1000);
            lastTimestampRef.current = ts;

            let angle = angleRef.current;
            let omega = angularVelocityRef.current;

            if (isSpinning && !deceleratingRef.current) {
                const baseSpeed = 6.0;
                omega = baseSpeed;
            }

            if (isSpinning && targetIndex !== null && !deceleratingRef.current) {
                const finalAngle = computeFinalAngle(angle, targetIndex);
                finalAngleRef.current = finalAngle;
                deceleratingRef.current = true;
            }

            if (deceleratingRef.current && finalAngleRef.current !== null) {
                const remaining = finalAngleRef.current - angle;
                const eps = 0.002;
                if (remaining <= eps) {
                    angle = finalAngleRef.current;
                    omega = 0;
                    angleRef.current = angle;
                    angularVelocityRef.current = omega;
                    drawWheel(ctx, angle);
                    if (targetIndex !== null) {
                        onStopped(targetIndex);
                    }
                    deceleratingRef.current = false;
                    finalAngleRef.current = null;
                    lastTimestampRef.current = null;
                    requestIdRef.current = null;
                    return;
                }
                const aIdeal = (omega * omega) / Math.max(0.001, 2 * remaining);
                const a = Math.min(aIdeal, 10.0);
                omega = Math.max(0, omega - a * dt);
            }

            angle += omega * dt;
            angleRef.current = angle;
            angularVelocityRef.current = omega;

            drawWheel(ctx, angle);
            requestIdRef.current = window.requestAnimationFrame(step);
        },
        [computeFinalAngle, drawWheel, isSpinning, size, targetIndex, onStopped]
    );

    useEffect(() => {
        if (isSpinning && requestIdRef.current === null) {
            deceleratingRef.current = false;
            finalAngleRef.current = null;
            lastTimestampRef.current = null;
            if (angularVelocityRef.current <= 0) angularVelocityRef.current = 2.0;
            requestIdRef.current = window.requestAnimationFrame(step);
        }
        if (!isSpinning && targetIndex === null && requestIdRef.current !== null) {
            window.cancelAnimationFrame(requestIdRef.current);
            requestIdRef.current = null;
            lastTimestampRef.current = null;
        }
        return () => {
            if (requestIdRef.current !== null) {
                window.cancelAnimationFrame(requestIdRef.current);
                requestIdRef.current = null;
            }
        };
    }, [isSpinning, targetIndex, step]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
        }
        drawWheel(ctx, angleRef.current);
    }, [drawWheel, size, segments.length, assetLoadTick]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: size, height: size, display: "block" }}
            aria-label="Roulette Wheel"
        />
    );
}


