"use client";
import { useAccount, useReadContract, useWriteContract, useConfig } from "wagmi";
import Wallet from "../wallet";
import Header from "./header";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ASSETS } from "./assets";
import type { AssetKey } from "./assets";
import WheelCanvas from "./components/WheelCanvas";
import { DEFAULT_SEGMENTS, LABEL_TO_ASSET_KEY } from "./constants";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "@/app/config";
import { Randomness } from "randomness-js";
import { ethers, getBytes } from "ethers";
import { waitForTransactionReceipt } from "@wagmi/core";

export default function SchwagRoulette() {
    const { isConnected } = useAccount();
    const [winner, setWinner] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [isSpinning, setIsSpinning] = useState<boolean>(false);
    const [targetIndex, setTargetIndex] = useState<number | null>(null);

    const initialRandomness = useRef<string | null>(null);
    const pollingInterval = useRef<NodeJS.Timeout | null>(null);

    const segments = useMemo(() => DEFAULT_SEGMENTS, []);
    const segmentAssetKeys: (AssetKey | null)[] = useMemo(
        () => segments.map((s) => LABEL_TO_ASSET_KEY[s] ?? null),
        [segments]
    );

    const { data: readData, refetch } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "randomness",
    }) as { data: bigint | undefined; refetch: () => Promise<{ data: unknown }> };

    // Write
    const { writeContract } = useWriteContract();
    const config = useConfig();

    const cleanup = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };

    useEffect(() => () => cleanup(), []);

    const handleTransactionSubmitted = async (txHash: string) => {
        try {
            const receipt = await waitForTransactionReceipt(config, {
                hash: txHash as `0x${string}`,
            });
            if (receipt.status === "success") {
                startPollingForRandomness();
            } else {
                throw new Error("Transaction failed");
            }
        } catch {
            setError("Transaction failed. Please try again.");
            setIsSpinning(false);
            setTargetIndex(null);
            cleanup();
        }
    };

    const generateRandomness = async () => {
        try {
            setError(null);
            const callbackGasLimit = 700_000;
            const jsonProvider = new ethers.JsonRpcProvider(
                `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
            );
            const randomness = Randomness.createBaseSepolia(jsonProvider);
            const [requestCallBackPrice] = await randomness.calculateRequestPriceNative(
                BigInt(callbackGasLimit)
            );
            writeContract(
                {
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: "generateWithDirectFunding",
                    args: [callbackGasLimit],
                    value: requestCallBackPrice,
                },
                {
                    onSuccess: handleTransactionSubmitted,
                    onError: () => {
                        setError("Failed to initiate transaction. Please try again.");
                        setIsSpinning(false);
                        setTargetIndex(null);
                        cleanup();
                    }
                }
            );
        } catch {
            setError("Failed to generate random number. Please try again.");
            setIsSpinning(false);
            setTargetIndex(null);
            cleanup();
        }
    };

    const startPollingForRandomness = () => {
        let attempts = 0;
        const maxAttempts = 90;
        pollingInterval.current = setInterval(async () => {
            attempts += 1;
            try {
                const result = await refetch();
                const valueBigInt = result?.data as bigint | undefined;
                const value = valueBigInt ? valueBigInt.toString() : "";
                if (value && value !== "0" && value !== initialRandomness.current) {
                    const bytes = getBytes(value);
                    if (bytes.length > 0) {
                        const index = bytes[0] % segments.length;
                        setTargetIndex(index);
                        cleanup();
                    }
                }
            } catch {
                // continue polling
            }
            if (attempts >= maxAttempts) {
                cleanup();
                setError("Request timed out. Please try again.");
                setIsSpinning(false);
                setTargetIndex(null);
            }
        }, 1000);
    };

    const handleSpinClick = () => {
        if (isSpinning) return;
        initialRandomness.current = readData?.toString() || null;
        setWinner(null);
        setError(null);
        setTargetIndex(null);
        setIsSpinning(true);
        generateRandomness();
    };

    const handleWheelStopped = (index: number) => {
        setIsSpinning(false);
        setWinner(segments[index]);
    };

    const resetWheel = () => {
        setWinner(null);
        setIsSpinning(false);
        setTargetIndex(null);
        cleanup();
    };

    const getWinnerAssetKey = (prize: string | null): AssetKey | null => {
        if (!prize) return null;
        return LABEL_TO_ASSET_KEY[prize] || null;
    };

    const isLossWinner = (prize: string | null): boolean => {
        if (!prize) return false;
        return prize.toLowerCase().includes("better") ||
            prize.toLowerCase().includes("try") ||
            prize.toLowerCase().includes("no prize");
    };

    const isLoss = isLossWinner(winner);
    const winnerAssetKey = getWinnerAssetKey(winner);

    return (
        <>
            {isConnected ? (
                <div className="min-h-screen bg-black-pattern relative overflow-hidden">
                    <Header />
                    {/* Decorative gradients */}
                    <div className="pointer-events-none absolute inset-0 -z-10">
                        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-purple-700/30 blur-3xl" />
                        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-[36rem] rounded-full bg-indigo-700/20 blur-3xl" />
                    </div>

                    <main className="flex-grow">
                        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-2 pb-10 md:pt-32 md:pb-14 lg:py-0 lg:min-h-[calc(100vh-5rem)] lg:flex lg:items-center">

                            {error && (
                                <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-100/80 border border-red-400/60 text-red-800 rounded-lg text-center">
                                    {error}
                                </div>
                            )}

                            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 items-center">
                                {/* Left: Heading & copy */}
                                <div className="space-y-5 md:space-y-6">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs md:text-sm text-white/80 shadow-sm">
                                        <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                        Provably Fair
                                    </div>
                                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                                        Schwag Roulette
                                    </h1>
                                    <p className="text-sm md:text-base lg:text-lg text-white/80 max-w-xl">
                                        Spin the wheel and try your luck to win amazing schwags. Each spin uses on-chain randomness to keep things fair and transparent.
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 max-w-md">
                                        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                                            <p className="text-xs text-white/60">Network</p>
                                            <p className="text-sm md:text-base font-semibold">Base Sepolia</p>
                                        </div>
                                        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                                            <p className="text-xs text-white/60">Fairness</p>
                                            <p className="text-sm md:text-base font-semibold">VRF-powered</p>
                                        </div>
                                    </div>

                                    <div className="hidden lg:block">
                                        <p className="text-xs md:text-sm text-white/60">
                                            Tip: You can spin as much as you like. Prizes vary by segment, good luck!
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Wheel & action */}
                                <div className="relative">
                                    <div className={`relative rounded-2xl bg-white/5 border border-white/10 p-4 md:p-5 shadow-xl backdrop-blur-md flex items-center justify-center min-h-[320px] ${isSpinning ? "ring-2 ring-indigo-400/40" : "hover:ring-1 hover:ring-white/10 transition"}`}>
                                        <WheelCanvas
                                            segments={segments}
                                            segmentAssetKeys={segmentAssetKeys}
                                            isSpinning={isSpinning}
                                            targetIndex={targetIndex}
                                            onStopped={handleWheelStopped}
                                            size={360}
                                        />
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <button
                                            onClick={handleSpinClick}
                                            disabled={isSpinning}
                                            className={`group relative mt-6 w-full md:w-auto px-10 py-3.5 rounded-xl font-bold text-lg transition-all will-change-transform ${isSpinning ? "cursor-not-allowed" : "hover:scale-[1.03] active:scale-[0.98]"} text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)]`}
                                        >
                                            <span className={`absolute inset-0 rounded-xl ${isSpinning ? "opacity-60" : "opacity-90 group-hover:opacity-100"} bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600`} aria-hidden />
                                            <span className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-indigo-400/40 via-violet-400/30 to-purple-400/40 blur-md opacity-60 group-hover:opacity-80 transition" aria-hidden />
                                            <span className="relative z-10 flex items-center justify-center gap-3">
                                                {isSpinning ? (
                                                    <>
                                                        <svg className="h-5 w-5 animate-spin text-white/90" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                                        </svg>
                                                        <span>Spinning...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>SPIN THE WHEEL</span>
                                                        <svg className="h-5 w-5 text-white/90" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                            <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </>
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Win modal */}
                            {winner && !isLoss && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                                    <div className={"relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-black/90 to-zinc-900/80 text-white shadow-2xl"}>
                                        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-indigo-600/20 blur-3xl" aria-hidden />
                                        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-purple-600/20 blur-3xl" aria-hidden />
                                        <div className="header border-b border-white/10 px-5 py-4">
                                            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">Congratulations! 🎉</h3>
                                            <p className="text-sm text-white/70">You won: {winner}</p>
                                        </div>
                                        <div className="body px-5 py-5">
                                            {winnerAssetKey && (
                                                <div className="mb-5">
                                                    <div className="p-1 rounded-xl bg-gradient-to-r from-indigo-500/40 via-violet-500/30 to-purple-500/40">
                                                        <div className="rounded-[10px] bg-white/5 border border-white/10 flex items-center justify-center">
                                                            <NextImage src={ASSETS[winnerAssetKey]} alt={winner} width={360} height={240} className="max-h-56 object-contain w-auto h-auto rounded-md" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                className="group relative inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition"
                                                onClick={resetWheel}
                                            >
                                                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600" aria-hidden />
                                                <span className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-indigo-400/40 via-violet-400/30 to-purple-400/40 blur-lg opacity-60 group-hover:opacity-80 transition" aria-hidden />
                                                <span className="relative z-10 inline-flex items-center gap-2">
                                                    <span>Spin Again</span>
                                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                        <path d="M12 5v4m0 6v4m-7-7h4m6 0h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Loss modal */}
                            {winner && isLoss && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                                    <div className={"relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-black/90 to-zinc-900/80 text-white shadow-2xl"}>
                                        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-indigo-600/10 blur-3xl" aria-hidden />
                                        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-purple-600/10 blur-3xl" aria-hidden />
                                        <div className="header border-b border-white/10 px-5 py-4">
                                            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-violet-300">Better Luck Next Time!</h3>
                                        </div>
                                        <div className="body px-5 py-5">
                                            <button
                                                className="group relative inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white transition"
                                                onClick={resetWheel}
                                            >
                                                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-zinc-700 to-zinc-800" aria-hidden />
                                                <span className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-white/10 via-white/5 to-white/10 blur-lg opacity-50 group-hover:opacity-70 transition" aria-hidden />
                                                <span className="relative z-10 inline-flex items-center gap-2">
                                                    <span>Try Again</span>
                                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                        <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            ) : (
                <Wallet />
            )}
        </>
    );
}
