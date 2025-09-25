import type { AssetKey } from "./assets";

export const DEFAULT_SEGMENTS = [
    "T-shirt",
    "Better luck next time",
    "Stickers",
    "Coffee Mug",
    "Better luck next time",
    "Water Bottle",
    "Stickers",
    "Tote Bag",
    "Better luck next time",
    "Stickers"
];

export const LABEL_TO_ASSET_KEY: Record<string, AssetKey> = {
    "T-shirt": "tshirt",
    "Coffee Mug": "coffeemug",
    "Water Bottle": "waterbottle",
    "Tote Bag": "totebag",
    "Stickers": "stickers",
    "Better luck next time": "betterlucknexttime"
};
