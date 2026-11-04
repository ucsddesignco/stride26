// Star art shared by the static stages (Hero) and the spawned stars (StarField).
// `inset` is the star's offset within its square bounding box.
const STAR_INSET_LG = "inset-[8.23%_8.82%_10.56%_8.82%]";
const STAR_INSET_SM = "inset-[8.9%_9.47%_11.18%_9.47%]";

export const RED = { src: "/hero/star-red.svg", w: 29.9892, h: 29.5714, inset: STAR_INSET_SM };
export const YELLOW = { src: "/hero/star-yellow-1.svg", w: 50.239, h: 49.5335, inset: STAR_INSET_LG };
export const BLUE = { src: "/hero/star-blue.svg", w: 75.7703, h: 74.7063, inset: STAR_INSET_LG };

export type StarArt = typeof RED;
