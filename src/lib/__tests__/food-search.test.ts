import { describe, expect, it } from 'vitest';
import warmTerms from '../../../scripts/common-meal-food-terms.json';
import fixtures from './fixtures/usda-common-searches.json';
import { foodSearchLine, defaultPortion, initialAmount } from '../meals';
import { capPerTier, distinctFoodNames, distinctCachedFoodNames, normalizeUsdaFood, rankUsdaRows } from '../usda-foods.server';
import { foodRelevance, mergeFoodSearch } from '../food-search';
import type { Food } from '../meals';

const expected:Record<string,string[]>={
 'pasta':['Pasta, whole-wheat, cooked', 'Pasta, cooked', 'Pasta, whole grain, cooked', 'Pasta, fresh-refrigerated, plain, cooked', 'Pasta, vegetable, cooked'],
 'eggs':['Egg white','Whole egg','Egg yolk','Whole egg, cooked, hard-boiled','Whole egg, cooked, scrambled'],
 'egg':['Egg white','Whole egg','Egg yolk','Whole egg, cooked, hard-boiled','Whole egg, cooked, scrambled'],
 'chicken breast':['Chicken breast, cooked, grilled', 'Chicken breast, cooked, roasted', 'Chicken breast, cooked, braised', 'Chicken breast, cooked, stewed', 'Chicken breast, cooked, fried'],
 'rice':['White rice, long-grain, cooked', 'Brown rice, long-grain, cooked', 'White rice, short-grain, cooked', 'White rice, medium-grain, cooked', 'Brown rice, medium-grain, cooked'],
 'white rice':['White rice, long-grain, cooked', 'White rice, short-grain, cooked', 'White rice, medium-grain, cooked', 'White rice, glutinous, cooked', 'White rice, long-grain, parboiled, cooked'],
 'banana':['Banana, raw','Banana, baked','Banana, overripe, raw','Banana, ripe and slightly ripe, raw','Banana, dehydrated, or banana powder'],
 'oats':['Oats, whole grain, steel cut','Oats, whole grain, rolled, old fashioned','Oats','Oats, raw','Oats, instant, fortified, plain, dry'],
 'oatmeal':['Oatmeal','Oatmeal, multigrain','Oatmeal, reduced sugar','Oatmeal, instant, fruit flavored, fat added','Oatmeal, instant, maple flavored, fat added'],
 'milk':['Milk','Whole milk','Milk, fat free (skim)','Milk, low fat (1%)','Milk, reduced fat (2%)'],
 'greek yogurt':['Greek yogurt, plain, nonfat','Greek yogurt, plain, lowfat','Greek yogurt, strawberry, nonfat','Greek yogurt, plain, whole milk','Greek yogurt, strawberry, lowfat'],
 'salmon':['Salmon, fried', 'Salmon, grilled', 'Pink salmon, cooked, dry heat', 'Chinook salmon, cooked, dry heat', 'Sockeye salmon, cooked, dry heat'],
 'bread':['White bread, commercial','Bread, mulitgrain, commercial','Bread, 100% whole wheat, commercial','White bread, commercially prepared','Bread, wheat'],
 'peanut butter':['Peanut butter','Peanut butter, reduced fat','Peanut butter, creamy','Peanut butter, reduced sodium','Peanut Butter, smooth'],
 'avocado':['Avocado, raw','Avocado, raw, California','Avocado, raw, Florida','Avocado, Hass, peeled, raw','Avocado, raw, all commercial varieties'],
 'quaker oatmeal':['Quaker MultiGrain Oatmeal, dry','Quaker, Instant Oatmeal Organic','Quaker MultiGrain Oatmeal, prepared with water, salt','Quaker, Instant Oatmeal, apples and cinnamon, dry','Quaker, Instant Oatmeal, Cinnamon-Spice, dry'],
};
describe('recorded USDA common queries',()=>{
 it('warms 300 distinct common terms including rice, pasta and chicken breast',()=>{expect(warmTerms.length).toBe(300);expect(new Set(warmTerms).size).toBe(300);expect(warmTerms).toEqual(expect.arrayContaining(['rice','pasta','chicken breast','eggs','oats','protein powder']));});
 for(const [q,fixture] of Object.entries(fixtures))it(`${q}: expected top five and unique names`,()=>{
  const raw=capPerTier(rankUsdaRows(fixture.search as Record<string,unknown>[],q)).slice(0,25);
  const foods=distinctFoodNames(raw.map(r=>{const row={...r,...fixture.details.find(d=>d.fdcId===r['fdcId'])};return{row,food:normalizeUsdaFood(row)};}));
  expect(foods.slice(0,5).map(f=>f.name)).toEqual(expected[q]);
  expect(new Set(foods.map(f=>f.name.toLowerCase())).size).toBe(foods.length);
 });
 it('eggs collapse equivalent raw forms into Foundation foods, then show cooked forms',()=>{
  const fixture=fixtures.eggs;
  const foods=distinctFoodNames(capPerTier(rankUsdaRows(fixture.search,'eggs')).slice(0,25).map(r=>{const row={...r,...fixture.details.find(d=>d.fdcId===r['fdcId'])};return{row,food:normalizeUsdaFood(row)};}));
  expect(foods.slice(0,8).map(f=>f.name)).toEqual(['Egg white','Whole egg','Egg yolk','Whole egg, cooked, hard-boiled','Whole egg, cooked, scrambled','Whole egg, cooked, fried','Whole egg, cooked, poached','Whole egg, cooked, omelet']);
  expect(distinctCachedFoodNames(capPerTier(rankUsdaRows(fixture.search,'eggs')).slice(0,25).map(r=>normalizeUsdaFood({...r,...fixture.details.find(d=>d.fdcId===r['fdcId'])}))).slice(0,8).map(f=>f.name)).toEqual(foods.slice(0,8).map(f=>f.name));
  expect(distinctCachedFoodNames(foods).slice(0,8).map(f=>f.name)).toEqual(foods.slice(0,8).map(f=>f.name));
  expect(foods.slice(0,3).map(f=>f.id)).toEqual(['usda:747997','usda:748967','usda:748236']);
 });
 it('only merges generic implied qualifiers within ten percent for both nutrients',()=>{
  const make=(fdcId:number,name:string,dataType:string,calories:number|null,protein:number|null)=>({row:{fdcId,dataType},food:{id:String(fdcId),name,portions:[],yours:false,nutrition:{calories,protein,carbs:null,fat:null}}});
  const plain=make(1,'Food','SR Legacy',100,10);
  expect(distinctFoodNames([plain,make(2,'Food, raw','Foundation',110,11)]).map(f=>({id:f.id,name:f.name}))).toEqual([{id:'2',name:'Food'}]);
  for(const other of [make(3,'Food, raw','Foundation',112,10),make(4,'Food, raw','Foundation',100,12),make(5,'Food, raw','Branded',100,10),make(6,'Food, cooked','Foundation',100,10),make(7,'Food, raw','Foundation',null,10)])expect(distinctFoodNames([plain,other])).toHaveLength(2);
 });
 it('recorded rice collapses glutinous qualifier order and uses the real cup portion',()=>{
  const f=fixtures.rice;
  const foods=distinctFoodNames(capPerTier(rankUsdaRows(f.search,'rice')).slice(0,25).map(r=>{const row={...r,...f.details.find(d=>d.fdcId===r['fdcId'])};return{row,food:normalizeUsdaFood(row)};}));
  const glutinous=foods.filter(f=>/glutinous/.test(f.name));expect(glutinous).toHaveLength(1);expect(glutinous[0]?.id).toBe('usda:169711');
  const rice=foods.find(f=>f.name==='Rice, cooked');expect(rice).toBeDefined();if(!rice)throw Error('Missing recorded cooked rice');expect(defaultPortion(rice,'en-GB').unit).toBe('cup');expect(foodSearchLine(rice)).toMatch(/^1 cup/);
 });
 it('recorded chicken shows five plain cooked forms then raw and keeps real breast portions',()=>{
  const f=fixtures['chicken breast'];
  const foods=distinctFoodNames(capPerTier(rankUsdaRows(f.search,'chicken breast')).slice(0,25).map(r=>{const row={...r,...f.details.find(d=>d.fdcId===r['fdcId'])};return{row,food:normalizeUsdaFood(row)};}));
  expect(foods.slice(0,6).map(f=>f.name)).toEqual(['Chicken breast, cooked, grilled','Chicken breast, cooked, roasted','Chicken breast, cooked, braised','Chicken breast, cooked, stewed','Chicken breast, cooked, fried','Chicken breast, raw']);
  const fried=foods.find(f=>f.name==='Chicken breast, cooked, fried');if(!fried)throw Error('Missing fried chicken');expect(defaultPortion(fried,'en-GB').unit).toBe('breast');expect(foodSearchLine(fried)).toMatch(/^1 breast/);
  const skin=f.details.filter(r=>r.description==='Chicken breast, stewed, skin eaten'||r.description==='Chicken, broilers or fryers, breast, meat and skin, cooked, stewed');expect(skin).toHaveLength(2);
  expect(distinctFoodNames(skin.map(row=>({row,food:normalizeUsdaFood(row)}))).map(f=>({id:f.id,name:f.name}))).toEqual([{id:'usda:171076',name:'Chicken breast, meat and skin, cooked, stewed'}]);
 });
 it('equivalent qualifier sets and grain synonyms collapse without merging different nutrition or brands',()=>{
  const make=(fdcId:number,name:string,dataType:string,calories=100,protein=3)=>({row:{fdcId,dataType},food:{id:String(fdcId),name,portions:[],yours:false,nutrition:{calories,protein,carbs:null,fat:null}}});
  expect(distinctFoodNames([make(1,'White rice, cooked, glutinous','Survey (FNDDS)'),make(2,'White rice, glutinous, cooked','SR Legacy',97,3)]).map(f=>f.id)).toEqual(['2']);
  expect(distinctFoodNames([make(1,'Pasta, cooked','Survey (FNDDS)'),make(2,'Pasta, prepared','SR Legacy')])).toHaveLength(1);
  expect(distinctFoodNames([make(1,'Chicken breast, stewed, skin eaten','Survey (FNDDS)'),make(2,'Chicken breast, meat and skin, cooked, stewed','SR Legacy')])).toHaveLength(1);
  expect(distinctFoodNames([make(1,'White rice, cooked, glutinous','Branded'),make(2,'White rice, glutinous, cooked','SR Legacy')])).toHaveLength(2);
  expect(distinctFoodNames([make(1,'White rice, cooked, glutinous','Survey (FNDDS)'),make(2,'White rice, glutinous, cooked','SR Legacy',100,4)])).toHaveLength(2);
 });
 it('puts a primary food above mentions, niche food and an unrequested brand',()=>{
  const rank=rankUsdaRows([
   {fdcId:1,description:'Babyfood, cereal, with eggs, strained',dataType:'SR Legacy'},
   {fdcId:2,description:'Herring eggs (Alaska Native)',dataType:'SR Legacy'},
   {fdcId:3,description:'Eggs',dataType:'Branded',brandOwner:'Oakdell Egg Farms'},
   {fdcId:4,description:'Egg, whole, cooked, scrambled',dataType:'Survey (FNDDS)'},
  ],'eggs');
  expect(rank[0]?.['fdcId']).toBe(4);
  expect(foodRelevance('Herring eggs (Alaska Native)','alaska native eggs').score).toBeLessThan(foodRelevance('Herring eggs (Alaska Native)','eggs').score);
 });
 it('keeps query-named brands and distinguishes a brand from a common food word',()=>{
  expect(foodRelevance('Oatmeal','quaker oatmeal','The Quaker Oats Company').brandAsked).toBe(true);
  expect(foodRelevance('Eggs','eggs','Oakdell Egg Farms').brandAsked).toBe(false);
 });
 it('keeps plain cooked grains above raw grains and mixed dishes without variety lists',()=>{
  const names=['Rice, fried','Rice, dressing','Rice, dirty','Wild rice, raw','Rice, white, long-grain, cooked','Rice, brown, long-grain, cooked'];
  const ranked=rankUsdaRows(names.map((description,fdcId)=>({description,fdcId,dataType:'SR Legacy'})),'rice');
  expect(ranked.slice(0,2).map(r=>r['description'])).toEqual(['Rice, white, long-grain, cooked','Rice, brown, long-grain, cooked']);
 });
 it('uses real add counts to break an otherwise equal prepared-food ranking',()=>{
  const rows=[{fdcId:1,description:'Rice, white, medium-grain, cooked',dataType:'SR Legacy',add_count:0},{fdcId:2,description:'Rice, white, long-grain, cooked',dataType:'SR Legacy',add_count:5}];
  expect(rankUsdaRows(rows,'rice').map(r=>r['fdcId'])).toEqual([2,1]);
 });
 it.each(['Pasta','Lentils','Beef','Fish, cod'])('%s prepared forms outrank raw ones',head=>{
  const ranked=rankUsdaRows([{fdcId:1,description:`${head}, raw`,dataType:'Foundation'},{fdcId:2,description:`${head}, cooked`,dataType:'SR Legacy'}],head);
  expect(ranked[0]?.['fdcId']).toBe(2);
 });
 it('merges by ID without moving already-shown rows or repeating cleaned names',()=>{
  const food=(id:string,name:string):Food=>({id,name,portions:[{unit:'g',grams:1}],yours:false});
  const local=[food('a','Egg white'),food('b','Whole egg')];
  const merged=mergeFoodSearch(local,[food('b','Whole egg, raw'),food('c','Egg yolk'),food('a','Egg white'),food('d','EGG WHITE')]);
  expect(merged.map(f=>f.id)).toEqual(['a','b','c']);
  expect(merged[1]?.name).toBe('Whole egg, raw');
  expect(local[1]?.name).toBe('Whole egg');
 });
});