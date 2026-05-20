const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Monorepo root
const workspaceRoot = path.resolve(__dirname, '../..');

// Watch all workspace packages so Metro picks up changes in @tutem/ui
config.watchFolders = [
  ...(config.watchFolders || []),
  workspaceRoot,
];

// Resolve node_modules from both the app and the workspace root
config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/**
 * CRITICAL: Force Metro to resolve these modules from the APP's node_modules.
 *
 * Without this, when Metro follows the symlink into packages/ui and encounters
 * an import like `import Animated from 'react-native-reanimated'`, it resolves
 * it relative to packages/ui — which has no node_modules (they're peerDeps).
 * That creates either a "module not found" crash or, worse, a second React/RN
 * instance which breaks contexts, portals, and gesture handlers.
 *
 * extraNodeModules pins every native/react module to exactly one copy: the one
 * inside this app.
 */
config.resolver.extraNodeModules = {
  // React singletons
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),

  // Animation / gesture (must be single instances for Reanimated worklets)
  'react-native-reanimated': path.resolve(__dirname, 'node_modules/react-native-reanimated'),
  'react-native-gesture-handler': path.resolve(__dirname, 'node_modules/react-native-gesture-handler'),

  // Screens (FullWindowOverlay used in Select/DropdownMenu)
  'react-native-screens': path.resolve(__dirname, 'node_modules/react-native-screens'),

  // NativeWind (cssInterop must come from the app that has Babel configured)
  'nativewind': path.resolve(__dirname, 'node_modules/nativewind'),

  // RNR primitives (React-context-bearing — must be singletons)
  '@rn-primitives/avatar': path.resolve(__dirname, 'node_modules/@rn-primitives/avatar'),
  '@rn-primitives/checkbox': path.resolve(__dirname, 'node_modules/@rn-primitives/checkbox'),
  '@rn-primitives/dialog': path.resolve(__dirname, 'node_modules/@rn-primitives/dialog'),
  '@rn-primitives/dropdown-menu': path.resolve(__dirname, 'node_modules/@rn-primitives/dropdown-menu'),
  '@rn-primitives/portal': path.resolve(__dirname, 'node_modules/@rn-primitives/portal'),
  '@rn-primitives/select': path.resolve(__dirname, 'node_modules/@rn-primitives/select'),
  '@rn-primitives/separator': path.resolve(__dirname, 'node_modules/@rn-primitives/separator'),
  '@rn-primitives/slot': path.resolve(__dirname, 'node_modules/@rn-primitives/slot'),
  '@rn-primitives/switch': path.resolve(__dirname, 'node_modules/@rn-primitives/switch'),
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
