const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Watch all files within the monorepo root
const workspaceRoot = path.resolve(__dirname, '../..');
config.watchFolders = [workspaceRoot];
// Resolve node modules from both project and workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
