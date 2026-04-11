import { v } from "convex/values";
import { query } from "../_generated/server";

export const getNearebyDrivers = query({
    args: {
        lattitude: v.number(),
        longitude: v.number(),
    },
    handler: (ctx, args) => {
        return [
        {
            id: "1",
            name: "Makhzoon",
            lattitude: 34.08153336242906,
            longitude: 74.79880051027877,
            // lattitude: args.lattitude + 0.001,
            // longitude: args.longitude + 0.002,
        },
        {
            id: "2",
            name: "Zehran",
            lattitude: 34.07971521201548,
            longitude: 74.79969480638518,
            // lattitude: args.lattitude + 0.002,
            // longitude: args.longitude + 0.002,
        },
        {
            id: "3",
            name: "Hanan",
            lattitude: 34.081396745098566,
            longitude: 74.80101681528942,
            // lattitude: args.lattitude + 0.002,
            // longitude: args.longitude + 0.002,
        },
        {
            id: "4",
            name: "Mariya",
            lattitude: 34.085155385039855,
            longitude: 74.7964733235308,
            // lattitude: args.lattitude + 0.002,
            // longitude: args.longitude + 0.002,
        },
        {
            id: "5",
            name: "Manzoor",
            lattitude: 34.077803073925104,
            longitude: 74.80133243696906,
            // lattitude: args.lattitude + 0.002,
            // longitude: args.longitude + 0.002,
        },
        {
            id: "6",
            name: "Zehran",
            lattitude: 34.076991624791034,
            longitude: 74.79847859230266,
            // lattitude: args.lattitude + 0.002,
            // longitude: args.longitude + 0.002,
        },
    ];
    }
})