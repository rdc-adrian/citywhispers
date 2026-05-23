const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname

// Must be set before Metro transforms so babel-preset-expo can inline it
if (!process.env.EXPO_ROUTER_APP_ROOT) {
  process.env.EXPO_ROUTER_APP_ROOT = path.join(projectRoot, 'app')
}
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Only watch mobile and packages — never the API
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(workspaceRoot, 'packages'),
]

config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Force all packages to use the mobile workspace's react/react-native regardless of hoisting.
// Without this, packages hoisted to root node_modules pick up root's react instance,
// causing "invalid hook call" due to two React copies in the bundle.
const PINNED = [
  'react',
  'react-dom',
  'react-native',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-gesture-handler',
  'react-native-reanimated',
]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = PINNED.find((p) => moduleName === p || moduleName.startsWith(p + '/'))
  if (pkg) {
    const suffix = moduleName.slice(pkg.length) // e.g. '' or '/jsx-runtime'
    const base = path.resolve(projectRoot, 'node_modules', pkg)
    return context.resolveRequest(
      { ...context, originModulePath: path.join(base, 'package.json') },
      moduleName,
      platform,
    )
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config