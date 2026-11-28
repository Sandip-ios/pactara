import { describe, expect, it } from "vitest";
import {
  mealMacroLine,
  postWorkoutSummary,
  postExerciseDose,
  postSectionCanSave,
  sectionPreview,
} from "../post-sections";
import { attachmentWorkoutView, editWorkoutChoice } from "../post-edit-attachment";
import type { PostWorkout } from "../social-post-types";
import { fullMealLine, type MealSnapshot } from "../meals";
describe("full post sections", () => {
  it("edit uses the feed snapshot for six exercises, fifteen sets and 83 minutes, not a changed saved template", () => {
    const workout: PostWorkout = { source: "saved", title: "Leg day", minutes: 83, sets: 15, prCount: 0, moves: Array.from({length:6}, (_,i)=>({exerciseId:`e${i}`,name:`Move ${i}`,imageStart:null,logType:"reps",sets:Array.from({length:i<3?3:2},()=>({reps:10,seconds:null,isPr:false}))})) };
    const choice=editWorkoutChoice({workout,workoutId:"template",workoutSessionId:null});
    expect(attachmentWorkoutView(choice,workout)?.line).toBe(postWorkoutSummary(workout));
    expect(attachmentWorkoutView(choice,workout)).toEqual({title:"Leg day",line:"6 exercises · 15 sets · 83 min"});
  });
  it("uses singular exercise and set in attachment summaries",()=>{
    expect(attachmentWorkoutView({source:"caption",moves:[{exerciseId:"e",name:"Squat",imageStart:null,sets:1,reps:10}]},null)?.line).toBe("1 exercise · 1 set");
  });
  it("meal edits use posted totals rather than recalculating foods",()=>{
    const meal:MealSnapshot={title:"Lunch",type:"Lunch",foods:[],items:[{name:"Rice",amount:"1 cup"},{name:"Chicken",amount:"1 serving"}],calories:1,totals:{calories:640,protein:62,carbs:70,fat:12}};
    expect(fullMealLine(meal)).toBe("About 640 cal · 62 g protein · 70 g carbs · 12 g fat");
  });
  it("shows three of four rows and exposes the full count", () =>
    expect(sectionPreview(["a", "b", "c", "d"])).toEqual({
      rows: ["a", "b", "c"],
      more: true,
      total: 4,
    }));
  it("does not show See all at three rows", () =>
    expect(sectionPreview([1, 2, 3]).more).toBe(false));
  it("own posts never offer an attachment save", () => {
    expect(postSectionCanSave(true)).toBe(false);
    expect(postSectionCanSave(false)).toBe(true);
  });
  it("formats sets and reps without weights", () =>
    expect(
      postExerciseDose({
        exerciseId: "e",
        name: "Press",
        imageStart: null,
        logType: "reps",
        sets: Array.from({ length: 3 }, () => ({ reps: 12, seconds: null, isPr: false })),
      }),
    ).toBe("3 × 12"));
  it("formats timed exercises", () =>
    expect(
      postExerciseDose({
        exerciseId: "e",
        name: "Plank",
        imageStart: null,
        logType: "timed",
        sets: [{ reps: null, seconds: 30, isPr: false }],
      }),
    ).toBe("1 × 30 sec"));
  it("formats approximate meal macros", () =>
    expect(mealMacroLine({ title: "Lunch", items: [], calories: 640, protein: 62 })).toBe(
      "About 640 cal · 62 g protein",
    ));
});
