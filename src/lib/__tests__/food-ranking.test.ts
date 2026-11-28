import { describe, expect, it } from 'vitest';
import rows from './fixtures/usda-rows.json';
import { normalizeUsdaFood } from '../usda-foods.server';
import { defaultPortion, foodPortions, newlyAddedFoodIds, rankFoodResults } from '../meals';
const food=(k:keyof typeof rows)=>normalizeUsdaFood(rows[k] as unknown as Record<string,unknown>);
const rice=food('rice white medium grain cooked'),puffed=food('rice puffed'),broccoli=food('broccoli cooked boiled drained without salt'),chicken=food('chicken breast skinless boneless braised'),egg=food('egg whole raw fresh'),apple=food('apples raw with skin'),bread=food('bread whole wheat commercially prepared');
describe('food search ranking',()=>{
 it('puts foods with a household portion ahead of gram-only foods when nobody has added them yet',()=>{expect(rankFoodResults([puffed,rice],{}).map(f=>f.id)).toEqual([rice.id,puffed.id]);});
 it('puts the foods members add most first, ahead of household portions',()=>{expect(rankFoodResults([rice,chicken,puffed],{[puffed.id]:3,[chicken.id]:1}).map(f=>f.id)).toEqual([puffed.id,chicken.id,rice.id]);});
 it('keeps the incoming tier order for ties',()=>{expect(rankFoodResults([chicken,rice,egg],{}).map(f=>f.id)).toEqual([chicken.id,rice.id,egg.id]);});
 it('counts only foods newly added in a save, duplicates included',()=>{expect(newlyAddedFoodIds(['a','a','b','c'],['a','c'])).toEqual(['a','b']);});
});
describe('default household portion',()=>{
 it('starts broccoli on 1 cup and keeps the stalk sizes as short chips',()=>{expect(defaultPortion({...broccoli,portions:foodPortions(broccoli)},'en-GB').unit).toBe('cup');expect(foodPortions(broccoli).map(p=>p.unit)).toEqual(expect.arrayContaining(['stalk, large','stalk, medium','stalk, small','spear']));});
 it.each([['egg',egg,'large'],['chicken breast',chicken,'piece'],['bread',bread,'slice'],['apple',apple,'medium'],['rice',rice,'cup'],['broccoli',broccoli,'cup']] as const)('starts %s on 1 %s-style whole item or household measure',(_,f,unit)=>{expect(defaultPortion({...f,portions:foodPortions(f)},'en-GB').unit).toBe(unit);expect(foodPortions(f)[0]?.unit).toBe(unit);});
 it('uses grams when a food has no household portion',()=>{expect(defaultPortion({...puffed,portions:foodPortions(puffed)},'en-GB').unit).toBe('g');});
});
