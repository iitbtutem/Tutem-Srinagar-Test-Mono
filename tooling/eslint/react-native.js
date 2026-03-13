import baseConfig from "./base.js";
import reactNativePlugin from "@react-native-community/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    plugins: {
      "@react-native-community": reactNativePlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactNativePlugin.configs.all.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
