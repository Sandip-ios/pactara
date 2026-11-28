import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHideBottomTabs } from '@/hooks/use-hide-bottom-tabs';
import { useOpenAtTop } from '@/lib/use-open-at-top';
import { useMealBuilderNavigation } from '@/lib/use-meal-builder-navigation';
import { getMeal, getMeals, saveMeal } from '@/lib/meals.functions';
import { MEAL_TYPES, foodAmount, foodNutrition, effectiveTotals, missingCalorieWarning, totalsWarning, changedFoodAfterRemoval, changedFoodAfterChange, type Food, type MealFood, type Nutrition, type MealType } from '@/lib/meals';
import { setDraft } from '@/lib/post-draft';
import { NewConfirm } from './NewConfirm';
import { MealFoodSearch, MealAmountSheet } from './MealFoodSheets';
import { MealNutrition } from './MealNutrition';
import { newToast } from './new-toast';
import './meals.css';
export function NewMealBuilder({mealId,forPost=false}:{mealId?:string;forPost?:boolean}) {
 useHideBottomTabs(true,false);
 const access=useQuery({queryKey:['my-meals'],queryFn:()=>getMeals({data:{target:null}})});
 const query=useQuery({queryKey:['meal',mealId],queryFn:()=>mealId?getMeal({data:{id:mealId}}):Promise.resolve(null),enabled:!!mealId});
 if(!access.data||mealId&&query.isPending)return <div className="redesign-step3 p6-page" aria-label="Loading meal"/>;
 if(mealId&&!query.data)return <div className="redesign-step3 p6-page p-6">This meal isn't available</div>;
 return <MealBuilder key={mealId??'new'} initial={query.data??null} under18={access.data.under18} forPost={forPost}/>;
}
function MealBuilder({initial,under18,forPost}:{initial:Awaited<ReturnType<typeof getMeal>>;under18:boolean;forPost:boolean}) {
 const {closeMealBuilder,returnHomeAfterSave}=useMealBuilderNavigation();
 const navigate=useNavigate();const qc=useQueryClient();const save=useServerFn(saveMeal);const scroll=useOpenAtTop();
 const [name,setName]=useState(initial?.name??'');const [type,setType]=useState<MealType|null>(initial?.snapshot.type??null);const [foods,setFoods]=useState<MealFood[]>(initial?.snapshot.foods??[]);const [override,setOverride]=useState<Nutrition|null>(initial?.snapshot.override??null);const [changedFood,setChangedFood]=useState<string|null>(null);
 const [search,setSearch]=useState(false);const [picked,setPicked]=useState<Food|null>(null);const [editing,setEditing]=useState<MealFood|null>(null);const [noteKey,setNoteKey]=useState<string|null>(null);const [discard,setDiscard]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 const initialSignature=useRef(JSON.stringify({name:initial?.name??'',type:initial?.snapshot.type??null,foods:initial?.snapshot.foods??[],override:initial?.snapshot.override??null}));
 const dirty=JSON.stringify({name,type,foods,override})!==initialSignature.current;const totals=useMemo(()=>effectiveTotals(foods,override),[foods,override]);
 const leave=()=>closeMealBuilder(forPost);
 const afterSave=()=>void navigate({to:forPost?'/post/compose':'/profile',...(forPost?{}:{search:{tab:'meals'}})});
 const changeFoods=(next:MealFood[],change:{kind:'add'|'reorder'|'edit';name?:string})=>{setFoods(next);if(override)setChangedFood(c=>changedFoodAfterChange(c,change));};
 const submit=async()=>{if(!name.trim()||!foods.length||busy)return;setBusy(true);setError(null);try{const result=await save({data:{id:initial?.id??null,name,type,foods:foods.map(f=>({key:f.key,foodId:f.foodId,amount:f.amount,unit:f.unit,note:f.note})),override}});await qc.invalidateQueries({queryKey:['my-meals']});void qc.invalidateQueries({queryKey:['profile-meals']});void qc.invalidateQueries({queryKey:['meal']});if(returnHomeAfterSave(forPost,()=>newToast(`${name.trim()} saved`)))return;if(forPost){setDraft({mealId:result.id});newToast('Saved to your meals');}else newToast(`${name.trim()} saved`);afterSave();}catch{setError("Couldn't save the meal. Try again.");setBusy(false);}};
 const pick=(food:Food)=>{setSearch(false);setPicked(food);setEditing(null);};
 const editAmount=(f:MealFood)=>{setEditing(f);setPicked({id:f.foodId,name:f.name,portions:f.portions??[{unit:f.unit,grams:f.grams/f.amount},...(f.unit==='g'?[]:[{unit:'g',grams:1}]),...(f.unit==='oz'?[]:[{unit:'oz',grams:28.349523125}])],yours:f.foodId.startsWith('own:'),...(f.nutrition?{nutrition:f.nutrition}:{})});};
 return <div ref={scroll} className="redesign-step3 p6-page" data-scroll-root><header className="p6-header"><Button variant="ghost" className="p6-link p6-muted justify-start" onClick={()=>dirty?setDiscard(true):leave()}>Cancel</Button><h1>{initial?'Edit meal':'New meal'}</h1><Button variant="ghost" className="p6-link justify-end" disabled={!name.trim()||!foods.length||busy} onClick={()=>void submit()}>Save</Button></header><div className="p6-builder">
 {forPost&&<p className="p6-source-note">For your post. Save adds it to your meals and attaches it.</p>}{initial?.fromName&&<p className="p6-source-note">This is your copy of {initial.fromName}'s meal. Your changes won't touch theirs, and “from {initial.fromName}” comes off once you change the foods.</p>}
 <section className="p6-block"><label htmlFor="meal-name" className="p6-label">Name</label><input id="meal-name" className="p6-input" placeholder="Post-workout bowl" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/><label className="p6-label mt-4">Type</label><div className="p6-types">{MEAL_TYPES.map(t=><Button key={t} variant="ghost" className={`p6-chip${t===type?' on':''}`} onClick={()=>setType(t===type?null:t)}>{t}</Button>)}</div></section>
 {!under18&&<section className="p6-block"><div className="flex items-center justify-between"><h2>Calories and macros</h2>{foods.length>0?<Button variant="ghost" className="p6-link h-auto text-[13px]" onClick={()=>{setOverride(override?null:{...totals});setChangedFood(null);}}>{override?'Reset':'Edit'}</Button>:<span className="text-[11px] p6-muted">Fills in as you add foods</span>}</div><MealNutrition totals={totals} edited={!!override} {...(override?{onChange:setOverride}:{})}/><p className={`p6-note${missingCalorieWarning(foods)||totalsWarning(override,changedFood)?' p6-warning':''}`}>{totalsWarning(override,changedFood)||missingCalorieWarning(foods)|| (override?"You changed these, so they won't update from your foods. Reset to go back.":'About. Worked out from your foods.')}</p></section>}
 <h2 className="p6-food-heading">FOODS{foods.length>0&&` · ${foods.length}`}</h2>{foods.length>0&&<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(over&&active.id!==over.id){const next=arrayMove(foods,foods.findIndex(f=>f.key===active.id),foods.findIndex(f=>f.key===over.id));changeFoods(next,{kind:'reorder'});}}}><SortableContext items={foods.map(f=>f.key)} strategy={verticalListSortingStrategy}><div className="p6-food-list">{foods.map(f=><SortableFood key={f.key} food={f} under18={under18} noteOpen={noteKey===f.key} onNoteOpen={()=>setNoteKey(f.key)} onNote={note=>setFoods(foods.map(x=>x.key===f.key?{...x,note}:x))} onAmount={()=>editAmount(f)} onRemove={()=>{const at=foods.findIndex(x=>x.key===f.key);setFoods(foods.filter(x=>x.key!==f.key));setChangedFood(c=>changedFoodAfterRemoval(c,f.name));newToast(`Removed ${f.name}`,{undo:()=>setFoods(current=>current.some(x=>x.key===f.key)?current:[...current.slice(0,at),f,...current.slice(at)])});}}/>)}</div></SortableContext></DndContext>}
 <Button variant="ghost" className={`p6-add-food${foods.length?'':' !mt-0'}`} disabled={foods.length>=30} onClick={()=>setSearch(true)}><Plus size={20}/>Add food</Button><p className="p6-help">{!foods.length?'Save turns on once it has a name and one food.':"Hold ⠿ and drag to change the order. Your notes show up for everyone who adds this meal."}</p>{error&&<p role="alert" className="p6-warning text-[14px]">{error}</p>}
 </div><MealFoodSearch open={search} onClose={()=>setSearch(false)} onPick={pick} foods={foods}/>{picked&&<MealAmountSheet key={editing?.key??picked.id} food={picked} {...(editing?{existing:editing}:{onBack:()=>{setPicked(null);setSearch(true);}})} foods={foods} under18={under18} onClose={()=>{setPicked(null);setEditing(null);}} onDone={f=>{changeFoods(editing?foods.map(x=>x.key===editing.key?f:x):[...foods,f],editing?{kind:'edit'}:{kind:'add',name:f.name});setPicked(null);setEditing(null);}}/>}
 <NewConfirm open={discard} onOpenChange={setDiscard} title="Discard this meal?" subtitle={forPost?"You'll go back to your post. Nothing is attached.":"Your changes won't be saved."} action="Discard" cancelLabel="Keep editing" busy={false} error={null} onConfirm={leave}/></div>;
}
function SortableFood({food,under18,noteOpen,onNoteOpen,onNote,onAmount,onRemove}:{food:MealFood;under18:boolean;noteOpen:boolean;onNoteOpen:()=>void;onNote:(v:string)=>void;onAmount:()=>void;onRemove:()=>void}){
 const {attributes,listeners,setNodeRef,transform,transition}=useSortable({id:food.key});const calories=food.nutrition?foodNutrition(food.nutrition,food.grams).calories:null;
 return <div ref={setNodeRef} className="p6-food-row" style={{transform:CSS.Transform.toString(transform),transition}}><Button variant="ghost" className="p6-icon p6-drag" {...attributes} {...listeners} aria-label={`Reorder ${food.name}`}><GripVertical size={16}/></Button><div className="p6-food-body"><div className="flex gap-2"><div className="min-w-0 flex-1"><h3 className="p6-food-name">{food.name}</h3>{!under18&&<p className={`p6-food-sub${calories===null?' p6-warning':''}`}>{calories===null?'No calories':`${Math.round(calories)} cal`}</p>}</div><div className="p6-food-actions"><Button variant="ghost" className="p6-dose" onClick={onAmount}>{foodAmount(food.amount,food.unit)}</Button><Button variant="ghost" className="p6-icon" aria-label={`Remove ${food.name}`} onClick={onRemove}><Trash2 size={18}/></Button></div></div>{noteOpen||food.note?<textarea className="p6-food-note" aria-label={`Note for ${food.name}`} maxLength={100} rows={1} value={food.note} onChange={e=>onNote(e.target.value)}/>:<Button variant="ghost" className="p6-link justify-start h-auto text-[13px] mt-2" onClick={onNoteOpen}>+ Add a note</Button>}</div></div>;
}
