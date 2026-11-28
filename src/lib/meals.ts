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
/** Removing the food that triggered the totals warning clears it; removing any other food leaves it. */
export function changedFoodAfterRemoval(changed: string | null, removed: string) { return changed === removed ? null : changed; }
/** Only a newly added food names the totals warning; reordering or editing an amount keeps the current one. */
export function changedFoodAfterChange(changed: string | null, change: { kind: 'add' | 'reorder' | 'edit'; name?: string }) { return change.kind === 'add' && change.name ? change.name : changed; }
export function totalsWarning(override: Nutrition | null, changedFood: string | null) { return override && changedFood ? `Your totals don't include the ${changedFood} you just added. Reset to use your foods' numbers.` : ''; }
export function effectiveTotals(foods: MealFood[], override: Nutrition | null): Nutrition { return override ? { ...override } : mealTotals(foods); }
export function foodAmount(amount: number, unit: string) {
 const rounded=roundNutrition(amount);const plural:Record<string,string>={cup:'cups',scoop:'scoops',piece:'pieces',serving:'servings',slice:'slices',tablespoon:'tablespoons',teaspoon:'teaspoons'};
 return `${rounded} ${rounded===1?unit:plural[unit]??unit}`;
}
/** Starting-portion preference: whole items (sizes, piece, slice, whole), then cup, then tbsp, then other measures, then grams. Parts such as stalk or spear count as other measures. */
const SIZE=/^(extra large|jumbo|large|medium|small)$/;
export const vaguePortion=(unit:string)=>/^(unit|each|serving|undetermined|quantity not specified)$/i.test(unit.trim());
export function portionPreference(unit:string) { const u=unit.toLowerCase().trim();if(SIZE.test(u)||/^(piece|slice|whole|breast)s?\b/.test(u))return 0;if(/^cups?\b/.test(u))return 1;if(/^(tbsp|tablespoons?)\b/.test(u))return 2;if(u==='g'||u==='oz')return 5;if(vaguePortion(u)||/\bracc\b/.test(u))return 6;return 3; }
/** Orders portions by preference; among whole-item sizes the middle size by weight comes first (egg: large, apple: medium). */
function sortPortions(portions:Portion[]):Portion[] {
 const sizes=portions.filter(p=>SIZE.test(p.unit.toLowerCase().trim())).sort((a,b)=>a.grams-b.grams);const mid=sizes[Math.floor((sizes.length-1)/2)];
 return portions.map((p,i)=>({p,i})).sort((a,b)=>portionPreference(a.p.unit)-portionPreference(b.p.unit)||Number(b.p===mid)-Number(a.p===mid)||a.i-b.i).map(x=>x.p);
}
export function hasHouseholdPortion(food:Food) { return food.portions.some(p=>p.grams>0&&portionPreference(p.unit)<=3); }
/** Search order: most added by members first, then foods with a household portion, then the incoming tier/name order. */
export function rankFoodResults(foods:Food[],adds:Record<string,number>):Food[] { return foods.map((f,i)=>({f,i})).sort((a,b)=>(adds[b.f.id]??0)-(adds[a.f.id]??0)||Number(hasHouseholdPortion(b.f))-Number(hasHouseholdPortion(a.f))||a.i-b.i).map(x=>x.f); }
/** Foods newly added in this save, counting duplicates, compared with the previous version of the meal. */
export function newlyAddedFoodIds(current:string[],previous:string[]) { const left=[...previous];return current.filter(id=>{const i=left.indexOf(id);if(i>=0){left.splice(i,1);return false;}return true;}); }
export function foodPortions(food:Food):Portion[] {
 const portions=sortPortions(food.portions.filter(p=>p.grams>0));
 return [...portions,...(portions.some(p=>p.unit==='g')?[]:[{unit:'g',grams:1}]),...(portions.some(p=>p.unit==='oz')?[]:[{unit:'oz',grams:28.349523125}])];
}
export function foodSearchLine(food:Food) {
 const p=defaultPortion({...food,portions:foodPortions(food)},'en-GB');const amount=initialAmount(p,food);const n=food.nutrition?foodNutrition(food.nutrition,p.grams*amount):null;
 const portion=p.unit==='serving'?`${roundNutrition(p.grams)} g`:foodAmount(amount,p.unit);
 return [portion,n?.calories!=null?`${Math.round(n.calories)} cal`:food.nutrition?'No calories':null,n?.protein!=null?`${Math.round(n.protein)} g protein`:null].filter(Boolean).join(' · ');
}
export function uniqueFoodResults(foods:Food[]):Food[] {
 const seen=new Set<string>();return foods.filter(f=>{const p=defaultPortion(f,'en-GB');const n=f.nutrition?foodNutrition(f.nutrition,p.grams*initialAmount(p,f)):null;const key=JSON.stringify([f.name.toLowerCase(),n?keys.map(k=>n[k]===null?null:Math.round(n[k]??0)):null,p.unit]);if(seen.has(key))return false;seen.add(key);return true;});
}
export function mealItems(snapshot:MealSnapshot) { return snapshot.items.map((item,i)=>{const food=snapshot.foods?.[i];return {...item,amount:food&&food.grams>0?foodAmount(food.amount,food.unit):item.amount.replace(/^(\d+(?:\.\d+)?) (cup|scoop|piece|serving)$/,(_,n:string,u:string)=>foodAmount(Number(n),u))};}); }
export function mealsCountLine(count:number,type:string) { const noun=type==='All'?'meal':type.toLowerCase().replace(/s$/,'');return `${count} ${noun}${count===1?'':'s'}, most added first`; }
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
export function defaultPortion(food:Food, region:string):Portion { const usable=food.portions.filter(p=>p.grams>0&&!vaguePortion(p.unit));const usual=sortPortions(usable)[0];if(!usable.some(p=>!['g','oz'].includes(p.unit)))return {unit:'g',grams:1}; if(usual && !['g','oz'].includes(usual.unit)) return usual; const imperial=/^(?:en-US|en-LR|en-MM)(?:$|-)/i.test(region); return food.portions.find(p=>p.unit===(imperial?'oz':'g')) ?? usual ?? {unit:'g',grams:1}; }
export function initialAmount(portion:Portion,food:Food) { return portion.unit==='g' && food.portions.every(p=>['g','oz'].includes(p.unit)||vaguePortion(p.unit)) ? 100 : 1; }
