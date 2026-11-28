import { afterEach,describe,it,expect,vi } from 'vitest';
import { cleanUsdaDescription,distinctFoodNames,fetchUsda,normalizeUsdaFood,rankUsdaRows } from '../usda-foods.server';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('USDA server boundary',()=>{
 it('ranks Foundation, SR Legacy and Survey foods before branded foods',()=>{const rows=[{fdcId:4,dataType:'Branded'},{fdcId:1,dataType:'Foundation'},{fdcId:2,dataType:'SR Legacy'},{fdcId:3,dataType:'Survey (FNDDS)'}];expect(rankUsdaRows(rows).map(r=>r['fdcId'])).toEqual([1,2,3,4]);});
 it('uses the branded household measure and keeps g and oz',()=>{const food=normalizeUsdaFood({fdcId:5,description:'RICE',dataType:'Branded',brandOwner:'Example Foods',servingSize:158,servingSizeUnit:'g',householdServingFullText:'1 cup'});expect(food.portions).toEqual([{unit:'cup',grams:158},{unit:'g',grams:1},{unit:'oz',grams:28.349523125}]);expect(food.name).toContain('Example Foods');});
 it('keeps every USDA portion with its per-unit gram weight',()=>{const food=normalizeUsdaFood({fdcId:6,description:'Rice',foodPortions:[{amount:1,gramWeight:158,modifier:'cup'},{amount:2,gramWeight:20,modifier:'tbsp'}]});expect(food.portions.slice(0,2)).toEqual([{unit:'cup',grams:158},{unit:'tbsp',grams:10}]);});

 it('normalizes per-100g nutrients and cup grams, with no credential field in the result',()=>{const food=normalizeUsdaFood({fdcId:123,description:'White rice',foodNutrients:[{nutrient:{id:1008},amount:130},{nutrient:{id:1003},amount:2.5},{nutrient:{id:1005},amount:28},{nutrient:{id:1004},amount:.2}],foodPortions:[{amount:1,gramWeight:158,portionDescription:'1 cup'}]});expect(food.portions[0]).toEqual({unit:'cup',grams:158});expect(food.nutrition).toEqual({calories:130,protein:2.5,carbs:28,fat:.2});expect(Object.keys(food).sort()).toEqual(['id','name','nutrition','portions','yours']);});
 it('uses the credential only in the server request header, not in the URL or returned food',async()=>{vi.stubEnv('USDA_API_KEY','test-only-credential');const fetchMock=vi.fn(async()=>new Response(JSON.stringify({foods:[{fdcId:123,description:'Rice'}]}),{status:200}));vi.stubGlobal('fetch',fetchMock);const result=await fetchUsda('foods/search',{query:'rice'});const call=fetchMock.mock.calls[0] as unknown as [string,RequestInit];expect(call[0]).toBe('https://api.nal.usda.gov/fdc/v1/foods/search');expect((call[1].headers as Record<string,string>)['X-Api-Key']).toBe('test-only-credential');expect(JSON.stringify(result)).not.toContain('test-only-credential');});
 it('never returns unknown calories as zero',()=>{expect(normalizeUsdaFood({fdcId:1,description:'Food',foodNutrients:[]}).nutrition?.calories).toBeNull();});

 it.each([
  ['Rice, white, long-grain, regular, enriched, cooked','White rice, long-grain, cooked'],
  ['Rice, white, short-grain, cooked','White rice, short-grain, cooked'],
  ['Rice, brown, medium-grain, cooked','Brown rice, medium-grain, cooked'],
  ['Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised','Chicken breast, cooked, braised'],
  ['Egg, whole, raw, fresh','Whole egg, raw'],
  ['Egg, white, raw, fresh','Egg white, raw'],
  ['Cereals, oats, regular and quick, not fortified, dry','Oats, regular and quick, dry'],
  ['Broccoli, cooked, boiled, drained, without salt','Broccoli, cooked, boiled, drained'],
  ['Fish, salmon, Atlantic, farmed, cooked, dry heat','Atlantic salmon, farmed, cooked, dry heat'],
  ['Rice, white, steamed, Chinese restaurant','White rice, steamed, Chinese restaurant'],
  ['Yogurt, Greek, plain, nonfat','Yogurt, Greek, plain, nonfat'],
  ['Cheese, Swiss','Cheese, Swiss'],
  ['Cereals, QUAKER, Quick Oats, Dry','Quaker, Quick Oats, Dry'],
 ])('cleans the USDA name %s',(raw,clean)=>{expect(cleanUsdaDescription(raw)).toBe(clean);});
 it('gives same-name foods with different numbers distinct names and collapses true duplicates',()=>{const make=(id:number,description:string,dataType:string,calories:number)=>{const row={fdcId:id,description,dataType,foodNutrients:[{nutrient:{id:1008},amount:calories}]};return {row,food:normalizeUsdaFood(row)};};const names=distinctFoodNames([make(1,'Rice, white, long-grain, regular, enriched, cooked','SR Legacy',130),make(2,'Rice, white, long-grain, regular, unenriched, cooked','SR Legacy',130),make(3,'Rice, white, long-grain, regular, cooked','Survey (FNDDS)',121),make(4,'Broccoli, raw','Foundation',34),make(5,'Broccoli, raw','SR Legacy',34)]).map(f=>f.name);expect(new Set(names).size).toBe(names.length);expect(names.filter(n=>n.startsWith('Broccoli'))).toEqual(['Broccoli, raw']);expect(names.filter(n=>n.startsWith('White rice'))).toEqual(['White rice, long-grain, cooked (reference)','White rice, long-grain, cooked (as eaten)']);});
 it('puts foods named for the query first inside each tier and drops rows that never mention it',()=>{const rows=[{fdcId:1,dataType:'SR Legacy',description:'Snacks, rice cakes, brown rice, plain'},{fdcId:2,dataType:'SR Legacy',description:'Rice, white, medium-grain, cooked'},{fdcId:3,dataType:'Branded',description:'RICE'},{fdcId:4,dataType:'Foundation',description:'Rice, brown, long-grain, raw'},{fdcId:5,dataType:'SR Legacy',description:'Cheese, cheddar'}];expect(rankUsdaRows(rows,'rice').map(r=>r['fdcId'])).toEqual([4,2,1,3]);});
 it('keeps the base unit alone when unique and the descriptor only when two portions share it',()=>{const f=normalizeUsdaFood({fdcId:9,description:'Apples, raw',foodPortions:[{amount:1,gramWeight:110,modifier:'cup, sliced'},{amount:1,gramWeight:125,modifier:'cup, chopped'},{amount:1,gramWeight:132,modifier:'cup, loosely packed'},{amount:1,gramWeight:200,modifier:'stalk, large'}]});expect(f.portions.map(p=>p.unit).slice(0,4)).toEqual(['cup, sliced','cup, chopped','cup, loosely packed','stalk']);expect(normalizeUsdaFood({fdcId:10,description:'Rice',foodPortions:[{amount:1,gramWeight:132,modifier:'cup, loosely packed'}]}).portions[0]?.unit).toBe('cup');});
});
