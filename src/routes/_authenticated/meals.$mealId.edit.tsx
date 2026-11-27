import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAppPrefs,useAppVersion } from '@/hooks/use-app-version';
import { NewMealBuilder } from '@/components/redesign/NewMealBuilder';
export const Route=createFileRoute('/_authenticated/meals/$mealId/edit')({head:()=>({meta:[{title:'Edit meal · Pactara'},{name:'description',content:'Edit your own copy of a meal.'},{property:'og:title',content:'Edit meal · Pactara'},{property:'og:description',content:'Edit your own copy of a meal.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:()=>{const v=useAppVersion();const p=useAppPrefs();const {mealId}=Route.useParams();return p.isLoading?null:v==='new'?<NewMealBuilder mealId={mealId}/>:<Navigate to="/profile"/>;}});
