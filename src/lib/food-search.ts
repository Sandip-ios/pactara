import type { Food } from './meals';
/** Grammatical normalization, not query-specific food exceptions. */
export function foodWords(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(w => w.endsWith('ies') ? `${w.slice(0,-3)}y` : w.endsWith('s') && !/(ss|us|oats)$/.test(w) ? w.slice(0,-1) : w);
}
export function foodRelevance(description: string, query: string, brand = '') {
  description=description.replace(/\s*\(includes [^)]*\)/gi,'');
  const words=foodWords(query), parts=description.split(',');
  const head=foodWords(parts[0]??'');
  const all=foodWords(`${description} ${brand}`);
  const brandWords=foodWords(brand);
  const brandAsked=brandWords.some(w=>words.includes(w)&&!head.includes(w));
  const match=words.every(w=>all.includes(w));
  const foodHead=/^(fish|cereals|fruits|vegetables|poultry)$/i.test(parts[0]?.trim()??'')?foodWords(parts[1]??''):head;
  const primary=words.every(w=>foodHead.includes(w)) || (foodHead.some(w=>words.includes(w)) && words.every(w=>foodWords(parts.slice(0,4).join(' ')).includes(w)));
  const extraHead=foodHead.filter(w=>!words.includes(w)&&!['white','brown','wild','black','red','whole','yolk','breast','thigh','fillet','atlantic','pink','sockeye','chinook','coho','greek','rolled','steel','cut'].includes(w)).length;
  const niche=/babyfood|baby toddler|infant|alaska native|restaurant|fast food|\b(?:dry )?mix(?:es)?\b/i.test(description);
  const asksNiche=words.some(w=>/^(babyfood|infant|alaska|native|restaurant|mix)$/.test(w));
  const simplePreparation=description.replace(/\b(?:cooked|prepared|made) with (?:water|milk)\b/gi,'cooked');
  const mixed=/\b(with|cereal|bread|sauce|dish|salad|sandwich|pizza|soup|mixture|cookie|cookies|shake|nuggets|tenders|roll|deli|cracker|crackers|noodle|noodles|bran|cake|cakes|chip|chips|nectar|pudding|split|yogurt)\b/i.test(simplePreparation);
  const processed=/\b(dried|dehydrated|powder|flour|puffed|frozen|condensed)\b/i.test(description)&&!words.some(w=>/^(dried|dehydrated|powder|flour|puffed|frozen|condensed)$/.test(w));
  const basic=new Set(foodWords('plain whole white brown yolk wheat multigrain mulitgrain commercial commercially prepared toasted raw cooked boiled scrambled fried poached roasted grilled baked braised stewed fluid lowfat nonfat low fat reduced fat free skim milkfat regular and quick instant grain long medium short steel cut rolled old fashioned grade a large small boneless skinless meat only broiler fryers unenriched enriched fresh dry heat water nfs'));
  const modifiers=foodWords(parts.slice(1).join(' ')).filter(w=>!words.includes(w)&&!basic.has(w)&&!/^\d+$/.test(w)).length;
  return {match,brandAsked,score:(brandAsked?-100:0)+(primary?0:20)+extraHead*2+modifiers*.25+(niche&&!asksNiche?40:0)+(mixed&&!words.some(w=>/^(cereal|bread|sauce|salad|sandwich|pizza|soup|cookie|shake|nugget|tender|cracker|noodle|bran|cake|chip|nectar|pudding|yogurt)$/.test(w))?10:0)+(processed?8:0)};
}
/** Local hits retain their positions; remote data refreshes matching IDs and appends new IDs. */
export function mergeFoodSearch(local: Food[], remote: Food[]) {
  const updated=new Map(remote.map(f=>[f.id,f]));
  const ids=new Set(local.map(f=>f.id));
  const merged=[...local.map(f=>updated.get(f.id)??f),...remote.filter(f=>!ids.has(f.id))];
  const names=new Set<string>();
  return merged.filter(f=>{const name=f.name.toLowerCase();if(names.has(name))return false;names.add(name);return true;});
}