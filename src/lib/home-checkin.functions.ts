import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import type {WorkoutDetail} from './lifts.functions';
export type HomeCheckInSocial={cheered:boolean;cheers:number;saved:boolean;comments:{id:string;userId:string;name:string;body:string;at:string}[];workoutDetail:WorkoutDetail|null};
export const getHomeCheckInSocial=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(data=>z.object({id:z.string().uuid()}).parse(data)).handler(async({context,data})=>{
 const {data:result,error}=await context.supabase.rpc('get_home_checkin_social',{_id:data.id});
 if(error)throw new Error('Check-in unavailable');
 return result as unknown as HomeCheckInSocial;
});
export const homeCheckInAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(data=>z.object({id:z.string().uuid(),action:z.enum(['cheer','comment','save','unsave']),body:z.string().max(1000).optional()}).parse(data)).handler(async({context,data})=>{
 const {error}=await context.supabase.rpc('home_checkin_action',{_id:data.id,_action:data.action,...(data.body?{_body:data.body}:{})});
 if(error)throw new Error('Could not update check-in');
 return {ok:true};
});
