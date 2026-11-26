/** Approved Discover names for Pactara plan-day workouts. Plan days and saved copies keep their own names. */
export const PACTARA_WORKOUT_NAMES = {
  "008eb68c0e5c67c2871b1e6d66b5943d": "Barbell squat + bench",
  "c7a6a3e78f04d37b806efb88ede43684": "Barbell squat + deadlift",
  "37ce9ba4818ecbcca72eddab367e37bd": "Squat-focused legs",
  "4419ffbe32daae10169ff1bb33959e1e": "Deadlift-focused legs",
  "fe0e0afb94e9295b805b3e31157b50bb": "Bench press upper body",
  "033b5b7a2ce3cf559be42c026ff6705c": "Incline press upper body",
  "a5af985459267d96f48ef61b6cd02d66": "Machine upper body",
  "bcde5003be2cc9baa1992230c6305d7f": "Machine full body",
  "f038382936e9ad7a4f07acbb50af47cf": "Machine shoulders + legs",
  "601e134a2f57f746ad8a89319b42a928": "Dumbbell press + squat",
  "c14965d73c11d71f2542962c420c2571": "Dumbbell hinge + press",
  "26ef8dd31835e4503da4aee44813e1e2": "Dumbbell split squat day",
  "2af517e862f4c323bde9d8cb7816d4e8": "Dumbbell carry day",
  "95b604bd3ffca3f9cba1f8f717f3a76f": "Dumbbell legs",
  "39922b8ede5b24fb36c50d05925189e9": "Dumbbell upper body",
  "f31bd7ce2d29c32c9e5182549e3c1e8e": "Squat + row starter",
  "eae10fe1b092bb958cfbb73583920239": "Hinge + press starter",
  "e89287d904bc9980868ec09fc3b54a41": "Bodyweight full body",
  "caadcafafa08167bcf40067f3963d31f": "Advanced bodyweight",
  "b1bbbe824cbfcff19606b5cee345ca32": "Bodyweight legs",
  "e3773fc366a924cd3f6a689f3b7f9044": "Lower body at home",
  "5381d6f7914cc04f7d90f1ffc92d7afa": "Bodyweight upper body",
  "5fdf98015e9366fdc2b715a4824bd911": "Bodyweight push",
  "464fcd7e7d22c46e1200293322f0d900": "Core basics",
  "935dcb977baadbc8e936e6c39589425e": "Core burner",
  "6e8226a14dfea486705d71acd1267cd3": "Back stretch",
  "40285904198e90cc1966f6c1cbfb9f8d": "Hip stretch",
  "31f9f629711c8c7204ff6dcd25c436b6": "Full body stretch",
} as const;

export type PactaraWorkoutKey = keyof typeof PACTARA_WORKOUT_NAMES;

export function pactaraWorkoutName(key: string, fallback: string): string {
  return PACTARA_WORKOUT_NAMES[key as PactaraWorkoutKey] ?? fallback;
}
