/**
 * Questions whose answer is a figure to memorise - speed limits, distances,
 * ages, weights, durations, tyre tread depths and the like.
 *
 * Hand-curated from the bank: answers carrying a number with a unit were
 * flagged, then reviewed one by one. Picture-index answers ("1", "2-rasmda")
 * and questions where a number only appears in passing were left out.
 */
export const NUMBER_QUESTION_IDS: ReadonlySet<number> = new Set([
  92, 99, 100, 102, 108, 128, 129, 130, 133, 138, 149, 152, 159, 162, 175, 178, 186, 197, 212,
  227, 234, 236, 282, 306, 314, 322, 346, 347, 349, 352, 358, 368, 381, 386, 405, 413, 414, 419,
  440, 481, 509, 542, 544, 546, 549, 558, 559, 593, 609, 610, 618, 627, 628, 635, 639, 644, 668,
  670, 718, 726, 760, 778, 786, 821, 907, 909, 918, 923, 931, 958, 977, 984, 1003, 1004, 3069,
  3070, 3074, 3079, 3081, 3082, 3088, 3109, 3115, 3142, 3152, 3170, 3200, 3217, 3250, 3266,
  3285, 3288, 3320, 3321, 3334, 3338, 3357, 3363, 3364, 3368, 3372, 3389, 3428, 3467, 3470,
  3471, 3483,
])
