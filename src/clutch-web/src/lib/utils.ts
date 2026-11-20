import { createCn } from "cn/config"

const radii = ["chip", "control", "card", "panel"]

export const cn = createCn({
  extend: {
    classGroups: {
      rounded: [{ rounded: radii }],
      "rounded-t": [{ "rounded-t": radii }],
      "rounded-r": [{ "rounded-r": radii }],
      "rounded-b": [{ "rounded-b": radii }],
      "rounded-l": [{ "rounded-l": radii }],
    },
  },
})
