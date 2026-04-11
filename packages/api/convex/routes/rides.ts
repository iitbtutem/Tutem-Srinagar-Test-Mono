import { v } from "convex/values";
import { query } from "../_generated/server";

export const getNearebyDrivers = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: (ctx, args) => {
    // return [];
    return [
      {
        id: "1",
        name: "Makhzoon",
        latitude: 34.08153336242906,
        longitude: 74.79880051027877,
        // latitude: args.latitude + 0.001,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "2",
        name: "Zehran",
        latitude: 34.07971521201548,
        longitude: 74.79969480638518,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "3",
        name: "Hanan",
        latitude: 34.081396745098566,
        longitude: 74.80101681528942,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "4",
        name: "Mariya",
        latitude: 34.085155385039855,
        longitude: 74.7964733235308,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "5",
        name: "Manzoor",
        latitude: 34.077803073925104,
        longitude: 74.80133243696906,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "6",
        name: "Zehran",
        latitude: 34.076991624791034,
        longitude: 74.79847859230266,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "7",
        name: "Arsalaan",
        latitude: 34.076991624791034,
        longitude: 74.79847859230266,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "8",
        name: "Kaheel",
        latitude: 34.076991624791034,
        longitude: 74.79847859230266,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "9",
        name: "Muneeb",
        latitude: 34.076991624791034,
        longitude: 74.79847859230266,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
      {
        id: "10",
        name: "Saika",
        latitude: 34.076991624791034,
        longitude: 74.79847859230266,
        // latitude: args.latitude + 0.002,
        // longitude: args.longitude + 0.002,
      },
    ];
  },
});
