import { z } from 'zod';
export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Supplements'] as const;
export type MealType = typeof MEAL_TYPES[number];
export type Nutrition = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
export type Portion = { unit: string; grams: number };
export type Food = { id: string; name: string; portions: Portion[]; nutrition?: Nutrition; yours: boolean };
export type MealFood = { key: string; foodId: string; name: string; amount: number; unit: string; grams: number; note: string; portions?: Portion[]; nutrition?: Nutrition };
export type MealSnapshot = { title: string; type: MealType | null; foods: MealFood[]; items: { name: string; amount: string }[]; totals?: Nutrition; override?: Nutrition | null; calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; mealId?: string; fromName?: string | null; missingCalories?: number };
export type Meal = { id: string; name: string; userId: string; author: string; fromName: string | null; sourceMealId: string | null; myCopyId: string | null; added: number; snapshot: MealSnapshot };
export const nutritionSchema = z.object({ calories: z.number().min(0).max(100000).nullable(), protein: z.number().min(0).max(100000).nullable(), carbs: z.number().min(0).max(100000).nullable(), fat: z.number().min(0).max(100000).nullable() });
export const mealInputSchema = z.object({ id: z.string().uuid().nullable(), name: z.string().trim().min(1).max(60), type: z.enum(MEAL_TYPES).nullable(), foods: z.array(z.object({ key: z.string().min(1).max(100), foodId: z.string().min(1).max(100), amount: z.number().positive().max(100000), unit: z.string().min(1).max(50), note: z.string().max(100) })).min(1).max(30), override: nutritionSchema.nullable() });
export type MealInput = z.infer<typeof mealInputSchema>;
const keys = ['calories', 'protein', 'carbs', 'fat'] as const;
export const roundNutrition = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
export function foodNutrition(n: Nutrition, grams: number): Nutrition { return Object.fromEntries(keys.map(k => [k, n[k] === null ? null : roundNutrition(n[k] * grams / 100)])) as Nutrition; }
export function mealTotals(foods: MealFood[]): Nutrition {
 return Object.fromEntries(keys.map(k => { const known = foods.filter(f => f.nutrition?.[k] != null); return [k, known.length ? roundNutrition(known.reduce((n,f) => n + (f.nutrition?.[k] ?? 0) * f.grams / 100, 0)) : null]; })) as Nutrition;
}
export function missingCalorieWarning(foods: MealFood[]): string { const n = foods.filter(f => f.nutrition?.calories == null).length; return n ? `${n} ${n === 1 ? 'food has' : 'foods have'} no calories, so these may be low.` : ''; }
export function switchFoodUnit(amount: number, fromGrams: number, toGrams: number) { return amount * fromGrams / toGrams; }
export function totalsWarning(override: Nutrition | null, changedFood: string | null) { return override && changedFood ? `Your totals don't include the ${changedFood} you just added. Reset to use your foods' numbers.` : ''; }
export function effectiveTotals(foods: MealFood[], override: Nutrition | null): Nutrition { return override ? { ...override } : mealTotals(foods); }
export function foodAmount(amount: number, unit: string) { return `${roundNutrition(amount)} ${unit}`; }
export function buildSnapshot(title: string, type: MealType | null, foods: MealFood[], override: Nutrition | null): MealSnapshot { const totals = effectiveTotals(foods,override); return { title, type, foods, items: foods.map(f => ({ name:f.name, amount:foodAmount(f.amount,f.unit) })), totals, override, ...totals, missingCalories: foods.filter(f => f.nutrition?.calories == null).length }; }
export function mealNumbers(m: MealSnapshot) { return m.totals ?? { calories:m.calories ?? null, protein:m.protein ?? null, carbs:m.carbs ?? null, fat:m.fat ?? null }; }
export function hasMealNutrition(m: MealSnapshot) { return !!m.totals || keys.some(k => Object.prototype.hasOwnProperty.call(m,k)); }
export function fullMealLine(m: MealSnapshot) { const n=mealNumbers(m); const parts=keys.filter(k => n[k]!=null).map(k=> `${Math.round(n[k] ?? 0)}${k==='calories' ? ' cal' : ` g ${k}`}`); return parts.length ? `${n.calories===null&&hasMealNutrition(m)?'No calories · ':''}About ${parts.join(' · ')}` : hasMealNutrition(m)?'No calories':''; }
export function stripNutrition<T>(value: T): T {
 if(Array.isArray(value)) return value.map(stripNutrition) as T;
 if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([k]) => ![...keys,'nutrition','totals','override','missingCalories'].includes(k)).map(([k,v])=>[k,stripNutrition(v)])) as T;
 return value;
}
export function mealForViewer<T>(value:T, under18:boolean):T { return under18 ? stripNutrition(value) : value; }
export function mealCopyCredit(previous:MealSnapshot, next:MealSnapshot, name:string|null) { return JSON.stringify(previous.foods)!==JSON.stringify(next.foods) ? null : name; }
export function defaultPortion(food:Food, region:string):Portion { const usual=food.portions[0]; if(usual && !['g','oz'].includes(usual.unit)) return usual; const imperial=/^(?:en-US|en-LR|en-MM)(?:$|-)/i.test(region); return food.portions.find(p=>p.unit===(imperial?'oz':'g')) ?? usual ?? {unit:'g',grams:1}; }
export function initialAmount(portion:Portion,food:Food) { return portion.unit==='g' && food.portions.every(p=>['g','oz'].includes(p.unit)) ? 100 : 1; }
