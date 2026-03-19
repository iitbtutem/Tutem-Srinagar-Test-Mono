import { query } from "../_generated/server";

export const getAllOrganizations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organization").collect();
  },
});