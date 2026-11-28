import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/usda-common-searches.json';
import { capPerTier, distinctFoodNames, normalizeUsdaFood, rankUsdaRows } from '../usda-foods.server';
import { foodRelevance, mergeFoodSearch } from '../food-search';
import type { Food } from '../meals';

const expected:Record<string,string[]>={
 'eggs':['Egg white','Whole egg','Egg yolk','Egg white, raw','Whole egg, raw'],
 'egg':['Egg white','Whole egg','Egg yolk','Egg white, raw','Whole egg, raw'],
 'chicken breast':['Chicken breast, raw','Chicken breast, cooked, braised','Chicken breast, meat and skin, raw','Chicken breast, cooked, fried','Chicken breast, cooked, roasted'],
 'rice':['Wild rice, dry, raw','Wild rice, cooked','Wild rice, raw','Rice, fried','Rice, cooked'],
 'white rice':['White rice, long grain, raw','White rice, medium-grain, cooked','White rice, short-grain, cooked','White rice, long-grain, cooked','White rice, medium-grain, raw'],
 'banana':['Banana, raw','Banana, baked','Banana, overripe, raw','Banana, ripe and slightly ripe, raw','Banana, dehydrated, or banana powder'],
 'oats':['Oats, whole grain, steel cut','Oats, whole grain, rolled, old fashioned','Oats','Oats, raw','Oats, instant, fortified, plain, dry'],
 'oatmeal':['Oatmeal','Oatmeal, multigrain','Oatmeal, reduced sugar','Oatmeal, instant, fruit flavored, fat added','Oatmeal, instant, maple flavored, fat added'],
 'milk':['Milk','Whole milk','Milk, fat free (skim)','Milk, low fat (1%)','Milk, reduced fat (2%)'],
 'greek yogurt':['Greek yogurt, plain, nonfat','Greek yogurt, plain, lowfat','Greek yogurt, strawberry, nonfat','Greek yogurt, plain, whole milk','Greek yogurt, strawberry, lowfat'],
 'salmon':['Salmon','Salmon, fried','Salmon, grilled','Salmon, raw','Chinook salmon, raw'],
 'bread':['White bread, commercial','Bread, mulitgrain, commercial','Bread, 100% whole wheat, commercial','White bread, commercially prepared','Bread, wheat'],
 'peanut butter':['Peanut butter','Peanut butter, reduced fat','Peanut butter, creamy','Peanut butter, reduced sodium','Peanut Butter, smooth'],
 'avocado':['Avocado, raw','Avocado, raw, California','Avocado, raw, Florida','Avocado, Hass, peeled, raw','Avocado, raw, all commercial varieties'],
 'quaker oatmeal':['Quaker MultiGrain Oatmeal, dry','Quaker, Instant Oatmeal Organic','Quaker MultiGrain Oatmeal, prepared with water, salt','Quaker, Instant Oatmeal, apples and cinnamon, dry','Quaker, Instant Oatmeal, Cinnamon-Spice, dry'],
};
describe('recorded USDA common queries',()=>{
 for(const [q,fixture] of Object.entries(fixtures))it(`${q}: expected top five and unique names`,()=>{
  const raw=capPerTier(rankUsdaRows(fixture.search as Record<string,unknown>[],q));
  const foods=distinctFoodNames(raw.map(r=>{const row={...r,...fixture.details.find(d=>d.fdcId===r['fdcId'])};return{row,food:normalizeUsdaFood(row)};}));
  expect(foods.slice(0,5).map(f=>f.name)).toEqual(expected[q]);
  expect(new Set(foods.map(f=>f.name.toLowerCase())).size).toBe(foods.length);
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
 it('merges by ID without moving already-shown rows or repeating cleaned names',()=>{
  const food=(id:string,name:string):Food=>({id,name,portions:[{unit:'g',grams:1}],yours:false});
  const local=[food('a','Egg white'),food('b','Whole egg')];
  const merged=mergeFoodSearch(local,[food('b','Whole egg, raw'),food('c','Egg yolk'),food('a','Egg white'),food('d','EGG WHITE')]);
  expect(merged.map(f=>f.id)).toEqual(['a','b','c']);
  expect(merged[1]?.name).toBe('Whole egg, raw');
  expect(local[1]?.name).toBe('Whole egg');
 });
});