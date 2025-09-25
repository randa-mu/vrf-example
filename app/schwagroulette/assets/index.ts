import tshirt from "./tshirt.png";
import coffeemug from "./coffee_mug.png";
import waterbottle from "./water_bottle.png";
import totebag from "./tote_bag.png";
import stickers from "./stickers.png";
import betterlucknexttime from "./better_luck_next_time.png";

export const ASSETS = {
    tshirt,
    coffeemug,
    waterbottle,
    totebag,
    stickers,
    betterlucknexttime,
};

export type AssetKey = keyof typeof ASSETS;
