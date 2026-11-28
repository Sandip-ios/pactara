import { describe,it,expect } from 'vitest';
import { buildSnapshot,mealTotals,foodNutrition,switchFoodUnit,effectiveTotals,totalsWarning,missingCalorieWarning,mealForViewer,mealCopyCredit,mealInputSchema,defaultPortion,initialAmount,hasMealNutrition,fullMealLine,foodPortions,foodSearchLine,foodAmount,uniqueFoodResults,mealItems,type MealFood,type Nutrition, changedFoodAfterChange } from '../meals';
const rice:MealFood={key:'rice-1',foodId:'rice',name:'White rice',amount:1,unit:'cup',grams:158,note:'',nutrition:{calories:129.7468,protein:2.5316,carbs:28.481,fat:0}};
const chicken:MealFood={key:'chicken-1',foodId:'chicken',name:'Chicken',amount:8,unit:'oz',grams:226.796185,note:'',nutrition:{calories:165,protein:31,carbs:0,fat:3.6}};
const custom:Nutrition={calories:640,protein:62,carbs:70,fat:12};
describe('Meals rules',()=>{
 it('includes all known portions plus grams and ounces',()=>{const food={id:'rice',name:'Rice',yours:false,portions:[{unit:'cup',grams:158},{unit:'tbsp',grams:10}]};expect(foodPortions(food)).toEqual([{unit:'cup',grams:158},{unit:'tbsp',grams:10},{unit:'g',grams:1},{unit:'oz',grams:28.349523125}]);});
 it('uses real portion weights for the search nutrients',()=>{const food={id:'rice',name:'White rice, cooked',yours:false,portions:[{unit:'cup',grams:158}],nutrition:{calories:130,protein:2.69,carbs:28.17,fat:.28}};expect(foodNutrition(food.nutrition,foodPortions(food)[0]?.grams??0).calories).toBe(205.4);expect(foodSearchLine(food)).toContain('205 cal');});
 it('collapses identical food results but keeps foods with different nutrients',()=>{const f={id:'rice-a',name:'Rice',yours:false,portions:[{unit:'cup',grams:158}],nutrition:custom};expect(uniqueFoodResults([f,{...f,id:'rice-b'},{...f,id:'rice-c',nutrition:{...custom,calories:650}}]).map(x=>x.id)).toEqual(['rice-a','rice-c']);});
 it('pluralizes cup and scoop quantities in saved and legacy meal amounts',()=>{expect(foodAmount(2,'cup')).toBe('2 cups');expect(foodAmount(1,'scoop')).toBe('1 scoop');expect(foodAmount(1.5,'scoop')).toBe('1.5 scoops');expect(mealItems(buildSnapshot('Meal',null,[{...rice,amount:2,grams:316}],null))[0]?.amount).toBe('2 cups');});

 it('distinguishes unknown adult calories from nutrition removed for under-18 members',()=>{const unknown=buildSnapshot('Legacy meal',null,[{...rice,nutrition:{calories:null,protein:null,carbs:null,fat:null}}],null);expect(hasMealNutrition(unknown)).toBe(true);expect(mealTotals(unknown.foods).calories).toBeNull();const teen=mealForViewer(unknown,true);expect(hasMealNutrition(teen)).toBe(false);expect(fullMealLine(teen)).toBe('');expect(fullMealLine(buildSnapshot('Zero',null,[{...rice,nutrition:{calories:0,protein:0,carbs:0,fat:0}}],null))).toContain('0 cal');});
 it('adds per-100g nutrients before rounding',()=>{expect(mealTotals([rice,chicken])).toEqual({calories:579.2,protein:74.3,carbs:45,fat:8.2});});
 it('rounds a portion to one decimal without converting missing calories to zero',()=>{expect(foodNutrition({calories:null,protein:1.25,carbs:0,fat:0},100)).toEqual({calories:null,protein:1.3,carbs:0,fat:0});});
 it('keeps food quantity when switching 1 cup to 158 grams and back',()=>{expect(switchFoodUnit(1,158,1)).toBe(158);expect(switchFoodUnit(158,1,158)).toBe(1);});
 it('keeps edited totals when food changes and identifies the excluded addition',()=>{expect(effectiveTotals([rice,chicken],custom)).toEqual(custom);expect(totalsWarning(custom,'Greek yogurt')).toBe("Your totals don't include the Greek yogurt you just added. Reset to use your foods' numbers.");expect(totalsWarning(null,'Greek yogurt')).toBe('');});
 it('warns about one missing calorie food and never stores zero for unknown',()=>{const unknown={...rice,nutrition:{calories:null,protein:null,carbs:null,fat:null}};expect(missingCalorieWarning([rice,unknown])).toBe('1 food has no calories, so these may be low.');expect(mealTotals([unknown]).calories).toBeNull();});
 it('allows duplicate foods as separate rows and counts both',()=>{expect(mealTotals([rice,{...rice,key:'rice-2'}]).calories).toBe(410);const input={id:null,name:'Rice twice',type:null,foods:[rice,{...rice,key:'rice-2'}],override:null};expect(mealInputSchema.parse(input).foods).toHaveLength(2);});
 it('enforces 30 foods and 60-character names and 100-character notes',()=>{const input={id:null,name:'Meal',type:null,foods:[rice],override:null};expect(mealInputSchema.safeParse({...input,foods:Array.from({length:31},(_,i)=>({...rice,key:String(i)}))}).success).toBe(false);expect(mealInputSchema.safeParse({...input,name:'x'.repeat(61)}).success).toBe(false);expect(mealInputSchema.safeParse({...input,foods:[{...rice,note:'x'.repeat(101)}]}).success).toBe(false);});
 it('removes all nutrition keys recursively from under-18 responses while adults retain numbers',()=>{const snapshot=buildSnapshot('Meal','Lunch',[rice],custom);const response=mealForViewer({snapshot,foods:[rice],nested:{protein:60}},true);expect(JSON.stringify(response)).not.toMatch(/"(calories|protein|carbs|fat|nutrition|totals|override|missingCalories)":/);expect(response.snapshot.items).toEqual([{name:'White rice',amount:'1 cup'}]);expect(mealForViewer(snapshot,false).totals).toEqual(custom);});
 it('editing an added meal changes only its snapshot and drops credit when foods change',()=>{const original=buildSnapshot('Meal','Lunch',[rice],null);const copy=buildSnapshot('My meal','Lunch',[{...rice,amount:2,grams:316}],null);expect(original.foods[0]?.amount).toBe(1);expect(mealCopyCredit(original,copy,'Maya')).toBeNull();expect(mealCopyCredit(original,{...original,title:'Renamed'},'Maya')).toBe('Maya');});
 it('starts gram-only foods at 100 grams and uses usual serving first',()=>{const food={id:'rice',name:'Rice',portions:[{unit:'cup',grams:158},{unit:'g',grams:1},{unit:'oz',grams:28.349523125}],yours:false};expect(defaultPortion(food,'en-US').unit).toBe('cup');expect(defaultPortion(food,'en-GB').unit).toBe('cup');expect(initialAmount({unit:'g',grams:1},{...food,portions:food.portions.slice(1)})).toBe(100);});
});
import { changedFoodAfterRemoval } from '../meals';
describe('totals warning after removing a food',()=>{
 it('clears when the food that triggered it is removed, and stays for any other food',()=>{
  expect(changedFoodAfterRemoval("Mom's pepper sauce","Mom's pepper sauce")).toBeNull();
  expect(changedFoodAfterRemoval("Mom's pepper sauce",'Mixed salad greens, raw')).toBe("Mom's pepper sauce");
 });
});
describe('totals warning after food changes',()=>{
 it('reordering or editing an amount never names a food; only an added food does',()=>{
  expect(changedFoodAfterChange(null,{kind:'reorder'})).toBeNull();
  expect(changedFoodAfterChange(null,{kind:'edit'})).toBeNull();
  expect(changedFoodAfterChange('Greek yogurt',{kind:'reorder'})).toBe('Greek yogurt');
  expect(changedFoodAfterChange(null,{kind:'add',name:'Greek yogurt'})).toBe('Greek yogurt');
 });
});
